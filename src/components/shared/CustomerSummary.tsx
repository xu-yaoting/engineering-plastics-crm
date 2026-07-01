import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '../../lib/currency';

interface SummaryProps {
  company: any;
  inquiries: any[];
  quotations: any[];
  orders: any[];
  activities: any[];
  tasks: any[];
}

export default function CustomerSummary({
  company, inquiries, quotations, orders, activities, tasks,
}: SummaryProps) {
  const { t, i18n } = useTranslation();

  // Compute summary metrics
  const summary = useMemo(() => {
    const wonQuotes = quotations.filter((q: any) => q.status === 'accepted');
    const totalRevenue = wonQuotes.reduce((s: number, q: any) => s + (q.total || 0), 0);
    const openInquiries = inquiries.filter((i: any) => i.status !== 'closed_won' && i.status !== 'closed_lost');
    const openQuotes = quotations.filter((q: any) => q.status !== 'accepted' && q.status !== 'rejected' && q.status !== 'expired' && q.status !== 'cancelled');
    const openOrders = orders.filter((o: any) => o.status !== 'delivered' && o.status !== 'cancelled');
    const recentActivity = activities.slice(0, 3);
    const pendingTasks = tasks.filter((t: any) => t.status !== 'completed');
    const overdueTasks = tasks.filter((t: any) => t.status !== 'completed' && t.due_date && new Date(t.due_date) < new Date());

    // Most common product
    const productCounts: Record<string, number> = {};
    inquiries.forEach((i: any) => {
      const mat = i.target_material_requested?.split(' ')[0];
      if (mat) productCounts[mat] = (productCounts[mat] || 0) + 1;
    });
    quotations.forEach((q: any) => {
      // Could also extract from line items
    });
    const topProduct = Object.entries(productCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || null;

    // Next best action
    let nextAction = '';
    let nextActionLink = '';
    if (overdueTasks.length > 0) {
      nextAction = t('page.customerSummary.followOverdueTask');
      nextActionLink = '/tasks';
    } else if (openInquiries.length > 0) {
      nextAction = t('page.customerSummary.quotePendingInquiry', { number: openInquiries[0].inquiry_number });
      nextActionLink = `/inquiries/${openInquiries[0].id}`;
    } else if (openQuotes.length > 0) {
      nextAction = t('page.customerSummary.followQuotation', { number: openQuotes[0].quotation_number });
      nextActionLink = `/quotations/${openQuotes[0].id}`;
    } else if (recentActivity.length === 0) {
      nextAction = t('page.customerSummary.noRecentReachOut');
      nextActionLink = `/companies/${company?.id}`;
    } else {
      nextAction = t('page.customerSummary.accountActiveUpsell');
      nextActionLink = `/companies/${company?.id}`;
    }

    const revenueCurrency = wonQuotes[0]?.currency || 'USD';

    return {
      totalRevenue, openInquiries, openQuotes, openOrders, revenueCurrency,
      recentActivity, pendingTasks, overdueTasks, topProduct,
      nextAction, nextActionLink,
      lastActivity: activities[0]?.created_at ? new Date(activities[0].created_at) : null,
      daysSinceLastActivity: activities[0]?.created_at
        ? Math.floor((Date.now() - new Date(activities[0].created_at).getTime()) / (1000 * 60 * 60 * 24))
        : null,
    };
  }, [company, inquiries, quotations, orders, activities, tasks, t]);

  if (!company) return null;

  return (
    <div className="space-y-3">
      {/* Briefing Card */}
      <div className="bg-gradient-to-br from-blue-50 to-white rounded-xl border border-blue-100 p-4">
        <h3 className="text-2xs font-450 text-blue-600 uppercase tracking-[0.08em] mb-3">
          {t('page.customerSummary.customerBriefing')}
        </h3>

        {/* Key metrics grid */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <Metric label={t('page.customerSummary.ytdRevenue')} value={formatCurrency(summary.totalRevenue, summary.revenueCurrency)} color="text-green-600" />
          <Metric
            label={t('page.customerSummary.lastActivity')}
            value={summary.daysSinceLastActivity !== null ? t('page.customerSummary.daysAgo', { count: summary.daysSinceLastActivity }) : t('page.customerSummary.never')}
            color={summary.daysSinceLastActivity !== null && summary.daysSinceLastActivity > 30 ? 'text-red-600' : 'text-gray-700'}
          />
          <Metric label={t('page.customerSummary.openOpportunities')} value={(summary.openInquiries.length + summary.openQuotes.length).toString()} color="text-blue-600" />
          <Metric label={t('page.customerSummary.activeOrders')} value={summary.openOrders.length.toString()} color="text-yellow-600" />
        </div>

        {/* Product focus */}
        {summary.topProduct && (
          <div className="text-xs text-gray-600 mb-3">
            <span className="text-gray-400">{t('page.customerSummary.topProduct')}:</span>{' '}
            <span className="font-medium">{summary.topProduct}</span>
          </div>
        )}

        {/* Overdue warning */}
        {summary.overdueTasks.length > 0 && (
          <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-3">
            <span className="text-xs font-medium text-red-700">
              {t('page.customerSummary.overdueTask', { count: summary.overdueTasks.length })}
            </span>
          </div>
        )}

        {/* Dormant warning */}
        {summary.daysSinceLastActivity !== null && summary.daysSinceLastActivity > 30 && (
          <div className="bg-yellow-50 border border-yellow-100 rounded-lg px-3 py-2 mb-3">
            <span className="text-xs font-medium text-yellow-700">
              {t('page.customerSummary.noActivityFor', { count: summary.daysSinceLastActivity })}
            </span>
          </div>
        )}

        {/* Next Best Action */}
        <Link
          to={summary.nextActionLink}
          className="block bg-blue-600 text-white rounded-lg px-3 py-2 text-xs font-medium text-center hover:bg-blue-700 transition-colors"
        >
          {summary.nextAction}
        </Link>
      </div>

      {/* Recent Activity Preview */}
      {summary.recentActivity.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <h4 className="text-2xs font-450 text-gray-500 uppercase tracking-[0.08em] mb-2">{t('page.customerSummary.recentActivity')}</h4>
          <div className="space-y-1.5">
            {summary.recentActivity.map((a: any) => (
              <div key={a.id} className="text-xs text-gray-600 flex items-start gap-1.5">
                <span className="text-gray-400">
                  {a.activity_type === 'call' ? '' : a.activity_type === 'email' ? '' : a.activity_type === 'meeting' ? '' : ''}
                </span>
                <span className="flex-1 truncate">{a.subject}</span>
                <span className="text-2xs text-gray-400 flex-shrink-0">
                  {new Date(a.created_at).toLocaleDateString(i18n.language === 'zh' ? 'zh-CN' : undefined)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pipeline Summary */}
      <div className="bg-white rounded-xl border border-gray-200 p-3">
        <h4 className="text-2xs font-450 text-gray-500 uppercase tracking-[0.08em] mb-2">{t('page.customerSummary.pipelineSummary')}</h4>
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-500">{t('page.customerSummary.openInquiries')}</span>
            <span className="font-medium">{summary.openInquiries.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">{t('page.customerSummary.openQuotes')}</span>
            <span className="font-medium">{summary.openQuotes.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">{t('page.customerSummary.activeOrders')}</span>
            <span className="font-medium">{summary.openOrders.length}</span>
          </div>
          <div className="flex justify-between pt-1.5 border-t border-gray-100">
            <span className="text-gray-500">{t('page.customerSummary.pendingTasks')}</span>
            <span className={`font-medium ${summary.pendingTasks.length > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
              {summary.pendingTasks.length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white/80 rounded-lg px-2.5 py-2">
      <div className="text-2xs text-gray-400">{label}</div>
      <div className={`text-sm font-semibold ${color}`}>{value}</div>
    </div>
  );
}
