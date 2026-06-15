import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { quotations } from '../lib/api';
import StatusBadge from '../components/shared/StatusBadge';
import { formatCurrency } from '../lib/currency';
import { useTranslation } from 'react-i18next';
import Icon from '../components/shared/Icon';
import { exportFullCsv } from '../lib/exportCsv';

export default function Quotations() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => {
    quotations.list().then(setList).finally(() => setLoading(false));
  }, []);

  const filtered = list.filter(q =>
    (!filterStatus || q.status === filterStatus) &&
    (q.quotation_number?.toLowerCase().includes(search.toLowerCase()) ||
     q.company_name?.toLowerCase().includes(search.toLowerCase()))
  );

  const recent = [...filtered].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());



  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{t('page.title.quotations')}</h1>
          <p className="text-sm text-gray-500">{list.length} {t('page.title.quotations')}</p>
        </div>
          <button onClick={() => exportFullCsv('/api/quotations', 'quotations')} className="btn-secondary btn-sm"><Icon name="download" size={14} className="mr-1" />CSV</button>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <input className="input max-w-sm" placeholder={t('common.searchQuotations')} value={search} onChange={e => setSearch(e.target.value)} />
        <select className="input max-w-[180px]" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All</option>
          <option value="draft">{t('status.draft')}</option>
          <option value="pending_approval">Pending Approval</option>
          <option value="approved">Approved</option>
          <option value="sent">{t('status.sent')}</option>
          <option value="negotiating">{t('status.negotiating')}</option>
          <option value="accepted">{t('status.accepted')}</option>
          <option value="rejected">{t('status.rejected')}</option>
          <option value="expired">{t('status.expired')}</option>
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
                <th className="table-header">Date</th>
                <th className="table-header">Company</th>
                <th className="table-header">Status</th>
                <th className="table-header text-right">Total</th>
                <th className="table-header">Currency</th>
                <th className="table-header">Valid Until</th>
                <th className="table-header">Version</th>
              </tr>
            </thead>
            <tbody>
              {recent.map(q => (
                <tr key={q.id} className="table-row" onClick={() => navigate(`/quotations/${q.id}`)}>
                  <td className="table-cell font-medium text-blue-600">{q.quotation_number}</td>
                  <td className="table-cell text-xs text-gray-500">{q.quotation_date || q.created_at?.slice(0, 10) || '—'}</td>
                  <td className="table-cell text-gray-900">{q.company_name || '—'}</td>
                  <td className="table-cell"><StatusBadge status={q.status} /></td>
                  <td className="table-cell text-right font-mono text-sm font-medium">{formatCurrency(q.total, q.currency)}</td>
                  <td className="table-cell text-xs text-gray-500">{q.currency}</td>
                  <td className="table-cell text-xs text-gray-500">{q.valid_until || '—'}</td>
                  <td className="table-cell text-xs text-gray-500">Rev {q.version || 1}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {recent.length === 0 && (
            <div className="text-center py-12 text-gray-400 text-sm">{t('noData.quotations')}</div>
          )}
        </div>
      )}
    </div>
  );
}
