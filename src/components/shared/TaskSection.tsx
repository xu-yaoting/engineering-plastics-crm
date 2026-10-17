import { useEffect, useState } from 'react';
import { tasks as tasksApi, team, type TeamMember } from '../../lib/api';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import Icon from './Icon';

interface Task {
  id: string;
  subject: string;
  priority: string;
  status: string;
  due_date?: string;
  entity_type?: string;
  entity_id?: string;
  assigned_to_user_id?: string;
  assignee_name?: string;
}

export default function TaskSection({
  tasks: initialTasks,
  entityType,
  entityId,
  onTaskChanged,
  compact,
}: {
  tasks: Task[];
  entityType?: string;
  entityId?: string;
  onTaskChanged?: () => void;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const [list, setList] = useState(initialTasks);
  const [newTask, setNewTask] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [saving, setSaving] = useState(false);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [membersLoadError, setMembersLoadError] = useState(false);
  const [assigneeId, setAssigneeId] = useState('');

  const loadMembers = () => {
    setMembersLoadError(false);
    team.list()
      .then(setMembers)
      .catch(() => {
        setMembers([]);
        setMembersLoadError(true);
      });
  };

  useEffect(() => {
    loadMembers();
  }, []);

  // Sync when prop changes
  if (initialTasks !== list) {
    setTimeout(() => setList(initialTasks), 0);
  }

  const addTask = async () => {
    if (!newTask.trim()) return;
    setSaving(true);
    try {
      await tasksApi.create({
        subject: newTask.trim(),
        task_type: 'other',
        priority: 'medium',
        status: 'pending',
        entity_type: entityType || null,
        entity_id: entityId || null,
        assigned_to_user_id: assigneeId || undefined,
      });
      setNewTask('');
      setAssigneeId('');
      setShowInput(false);
      onTaskChanged?.();
    } catch (e) {
      toast.error(t('page.tasks.taskAddFailed'));
    } finally {
      setSaving(false);
    }
  };

  const toggleTask = async (task: Task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    try {
      await tasksApi.update(task.id, { status: newStatus });
      onTaskChanged?.();
    } catch (e) {
      toast.error(t('page.tasks.taskUpdateFailed'));
    }
  };

  const isOverdue = (date?: string) => date && new Date(date) < new Date();
  const isDueSoon = (date?: string) => {
    if (!date) return false;
    const d = new Date(date);
    const now = new Date();
    const diff = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 2;
  };

  const priorityDot = (task: Task) => {
    if (task.status === 'completed') return null;
    if (isOverdue(task.due_date)) return <span className="mt-1.5 size-1.5 flex-shrink-0 rounded-full bg-danger" title={t('page.tasks.overdue')} />;
    if (isDueSoon(task.due_date)) return <span className="mt-1.5 size-1.5 flex-shrink-0 rounded-full bg-warning" title={t('page.tasks.dueSoon')} />;
    return <span className="mt-1.5 size-1.5 flex-shrink-0 rounded-full bg-border-strong" />;
  };

  const openTasks = list.filter(t => t.status !== 'completed');

  return (
    <div>
      <div className="space-y-1">
        {(compact ? openTasks : list).map(task => (
          <div key={task.id} className="flex items-start gap-2 p-1.5 rounded-lg hover:bg-canvas group">
            <button
              onClick={() => toggleTask(task)}
              aria-label={`${task.status === 'completed' ? t('page.tasks.completed') : t('page.tasks.open')}: ${task.subject}`}
              className={`size-4 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                task.status === 'completed' ? 'bg-brand border-brand' : 'border-border-strong hover:border-brand'
              }`}
            >
              {task.status === 'completed' && <Icon name="check" size={11} className="text-white" />}
            </button>
            {priorityDot(task)}
            <div className="flex-1 min-w-0">
              <p className={`min-w-0 break-words ${compact ? 'text-xs' : 'text-sm'} ${
                task.status === 'completed' ? 'text-ink-subtle line-through' : 'text-ink'
              }`}>
                {task.subject}
              </p>
              {(task.due_date || task.assignee_name) && (
                <p className={`break-words text-2xs mt-0.5 ${
                  isOverdue(task.due_date) && task.status !== 'completed' ? 'text-danger font-medium' : 'text-ink-subtle'
                }`}>
                  {task.due_date && (isOverdue(task.due_date) && task.status !== 'completed' ? `${t('page.tasks.overdue')}: ${task.due_date}` : `${t('page.tasks.due')}: ${task.due_date}`)}
                  {task.due_date && task.assignee_name && ' · '}
                  {task.assignee_name && `${t('accountability.owner')}: ${task.assignee_name}`}
                </p>
              )}
            </div>
          </div>
        ))}
        {list.length === 0 && !showInput && (
          <div className="empty-state">
            <p className="text-xs">{t('page.tasks.noTasks')}</p>
            <button type="button" onClick={() => setShowInput(true)} className="btn-primary btn-sm">
              <Icon name="plus" size={13} className="mr-1" />
              {t('page.tasks.addTask')}
            </button>
          </div>
        )}
      </div>

      {/* Quick add */}
      {showInput ? (
          <div className="mt-3 space-y-2">
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="sr-only" htmlFor="task-section-subject">{t('page.tasks.addTaskPlaceholder')}</label>
              <input
                id="task-section-subject"
                className="input w-full flex-1 text-sm"
              value={newTask}
              onChange={e => setNewTask(e.target.value)}
              placeholder={t('page.tasks.addTaskPlaceholder')}
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTask(); } }}
            />
              <div className="flex gap-2 sm:shrink-0">
                <button onClick={addTask} disabled={!newTask.trim() || saving} className="btn-primary btn-sm flex-1 sm:flex-none">{t('page.tasks.add')}</button>
                <button onClick={() => setShowInput(false)} className="icon-btn shrink-0" aria-label={t('common.close')} title={t('common.close')}><Icon name="close" size={14} /></button>
              </div>
          </div>
          <select className="input w-full text-xs" value={assigneeId} onChange={e => setAssigneeId(e.target.value)} aria-label={t('accountability.owner')}>
            <option value="">{t('accountability.defaultToMe')}</option>
            {members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
          </select>
          {membersLoadError && (
            <div className="flex items-center justify-between gap-2" role="alert">
              <span className="text-2xs text-danger">{t('page.error.loadFailed')}</span>
              <button type="button" onClick={loadMembers} className="inline-flex items-center gap-1 text-2xs text-brand hover:underline">
                <Icon name="refresh" size={12} />
                {t('common.refresh')}
              </button>
            </div>
          )}
        </div>
      ) : list.length > 0 ? (
        <button onClick={() => setShowInput(true)} className="text-xs text-brand hover:text-brand-700 mt-2 inline-flex items-center gap-1">
          <Icon name="plus" size={13} />{t('page.tasks.addTask')}
        </button>
      ) : null}
    </div>
  );
}
