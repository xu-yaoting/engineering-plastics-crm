import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import StatusBadge from '../components/shared/StatusBadge';
import { formatCurrency } from '../lib/currency';
import { useTranslation } from 'react-i18next';
import Icon from '../components/shared/Icon';
import { exportFullCsv } from '../lib/exportCsv';

export default function Orders() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/orders')
      .then(r => r.json())
      .then(setList)
      .finally(() => setLoading(false));
  }, []);

  const filtered = list.filter(o =>
    !search ||
    o.order_number?.toLowerCase().includes(search.toLowerCase()) ||
    o.company_name?.toLowerCase().includes(search.toLowerCase()) ||
    o.customer_po_number?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{t('page.title.orders')}</h1>
          <p className="text-sm text-gray-500">{list.length} {t('page.title.orders')}</p>
        </div>
          <button onClick={() => exportFullCsv('/api/orders', 'orders')} className="btn-secondary btn-sm"><Icon name="download" size={14} className="mr-1" />CSV</button>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <input className="input max-w-sm" placeholder={t('common.searchOrders')} value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">{t('common.loading')}</div>
      ) : (
        <div className="card">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="table-header">{t('page.orders.orderNumber')}</th>
                <th className="table-header">{t('page.orders.company')}</th>
                <th className="table-header">{t('page.orders.status')}</th>
                <th className="table-header">{t('page.orders.payment')}</th>
                <th className="table-header text-right">{t('page.orders.total')}</th>
                <th className="table-header">{t('page.orders.date')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o: any) => (
                <tr key={o.id} className="table-row" onClick={() => navigate(`/orders/${o.id}`)}>
                  <td className="table-cell font-medium text-blue-600">{o.order_number}</td>
                  <td className="table-cell text-gray-900">{o.company_name || '—'}</td>
                  <td className="table-cell"><StatusBadge status={o.status} /></td>
                  <td className="table-cell"><StatusBadge status={o.payment_status} /></td>
                  <td className="table-cell text-right font-mono text-sm font-medium">{formatCurrency(o.total, o.currency)}</td>
                  <td className="table-cell text-xs text-gray-400">{o.order_date?.slice(0, 10)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400 text-sm">{t('noData.orders')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
