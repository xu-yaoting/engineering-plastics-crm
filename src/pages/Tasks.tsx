import { useState, useEffect, useRef } from 'react';
import { tasks } from '../lib/api';
import Icon from '../components/shared/Icon';
import SidePanel from '../components/shared/SidePanel';
import { useTranslation } from 'react-i18next';

export default function Tasks() {
  const { t } = useTranslation();
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ subject: '', priority: 'medium', due_date: '', description: '' });
  const [subjectError, setSubjectError] = useState('');
  const subjectInputRef = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    tasks.list({ status: filter === 'all' ? undefined : filter }).then(setList).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [filter]);

  const closeCreatePanel = () => {
    if (creating) return;
    setSubjectError('');
    setShowForm(false);
  };

  const create = async () => {
    if (creating) return;
    if (!form.subject.trim()) {
      setSubjectError(t('page.tasks.subjectRequired'));
      subjectInputRef.current?.focus();
      return;
    }
    setSubjectError('');
    setCreating(true);
    try {
      await tasks.create({ ...form, task_type: 'other', status: 'pending' });
      setShowForm(false);
      setForm({ subject: '', priority: 'medium', due_date: '', description: '' });
      load();
    } finally {
      setCreating(false);
    }
  };

  const toggleStatus = async (task: any) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    await tasks.update(task.id, { status: newStatus });
    load();
  };

  const overdue = (date: string) => date && new Date(date) < new Date();
  const priorityLabel = (priority: string) => t(`status.${priority}`);
  const statusLabel = (status: string) => t(`status.${status}`);

  const renderMobileTask = (task: any) => {
    const isOverdue = !!(task.due_date && overdue(task.due_date) && task.status !== 'completed');
    return (
      <article key={task.id} className="rounded-md border border-gray-200 bg-white p-3">
        <div className="flex min-w-0 items-start gap-3">
          <button
            onClick={() => toggleStatus(task)}
            aria-label={`${statusLabel(task.status)}: ${task.subject}`}
            className={`mt-0.5 flex size-9 flex-shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
              task.status === 'completed' ? 'border-blue-600 bg-blue-600' : 'border-gray-300 hover:border-blue-600'
            }`}
          >
            {task.status === 'completed' && <Icon name="check" size={14} className="text-white" />}
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-start justify-between gap-2">
              <p className={`min-w-0 break-words text-sm ${task.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                {task.subject}
              </p>
              <span className={`inline-flex shrink-0 rounded px-1.5 py-0.5 text-2xs font-450 ${
                task.priority === 'urgent' ? 'bg-red-50 text-red-600' :
                task.priority === 'high' ? 'bg-yellow-50 text-yellow-600' :
                'bg-gray-100 text-gray-500'
              }`}>{priorityLabel(task.priority)}</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-2xs">
              {task.due_date && (
                <span className={isOverdue ? 'font-450 text-red-500' : 'text-gray-400'}>
                  {isOverdue ? t('page.tasks.overdue') : t('page.tasks.due')}: {task.due_date}
                </span>
              )}
              <span className="text-gray-400">{statusLabel(task.status)}</span>
            </div>
          </div>
          {task.status === 'completed' && (
            <button
              onClick={async () => {
                await tasks.delete(task.id);
                load();
              }}
              className="icon-btn -mr-1 -mt-1 flex-shrink-0 text-gray-300 hover:text-red-500"
              aria-label={t('page.tasks.deleteTask')}
              title={t('page.tasks.deleteTask')}
            >
              <Icon name="delete" size={14} />
            </button>
          )}
        </div>
      </article>
    );
  };

  return (
    <div className="page-shell max-w-5xl">
      <div className="page-header">
        <div>
          <h1 className="page-heading">{t('page.title.tasks')}</h1>
          <p className="page-summary tabular-nums">{t('page.tasks.pendingSummary', { count: list.filter(t => t.status !== 'completed').length })}</p>
        </div>
        <div className="page-actions">
          <button onClick={() => setShowForm(true)} className="btn-primary btn-sm"><Icon name="plus" size={16} className="mr-1.5" />{t('page.tasks.new')}</button>
        </div>
      </div>

      <SidePanel
        open={showForm}
        onClose={closeCreatePanel}
        title={t('page.tasks.new')}
        subtitle={t('page.title.tasks')}
        width="w-[min(440px,calc(100vw-1rem))]"
      >
        <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <legend className="sr-only">{t('page.tasks.new')}</legend>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="task-subject">{t('page.tasks.subject')} *</label>
            <input
              ref={subjectInputRef}
              id="task-subject"
              className="input"
              value={form.subject}
              required
              aria-invalid={!!subjectError}
              aria-describedby={subjectError ? 'task-subject-error' : undefined}
              onChange={e => {
                setForm({...form, subject: e.target.value});
                if (e.target.value.trim()) setSubjectError('');
              }}
              placeholder={t('page.tasks.taskDescription')}
            />
            {subjectError && <p id="task-subject-error" className="field-error" role="alert">{subjectError}</p>}
          </div>
          <div>
            <label className="label" htmlFor="task-priority">{t('page.tasks.priority')}</label>
            <select id="task-priority" className="input" value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}>
              <option value="urgent">{t('status.urgent')}</option>
              <option value="high">{t('status.high')}</option>
              <option value="medium">{t('status.medium')}</option>
              <option value="low">{t('status.low')}</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="task-due-date">{t('page.tasks.dueDate')}</label>
            <input id="task-due-date" className="input" type="date" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})} />
          </div>
        </fieldset>
        <div className="sticky bottom-0 z-10 -mx-5 mt-4 flex gap-2 border-t border-gray-200 bg-white px-5 pt-4">
          <button onClick={create} disabled={creating} className="btn-primary btn-sm">
            {creating ? t('common.loading') : t('common.create')}
          </button>
          <button onClick={closeCreatePanel} disabled={creating} className="btn-secondary btn-sm">
            {t('common.cancel')}
          </button>
        </div>
      </SidePanel>

      <div className="toolbar overflow-x-auto" role="tablist" aria-label={t('page.title.tasks')}>
        <div className="segmented-control">
          {[
            { key: 'pending', label: t('page.tasks.open') },
            { key: 'in_progress', label: t('page.tasks.inProgress') },
            { key: 'completed', label: t('page.tasks.completed') },
            { key: 'all', label: t('page.tasks.all') },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              aria-pressed={filter === f.key}
              className={`segmented-option ${filter === f.key ? 'segmented-option-active' : ''}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="data-surface p-3" aria-label={t('common.loading')}>
          <div className="animate-pulse space-y-2">
            {[0, 1, 2, 3].map(row => <div key={row} className="h-14 rounded bg-gray-100" />)}
          </div>
        </div>
      ) : (
        <div className="data-surface">
          <div className="space-y-2 p-3 md:hidden">
            {list.map(renderMobileTask)}
            {list.length === 0 && <div className="empty-state rounded-md border border-gray-200 bg-white">{t('noData.tasks')}</div>}
          </div>
          <div className="hidden md:block divide-y divide-gray-100">
            {list.map((task: any) => (
              <div key={task.id} className="flex items-start gap-3 p-3 hover:bg-gray-50">
                <button
                  onClick={() => toggleStatus(task)}
                  aria-label={`${statusLabel(task.status)}: ${task.subject}`}
                  className={`size-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                    task.status === 'completed' ? 'bg-blue-600 border-blue-600' : 'border-gray-300 hover:border-blue-600'
                  }`}
                >
                  {task.status === 'completed' && <Icon name="check" size={13} className="text-white" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm ${task.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                      {task.subject}
                    </p>
                    <span className={`inline-flex px-1.5 py-0.5 rounded text-2xs font-450 ${
                      task.priority === 'urgent' ? 'bg-red-50 text-red-600' :
                      task.priority === 'high' ? 'bg-yellow-50 text-yellow-600' :
                      'bg-gray-100 text-gray-500'
                    }`}>{priorityLabel(task.priority)}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    {task.due_date && (
                      <span className={`text-2xs ${overdue(task.due_date) && task.status !== 'completed' ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                        {overdue(task.due_date) && task.status !== 'completed' ? t('page.tasks.overdue') : t('page.tasks.due')}: {task.due_date}
                      </span>
                    )}
                    <span className="text-2xs text-gray-400">{statusLabel(task.status)}</span>
                  </div>
                </div>
                {task.status === 'completed' && (
                  <button
                    onClick={async () => {
                      await tasks.delete(task.id);
                      load();
                    }}
                    className="size-6 flex items-center justify-center rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
                    aria-label={t('page.tasks.deleteTask')}
                    title={t('page.tasks.deleteTask')}
                  >
                    <Icon name="delete" size={13} />
                  </button>
                )}
              </div>
            ))}
            {list.length === 0 && (
              <div className="empty-state">{t('noData.tasks')}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
