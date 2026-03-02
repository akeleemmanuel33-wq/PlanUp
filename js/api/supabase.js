// ============================================================
// supabase.js — Supabase client + all DB helper functions
// Place this file at the root of your project
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ─────────────────────────────────────────
// INIT — replace with your actual values
// ─────────────────────────────────────────
const SUPABASE_URL = 'https://ilsbnkwcqxiijiyrljfi.supabase.co';  // ← from Project Settings > API
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlsc2Jua3djcXhpaWppeXJsamZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0MDQzMTcsImV4cCI6MjA4Nzk4MDMxN30.trrsgMaSG7hgq-rpzcUJyqffR8AjOvyfdaSEoeRj_a4';                   // ← from Project Settings > API

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


// ─────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────
export const auth = {
  signUp: (email, password) =>
    supabase.auth.signUp({ email, password }),

  signIn: (email, password) =>
    supabase.auth.signInWithPassword({ email, password }),

  signInWithGoogle: () =>
    supabase.auth.signInWithOAuth({ provider: 'google' }),

  signOut: () =>
    supabase.auth.signOut(),

  getUser: () =>
    supabase.auth.getUser(),

  onAuthChange: (callback) =>
    supabase.auth.onAuthStateChange(callback),
};


// ─────────────────────────────────────────
// LISTS
// ─────────────────────────────────────────
export const lists = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('lists')
      .select('*')
      .order('position');
    return { data, error };
  },

  create: async ({ name, color = '#6366f1', icon = '📋' }) => {
    const { data: userData } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('lists')
      .insert([{ user_id: userData.user.id, name, color, icon }])
      .select()
      .single();
    return { data, error };
  },

  update: async (id, updates) => {
    const { data, error } = await supabase
      .from('lists')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  },

  delete: async (id) => {
    const { error } = await supabase.from('lists').delete().eq('id', id);
    return { error };
  },
};


// ─────────────────────────────────────────
// TAGS
// ─────────────────────────────────────────
export const tags = {
  getAll: async () => {
    const { data, error } = await supabase.from('tags').select('*').order('name');
    return { data, error };
  },

  create: async ({ name, color = '#94a3b8' }) => {
    const { data: userData } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('tags')
      .insert([{ user_id: userData.user.id, name, color }])
      .select()
      .single();
    return { data, error };
  },

  delete: async (id) => {
    const { error } = await supabase.from('tags').delete().eq('id', id);
    return { error };
  },
};


// ─────────────────────────────────────────
// TASKS
// ─────────────────────────────────────────
export const tasks = {
  // Get all tasks with subtasks + tags
  getAll: async (filters = {}) => {
    let query = supabase
      .from('tasks')
      .select(`
        *,
        list:lists(id, name, color, icon),
        subtasks(id, title, completed, position),
        task_tags(tag:tags(id, name, color))
      `)
      .order('pinned', { ascending: false })
      .order('position');

    if (filters.status)     query = query.eq('status', filters.status);
    if (filters.priority)   query = query.eq('priority', filters.priority);
    if (filters.list_id)    query = query.eq('list_id', filters.list_id);
    if (filters.due_before) query = query.lte('due_date', filters.due_before);
    if (filters.due_after)  query = query.gte('due_date', filters.due_after);

    const { data, error } = await query;
    return { data, error };
  },

  // Full-text search
  search: async (searchQuery) => {
    const { data: userData } = await supabase.auth.getUser();
    const { data, error } = await supabase.rpc('search_tasks', {
      search_query: searchQuery,
      p_user_id: userData.user.id,
    });
    return { data, error };
  },

  // Get single task
  getById: async (id) => {
    const { data, error } = await supabase
      .from('tasks')
      .select(`
        *,
        list:lists(id, name, color, icon),
        subtasks(id, title, completed, position),
        task_tags(tag:tags(id, name, color))
      `)
      .eq('id', id)
      .single();
    return { data, error };
  },

  create: async (taskData) => {
    const { data: userData } = await supabase.auth.getUser();
    const { tagIds, ...rest } = taskData;

    const { data, error } = await supabase
      .from('tasks')
      .insert([{ ...rest, user_id: userData.user.id }])
      .select()
      .single();

    if (error || !data) return { data, error };

    // Attach tags if provided
    if (tagIds && tagIds.length > 0) {
      await supabase.from('task_tags').insert(
        tagIds.map((tag_id) => ({ task_id: data.id, tag_id }))
      );
    }

    return { data, error };
  },

  update: async (id, updates) => {
    const { tagIds, ...rest } = updates;

    const { data, error } = await supabase
      .from('tasks')
      .update(rest)
      .eq('id', id)
      .select()
      .single();

    if (error) return { data, error };

    // Sync tags if provided
    if (tagIds !== undefined) {
      await supabase.from('task_tags').delete().eq('task_id', id);
      if (tagIds.length > 0) {
        await supabase.from('task_tags').insert(
          tagIds.map((tag_id) => ({ task_id: id, tag_id }))
        );
      }
    }

    return { data, error };
  },

  delete: async (id) => {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    return { error };
  },

  deleteBulk: async (ids) => {
    const { error } = await supabase.from('tasks').delete().in('id', ids);
    return { error };
  },

  duplicate: async (id) => {
    const { data: source } = await tasks.getById(id);
    if (!source) return { error: 'Task not found' };

    const tagIds = source.task_tags?.map((tt) => tt.tag.id) || [];

    return tasks.create({
      list_id: source.list_id,
      title: `${source.title} (copy)`,
      description: source.description,
      status: 'todo',
      priority: source.priority,
      due_date: source.due_date,
      recurring: source.recurring,
      pinned: false,
      tagIds,
    });
  },

  togglePin: async (id, pinned) => {
    return tasks.update(id, { pinned: !pinned });
  },

  reorder: async (orderedIds) => {
    const updates = orderedIds.map((id, index) => ({
      id,
      position: index,
    }));

    const { error } = await supabase
      .from('tasks')
      .upsert(updates, { onConflict: 'id' });
    return { error };
  },
};


// ─────────────────────────────────────────
// SUBTASKS
// ─────────────────────────────────────────
export const subtasks = {
  create: async (task_id, title) => {
    const { data, error } = await supabase
      .from('subtasks')
      .insert([{ task_id, title }])
      .select()
      .single();
    return { data, error };
  },

  toggle: async (id, completed) => {
    const { data, error } = await supabase
      .from('subtasks')
      .update({ completed })
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  },

  update: async (id, title) => {
    const { data, error } = await supabase
      .from('subtasks')
      .update({ title })
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  },

  delete: async (id) => {
    const { error } = await supabase.from('subtasks').delete().eq('id', id);
    return { error };
  },
};


// ─────────────────────────────────────────
// ANALYTICS
// ─────────────────────────────────────────
export const analytics = {
  getWeeklyStats: async () => {
    const { data: userData } = await supabase.auth.getUser();
    const { data, error } = await supabase.rpc('get_weekly_stats', {
      p_user_id: userData.user.id,
    });
    return { data, error };
  },

  getSummary: async () => {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user.id;

    const [total, completed, overdue] = await Promise.all([
      supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'completed'),
      supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('user_id', userId).lt('due_date', new Date().toISOString()).neq('status', 'completed'),
    ]);

    return {
      total: total.count || 0,
      completed: completed.count || 0,
      overdue: overdue.count || 0,
      completionRate: total.count ? Math.round((completed.count / total.count) * 100) : 0,
    };
  },
};


// ─────────────────────────────────────────
// USER PREFERENCES
// ─────────────────────────────────────────
export const preferences = {
  get: async () => {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .single();
    return { data, error };
  },

  update: async (updates) => {
    const { data: userData } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('user_preferences')
      .update(updates)
      .eq('user_id', userData.user.id)
      .select()
      .single();
    return { data, error };
  },
};


// ─────────────────────────────────────────
// ACTIVITY LOG
// ─────────────────────────────────────────
export const activity = {
  log: async (task_id, action, meta = {}) => {
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from('activity_log').insert([{
      user_id: userData.user.id,
      task_id,
      action,
      meta,
    }]);
  },

  getForTask: async (task_id) => {
    const { data, error } = await supabase
      .from('activity_log')
      .select('*')
      .eq('task_id', task_id)
      .order('created_at', { ascending: false })
      .limit(20);
    return { data, error };
  },
};


// ─────────────────────────────────────────
// REALTIME subscriptions
// ─────────────────────────────────────────
export const realtime = {
  subscribeTasks: (callback) => {
    return supabase
      .channel('tasks-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, callback)
      .subscribe();
  },

  unsubscribe: (channel) => {
    supabase.removeChannel(channel);
  },
};