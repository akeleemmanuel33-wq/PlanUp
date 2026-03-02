// ============================================================
// js/api/tasks.js
// ============================================================

import { supabase, getUser } from './supabase.js';

const TASK_SELECT = `
  *,
  list:lists(id, name, color, icon),
  subtasks(id, title, completed, position),
  task_tags(tag:tags(id, name, color))
`;

export const fetchTasks = async (filters = {}) => {
  let query = supabase
    .from('tasks')
    .select(TASK_SELECT)
    .order('pinned', { ascending: false })
    .order('position');

  if (filters.status)   query = query.eq('status', filters.status);
  if (filters.priority) query = query.eq('priority', filters.priority);
  if (filters.list_id)  query = query.eq('list_id', filters.list_id);

  return query;
};

export const createTask = async (taskData) => {
  const user = await getUser();
  const { tagIds = [], subtaskTitles = [], ...rest } = taskData;

  const { data, error } = await supabase
    .from('tasks')
    .insert([{ ...rest, user_id: user.id }])
    .select(TASK_SELECT)
    .single();

  if (error || !data) return { data, error };

  if (tagIds.length > 0) {
    await supabase.from('task_tags').insert(tagIds.map(tag_id => ({ task_id: data.id, tag_id })));
  }

  if (subtaskTitles.length > 0) {
    await supabase.from('subtasks').insert(
      subtaskTitles.map((title, i) => ({ task_id: data.id, title, position: i }))
    );
  }

  return fetchTaskById(data.id);
};

export const fetchTaskById = async (id) => {
  return supabase.from('tasks').select(TASK_SELECT).eq('id', id).single();
};

export const updateTask = async (id, updates) => {
  const { tagIds, ...rest } = updates;

  const { data, error } = await supabase
    .from('tasks')
    .update(rest)
    .eq('id', id)
    .select(TASK_SELECT)
    .single();

  if (error) return { data, error };

  if (tagIds !== undefined) {
    await supabase.from('task_tags').delete().eq('task_id', id);
    if (tagIds.length > 0) {
      await supabase.from('task_tags').insert(tagIds.map(tag_id => ({ task_id: id, tag_id })));
    }
  }

  return fetchTaskById(id);
};

export const deleteTask = async (id) => {
  return supabase.from('tasks').delete().eq('id', id);
};

export const deleteTasks = async (ids) => {
  return supabase.from('tasks').delete().in('id', ids);
};

export const duplicateTask = async (id) => {
  const { data: source } = await fetchTaskById(id);
  if (!source) return { error: 'Task not found' };

  return createTask({
    list_id:     source.list_id,
    title:       `${source.title} (copy)`,
    description: source.description,
    status:      'todo',
    priority:    source.priority,
    due_date:    source.due_date,
    recurring:   source.recurring,
    pinned:      false,
    tagIds:      (source.task_tags || []).map(tt => tt.tag.id),
    subtaskTitles: (source.subtasks || []).map(s => s.title),
  });
};

export const reorderTasks = async (orderedIds) => {
  const updates = orderedIds.map((id, index) => ({ id, position: index }));
  return supabase.from('tasks').upsert(updates, { onConflict: 'id' });
};