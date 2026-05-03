/* global state */
const SERVINGS = 4;
let recipes = [];
const selected = new Set();
let filterDay  = 'all';
let toastTimer = null;

/* ── Boot ────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch('recipes.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    recipes = await res.json();
  } catch (err) {
    document.getElementById('recipes-grid').innerHTML =
      `<div class="no-results">
        <div class="no-results-icon">⚠️</div>
        <p>Kunne ikke indlæse recipes.json.<br>
        <strong>Kør mappen via en HTTP-server</strong> — fx:<br>
        <code>npx serve .</code> eller brug VS Code Live Server.</p>
      </div>`;
    return;
  }

  renderRecipes();
  wireFilters();
  wireModal();
  wireSidebar();
});

/* ── Filtering ───────────────────────────────────────────── */
function wireFilters() {

  document.getElementById('day-filter').addEventListener('change', e => {
    filterDay = e.target.value;
    renderRecipes();
  });
}

function filteredRecipes() {
  return recipes.filter(r => {
    if (filterDay !== 'all' && r.suggestedDay !== filterDay) return false;
    return true;
  });
}

/* ── Recipe Cards ────────────────────────────────────────── */
function renderRecipes() {
  const grid = document.getElementById('recipes-grid');
  const list = filteredRecipes();

  if (!list.length) {
    grid.innerHTML = `<div class="no-results">
      <div class="no-results-icon">🔍</div>
      <p>Ingen opskrifter matcher filteret.</p>
    </div>`;
    return;
  }

  grid.innerHTML = list.map(r => cardHTML(r)).join('');

  grid.querySelectorAll('.recipe-card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('.card-check')) {
        toggleSelected(Number(card.dataset.id));
      } else {
        openModal(Number(card.dataset.id));
      }
    });
  });
}

function cardHTML(r) {
  const sel   = selected.has(r.id);
  const totalTime = parseMinutes(r.prepTime) + parseMinutes(r.cookTime);

  return `
    <article class="recipe-card ${sel ? 'selected' : ''}" data-id="${r.id}" tabindex="0"
             role="button" aria-pressed="${sel}"
             aria-label="${r.name}${sel ? ' (valgt)' : ''}">
      <div class="card-check" aria-hidden="true">${sel ? '✓' : ''}</div>
      <div class="card-img-wrap">
        <img src="${r.picture}" alt="${r.name}"
             onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" />
        <div class="card-emoji-fallback">${r.emoji}</div>
      </div>
      <div class="card-body">
        <div class="card-header">
          <h3 class="card-name">${r.name}</h3>
        </div>
        <div class="card-meta">
          <span class="meta-item"><span class="icon">⏱</span>${totalTime} min</span>
          <span class="meta-item"><span class="icon">🍽</span>${SERVINGS} pers.</span>
          <span class="meta-item"><span class="icon">💪</span>${r.proteinPerServing} protein</span>
        </div>
        <div class="card-tags">
          ${r.tags.map(t => `<span class="tag">${t}</span>`).join('')}
        </div>
        <div class="card-day">
          <span class="day-dot"></span>${r.suggestedDay}
        </div>
      </div>
    </article>`;
}

function parseMinutes(str) {
  const m = str.match(/\d+/);
  return m ? Number(m[0]) : 0;
}

/* ── Selection ───────────────────────────────────────────── */
function toggleSelected(id) {
  if (selected.has(id)) {
    selected.delete(id);
  } else {
    selected.add(id);
  }
  updateCardState(id);
  renderShoppingList();
  updateClearBtn();
}

function updateCardState(id) {
  const card = document.querySelector(`.recipe-card[data-id="${id}"]`);
  if (!card) return;
  const sel = selected.has(id);
  card.classList.toggle('selected', sel);
  card.setAttribute('aria-pressed', String(sel));
  const check = card.querySelector('.card-check');
  check.textContent = sel ? '✓' : '';
}

function updateClearBtn() {
  const btn = document.getElementById('clear-btn');
  btn.hidden = selected.size === 0;
}

/* ── Shopping List ───────────────────────────────────────── */
function renderShoppingList() {
  const content = document.getElementById('shopping-content');
  const actions = document.getElementById('sidebar-actions');
  const countBadge = document.getElementById('selected-count');

  countBadge.textContent = selected.size;

  if (selected.size === 0) {
    content.className = 'shopping-empty';
    content.innerHTML = `<span class="empty-icon">🛒</span><p>Vælg retter for at bygge<br />din indkøbsliste</p>`;
    actions.hidden = true;
    return;
  }

  const selectedRecipes = recipes.filter(r => selected.has(r.id));
  content.className = '';

  content.innerHTML = selectedRecipes.map((r, i) => {
    const checkboxes = r.shoppingList.map((item, j) => {
      const checkId = `item-${r.id}-${j}`;
      return `<div class="shop-item" id="row-${checkId}">
        <input type="checkbox" id="${checkId}" />
        <label for="${checkId}">${item}</label>
      </div>`;
    }).join('');

    return `<div class="shop-recipe-group">
      <div class="shop-group-header">
        <span class="shop-group-name">${r.emoji} ${r.name}</span>
        <span class="shop-group-day">${r.suggestedDay}</span>
      </div>
      ${checkboxes}
    </div>`;
  }).join('<hr style="border:none;border-top:1px solid var(--border);margin:12px 0">');

  /* checkbox → strikethrough */
  content.querySelectorAll('.shop-item input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      cb.closest('.shop-item').classList.toggle('checked', cb.checked);
    });
  });

  actions.hidden = false;
}

/* ── Sidebar action buttons ──────────────────────────────── */
function wireSidebar() {
  document.getElementById('clear-btn').addEventListener('click', () => {
    selected.forEach(id => {
      selected.delete(id);
      updateCardState(id);
    });
    renderShoppingList();
    updateClearBtn();
  });

  document.getElementById('copy-list-btn').addEventListener('click', () => {
    const selectedRecipes = recipes.filter(r => selected.has(r.id));
    const text = selectedRecipes.map(r =>
      `## ${r.name} (${r.suggestedDay})\n` +
      r.shoppingList.map(i => `- ${i}`).join('\n')
    ).join('\n\n');
    copyToClipboard(text, 'Indkøbsliste kopiéret!');
  });

  document.getElementById('copy-plan-btn').addEventListener('click', () => {
    const selectedRecipes = recipes
      .filter(r => selected.has(r.id))
      .sort((a, b) => dayOrder(a.suggestedDay) - dayOrder(b.suggestedDay));
    const text = selectedRecipes.map(r => r.weeklyPlanEntry).join('\n');
    copyToClipboard(text, 'Madplan kopiéret!');
  });
}

function dayOrder(day) {
  return ['Mandag','Tirsdag','Onsdag','Torsdag','Fredag','Lørdag','Søndag'].indexOf(day);
}

/* ── Modal ───────────────────────────────────────────────── */
function wireModal() {
  const overlay = document.getElementById('modal-overlay');
  document.getElementById('modal-close').addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
}

function openModal(id) {
  const r = recipes.find(r => r.id === id);
  if (!r) return;

  const totalTime = parseMinutes(r.prepTime) + parseMinutes(r.cookTime);
  const sel = selected.has(id);

  const subsHTML = r.nonPescetarianIngredients.length
    ? `<div class="modal-section">
        <h3>🐟 Pescetariske erstatninger</h3>
        <ul class="sub-list">
          ${r.nonPescetarianIngredients.map(s =>
            `<li class="sub-item">
              <span class="orig">${s.original}</span>
              <span class="arrow">→</span>
              <span class="repl">${s.substitution}</span>
            </li>`
          ).join('')}
        </ul>
      </div>`
    : `<div class="modal-section">
        <h3>🐟 Pescetariske erstatninger</h3>
        <p style="font-size:.875rem;color:var(--text-muted)">Ingen erstatninger nødvendige — retten er allerede pescetarisk!</p>
      </div>`;

  document.getElementById('modal-body').innerHTML = `
    <div class="modal-img-wrap">
      <img src="${r.picture}" alt="${r.name}"
           onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" />
      <div class="modal-img-emoji">${r.emoji}</div>
    </div>
    <div class="modal-inner">
      <div class="modal-badges">
        ${r.tags.map(t => `<span class="tag">${t}</span>`).join('')}
      </div>
      <h2 id="modal-title">${r.name}</h2>
      <div class="modal-meta">
        <div class="modal-meta-item">
          <span class="meta-label">Dag</span>
          <span class="meta-value">${r.suggestedDay}</span>
        </div>
        <div class="modal-meta-item">
          <span class="meta-label">Forberedelse</span>
          <span class="meta-value">${r.prepTime}</span>
        </div>
        <div class="modal-meta-item">
          <span class="meta-label">Tilberedning</span>
          <span class="meta-value">${r.cookTime}</span>
        </div>
        <div class="modal-meta-item">
          <span class="meta-label">I alt</span>
          <span class="meta-value">${totalTime} min</span>
        </div>
        <div class="modal-meta-item">
          <span class="meta-label">Personer</span>
          <span class="meta-value">${SERVINGS}</span>
        </div>
        <div class="modal-meta-item">
          <span class="meta-label">Protein/pers.</span>
          <span class="meta-value">${r.proteinPerServing}</span>
        </div>
      </div>

      ${subsHTML}

      <div class="modal-section">
        <h3>🛒 Indkøbsliste</h3>
        <ul class="shop-list-modal">
          ${r.shoppingList.map(i => `<li>${i}</li>`).join('')}
        </ul>
      </div>

      <div class="modal-section">
        <h3>📦 Rester</h3>
        <div class="leftovers-box">${r.leftoversNote}</div>
      </div>

      ${r.source ? `<div class="modal-section">
        <h3>🔗 Originalopskrift</h3>
        <a class="source-link" href="${r.source}" target="_blank" rel="noopener noreferrer">${r.source}</a>
      </div>` : ''}

      <div class="modal-section">
        <h3>📋 Madplan-linje</h3>
        <div class="plan-entry-box">
          ${r.weeklyPlanEntry}
          <button class="plan-entry-copy" data-text="${escAttr(r.weeklyPlanEntry)}">Kopiér</button>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn ${sel ? 'btn-outline' : 'btn-primary'}" id="modal-select-btn" data-id="${r.id}">
        ${sel ? '✓ Fjern fra indkøbsliste' : '+ Føj til indkøbsliste'}
      </button>
    </div>`;

  /* plan entry copy button */
  document.querySelector('.plan-entry-copy').addEventListener('click', e => {
    copyToClipboard(e.currentTarget.dataset.text, 'Kopiéret!');
  });

  /* add/remove from modal */
  document.getElementById('modal-select-btn').addEventListener('click', e => {
    const btnId = Number(e.currentTarget.dataset.id);
    toggleSelected(btnId);
    const nowSel = selected.has(btnId);
    e.currentTarget.className = `btn ${nowSel ? 'btn-outline' : 'btn-primary'}`;
    e.currentTarget.textContent = nowSel ? '✓ Fjern fra indkøbsliste' : '+ Føj til indkøbsliste';
  });

  const overlay = document.getElementById('modal-overlay');
  overlay.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modal-overlay').hidden = true;
  document.body.style.overflow = '';
}

function escAttr(str) {
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ── Clipboard ───────────────────────────────────────────── */
function copyToClipboard(text, message = 'Copied!') {
  navigator.clipboard.writeText(text)
    .then(() => showToast(message))
    .catch(() => {
      /* fallback for older browsers / file:// */
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      showToast(message);
    });
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 2200);
}
