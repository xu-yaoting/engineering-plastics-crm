import { useState, useEffect } from 'react';
import { tasks } from '../lib/api';
import Icon from '../components/shared/Icon';
import { useTranslation } from 'react-i18next';

export default function Tasks() {
  const { t } = useTranslation();
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ subject: '', priority: 'medium', due_date: '', description: '' });

  const load = () => {
    setLoading(true);
    tasks.list({ status: filter === 'all' ? undefined : filter }).then(setList).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [filter]);

  const create = async () => {
    if (!form.subject.trim()) return;
    await tasks.create({ ...form, task_type: 'other', status: 'pending' });
    setShowForm(false);
    setForm({ subject: '', priority: 'medium', due_date: '', description: '' });
    load();
  };

  const toggleStatus = async (task: any) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    await tasks.update(task.id, { status: newStatus });
    load();
  };

  const overdue = (date: string) => date && new Date(date) < new Date();

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{t('page.title.tasks')}</h1>
          <p className="text-sm text-gray-500">{list.filter(t => t.status !== 'completed').length} pending</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary btn-sm"><Icon name="plus" size={16} className="mr-1.5" />{t('page.tasks.new')}</button>
      </div>

      {showForm && (
        <div className="card p-4 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div className="sm:col-span-2">
              <label className="label">Subject *</label>
              <input className="input" value={form.subject} onChange={e => setForm({...form, subject: e.target.value})} placeholder="Task description" />
            </div>
            <div>
              <label className="label">Priority</label>
              <select className="input" value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}>
                <option value="urgent">{t('status.urgent')}</option>
                <option value="high">{t('status.high')}</option>
                <option value="medium">{t('status.medium')}</option>
                <option value="low">{t('status.low')}</option>
              </select>
            </div>
            <div>
              <label className="label">Due Date</label>
              <input className="input" type="date" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={create} className="btn-primary btn-sm">{t('common.create')}</button>
            <button onClick={() => setShowForm(false) } className="btn-secondary btn-sm">{t('common.cancel')}</button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 mb-4">
        {[
          { key: 'pending', label: t('page.tasks.open') },
          { key: 'in_progress', label: t('page.tasks.inProgress') },
          { key: 'completed', label: t('page.tasks.completed') },
          { key: 'all', label: t('page.tasks.all') },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === f.key ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">{t('common.loading')}</div>
      ) : (
        <div className="card divide-y divide-gray-100">
          {list.map((t: any) => (
            <div key={t.id} className="flex items-start gap-3 p-3 hover:bg-gray-50">
              <button
                onClick={() => toggleStatus(t)}
                className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                  t.status === 'completed' ? 'bg-blue-600 border-blue-600' : 'border-gray-300 hover:border-blue-600'
                }`}
              >
                {t.status === 'completed' && <span className="text-white text-xs">✓</span>}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={`text-sm ${t.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                    {t.subject}
                  </p>
                  <span className={`inline-flex px-1.5 py-0.5 rounded text-2xs font-medium ${
                    t.priority === 'urgent' ? 'bg-red-50 text-red-600' :
                    t.priority === 'high' ? 'bg-yellow-50 text-yellow-600' :
                    'bg-gray-100 text-gray-500'
                  }`}>{t.priority}</span>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  {t.due_date && (
                    <span className={`text-2xs ${overdue(t.due_date) && t.status !== 'completed' ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                      {overdue(t.due_date) && t.status !== 'completed' ? 'Overdue' : 'Due'}: {t.due_date}
                    </span>
                  )}
                  <span className="text-2xs text-gray-400 capitalize">{t.status?.replace('_', ' ')}</span>
                </div>
              </div>
              {t.status === 'completed' && (
                <button
                  onClick={async () => {
                    await tasks.delete(t.id);
                    load();
                  }}
                  className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
                  title="Delete task"
                >
                  <Icon name="delete" size={13} />
                </button>
              )}
            </div>
          ))}
          {list.length === 0 && (
            <div className="text-center py-12 text-gray-400 text-sm">{t('noData.tasks')}</div>
          )}
        </div>
      )}
    </div>
  );
}
