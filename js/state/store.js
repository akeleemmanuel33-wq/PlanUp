// ============================================================
// js/state/store.js — Central app state
// ============================================================

const store = {
  // ── Auth ──────────────────────────────────────────────────
  user: null,

  // ── Data ──────────────────────────────────────────────────
  tasks: [],
  lists: [],
  tags: [],

  // ── UI State ──────────────────────────────────────────────
  activeListId: null,       // currently selected list (null = All Tasks)
  selectedTaskIds: new Set(), // bulk selection
  openTaskId: null,         // task detail panel

  // ── Filters ───────────────────────────────────────────────
  filters: {
    search: '',
    status: null,           // 'todo' | 'in-progress' | 'completed' | null
    priority: null,         // 'low' | 'medium' | 'high' | null
    tagIds: [],
    dueBefore: null,
    dueAfter: null,
  },

  // ── Preferences ───────────────────────────────────────────
  prefs: {
    theme: 'light',
    accentColor: '#6366f1',
    compactView: false,
  },

  // ── Listeners ─────────────────────────────────────────────
  _listeners: {},

  on(event, callback) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(callback);
  },

  off(event, callback) {
    if (!this._listeners[event]) return;
    this._listeners[event] = this._listeners[event].filter(cb => cb !== callback);
  },

  emit(event, data) {
    (this._listeners[event] || []).forEach(cb => cb(data));
  },

  // ── Setters (always emit change) ──────────────────────────
  setTasks(tasks) {
    this.tasks = tasks;
    this.emit('tasks:changed', tasks);
  },

  setLists(lists) {
    this.lists = lists;
    this.emit('lists:changed', lists);
  },

  setTags(tags) {
    this.tags = tags;
    this.emit('tags:changed', tags);
  },

  setFilter(key, value) {
    this.filters[key] = value;
    this.emit('filters:changed', this.filters);
  },

  resetFilters() {
    this.filters = { search: '', status: null, priority: null, tagIds: [], dueBefore: null, dueAfter: null };
    this.emit('filters:changed', this.filters);
  },

  setActiveList(listId) {
    this.activeListId = listId;
    this.emit('list:changed', listId);
  },

  setOpenTask(taskId) {
    this.openTaskId = taskId;
    this.emit('task:opened', taskId);
  },

  // ── Derived: filtered task list ───────────────────────────
  getFilteredTasks() {
    let result = [...this.tasks];

    // List filter
    if (this.activeListId) {
      result = result.filter(t => t.list_id === this.activeListId);
    }

    // Search
    if (this.filters.search) {
      const q = this.filters.search.toLowerCase();
      result = result.filter(t =>
        t.title.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q)
      );
    }

    // Status
    if (this.filters.status) {
      result = result.filter(t => t.status === this.filters.status);
    }

    // Priority
    if (this.filters.priority) {
      result = result.filter(t => t.priority === this.filters.priority);
    }

    // Tags
    if (this.filters.tagIds.length > 0) {
      result = result.filter(t => {
        const taskTagIds = (t.task_tags || []).map(tt => tt.tag.id);
        return this.filters.tagIds.every(id => taskTagIds.includes(id));
      });
    }

    // Due date range
    if (this.filters.dueBefore) {
      result = result.filter(t => t.due_date && new Date(t.due_date) <= new Date(this.filters.dueBefore));
    }
    if (this.filters.dueAfter) {
      result = result.filter(t => t.due_date && new Date(t.due_date) >= new Date(this.filters.dueAfter));
    }

    // Pinned always first, then by position
    result.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return (a.position ?? 0) - (b.position ?? 0);
    });

    return result;
  },

  // ── Task helpers ──────────────────────────────────────────
  getTaskById(id) {
    return this.tasks.find(t => t.id === id) || null;
  },

  upsertTask(task) {
    const idx = this.tasks.findIndex(t => t.id === task.id);
    if (idx >= 0) {
      this.tasks[idx] = { ...this.tasks[idx], ...task };
    } else {
      this.tasks.unshift(task);
    }
    this.emit('tasks:changed', this.tasks);
  },

  removeTask(id) {
    this.tasks = this.tasks.filter(t => t.id !== id);
    this.emit('tasks:changed', this.tasks);
  },
};

export default store;