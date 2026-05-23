// ═══════════════════════════════════════════════════════════════
// TASKFLOW — Main Application
// Single-page app orchestrator
// ═══════════════════════════════════════════════════════════════

import { auth } from "./firebase-config.js";
import {
  registerWithEmail, loginWithEmail, loginWithGoogle,
  resetPassword, logout, onAuthChange, updateDisplayName, getAuthErrorMessage
} from "./auth/auth.service.js";
import {
  saveUserProfile, getUserProfile,
  createBoard, updateBoard, deleteBoard, onBoards, onBoard,
  createColumn, updateColumnName, deleteColumn,
  createCard, updateCard, deleteCard, moveCard, toggleCardComplete
} from "./services/db.service.js";
import { toast } from "./utils/toast.js";
import {
  $, $$, show, hide, toggle, getInitials,
  formatDate, isOverdue, isDueSoon,
  validateEmail, validatePassword, passwordStrength, strengthColor,
  setLoading, getPriorityMeta, showConfirm, escapeHtml, highlightText, truncate
} from "./utils/helpers.js";
import { initTheme, toggleTheme } from "./utils/theme.js";

// ═══════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════
const state = {
  user: null,
  boards: [],
  currentBoardId: null,
  currentBoard: null,
  taskModal: { mode: 'create', boardId: null, columnId: null, cardId: null, cardData: null },
  boardModal: { mode: 'create', boardId: null },
  unsubBoards: null,
  unsubBoard: null,
  selectedTagColor: '#6366f1',
  searchQuery: '',
  priorityFilter: '',
  dragState: { cardId: null, fromColumnId: null, cardData: null },
};

// ═══════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════
initTheme();

window.addEventListener('DOMContentLoaded', () => {
  setupAuthListeners();
  setupNavListeners();
  setupBoardModalListeners();
  setupTaskModalListeners();
  setupSearchListeners();
  setupProfileListeners();
  setupThemeListener();

  // Auth state watcher
  onAuthChange((user) => {
    hideLoader();
    if (user) {
      state.user = user;
      initDashboard();
    } else {
      state.user = null;
      showAuthView();
    }
  });
});

// ─── Loader ──────────────────────────────────────────────────
function hideLoader() {
  const loader = document.getElementById('app-loader');
  loader.classList.add('fade-out');
  setTimeout(() => hide(loader), 500);
  show(document.getElementById('app'));
}

// ═══════════════════════════════════════════════════════════════
// VIEW ROUTING
// ═══════════════════════════════════════════════════════════════
function showAuthView(page = 'login') {
  hide($('#dashboard-view'));
  show($('#auth-view'));
  showAuthPage(page);
}

function showAuthPage(page) {
  $$('#auth-view .auth-page').forEach(p => hide(p));
  show($(`#${page}-page`));
}

function initDashboard() {
  show($('#dashboard-view'));
  hide($('#auth-view'));
  updateUserUI();
  subscribeBoards();
  showPage('boards');
}

function showPage(name) {
  $$('.page').forEach(p => { p.classList.remove('active'); hide(p); });
  const page = $(`#${name}-page`);
  if (page) { show(page); page.classList.add('active'); }

  // Update nav
  $$('.nav-item[data-view]').forEach(item => {
    item.classList.toggle('active', item.dataset.view === name);
  });

  // Update breadcrumb
  const labels = { boards: 'Mis Boards', 'all-tasks': 'Todas las tareas' };
  if (labels[name]) {
    $('#breadcrumb').innerHTML = `<span>${labels[name]}</span>`;
  }

  // Filter visibility
  toggle($('#priority-filter-wrap'), name === 'all-tasks' || name === 'board');
}

// ═══════════════════════════════════════════════════════════════
// AUTH LISTENERS
// ═══════════════════════════════════════════════════════════════
function setupAuthListeners() {
  // Login form
  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFieldErrors('login');
    const email = $('#login-email').value.trim();
    const password = $('#login-password').value;
    if (!validateAuthFields('login', email, password)) return;

    const btn = $('#login-submit-btn');
    setLoading(btn, true);
    try {
      await loginWithEmail(email, password);
    } catch (err) {
      const msg = getAuthErrorMessage(err.code);
      if (msg) showFieldError('login-email-error', msg);
      btn.style.animation = 'shake 0.4s ease';
      setTimeout(() => { btn.style.animation = ''; }, 400);
    } finally {
      setLoading(btn, false);
    }
  });

  // Register form
  $('#register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFieldErrors('register');
    const name = $('#register-name').value.trim();
    const email = $('#register-email').value.trim();
    const password = $('#register-password').value;

    if (!name) { showFieldError('register-name-error', 'Ingresa tu nombre.'); return; }
    if (!validateAuthFields('register', email, password)) return;

    const btn = $('#register-submit-btn');
    setLoading(btn, true);
    try {
      const user = await registerWithEmail(name, email, password);
      await saveUserProfile(user.uid, { name, email, createdAt: Date.now() });
    } catch (err) {
      const msg = getAuthErrorMessage(err.code);
      if (msg) showFieldError('register-email-error', msg);
    } finally {
      setLoading(btn, false);
    }
  });

  // Forgot password form
  $('#forgot-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#forgot-email').value.trim();
    if (!validateEmail(email)) { showFieldError('forgot-email-error', 'Email no válido.'); return; }
    const btn = $('#forgot-submit-btn');
    setLoading(btn, true);
    try {
      await resetPassword(email);
      toast.success('Enlace enviado. Revisa tu bandeja de entrada.');
      showAuthPage('login');
    } catch (err) {
      showFieldError('forgot-email-error', getAuthErrorMessage(err.code));
    } finally {
      setLoading(btn, false);
    }
  });

  // Google login
  $$('#google-login-btn, #google-register-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        const user = await loginWithGoogle();
        // Save profile if new user
        const profile = await getUserProfile(user.uid);
        if (!profile) {
          await saveUserProfile(user.uid, { name: user.displayName || 'Usuario', email: user.email, createdAt: Date.now() });
        }
      } catch (err) {
        const msg = getAuthErrorMessage(err.code);
        if (msg) toast.error(msg);
      }
    });
  });

  // Navigation between auth pages
  $('#go-register').addEventListener('click', () => showAuthPage('register'));
  $('#go-login').addEventListener('click', () => showAuthPage('login'));
  $('#forgot-password-link').addEventListener('click', () => showAuthPage('forgot'));
  $('#go-login-from-forgot').addEventListener('click', () => showAuthPage('login'));

  // Password visibility toggles
  $$('.toggle-password').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = btn.previousElementSibling;
      input.type = input.type === 'password' ? 'text' : 'password';
    });
  });

  // Password strength indicator
  $('#register-password').addEventListener('input', (e) => {
    const strength = passwordStrength(e.target.value);
    const el = $('#password-strength');
    el.style.setProperty('--strength-width', `${(strength / 5) * 100}%`);
    el.style.setProperty('--strength-color', strengthColor(strength));
  });
}

function validateAuthFields(type, email, password) {
  let valid = true;
  if (!validateEmail(email)) {
    showFieldError(`${type}-email-error`, 'Ingresa un email válido.');
    valid = false;
  }
  if (!validatePassword(password)) {
    showFieldError(`${type}-password-error`, 'Mínimo 8 caracteres.');
    valid = false;
  }
  return valid;
}

function showFieldError(id, msg) {
  const el = $(`#${id}`);
  if (el) el.textContent = msg;
}

function clearFieldErrors(prefix) {
  $$(`[id^="${prefix}-"][id$="-error"]`).forEach(el => el.textContent = '');
}

// ═══════════════════════════════════════════════════════════════
// USER UI
// ═══════════════════════════════════════════════════════════════
function updateUserUI() {
  const user = state.user;
  if (!user) return;
  const initials = getInitials(user.displayName || user.email);
  $('#user-initials').textContent = initials;
  $('#dropdown-user-name').textContent = user.displayName || 'Usuario';
  $('#dropdown-user-email').textContent = user.email || '';
}

// ═══════════════════════════════════════════════════════════════
// NAV LISTENERS
// ═══════════════════════════════════════════════════════════════
function setupNavListeners() {
  // Hamburger
  $('#hamburger').addEventListener('click', openSidebar);
  $('#sidebar-close').addEventListener('click', closeSidebar);
  $('#sidebar-overlay').addEventListener('click', closeSidebar);

  // Nav items
  $$('.nav-item[data-view]').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      showPage(item.dataset.view);
      if (item.dataset.view === 'all-tasks') renderAllTasks();
      closeSidebar();
    });
  });

  // Logout
  $('#logout-btn').addEventListener('click', async () => {
    const ok = await showConfirm('Cerrar sesión', '¿Seguro que quieres salir?');
    if (!ok) return;
    if (state.unsubBoards) state.unsubBoards();
    if (state.unsubBoard) state.unsubBoard();
    await logout();
    toast.info('Sesión cerrada.');
  });

  // User menu toggle
  $('#user-avatar-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    $('#user-dropdown').classList.toggle('hidden');
  });
  document.addEventListener('click', () => hide($('#user-dropdown')));

  // Back to boards
  $('#back-to-boards').addEventListener('click', () => {
    if (state.unsubBoard) { state.unsubBoard(); state.unsubBoard = null; }
    state.currentBoardId = null;
    state.currentBoard = null;
    showPage('boards');
  });

  // Create board buttons
  $('#create-board-btn').addEventListener('click', () => openBoardModal());
  $('#create-board-sidebar-btn').addEventListener('click', () => openBoardModal());
  $('#create-first-board-btn').addEventListener('click', () => openBoardModal());

  // Add column
  $('#add-column-btn').addEventListener('click', () => promptAddColumn());

  // Edit/Delete board
  $('#edit-board-btn').addEventListener('click', () => {
    if (state.currentBoard) openBoardModal('edit', state.currentBoard);
  });
  $('#delete-board-btn').addEventListener('click', () => handleDeleteBoard());

  // Priority filter
  $('#priority-filter').addEventListener('change', (e) => {
    state.priorityFilter = e.target.value;
    if (state.currentBoard) renderBoard(state.currentBoard);
  });
}

function openSidebar() {
  $('#sidebar').classList.add('open');
  $('#sidebar-overlay').classList.add('open');
}
function closeSidebar() {
  $('#sidebar').classList.remove('open');
  $('#sidebar-overlay').classList.remove('open');
}

// ═══════════════════════════════════════════════════════════════
// THEME
// ═══════════════════════════════════════════════════════════════
function setupThemeListener() {
  $('#theme-toggle').addEventListener('click', () => {
    toggleTheme();
  });
}

// ═══════════════════════════════════════════════════════════════
// BOARDS
// ═══════════════════════════════════════════════════════════════
function subscribeBoards() {
  if (state.unsubBoards) state.unsubBoards();
  state.unsubBoards = onBoards(state.user.uid, (boards) => {
    state.boards = boards;
    renderBoardsGrid(boards);
    renderSidebarBoards(boards);
    // Update page subtitle
    $('#boards-count-text').textContent =
      boards.length === 0 ? 'Sin boards aún' :
      boards.length === 1 ? '1 board' : `${boards.length} boards`;
  });
}

function renderBoardsGrid(boards) {
  const grid = $('#boards-grid');
  const empty = $('#boards-empty');

  if (!boards.length) {
    grid.innerHTML = '';
    show(empty);
    return;
  }
  hide(empty);

  grid.innerHTML = boards.map(b => `
    <div class="board-card" data-board-id="${b.id}" style="--card-accent: ${b.color}">
      <div class="board-card-icon" style="background:${b.color}22;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${b.color}" stroke-width="2">
          <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
          <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
        </svg>
      </div>
      <div class="board-card-name">${escapeHtml(b.name)}</div>
      ${b.description ? `<div class="board-card-desc">${escapeHtml(b.description)}</div>` : ''}
      <div class="board-card-meta">
        <span class="board-card-count">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
          </svg>
          ${countColumns(b)} columnas · ${countCards(b)} tareas
        </span>
      </div>
    </div>
  `).join('');

  $$('.board-card').forEach(card => {
    card.addEventListener('click', () => openBoard(card.dataset.boardId));
  });
}

function countColumns(board) {
  return board.columns ? Object.keys(board.columns).length : 0;
}
function countCards(board) {
  if (!board.columns) return 0;
  return Object.values(board.columns).reduce((acc, col) => acc + (col.cards ? Object.keys(col.cards).length : 0), 0);
}

function renderSidebarBoards(boards) {
  const list = $('#sidebar-boards-list');
  list.innerHTML = boards.map(b => `
    <button class="nav-item sidebar-board-item" data-board-id="${b.id}">
      <span class="sidebar-board-dot" style="background:${b.color}"></span>
      ${escapeHtml(truncate(b.name, 24))}
    </button>
  `).join('');
  $$('.sidebar-board-item').forEach(item => {
    item.addEventListener('click', () => {
      openBoard(item.dataset.boardId);
      closeSidebar();
    });
  });
}

function openBoard(boardId) {
  state.currentBoardId = boardId;
  showPage('board');
  if (state.unsubBoard) state.unsubBoard();
  state.unsubBoard = onBoard(state.user.uid, boardId, (board) => {
    if (!board) { toast.error('Board no encontrado.'); showPage('boards'); return; }
    state.currentBoard = board;
    renderBoard(board);
  });
}

function renderBoard(board) {
  // Update header
  $('#board-title-display').textContent = board.name;
  $('#board-color-dot').style.background = board.color;
  $('#breadcrumb').innerHTML = `
    <span style="color:var(--text-muted)">Mis Boards</span>
    <span class="sep">›</span>
    <span>${escapeHtml(board.name)}</span>
  `;

  // Render columns
  const container = $('#columns-container');
  const columns = board.columns
    ? Object.values(board.columns).sort((a, b) => (a.order || 0) - (b.order || 0))
    : [];

  container.innerHTML = '';
  columns.forEach(col => {
    const cards = col.cards
      ? Object.values(col.cards).sort((a, b) => (a.order || 0) - (b.order || 0))
      : [];

    // Apply filters
    const filteredCards = filterCards(cards);
    const colEl = createColumnElement(board.id, col, filteredCards);
    container.appendChild(colEl);
  });
}

function filterCards(cards) {
  return cards.filter(card => {
    // Priority filter
    if (state.priorityFilter && card.priority !== state.priorityFilter) return false;
    // Search filter
    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      return (
        card.title?.toLowerCase().includes(q) ||
        card.description?.toLowerCase().includes(q) ||
        card.tags?.some(t => t.text?.toLowerCase().includes(q))
      );
    }
    return true;
  });
}

// ─── Create Column DOM element ───────────────────────────────
function createColumnElement(boardId, col, cards) {
  const div = document.createElement('div');
  div.className = 'column';
  div.dataset.columnId = col.id;

  const completedCount = cards.filter(c => c.completed).length;

  div.innerHTML = `
    <div class="column-header">
      <input class="column-title" value="${escapeHtml(col.name)}" maxlength="40" aria-label="Nombre de columna" />
      <span class="column-count">${cards.length}</span>
      <button class="column-menu-btn" aria-label="Opciones de columna">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>
        </svg>
        <div class="column-menu hidden">
          <button class="rename-col-btn">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Renombrar
          </button>
          <button class="delete-col-btn danger">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
            Eliminar
          </button>
        </div>
      </button>
    </div>
    <div class="cards-list" data-column-id="${col.id}"></div>
    <button class="add-card-btn">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Agregar tarea
    </button>
  `;

  // Render cards
  const cardsList = div.querySelector('.cards-list');
  cards.forEach(card => {
    cardsList.appendChild(createCardElement(boardId, col.id, card));
  });

  // Column menu toggle
  const menuBtn = div.querySelector('.column-menu-btn');
  const menu = div.querySelector('.column-menu');
  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.classList.toggle('hidden');
  });
  document.addEventListener('click', () => menu.classList.add('hidden'));

  // Rename column
  div.querySelector('.rename-col-btn').addEventListener('click', () => {
    const titleInput = div.querySelector('.column-title');
    titleInput.focus();
    titleInput.select();
    menu.classList.add('hidden');
  });

  // Column title edit
  const titleInput = div.querySelector('.column-title');
  titleInput.addEventListener('blur', async () => {
    const newName = titleInput.value.trim();
    if (newName && newName !== col.name) {
      try {
        await updateColumnName(state.user.uid, boardId, col.id, newName);
      } catch (err) {
        toast.error('Error al renombrar columna.');
        titleInput.value = col.name;
      }
    }
  });
  titleInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') titleInput.blur();
    if (e.key === 'Escape') { titleInput.value = col.name; titleInput.blur(); }
  });

  // Delete column
  div.querySelector('.delete-col-btn').addEventListener('click', async () => {
    menu.classList.add('hidden');
    const ok = await showConfirm('Eliminar columna', `¿Eliminar "${col.name}" y todas sus tareas? Esta acción es irreversible.`);
    if (!ok) return;
    try {
      await deleteColumn(state.user.uid, boardId, col.id);
      toast.success('Columna eliminada.');
    } catch (err) {
      toast.error('Error al eliminar columna.');
    }
  });

  // Add card
  div.querySelector('.add-card-btn').addEventListener('click', () => {
    openTaskModal('create', boardId, col.id);
  });

  // Drag & Drop
  setupColumnDrop(cardsList, boardId, col.id);

  return div;
}

// ─── Create Card DOM element ─────────────────────────────────
function createCardElement(boardId, columnId, card) {
  const div = document.createElement('div');
  div.className = `card ${card.completed ? 'completed' : ''}`;
  div.dataset.cardId = card.id;
  div.draggable = true;

  const meta = getPriorityMeta(card.priority);
  const overdue = isOverdue(card.dueDate);
  const dueSoon = !overdue && isDueSoon(card.dueDate);

  // Checklist progress
  const checklistTotal = card.checklist?.length || 0;
  const checklistDone = card.checklist?.filter(i => i.done).length || 0;
  const hasProgress = checklistTotal > 0;

  const tagsHtml = (card.tags || []).map(tag =>
    `<span class="tag tag-sm" style="background:${tag.color}">${escapeHtml(tag.text)}</span>`
  ).join('');

  const dueDateHtml = card.dueDate
    ? `<span class="card-due ${overdue ? 'overdue' : dueSoon ? 'due-soon' : ''}">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        ${formatDate(card.dueDate)}
       </span>`
    : '';

  // Apply search highlight
  const titleDisplay = state.searchQuery
    ? highlightText(card.title, state.searchQuery)
    : escapeHtml(card.title);

  div.innerHTML = `
    ${tagsHtml ? `<div class="card-tags">${tagsHtml}</div>` : ''}
    <div class="card-title">${titleDisplay}</div>
    <div class="card-footer">
      <span class="card-priority" style="--priority-color:${meta.color}; --priority-bg:${meta.bg}">
        ${meta.emoji} ${meta.label}
      </span>
      ${dueDateHtml}
    </div>
    ${hasProgress ? `
      <div class="card-progress" title="${checklistDone}/${checklistTotal} ítems">
        <div class="card-progress-fill" style="width:${(checklistDone/checklistTotal)*100}%"></div>
      </div>
    ` : ''}
    <button class="card-checkbox ${card.completed ? 'checked' : ''}" aria-label="${card.completed ? 'Marcar incompleta' : 'Marcar completa'}"></button>
  `;

  // Click card to edit
  div.addEventListener('click', (e) => {
    if (e.target.closest('.card-checkbox')) return;
    openTaskModal('edit', boardId, columnId, card.id, card);
  });

  // Toggle complete
  div.querySelector('.card-checkbox').addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      await toggleCardComplete(state.user.uid, boardId, columnId, card.id, !card.completed);
    } catch (err) {
      toast.error('Error al actualizar tarea.');
    }
  });

  // Drag events
  div.addEventListener('dragstart', (e) => {
    state.dragState = { cardId: card.id, fromColumnId: columnId, cardData: card };
    div.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });
  div.addEventListener('dragend', () => {
    div.classList.remove('dragging');
    $$('.drag-over').forEach(el => el.classList.remove('drag-over'));
  });

  return div;
}

// ─── Drag & Drop for column lists ────────────────────────────
function setupColumnDrop(cardsList, boardId, columnId) {
  cardsList.addEventListener('dragover', (e) => {
    e.preventDefault();
    cardsList.classList.add('drag-active');
    cardsList.closest('.column').classList.add('drag-over');
  });

  cardsList.addEventListener('dragleave', () => {
    cardsList.classList.remove('drag-active');
    cardsList.closest('.column').classList.remove('drag-over');
  });

  cardsList.addEventListener('drop', async (e) => {
    e.preventDefault();
    cardsList.classList.remove('drag-active');
    cardsList.closest('.column').classList.remove('drag-over');

    const { cardId, fromColumnId, cardData } = state.dragState;
    if (!cardId || fromColumnId === columnId) return;

    try {
      await moveCard(state.user.uid, boardId, fromColumnId, columnId, cardId, cardData);
      toast.success('Tarea movida.');
    } catch (err) {
      toast.error('Error al mover la tarea.');
    }
    state.dragState = {};
  });
}

// ─── Add column prompt ────────────────────────────────────────
async function promptAddColumn() {
  if (!state.currentBoardId) return;

  // Inline form in the add-column-wrap area
  const wrap = $('.add-column-wrap');
  const existingForm = wrap.querySelector('.inline-add');
  if (existingForm) { existingForm.remove(); return; }

  const form = document.createElement('div');
  form.className = 'inline-add';
  form.innerHTML = `
    <input type="text" placeholder="Nombre de columna..." maxlength="40" />
    <button class="btn-add-confirm">Agregar</button>
    <button class="btn-add-cancel">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
    </button>
  `;

  wrap.appendChild(form);
  const input = form.querySelector('input');
  input.focus();

  const submit = async () => {
    const name = input.value.trim();
    if (!name) { input.focus(); return; }
    form.remove();
    try {
      await createColumn(state.user.uid, state.currentBoardId, name);
    } catch (err) {
      toast.error('Error al crear columna.');
    }
  };

  form.querySelector('.btn-add-confirm').addEventListener('click', submit);
  form.querySelector('.btn-add-cancel').addEventListener('click', () => form.remove());
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submit();
    if (e.key === 'Escape') form.remove();
  });
}

// ─── Delete Board ─────────────────────────────────────────────
async function handleDeleteBoard() {
  if (!state.currentBoard) return;
  const ok = await showConfirm('Eliminar board', `¿Eliminar "${state.currentBoard.name}"? Se eliminarán todas las columnas y tareas. Esta acción es irreversible.`);
  if (!ok) return;
  try {
    if (state.unsubBoard) { state.unsubBoard(); state.unsubBoard = null; }
    await deleteBoard(state.user.uid, state.currentBoardId);
    state.currentBoardId = null;
    state.currentBoard = null;
    showPage('boards');
    toast.success('Board eliminado.');
  } catch (err) {
    toast.error('Error al eliminar board.');
  }
}

// ═══════════════════════════════════════════════════════════════
// BOARD MODAL
// ═══════════════════════════════════════════════════════════════
function setupBoardModalListeners() {
  // Color picker
  $$('#board-color-picker .color-swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      $$('#board-color-picker .color-swatch').forEach(s => s.classList.remove('active'));
      sw.classList.add('active');
    });
  });

  // Close
  ['#board-modal-close', '#board-modal-cancel'].forEach(sel => {
    $(sel).addEventListener('click', closeBoardModal);
  });
  $('#board-modal-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeBoardModal();
  });

  // Save
  $('#board-modal-save').addEventListener('click', handleSaveBoard);
  $('#board-name-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSaveBoard();
  });
}

function openBoardModal(mode = 'create', board = null) {
  state.boardModal = { mode, boardId: board?.id || null };

  const title = $('#board-modal-title');
  const saveBtn = $('#board-modal-save .btn-text');

  if (mode === 'edit' && board) {
    title.textContent = 'Editar board';
    saveBtn.textContent = 'Guardar cambios';
    $('#board-name-input').value = board.name;
    $('#board-desc-input').value = board.description || '';
    // Select color
    $$('#board-color-picker .color-swatch').forEach(sw => {
      sw.classList.toggle('active', sw.dataset.color === board.color);
    });
  } else {
    title.textContent = 'Nuevo board';
    saveBtn.textContent = 'Crear board';
    $('#board-name-input').value = '';
    $('#board-desc-input').value = '';
    // Default color
    $$('#board-color-picker .color-swatch').forEach((sw, i) => sw.classList.toggle('active', i === 0));
  }

  show($('#board-modal-overlay'));
  setTimeout(() => $('#board-name-input').focus(), 50);
}

function closeBoardModal() {
  hide($('#board-modal-overlay'));
}

async function handleSaveBoard() {
  const name = $('#board-name-input').value.trim();
  if (!name) {
    $('#board-name-input').focus();
    toast.warning('Ingresa un nombre para el board.');
    return;
  }
  const description = $('#board-desc-input').value.trim();
  const color = $('.color-swatch.active')?.dataset.color || '#6366f1';
  const btn = $('#board-modal-save');
  setLoading(btn, true);

  try {
    if (state.boardModal.mode === 'edit') {
      await updateBoard(state.user.uid, state.boardModal.boardId, { name, description, color });
      toast.success('Board actualizado.');
    } else {
      const board = await createBoard(state.user.uid, { name, description, color });
      toast.success('Board creado.');
      openBoard(board.id);
    }
    closeBoardModal();
  } catch (err) {
    toast.error('Error al guardar board.');
  } finally {
    setLoading(btn, false);
  }
}

// ═══════════════════════════════════════════════════════════════
// TASK MODAL
// ═══════════════════════════════════════════════════════════════
function setupTaskModalListeners() {
  // Close
  ['#task-modal-close', '#task-modal-cancel'].forEach(sel => {
    $(sel).addEventListener('click', closeTaskModal);
  });
  $('#task-modal-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeTaskModal();
  });

  // Save
  $('#task-modal-save').addEventListener('click', handleSaveTask);

  // Delete
  $('#task-delete-btn').addEventListener('click', handleDeleteTask);

  // Tag color selector
  $$('#tag-colors .tag-color-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('#tag-colors .tag-color-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.selectedTagColor = btn.dataset.color;
    });
  });

  // Tag input
  $('#tag-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag($('#tag-input').value.trim());
    }
    if (e.key === 'Backspace' && !$('#tag-input').value) {
      removeLastTag();
    }
  });

  // Add checklist item
  $('#add-checklist-item-btn').addEventListener('click', () => addChecklistItem(''));
}

function openTaskModal(mode, boardId, columnId, cardId = null, cardData = null) {
  state.taskModal = { mode, boardId, columnId, cardId, cardData };
  clearTaskModal();

  $('#task-modal-title').textContent = mode === 'edit' ? 'Editar tarea' : 'Nueva tarea';
  $('#task-modal-save .btn-text').textContent = mode === 'edit' ? 'Guardar cambios' : 'Crear tarea';
  toggle($('#task-delete-btn'), mode === 'edit');

  if (mode === 'edit' && cardData) {
    $('#task-title-input').value = cardData.title || '';
    $('#task-desc-input').value = cardData.description || '';
    $('#task-priority-input').value = cardData.priority || 'medium';
    $('#task-due-input').value = cardData.dueDate || '';
    $('#task-completed-input').checked = cardData.completed || false;

    // Tags
    (cardData.tags || []).forEach(tag => addTagToDisplay(tag.text, tag.color));

    // Checklist
    (cardData.checklist || []).forEach(item => addChecklistItem(item.text, item.done));
  }

  show($('#task-modal-overlay'));
  setTimeout(() => $('#task-title-input').focus(), 50);
}

function closeTaskModal() {
  hide($('#task-modal-overlay'));
  clearTaskModal();
}

function clearTaskModal() {
  $('#task-title-input').value = '';
  $('#task-desc-input').value = '';
  $('#task-priority-input').value = 'medium';
  $('#task-due-input').value = '';
  $('#task-completed-input').checked = false;
  $('#tags-display').innerHTML = '';
  $('#tag-input').value = '';
  $('#checklist-container').innerHTML = '';
}

async function handleSaveTask() {
  const title = $('#task-title-input').value.trim();
  if (!title) {
    $('#task-title-input').focus();
    toast.warning('El título es obligatorio.');
    return;
  }

  const { mode, boardId, columnId, cardId } = state.taskModal;

  const tags = [...$$('#tags-display .tag-removable')].map(t => ({
    text: t.dataset.text,
    color: t.dataset.color
  }));

  const checklist = [...$$('#checklist-container .checklist-item')].map(item => ({
    text: item.querySelector('.checklist-item-text').value,
    done: item.querySelector('.checklist-checkbox').checked
  })).filter(i => i.text.trim());

  const data = {
    title,
    description: $('#task-desc-input').value.trim(),
    priority: $('#task-priority-input').value,
    dueDate: $('#task-due-input').value || null,
    completed: $('#task-completed-input').checked,
    tags,
    checklist
  };

  const btn = $('#task-modal-save');
  setLoading(btn, true);

  try {
    if (mode === 'edit') {
      await updateCard(state.user.uid, boardId, columnId, cardId, data);
      toast.success('Tarea actualizada.');
    } else {
      await createCard(state.user.uid, boardId, columnId, data);
      toast.success('Tarea creada.');
    }
    closeTaskModal();
  } catch (err) {
    toast.error('Error al guardar tarea.');
    console.error(err);
  } finally {
    setLoading(btn, false);
  }
}

async function handleDeleteTask() {
  const { boardId, columnId, cardId, cardData } = state.taskModal;
  const ok = await showConfirm('Eliminar tarea', `¿Eliminar "${cardData?.title}"?`);
  if (!ok) return;
  try {
    await deleteCard(state.user.uid, boardId, columnId, cardId);
    closeTaskModal();
    toast.success('Tarea eliminada.');
  } catch (err) {
    toast.error('Error al eliminar tarea.');
  }
}

// ─── Tags ─────────────────────────────────────────────────────
function addTag(text) {
  if (!text) return;
  $('#tag-input').value = '';
  addTagToDisplay(text, state.selectedTagColor);
}

function addTagToDisplay(text, color) {
  const span = document.createElement('span');
  span.className = 'tag-removable';
  span.dataset.text = text;
  span.dataset.color = color;
  span.style.background = color;
  span.innerHTML = `${escapeHtml(text)} <button class="tag-remove-btn" aria-label="Quitar etiqueta">×</button>`;
  span.querySelector('.tag-remove-btn').addEventListener('click', () => span.remove());
  $('#tags-display').appendChild(span);
}

function removeLastTag() {
  const tags = $$('#tags-display .tag-removable');
  if (tags.length) tags[tags.length - 1].remove();
}

// ─── Checklist ────────────────────────────────────────────────
function addChecklistItem(text = '', done = false) {
  const container = $('#checklist-container');
  const item = document.createElement('div');
  item.className = 'checklist-item';
  item.innerHTML = `
    <input type="checkbox" class="checklist-checkbox" ${done ? 'checked' : ''} />
    <input type="text" class="checklist-item-text ${done ? 'done' : ''}" value="${escapeHtml(text)}" placeholder="Ítem del checklist..." />
    <button class="checklist-remove" aria-label="Eliminar ítem">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
    </button>
  `;

  item.querySelector('.checklist-checkbox').addEventListener('change', (e) => {
    item.querySelector('.checklist-item-text').classList.toggle('done', e.target.checked);
  });
  item.querySelector('.checklist-remove').addEventListener('click', () => item.remove());

  container.appendChild(item);
  item.querySelector('.checklist-item-text').focus();
}

// ═══════════════════════════════════════════════════════════════
// SEARCH
// ═══════════════════════════════════════════════════════════════
function setupSearchListeners() {
  const input = $('#global-search');
  let debounce;
  input.addEventListener('input', (e) => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      state.searchQuery = e.target.value.trim();
      if (state.currentBoard) renderBoard(state.currentBoard);
      // Also refresh all tasks if visible
      if ($('#all-tasks-page').classList.contains('active')) renderAllTasks();
    }, 250);
  });

  // Cmd+K shortcut
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      input.focus();
    }
    if (e.key === 'Escape' && document.activeElement === input) {
      input.value = '';
      state.searchQuery = '';
      if (state.currentBoard) renderBoard(state.currentBoard);
    }
  });
}

// ═══════════════════════════════════════════════════════════════
// ALL TASKS VIEW
// ═══════════════════════════════════════════════════════════════
function renderAllTasks() {
  const list = $('#all-tasks-list');
  const empty = $('#all-tasks-empty');
  const allTasks = [];

  state.boards.forEach(board => {
    if (!board.columns) return;
    Object.values(board.columns).forEach(col => {
      if (!col.cards) return;
      Object.values(col.cards).forEach(card => {
        allTasks.push({ ...card, boardName: board.name, colName: col.name, boardId: board.id, columnId: col.id });
      });
    });
  });

  // Apply search and priority filter
  let filtered = allTasks.filter(t => {
    if (state.priorityFilter && t.priority !== state.priorityFilter) return false;
    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      return t.title?.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q);
    }
    return true;
  });

  filtered.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  $('#all-tasks-count-text').textContent = `${filtered.length} tareas`;

  if (!filtered.length) {
    list.innerHTML = '';
    show(empty);
    return;
  }
  hide(empty);

  const meta_priority = { critical: 0, high: 1, medium: 2, low: 3 };
  filtered.sort((a, b) => (meta_priority[a.priority] ?? 2) - (meta_priority[b.priority] ?? 2));

  list.innerHTML = filtered.map(t => {
    const meta = getPriorityMeta(t.priority);
    return `
      <div class="task-row ${t.completed ? 'completed' : ''}" data-board-id="${t.boardId}" data-col-id="${t.columnId}" data-card-id="${t.id}">
        <span class="card-priority" style="--priority-color:${meta.color}; --priority-bg:${meta.bg}">${meta.emoji}</span>
        <span class="task-row-title">${highlightText(t.title, state.searchQuery)}</span>
        <span class="task-row-board">${escapeHtml(t.boardName)} › ${escapeHtml(t.colName)}</span>
        ${t.dueDate ? `<span class="card-due ${isOverdue(t.dueDate) ? 'overdue' : ''}">${formatDate(t.dueDate)}</span>` : ''}
      </div>
    `;
  }).join('');

  $$('.task-row').forEach(row => {
    row.addEventListener('click', () => {
      const boardId = row.dataset.boardId;
      const colId = row.dataset.colId;
      const cardId = row.dataset.cardId;
      const board = state.boards.find(b => b.id === boardId);
      if (!board) return;
      const col = board.columns?.[colId];
      if (!col) return;
      const card = col.cards?.[cardId];
      if (!card) return;
      openTaskModal('edit', boardId, colId, cardId, card);
    });
  });
}

// ═══════════════════════════════════════════════════════════════
// PROFILE MODAL
// ═══════════════════════════════════════════════════════════════
function setupProfileListeners() {
  $('#profile-btn').addEventListener('click', openProfileModal);
  $('#profile-modal-close').addEventListener('click', closeProfileModal);
  $('#profile-cancel-btn').addEventListener('click', closeProfileModal);
  $('#profile-modal-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeProfileModal();
  });
  $('#profile-save-btn').addEventListener('click', handleSaveProfile);
}

function openProfileModal() {
  hide($('#user-dropdown'));
  const user = state.user;
  const initials = getInitials(user.displayName || user.email);
  $('#profile-initials-large').textContent = initials;
  $('#profile-avatar-large').style.background = '#6366f1';
  $('#profile-name-input').value = user.displayName || '';
  $('#profile-email-display').value = user.email || '';

  // Stats
  const totalBoards = state.boards.length;
  let totalTasks = 0, doneTasks = 0;
  state.boards.forEach(b => {
    if (!b.columns) return;
    Object.values(b.columns).forEach(col => {
      if (!col.cards) return;
      Object.values(col.cards).forEach(card => {
        totalTasks++;
        if (card.completed) doneTasks++;
      });
    });
  });
  $('#stat-boards').textContent = totalBoards;
  $('#stat-tasks').textContent = totalTasks;
  $('#stat-done').textContent = doneTasks;

  show($('#profile-modal-overlay'));
}

function closeProfileModal() {
  hide($('#profile-modal-overlay'));
}

async function handleSaveProfile() {
  const name = $('#profile-name-input').value.trim();
  if (!name) { toast.warning('Ingresa tu nombre.'); return; }
  const btn = $('#profile-save-btn');
  setLoading(btn, true);
  try {
    await updateDisplayName(name);
    await saveUserProfile(state.user.uid, { name, email: state.user.email });
    state.user = { ...state.user, displayName: name };
    updateUserUI();
    closeProfileModal();
    toast.success('Perfil actualizado.');
  } catch (err) {
    toast.error('Error al actualizar perfil.');
  } finally {
    setLoading(btn, false);
  }
}
