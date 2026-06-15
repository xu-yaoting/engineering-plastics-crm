import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { inquiries } from '../lib/api';
import StatusBadge from '../components/shared/StatusBadge';
import { useTranslation } from 'react-i18next';
import Icon from '../components/shared/Icon';
import { exportFullCsv } from '../lib/exportCsv';

export default function Inquiries() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => {
    inquiries.list().then(setList).finally(() => setLoading(false));
  }, []);

  const filtered = list.filter(i =>
    (i.inquiry_number?.toLowerCase().includes(search.toLowerCase()) ||
     i.company_name?.toLowerCase().includes(search.toLowerCase()) ||
     i.target_material_requested?.toLowerCase().includes(search.toLowerCase())) &&
    (!filterStatus || i.status === filterStatus)
  );

  const urgencyColor = (u: string) => {
    if (u === 'immediate') return 'text-red-500 font-medium';
    if (u === 'within_2_weeks') return 'text-yellow-600';
    return 'text-gray-400';
  };



  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{t('page.title.inquiries')}</h1>
          <p className="text-sm text-gray-500">{list.length} {t('page.title.inquiries')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/inquiries/new" className="btn-primary btn-sm">{t('page.inquiries.new')}</Link>
          <button onClick={() => exportFullCsv('/api/inquiries', 'inquiries')} className="btn-secondary btn-sm"><Icon name="download" size={14} className="mr-1" />CSV</button>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <input className="input max-w-sm" placeholder={t('common.searchInquiries')} value={search} onChange={e => setSearch(e.target.value)} />
        <select className="input max-w-[180px]" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">{t('page.inquiries.allStatus')}</option>
          <option value="open">{t('status.open')}</option>
          <option value="under_review">{t('status.underReview')}</option>
          <option value="quoted">{t('status.quoted')}</option>
          <option value="closed_won">{t('status.won')}</option>
          <option value="closed_lost">{t('status.lost')}</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">{t('common.loading')}</div>
      ) : (
        <div className="card">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="table-header">Number</th>
                <th className="table-header">Company</th>
                <th className="table-header">Material</th>
                <th className="table-header">Status</th>
                <th className="table-header">Urgency</th>
                <th className="table-header">Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(inq => (
                <tr key={inq.id} className="table-row" onClick={() => navigate(`/inquiries/${inq.id}`)}>
                  <td className="table-cell font-medium text-blue-600">{inq.inquiry_number}</td>
                  <td className="table-cell">
                    <span className="text-gray-900">{inq.company_name || '—'}</span>
                  </td>
                  <td className="table-cell">
                    <span className="text-xs font-medium">{inq.target_material_requested || '—'}</span>
                    {inq.quantity_estimate && <span className="text-2xs text-gray-400 ml-1">· {inq.quantity_estimate}</span>}
                  </td>
                  <td className="table-cell"><StatusBadge status={inq.status} /></td>
                  <td className="table-cell">
                    <span className={`text-xs ${urgencyColor(inq.urgency)}`}>{inq.urgency?.replace('_', ' ') || '—'}</span>
                  </td>
                  <td className="table-cell text-2xs text-gray-400">{inq.created_at?.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400 text-sm">{t('noData.inquiries')}</div>
          )}
        </div>
      )}
    </div>
  );
}
