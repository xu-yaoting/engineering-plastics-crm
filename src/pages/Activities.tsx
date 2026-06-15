import { useState, useEffect } from 'react';
import { Phone, Mail, FileText, Calendar, RefreshCw, Upload, Settings2 } from 'lucide-react';
import { activities } from '../lib/api';
import { useTranslation } from 'react-i18next';

export default function Activities() {
  const { t } = useTranslation();
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    activities.recent().then(setList).finally(() => setLoading(false));
  }, []);

  const remove = async (id: string) => {
    try {
      await fetch(`/api/activities/${id}`, { method: 'DELETE' });
      setConfirmDelete(null);
      activities.recent().then(setList);
    } catch (e) { console.error('Delete failed', e); }
  };

  const filtered = list.filter(a =>
    a.subject?.toLowerCase().includes(search.toLowerCase()) ||
    a.description?.toLowerCase().includes(search.toLowerCase())
  );

  const getIcon = (type: string) => {
    const map: Record<string, React.ReactNode> = {
      call: <Phone size={16} strokeWidth={1.75} className="text-gray-400" />,
      email: <Mail size={16} strokeWidth={1.75} className="text-gray-400" />,
      note: <FileText size={16} strokeWidth={1.75} className="text-gray-400" />,
      meeting: <Calendar size={16} strokeWidth={1.75} className="text-gray-400" />,
      status_change: <RefreshCw size={16} strokeWidth={1.75} className="text-gray-400" />,
      document_upload: <Upload size={16} strokeWidth={1.75} className="text-gray-400" />,
      system_event: <Settings2 size={16} strokeWidth={1.75} className="text-gray-400" />,
    };
    return map[type] || null;
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">{t('page.title.activities')}</h1>
        <p className="text-sm text-gray-500">{list.length} total activities</p>
      </div>

      <div className="mb-4">
        <input className="input max-w-sm" placeholder=" Search activities..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">{t('common.loading')}</div>
      ) : (
        <div className="card p-4">
          {filtered.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">{t('noData.activities')}</p>
          ) : (
            <div className="space-y-3">
              {filtered.map((a: any) => (
                <div key={a.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50">
                  <span className="mt-0.5 flex-shrink-0">{getIcon(a.activity_type)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-700 capitalize">{a.activity_type}</span>
                      <span className="text-2xs text-gray-400">·</span>
                      <span className="text-2xs text-gray-400">{new Date(a.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-gray-900 mt-0.5">{a.subject}</p>
                    {a.description && <p className="text-xs text-gray-500 mt-0.5">{a.description}</p>}
                    {a.company_name && (
                      <p className="text-2xs text-blue-600 mt-1">{a.company_name}</p>
                    )}
                  </div>
                  <span className="text-2xs text-gray-400 capitalize px-1.5 py-0.5 bg-gray-100 rounded">
                    {a.direction || 'internal'}
                  </span>
                  {confirmDelete === a.id ? (
                    <div className="flex items-center gap-1">
                      <button onClick={() => remove(a.id)} className="text-2xs text-red-600 hover:text-red-800 font-medium">Delete</button>
                      <button onClick={() => setConfirmDelete(null)} className="text-2xs text-gray-400 hover:text-gray-600">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDelete(a.id)} className="text-2xs text-gray-300 hover:text-red-500 ml-2 flex-shrink-0" title="Delete">✕</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
