import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import SidePanel from '../shared/SidePanel';
import { auth } from '../../lib/api';
import { materialsToolingApi } from '../../lib/materials-tooling-api';
import type { MaterialsPermission } from '../../lib/materials-tooling-api';

const STATUS_LABELS: Record<string, string> = {
  draft: 'page.materialsTooling.status.draft',
  pending_approval: 'page.materialsTooling.status.pendingApproval',
  approved: 'page.materialsTooling.status.approved',
  rejected: 'page.materialsTooling.status.rejected',
  pending_execution: 'page.materialsTooling.status.pendingExecution',
  executed: 'page.materialsTooling.status.executed',
  awaiting_signed_copy: 'page.materialsTooling.status.awaitingSignedCopy',
  completed: 'page.materialsTooling.status.completed',
  withdrawn: 'page.materialsTooling.status.withdrawn',
  voided: 'page.materialsTooling.status.voided',
};

function shortDocType(docType: string): string {
  switch (docType) {
    case 'purchase_request': return 'PR';
    case 'purchase_receipt': return 'GR';
    case 'material_issue': return 'MI';
    case 'material_return': return 'MR';
    case 'scrap': return 'SC';
    case 'count_adjustment': return 'CA';
    case 'tooling_movement': return 'TM';
    default: return docType;
  }
}

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = filename; link.click();
  URL.revokeObjectURL(url);
}

export function ApprovalsTab({ permissions }: { permissions: MaterialsPermission | null }) {
  const { t } = useTranslation();
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selected, setSelected] = useState<any | null>(null);

  const canApprove = permissions?.approve ?? false;

  const load = () => {
    setLoading(true);
    Promise.all([materialsToolingApi.listDocuments(), auth.me()])
      .then(([data, me]) => { setDocuments(data.documents); setCurrentUserId(me.user.id); })
      .catch(err => toast.error(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  // Documents pending approval for the current user
  const pendingDocs = documents.filter(doc => (
    doc.status === 'pending_approval' && doc.assigned_approver_user_id === currentUserId
  ));

  const doApprove = async (docId: string) => {
    try {
      await materialsToolingApi.approveDocument(docId);
      toast.success(t('page.materialsTooling.status.approved'));
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('page.materialsTooling.error.saveFailed'));
    }
  };

  const doReject = async (docId: string) => {
    if (!rejectReason.trim()) return;
    try {
      await materialsToolingApi.rejectDocument(docId, { reason: rejectReason });
      toast.success(t('page.materialsTooling.status.rejected'));
      setRejectId(null);
      setRejectReason('');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('page.materialsTooling.error.saveFailed'));
    }
  };
  const openDetail = async (docId: string): Promise<void> => {
    try { setSelected((await materialsToolingApi.getDocument(docId)).document); }
    catch (error) { toast.error(error instanceof Error ? error.message : String(error)); }
  };
  const downloadApplicationPdf = async (doc: any): Promise<void> => {
    try { saveBlob(await materialsToolingApi.downloadApplicationPdf(doc.id), `${doc.document_number}-application.pdf`); }
    catch (error) { toast.error(error instanceof Error ? error.message : String(error)); }
  };

  const renderActions = (doc: any, compact = false) => (
    <div className={compact ? 'flex w-full flex-wrap items-center gap-3' : 'inline-flex items-center gap-2'}>
      <button onClick={() => openDetail(doc.id)} className="text-xs text-blue-600 hover:underline">{t('page.materialsTooling.reviewDetails')}</button>
      <button onClick={() => downloadApplicationPdf(doc)} className="text-xs text-blue-600 hover:underline">{t('page.materialsTooling.applicationPdf')}</button>
      {canApprove && (
        <>
          <button
            onClick={() => doApprove(doc.id)}
            className="text-xs font-medium text-green-600 hover:underline"
          >{t('page.materialsTooling.approveAction')}</button>
          {rejectId === doc.id ? (
            <div className={compact ? 'flex w-full flex-wrap items-center gap-2' : 'inline-flex items-center gap-1'}>
              <label className="sr-only" htmlFor={`approval-reject-reason-${doc.id}`}>
                {t('page.materialsTooling.rejectReason')}
              </label>
              <input
                id={`approval-reject-reason-${doc.id}`}
                className={compact ? 'input min-w-0 flex-1 text-xs' : 'input w-32 text-xs'}
                placeholder={t('page.materialsTooling.rejectReason')}
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
              />
              <button
                onClick={() => doReject(doc.id)}
                disabled={!rejectReason.trim()}
                className="text-xs text-red-600 hover:underline"
              >{t('page.materialsTooling.rejectAction')}</button>
              <button
                onClick={() => { setRejectId(null); setRejectReason(''); }}
                className="text-xs text-gray-400 hover:underline"
              >{t('common.cancel')}</button>
            </div>
          ) : (
            <button
              onClick={() => setRejectId(doc.id)}
              className="text-xs text-red-500 hover:underline"
            >{t('page.materialsTooling.rejectAction')}</button>
          )}
        </>
      )}
    </div>
  );

  return (
    <div>
      <div className="toolbar mb-4">
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 tabular-nums">
            {t('page.materialsTooling.pendingApprovals')}: {pendingDocs.length}
          </span>
        </div>
      </div>

      {!canApprove && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-500 mb-4">
          {t('page.materialsTooling.error.unauthorized')}
        </div>
      )}

      <div className="space-y-2 md:hidden">
        {loading && [0, 1, 2].map(row => (
          <div key={row} className="data-surface animate-pulse p-4">
            <div className="h-4 w-2/3 rounded bg-gray-100" />
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="h-3 rounded bg-gray-100" />
              <div className="h-3 rounded bg-gray-100" />
              <div className="h-3 rounded bg-gray-100" />
              <div className="h-3 rounded bg-gray-100" />
            </div>
          </div>
        ))}
        {pendingDocs.length > 0 && (
          <div className="px-1 text-xs font-medium text-blue-600">
            {t('page.materialsTooling.assignedApprovalQueue')}
          </div>
        )}
        {pendingDocs.map((doc: any) => (
          <article key={doc.id} className="data-surface space-y-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-xs tabular-nums text-gray-500">{doc.document_number}</p>
                <h3 className="font-medium text-gray-900">{shortDocType(doc.document_type)}</h3>
              </div>
              <span className="shrink-0 rounded bg-amber-50 px-2 py-0.5 text-2xs font-450 text-amber-600">
                {t(STATUS_LABELS.pending_approval)}
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div className="min-w-0">
                <dt className="section-label">{t('page.materialsTooling.department')}</dt>
                <dd className="truncate text-gray-700">{doc.department || '—'}</dd>
              </div>
              <div>
                <dt className="section-label">{t('page.materialsTooling.requestDate')}</dt>
                <dd className="text-gray-700">{doc.request_date || '—'}</dd>
              </div>
            </dl>
            <div className="border-t border-gray-100 pt-3">{renderActions(doc, true)}</div>
          </article>
        ))}
        {!loading && pendingDocs.length === 0 && <div className="empty-state">{t('page.materialsTooling.noData')}</div>}
      </div>

      <div className="hidden data-surface overflow-x-auto md:block">
        <table className="w-full">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="table-header">{t('page.materialsTooling.documentNumber')}</th>
              <th className="table-header">{t('page.materialsTooling.documentTypeLabel')}</th>
              <th className="table-header">{t('page.materialsTooling.statusLabel')}</th>
              <th className="table-header">{t('page.materialsTooling.department')}</th>
              <th className="table-header">{t('page.materialsTooling.requestDate')}</th>
              <th className="table-header"></th>
            </tr>
          </thead>
          <tbody>
            {loading && [0, 1, 2].map(row => (
              <tr key={row} className="animate-pulse border-b border-gray-100">
                <td colSpan={6} className="px-4 py-3"><div className="h-4 rounded bg-gray-100" /></td>
              </tr>
            ))}
            {/* Pending approvals queue */}
            {pendingDocs.length > 0 && (
              <tr className="bg-blue-50/50">
                <td colSpan={6} className="px-4 py-2 text-xs font-medium text-blue-600">
                  {t('page.materialsTooling.assignedApprovalQueue')}
                </td>
              </tr>
            )}
            {pendingDocs.map((doc: any) => (
              <tr key={doc.id} className="border-b border-gray-100">
                <td className="table-cell tabular-nums text-xs text-gray-500">{doc.document_number}</td>
                <td className="table-cell text-xs text-gray-500">{shortDocType(doc.document_type)}</td>
                <td className="table-cell">
                  <span className="inline-flex px-2 py-0.5 rounded text-2xs font-450 bg-amber-50 text-amber-600">
                    {t(STATUS_LABELS.pending_approval)}
                  </span>
                </td>
                <td className="table-cell text-xs text-gray-500">{doc.department || '—'}</td>
                <td className="table-cell text-xs text-gray-400">{doc.request_date || '—'}</td>
                    <td className="table-cell text-right">{renderActions(doc)}</td>
              </tr>
            ))}
            {!loading && pendingDocs.length === 0 && (
              <tr><td colSpan={6}><div className="empty-state">{t('page.materialsTooling.noData')}</div></td></tr>
            )}
          </tbody>
        </table>
      </div>
      <SidePanel
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.document_number || t('workspace.details')}
        subtitle={selected?.purpose || undefined}
        width="w-[min(720px,calc(100vw-1rem))]"
      >
        {selected && <>
          <div className="overflow-x-auto"><table className="w-full"><thead><tr><th className="table-header">{t('page.materialsTooling.materials')}</th><th className="table-header">{t('page.materialsTooling.quantity')}</th><th className="table-header">{t('page.materialsTooling.unit')}</th>{permissions?.viewPrices && <th className="table-header">{t('page.materialsTooling.unitPrice')}</th>}</tr></thead><tbody>
            {(selected.lines ?? []).map((line: any) => <tr key={line.id}><td className="table-cell">{line.item_name ?? line.material_item_id}</td><td className="table-cell">{line.execution_quantity ?? line.requested_quantity}</td><td className="table-cell">{line.unit}</td>{permissions?.viewPrices && <td className="table-cell">{line.tax_inclusive_unit_price ?? '-'}</td>}</tr>)}
          </tbody></table></div>
          {selected.tooling_request && <div className="mt-3 text-sm"><p>{t('page.materialsTooling.toolingTab')}: {selected.tooling_request.asset_code ?? selected.tooling_request.asset_id}</p><p>{t('page.materialsTooling.action')}: {t(`page.materialsTooling.toolingAction.${selected.tooling_request.action}`)}</p><p>{t('page.materialsTooling.targetLocation')}: {selected.tooling_request.to_location || '-'}</p></div>}
        </>}
      </SidePanel>
    </div>
  );
}
