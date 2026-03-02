// ============================================================
// js/pages/task-modal.js — Create / Edit task modal
// ============================================================

import store                      from '../state/store.js';
import { $, $$, toast, escapeHtml } from '../utils/dom.js';
import { createTask, updateTask, fetchTaskById } from '../api/tasks.js';
import { createSubtask, toggleSubtask, deleteSubtask } from '../api/subtasks.js';

let editingId   = null;  // null = create, string = edit
let isPinned    = false;
let selectedTagIds = new Set();
let subtaskInputs  = [];  // for new tasks: [{title, done}]

export const init = () => {
  $('#modal-close-btn')?.addEventListener('click',  close);
  $('#modal-cancel-btn')?.addEventListener('click', close);
  $('#modal-save-btn')?.addEventListener('click',   save);
  $('#add-subtask-btn')?.addEventListener('click',  addSubtaskRow);
  $('#modal-pin-btn')?.addEventListener('click',    togglePin);

  // Close on overlay click
  $('#task-modal-overlay')?.addEventListener('click', (e) => {
    if (e.target === $('#task-modal-overlay')) close();
  });

  // Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });
};

// ── Open modal ────────────────────────────────────────────────
export const open = async (taskId = null) => {
  editingId      = taskId;
  isPinned       = false;
  selectedTagIds = new Set();
  subtaskInputs  = [];

  resetForm();
  populateLists();
  populateTags();

  if (taskId) {
    $('#modal-title').textContent  = 'Edit Task';
    $('#modal-save-btn').textContent = 'Save Changes';
    await loadTask(taskId);
  } else {
    $('#modal-title').textContent  = 'New Task';
    $('#modal-save-btn').textContent = 'Save Task';
  }

  $('#task-modal-overlay').classList.add('open');
  setTimeout(() => $('#task-title-input')?.focus(), 120);
};

// ── Close ─────────────────────────────────────────────────────
export const close = () => {
  $('#task-modal-overlay')?.classList.remove('open');
};

// ── Reset form ────────────────────────────────────────────────
function resetForm() {
  $('#task-title-input').value      = '';
  $('#task-desc-input').value       = '';
  $('#task-status-input').value     = 'todo';
  $('#task-priority-input').value   = 'medium';
  $('#task-due-input').value        = '';
  $('#task-reminder-input').value   = '';
  $('#task-recurring-input').value  = 'none';
  $('#task-list-input').value       = '';
  $('#subtasks-list').innerHTML     = '';
  updatePinBtn(false);
}

// ── Load task into form (edit mode) ───────────────────────────
async function loadTask(id) {
  const task = store.getTaskById(id);
  if (!task) return;

  $('#task-title-input').value    = task.title || '';
  $('#task-desc-input').value     = task.description || '';
  $('#task-status-input').value   = task.status || 'todo';
  $('#task-priority-input').value = task.priority || 'medium';
  $('#task-list-input').value     = task.list_id || '';
  $('#task-recurring-input').value = task.recurring || 'none';

  if (task.due_date) {
    $('#task-due-input').value = toDatetimeLocal(task.due_date);
  }
  if (task.reminder) {
    $('#task-reminder-input').value = toDatetimeLocal(task.reminder);
  }

  isPinned = task.pinned || false;
  updatePinBtn(isPinned);

  // Tags
  selectedTagIds = new Set((task.task_tags || []).map(tt => tt.tag?.id).filter(Boolean));
  populateTags();

  // Subtasks
  const subtasks = task.subtasks || [];
  subtasks.sort((a,b) => a.position - b.position).forEach(s => addSubtaskRow(s));
}

// ── Populate lists dropdown ───────────────────────────────────
function populateLists() {
  const sel = $('#task-list-input');
  if (!sel) return;
  sel.innerHTML = `<option value="">No list</option>` +
    store.lists.map(l => `<option value="${l.id}">${escapeHtml(l.name)}</option>`).join('');

  // Pre-select active list
  if (store.activeListId) sel.value = store.activeListId;
}

// ── Populate tag chips ────────────────────────────────────────
function populateTags() {
  const container = $('#task-tags-input');
  if (!container) return;

  if (!store.tags.length) {
    container.innerHTML = `<span style="font-size:.75rem;color:var(--text-tertiary)">No tags yet</span>`;
    return;
  }

  container.innerHTML = store.tags.map(tag => {
    const active = selectedTagIds.has(tag.id);
    return `<button type="button" class="badge badge-tag tag-toggle ${active ? 'tag-active' : ''}"
              data-tag-id="${tag.id}"
              style="${active ? `background:${tag.color}25;color:${tag.color};border-color:${tag.color}` : ''}">
              ${escapeHtml(tag.name)}
            </button>`;
  }).join('');

  $$('.tag-toggle', container).forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.tagId;
      const tag = store.tags.find(t => t.id === id);
      if (selectedTagIds.has(id)) {
        selectedTagIds.delete(id);
        btn.classList.remove('tag-active');
        btn.style.cssText = '';
      } else {
        selectedTagIds.add(id);
        btn.classList.add('tag-active');
        btn.style.cssText = `background:${tag.color}25;color:${tag.color};border-color:${tag.color}`;
      }
    });
  });
}

// ── Subtask rows ──────────────────────────────────────────────
function addSubtaskRow(existing = null) {
  const list = $('#subtasks-list');
  if (!list) return;

  const row = document.createElement('div');
  row.style.cssText = 'display:flex;align-items:center;gap:8px';

  const isExisting = existing && existing.id;
  const checked    = existing?.completed || false;

  row.innerHTML = `
    <div class="checkbox ${checked ? 'checked' : ''}" data-subtask-id="${existing?.id || ''}" style="flex-shrink:0"></div>
    <input class="input" type="text" placeholder="Subtask…" value="${escapeHtml(existing?.title || '')}"
           style="flex:1;height:30px;font-size:.8125rem" />
    <button type="button" class="btn-icon" style="color:var(--text-tertiary);font-size:.75rem">✕</button>
  `;

  const checkbox = row.querySelector('.checkbox');
  const input    = row.querySelector('input');
  const removeBtn = row.querySelector('button');

  // Toggle subtask (edit mode only)
  checkbox.addEventListener('click', async () => {
    if (isExisting) {
      const done = !checkbox.classList.contains('checked');
      checkbox.classList.toggle('checked', done);
      await toggleSubtask(existing.id, done);
      store.upsertTask({ id: editingId, subtasks: store.getTaskById(editingId)?.subtasks?.map(s => s.id === existing.id ? {...s, completed: done} : s) });
    } else {
      checkbox.classList.toggle('checked');
    }
  });

  // Remove
  removeBtn.addEventListener('click', async () => {
    if (isExisting) await deleteSubtask(existing.id);
    row.remove();
  });

  list.appendChild(row);
}

// ── Pin toggle ────────────────────────────────────────────────
function togglePin() {
  isPinned = !isPinned;
  updatePinBtn(isPinned);
}

function updatePinBtn(pinned) {
  const btn = $('#modal-pin-btn');
  if (btn) {
    btn.style.color = pinned ? 'var(--amber)' : '';
    btn.textContent = pinned ? '📌 Pinned' : '📌 Pin';
  }
}

// ── Save ──────────────────────────────────────────────────────
async function save() {
  const title = $('#task-title-input')?.value.trim();
  if (!title) {
    $('#task-title-input')?.focus();
    $('#task-title-input')?.style && ($('#task-title-input').style.borderColor = 'var(--red)');
    return;
  }

  const saveBtn = $('#modal-save-btn');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving…'; }

  // Collect subtask titles from inputs (create mode)
  const subtaskInputEls = $$('#subtasks-list input[type="text"]');
  const subtaskTitles   = [...subtaskInputEls].map(i => i.value.trim()).filter(Boolean);

  const payload = {
    title,
    description:  $('#task-desc-input')?.value.trim() || null,
    status:       $('#task-status-input')?.value,
    priority:     $('#task-priority-input')?.value,
    list_id:      $('#task-list-input')?.value || null,
    due_date:     $('#task-due-input')?.value ? new Date($('#task-due-input').value).toISOString() : null,
    reminder:     $('#task-reminder-input')?.value ? new Date($('#task-reminder-input').value).toISOString() : null,
    recurring:    $('#task-recurring-input')?.value || 'none',
    pinned:       isPinned,
    tagIds:       [...selectedTagIds],
    subtaskTitles,
  };

  let data, error;

  if (editingId) {
    ({ data, error } = await updateTask(editingId, payload));
  } else {
    ({ data, error } = await createTask(payload));
  }

  if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = editingId ? 'Save Changes' : 'Save Task'; }

  if (error) { toast('Failed to save task', 'error'); console.error(error); return; }

  if (data) store.upsertTask(data);
  toast(editingId ? 'Task updated ✓' : 'Task created ✓');
  close();
}

// ── Helpers ───────────────────────────────────────────────────
function toDatetimeLocal(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}