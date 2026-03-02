// ============================================================
// js/app.js — App bootstrap, auth guard, global init
// ============================================================

import { supabase, requireAuth } from './api/supabase.js';
import store                      from './state/store.js';
import { theme }                  from './utils/theme.js';
import { toast }                  from './utils/dom.js';
import { notifications }          from './utils/notifications.js';

// API
import { fetchTasks }             from './api/tasks.js';
import { fetchLists }             from './api/lists.js';
import { fetchTags }              from './api/tags.js';
import { fetchPreferences }       from './api/analytics.js';

// Page modules (loaded conditionally)
let sidebarModule, tasksModule, taskModalModule;

// ─────────────────────────────────────────
// BOOT
// ─────────────────────────────────────────
async function boot() {
  // 1. Apply saved theme immediately (prevents flash)
  const savedPrefs = theme.load();
  store.prefs = { ...store.prefs, ...savedPrefs };

  // 2. Auth guard
  const user = await requireAuth();
  store.user = user;

  // 3. Load initial data in parallel
  const [tasksRes, listsRes, tagsRes] = await Promise.all([
    fetchTasks(),
    fetchLists(),
    fetchTags(),
  ]);

  if (tasksRes.data) store.setTasks(tasksRes.data);
  if (listsRes.data) store.setLists(listsRes.data);
  if (tagsRes.data)  store.setTags(tagsRes.data);

  // 4. Request notification permission + schedule reminders
  await notifications.request();
  notifications.rescheduleAll(store.tasks);

  // 5. Init page modules
  const [sidebar, tasks, taskModal] = await Promise.all([
    import('./pages/sidebar.js'),
    import('./pages/tasks.js'),
    import('./pages/task-modal.js'),
  ]);

  sidebarModule    = sidebar;
  tasksModule      = tasks;
  taskModalModule  = taskModal;

  sidebar.init();
  tasks.init();
  taskModal.init();

  // 6. Realtime: re-fetch tasks when DB changes
  supabase
    .channel('planup-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, async () => {
      const { data } = await fetchTasks();
      if (data) store.setTasks(data);
    })
    .subscribe();

  console.log('PlanUp ready ✅');
}

boot().catch(err => {
  console.error('Boot failed:', err);
  toast('Failed to load app. Please refresh.', 'error');
});