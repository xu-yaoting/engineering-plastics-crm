import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import Icon from '../shared/Icon';
import SidePanel from '../shared/SidePanel';
import { team, type TeamMember } from '../../lib/api';
import { materialsToolingApi, type MaterialsAttachment } from '../../lib/materials-tooling-api';

const DOCUMENT_TYPES = [
  'purchase_request', 'purchase_receipt', 'material_issue', 'material_return',
  'scrap', 'count_adjustment', 'tooling_movement',
] as const;
const TOOLING_ACTIONS = [
  'issue', 'return', 'loan', 'transfer', 'repair', 'repair_completion', 'disposal', 'loss_report',
] as const;
const STATUS_MAP: Record<string, string> = {
  draft: 'draft', pending_approval: 'pendingApproval', approved: 'approved', rejected: 'rejected',
  pending_execution: 'pendingExecution', executed: 'executed', awaiting_signed_copy: 'awaitingSignedCopy',
  completed: 'completed', withdrawn: 'withdrawn', voided: 'voided',
};
const today = () => new Date().toISOString().slice(0, 10);

type DocumentForm = {
  documentType: typeof DOCUMENT_TYPES[number]; department: string; requestDate: string;
  requiredDate: string; purpose: string;
  supplierId: string; contractNumber: string; invoiceNumber: string;
  assetId: string;
  action: typeof TOOLING_ACTIONS[number]; targetCustodianId: string; targetLocation: string; reason: string;
};
type MaterialLineForm = {
  itemId: string; quantity: string; unitPrice: string;
  systemQuantity: string; countedQuantity: string;
};
const EMPTY_LINE: MaterialLineForm = {
  itemId: '', quantity: '1', unitPrice: '', systemQuantity: '0', countedQuantity: '0',
};
const EMPTY_FORM: DocumentForm = {
  documentType: 'material_issue', department: '', requestDate: today(), requiredDate: '', purpose: '',
  assetId: '', supplierId: '', contractNumber: '', invoiceNumber: '',
  action: 'issue', targetCustodianId: '', targetLocation: '', reason: '',
};

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function DocumentsTab() {
  const { t } = useTranslation();
  const [documents, setDocuments] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [tooling, setTooling] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<DocumentForm>(EMPTY_FORM);
  const [lineForms, setLineForms] = useState<MaterialLineForm[]>([{ ...EMPTY_LINE }]);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<MaterialsAttachment[]>([]);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentCategory, setAttachmentCategory] = useState('other');
  const [uploading, setUploading] = useState(false);

  const load = (): void => {
    setLoading(true);
    Promise.all([
      materialsToolingApi.listDocuments(), materialsToolingApi.listItems(),
      materialsToolingApi.listTooling(), materialsToolingApi.listSuppliers(), team.list(),
    ]).then(([documentData, itemData, toolingData, supplierData, teamData]) => {
      setDocuments(documentData.documents);
      setItems(itemData.items);
      setTooling(toolingData.tooling);
      setSuppliers(supplierData.suppliers);
      setMembers(teamData);
    }).catch(error => toast.error(error.message)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const createDocument = async (): Promise<void> => {
    if (saving) return;
    setSaving(true);
    try {
      const base = {
        document_type: form.documentType,
        department: form.department,
        request_date: form.requestDate,
        required_date: form.requiredDate || undefined,
        purpose: form.purpose || undefined,
        supplier_id: ['purchase_request', 'purchase_receipt'].includes(form.documentType) ? form.supplierId || undefined : undefined,
        contract_number: ['purchase_request', 'purchase_receipt'].includes(form.documentType) ? form.contractNumber || undefined : undefined,
        invoice_number: form.documentType === 'purchase_receipt' ? form.invoiceNumber || undefined : undefined,
      };
      let payload: Record<string, unknown>;
      if (form.documentType === 'tooling_movement') {
        payload = {
          ...base,
          lines: [],
          tooling_request: {
            asset_id: form.assetId,
            action: form.action,
            to_custodian_user_id: form.targetCustodianId || undefined,
            to_location: form.targetLocation || undefined,
            reason: form.reason || undefined,
          },
        };
      } else {
        const lines = lineForms.map((lineForm) => {
          const item = items.find(candidate => candidate.id === lineForm.itemId);
          if (!item) throw new Error(t('page.materialsTooling.selectMaterial'));
          const quantity = Number(lineForm.quantity);
          const line: Record<string, unknown> = {
            material_item_id: item.id, requested_quantity: quantity,
            execution_quantity: form.documentType === 'purchase_request' ? 0 : quantity,
            unit: item.unit,
          };
          if (['purchase_request', 'purchase_receipt'].includes(form.documentType) && lineForm.unitPrice !== '') {
            line.tax_inclusive_unit_price = Number(lineForm.unitPrice);
          }
          if (form.documentType === 'count_adjustment') {
            const systemQuantity = Number(lineForm.systemQuantity);
            const countedQuantity = Number(lineForm.countedQuantity);
            line.system_quantity = systemQuantity; line.counted_quantity = countedQuantity;
            line.adjustment_delta = countedQuantity - systemQuantity;
          }
          return line;
        });
        payload = { ...base, lines };
      }
      if (editingId) {
        const updatePayload = { ...payload };
        delete updatePayload.document_type;
        await materialsToolingApi.updateDocument(editingId, updatePayload);
      } else await materialsToolingApi.createDocument(payload);
      toast.success(t(editingId ? 'page.materialsTooling.documentUpdated' : 'page.materialsTooling.documentCreated'));
      setForm({ ...EMPTY_FORM, requestDate: today() });
      setLineForms([{ ...EMPTY_LINE }]);
      setEditingId(null);
      setShowForm(false);
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('page.materialsTooling.error.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const openDetail = async (id: string): Promise<void> => {
    try {
      const [result, attachmentData] = await Promise.all([
        materialsToolingApi.getDocument(id), materialsToolingApi.listDocumentAttachments(id),
      ]);
      setSelected(result.document);
      setAttachments(attachmentData.attachments);
    } catch (error) { toast.error(error instanceof Error ? error.message : String(error)); }
  };
  const editDocument = async (id: string): Promise<void> => {
    try {
      const { document: doc } = await materialsToolingApi.getDocument(id);
      const toolingRequest = doc.tooling_request;
      setForm({
        documentType: doc.document_type,
        department: doc.department ?? '', requestDate: doc.request_date ?? today(),
        requiredDate: doc.required_date ?? '', purpose: doc.purpose ?? '',
        supplierId: doc.supplier_id ?? '', contractNumber: doc.contract_number ?? '',
        invoiceNumber: doc.invoice_number ?? '',
        assetId: toolingRequest?.asset_id ?? '', action: toolingRequest?.action ?? 'issue',
        targetCustodianId: toolingRequest?.to_custodian_user_id ?? '',
        targetLocation: toolingRequest?.to_location ?? '', reason: toolingRequest?.reason ?? '',
      });
      setLineForms((doc.lines?.length ? doc.lines : [{}]).map((line: any) => ({
        itemId: line.material_item_id ?? '', quantity: String(line.requested_quantity ?? 1),
        unitPrice: line.tax_inclusive_unit_price == null ? '' : String(line.tax_inclusive_unit_price),
        systemQuantity: String(line.system_quantity ?? 0), countedQuantity: String(line.counted_quantity ?? 0),
      })));
      setEditingId(id);
      setShowForm(true);
    } catch (error) { toast.error(error instanceof Error ? error.message : String(error)); }
  };
  const uploadAttachment = async (): Promise<void> => {
    if (!selected || !attachmentFile || uploading) return;
    setUploading(true);
    try {
      const data = new FormData();
      data.set('category', attachmentCategory);
      data.set('file', attachmentFile);
      await materialsToolingApi.uploadAttachment(selected.id, data);
      setAttachmentFile(null);
      const refreshed = await materialsToolingApi.listDocumentAttachments(selected.id);
      setAttachments(refreshed.attachments);
      toast.success(t('page.materialsTooling.attachmentUploaded'));
    } catch (error) { toast.error(error instanceof Error ? error.message : String(error)); }
    finally { setUploading(false); }
  };
  const downloadAttachment = async (attachment: MaterialsAttachment): Promise<void> => {
    if (!selected) return;
    try {
      const blob = await materialsToolingApi.downloadAttachment(selected.id, attachment.id);
      saveBlob(blob, attachment.original_name);
    } catch (error) { toast.error(error instanceof Error ? error.message : String(error)); }
  };
  const run = async (operation: () => Promise<unknown>, messageKey: string): Promise<void> => {
    try { await operation(); toast.success(t(messageKey)); load(); }
    catch (error) { toast.error(error instanceof Error ? error.message : String(error)); }
  };
  const downloadPdf = async (doc: any, approved: boolean): Promise<void> => {
    try {
      const blob = approved
        ? await materialsToolingApi.downloadApprovedPdf(doc.id)
        : await materialsToolingApi.downloadApplicationPdf(doc.id);
      saveBlob(blob, `${doc.document_number}-${approved ? 'approved' : 'application'}.pdf`);
    } catch (error) { toast.error(error instanceof Error ? error.message : String(error)); }
  };
  const voidAndReplace = async (doc: any): Promise<void> => {
    const reason = window.prompt(t('page.materialsTooling.voidReason'))?.trim();
    if (!reason) return;
    await run(
      () => materialsToolingApi.voidAndReplaceDocument(doc.id, { reason }),
      'page.materialsTooling.replacementCreated',
    );
  };

  const renderDocumentActions = (doc: any, compact = false) => (
    <div className={compact ? 'flex flex-wrap items-center gap-3' : 'inline-flex flex-wrap justify-end gap-2'}>
      <button className="text-xs text-blue-600" onClick={() => openDetail(doc.id)}>{t('common.view')}</button>
      {doc.status === 'draft' && <button className="text-xs text-blue-600" onClick={() => editDocument(doc.id)}>{t('common.edit')}</button>}
      <button className="text-xs text-blue-600" onClick={() => downloadPdf(doc, false)}>{t('page.materialsTooling.applicationPdf')}</button>
      {['approved', 'pending_execution', 'executed', 'awaiting_signed_copy', 'completed'].includes(doc.status) && <button className="text-xs text-blue-600" onClick={() => downloadPdf(doc, true)}>{t('page.materialsTooling.approvedPdf')}</button>}
      {doc.status === 'draft' && <button className="text-xs text-blue-600" onClick={() => run(() => materialsToolingApi.submitDocument(doc.id), 'page.materialsTooling.status.pendingApproval')}>{t('page.materialsTooling.submit')}</button>}
      {['draft', 'pending_approval', 'rejected'].includes(doc.status) && <button className="text-xs text-gray-500" onClick={() => run(() => materialsToolingApi.withdrawDocument(doc.id), 'page.materialsTooling.status.withdrawn')}>{t('page.materialsTooling.withdraw')}</button>}
      {doc.status === 'pending_execution' && <button className="text-xs text-green-600" onClick={() => run(() => materialsToolingApi.executeDocument(doc.id), 'page.materialsTooling.status.executed')}>{t('page.materialsTooling.execute')}</button>}
      {['executed', 'awaiting_signed_copy', 'completed'].includes(doc.status) && <button className="text-xs text-red-600" onClick={() => voidAndReplace(doc)}>{t('page.materialsTooling.voidReplace')}</button>}
    </div>
  );

  const filtered = documents.filter(doc => (
    (!typeFilter || doc.document_type === typeFilter) && (!statusFilter || doc.status === statusFilter)
  ));
  const isTooling = form.documentType === 'tooling_movement';
  const addMaterialLine = (): void => setLineForms(current => [...current, { ...EMPTY_LINE }]);
  const removeMaterialLine = (index: number): void => setLineForms(current => current.filter((_, currentIndex) => currentIndex !== index));
  const updateMaterialLine = (index: number, patch: Partial<MaterialLineForm>): void => {
    setLineForms(current => current.map((line, currentIndex) => currentIndex === index ? { ...line, ...patch } : line));
  };

  return <div>
    <div className="toolbar mb-4 justify-between flex-wrap gap-3">
      <div className="flex items-center gap-3">
        <Icon name="filter" size="toolbar" className="text-gray-400" />
        <label className="sr-only" htmlFor="materials-documents-type-filter">{t('page.materialsTooling.allTypes')}</label>
        <select id="materials-documents-type-filter" className="input w-48" value={typeFilter} onChange={event => setTypeFilter(event.target.value)}>
          <option value="">{t('page.materialsTooling.allTypes')}</option>
          {DOCUMENT_TYPES.map(type => <option key={type} value={type}>{t(`page.materialsTooling.documentType.${type}`)}</option>)}
        </select>
        <label className="sr-only" htmlFor="materials-documents-status-filter">{t('page.materialsTooling.allStatuses')}</label>
        <select id="materials-documents-status-filter" className="input w-44" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
          <option value="">{t('page.materialsTooling.allStatuses')}</option>
          {Object.entries(STATUS_MAP).map(([status, key]) => <option key={status} value={status}>{t(`page.materialsTooling.status.${key}`)}</option>)}
        </select>
      </div>
      <button className="btn-primary btn-sm" onClick={() => { setEditingId(null); setForm({ ...EMPTY_FORM, requestDate: today() }); setLineForms([{ ...EMPTY_LINE }]); setShowForm(value => !value); }}>
        <Icon name="plus" size={15} className="mr-1.5" />{t('page.materialsTooling.newDocument')}
      </button>
    </div>

    <SidePanel
      open={showForm}
      onClose={() => {
        if (!saving) {
          setShowForm(false);
          setEditingId(null);
        }
      }}
      title={t(editingId ? 'page.materialsTooling.editDocument' : 'page.materialsTooling.newDocument')}
      subtitle={t(`page.materialsTooling.documentType.${form.documentType}`)}
      width="w-[min(760px,calc(100vw-1rem))]"
    >
      <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <legend className="sr-only">{t(editingId ? 'page.materialsTooling.editDocument' : 'page.materialsTooling.newDocument')}</legend>
        <label className="label">{t('page.materialsTooling.documentTypeLabel')}
          <select className="input mt-1" value={form.documentType} onChange={event => setForm(value => ({ ...value, documentType: event.target.value as DocumentForm['documentType'] }))}>
            {DOCUMENT_TYPES.map(type => <option key={type} value={type}>{t(`page.materialsTooling.documentType.${type}`)}</option>)}
          </select>
        </label>
        <label className="label">{t('page.materialsTooling.department')} *
          <input className="input mt-1" value={form.department} onChange={event => setForm(value => ({ ...value, department: event.target.value }))} />
        </label>
        <label className="label">{t('page.materialsTooling.requestDate')} *
          <input type="date" className="input mt-1" value={form.requestDate} onChange={event => setForm(value => ({ ...value, requestDate: event.target.value }))} />
        </label>
        <label className="label">{t('page.materialsTooling.requiredDate')}
          <input type="date" className="input mt-1" value={form.requiredDate} onChange={event => setForm(value => ({ ...value, requiredDate: event.target.value }))} />
        </label>
        <label className="label sm:col-span-2">{t('page.materialsTooling.purpose')}
          <input className="input mt-1" value={form.purpose} onChange={event => setForm(value => ({ ...value, purpose: event.target.value }))} />
        </label>
        {!isTooling && <>
          {['purchase_request', 'purchase_receipt'].includes(form.documentType) && <>
            <label className="label">{t('page.materialsTooling.supplier')}
              <select className="input mt-1" value={form.supplierId} onChange={event => setForm(value => ({ ...value, supplierId: event.target.value }))}>
                <option value="">{t('common.none')}</option>{suppliers.filter(supplier => supplier.is_active).map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.code} · {supplier.name}</option>)}
              </select>
            </label>
            <label className="label">{t('page.materialsTooling.contractNumber')}<input className="input mt-1" value={form.contractNumber} onChange={event => setForm(value => ({ ...value, contractNumber: event.target.value }))} /></label>
            {form.documentType === 'purchase_receipt' && <label className="label">{t('page.materialsTooling.invoiceNumber')}<input className="input mt-1" value={form.invoiceNumber} onChange={event => setForm(value => ({ ...value, invoiceNumber: event.target.value }))} /></label>}
          </>}
          <div className="sm:col-span-2 space-y-3">{lineForms.map((lineForm, index) => {
            const selectedItem = items.find(item => item.id === lineForm.itemId);
            return <div key={index} className="grid grid-cols-1 gap-3 rounded border border-gray-200 p-3 sm:grid-cols-2">
              <label className="label">{t('page.materialsTooling.materials')} *<select className="input mt-1" value={lineForm.itemId} onChange={event => updateMaterialLine(index, { itemId: event.target.value })}><option value="">{t('page.materialsTooling.selectMaterial')}</option>{items.filter(item => item.is_active).map(item => <option key={item.id} value={item.id}>{item.code} · {item.name} ({item.unit})</option>)}</select></label>
              <label className="label">{t('page.materialsTooling.quantity')} ({selectedItem?.unit ?? '-'}) *<input type="number" min="0.0001" step="any" className="input mt-1" value={lineForm.quantity} onChange={event => updateMaterialLine(index, { quantity: event.target.value })} /></label>
              {['purchase_request', 'purchase_receipt'].includes(form.documentType) && <label className="label">{t('page.materialsTooling.unitPrice')}<input type="number" min="0" step="any" className="input mt-1" value={lineForm.unitPrice} onChange={event => updateMaterialLine(index, { unitPrice: event.target.value })} /></label>}
              {form.documentType === 'count_adjustment' && <><label className="label">{t('page.materialsTooling.systemQuantity')}<input type="number" className="input mt-1" value={lineForm.systemQuantity} onChange={event => updateMaterialLine(index, { systemQuantity: event.target.value })} /></label><label className="label">{t('page.materialsTooling.countedQuantity')}<input type="number" className="input mt-1" value={lineForm.countedQuantity} onChange={event => updateMaterialLine(index, { countedQuantity: event.target.value })} /></label></>}
              {lineForms.length > 1 && <button type="button" className="btn-secondary btn-sm justify-self-start" onClick={() => removeMaterialLine(index)}>{t('page.materialsTooling.removeLine')}</button>}
            </div>;
          })}<button type="button" className="btn-secondary btn-sm" onClick={addMaterialLine}>{t('page.materialsTooling.addLine')}</button></div>
        </>}
        {isTooling && <>
          <label className="label">{t('page.materialsTooling.toolingTab')} *
            <select className="input mt-1" value={form.assetId} onChange={event => setForm(value => ({ ...value, assetId: event.target.value }))}>
              <option value="">{t('page.materialsTooling.selectTooling')}</option>
              {tooling.filter(asset => !['disposed', 'lost'].includes(asset.status)).map(asset => <option key={asset.id} value={asset.id}>{asset.tooling_code} · {asset.name}</option>)}
            </select>
          </label>
          <label className="label">{t('page.materialsTooling.action')} *
            <select className="input mt-1" value={form.action} onChange={event => setForm(value => ({ ...value, action: event.target.value as DocumentForm['action'] }))}>
              {TOOLING_ACTIONS.map(action => <option key={action} value={action}>{t(`page.materialsTooling.toolingAction.${action}`)}</option>)}
            </select>
          </label>
          <label className="label">{t('page.materialsTooling.targetCustodian')}
            <select className="input mt-1" value={form.targetCustodianId} onChange={event => setForm(value => ({ ...value, targetCustodianId: event.target.value }))}>
              <option value="">{t('common.none')}</option>{members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
            </select>
          </label>
          <label className="label">{t('page.materialsTooling.targetLocation')}<input className="input mt-1" value={form.targetLocation} onChange={event => setForm(value => ({ ...value, targetLocation: event.target.value }))} /></label>
          <label className="label sm:col-span-2">{t('page.materialsTooling.reason')}<input className="input mt-1" value={form.reason} onChange={event => setForm(value => ({ ...value, reason: event.target.value }))} /></label>
        </>}
      </fieldset>
      <div className="sticky bottom-0 z-10 -mx-5 mt-4 flex gap-2 border-t border-gray-200 bg-white px-5 pt-4"><button disabled={saving} className="btn-primary btn-sm" onClick={createDocument}>{saving ? t('common.loading') : t(editingId ? 'common.save' : 'common.create')}</button><button disabled={saving} className="btn-secondary btn-sm" onClick={() => { setShowForm(false); setEditingId(null); }}>{t('common.cancel')}</button></div>
    </SidePanel>

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
      {filtered.map(doc => (
        <article key={doc.id} className="data-surface space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-xs tabular-nums text-gray-500">{doc.document_number}</p>
              <h3 className="break-words font-medium text-gray-900">{t(`page.materialsTooling.documentType.${doc.document_type}`)}</h3>
            </div>
            <span className={`shrink-0 rounded px-2 py-0.5 text-2xs font-450 ${
              doc.status === 'completed' ? 'bg-green-50 text-green-600'
                : doc.status === 'rejected' || doc.status === 'voided' ? 'bg-red-50 text-red-600'
                  : doc.status === 'pending_approval' || doc.status === 'pending_execution' ? 'bg-amber-50 text-amber-600'
                    : 'bg-gray-100 text-gray-600'
            }`}>
              {t(`page.materialsTooling.status.${STATUS_MAP[doc.status] ?? 'draft'}`)}
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
          <div className="border-t border-gray-100 pt-3">{renderDocumentActions(doc, true)}</div>
        </article>
      ))}
      {!loading && filtered.length === 0 && <div className="empty-state">{t('page.materialsTooling.noData')}</div>}
    </div>

    <div className="hidden data-surface overflow-x-auto md:block"><table className="w-full"><thead className="sticky top-0 z-10"><tr className="border-b bg-gray-50">
      <th className="table-header">{t('page.materialsTooling.code')}</th><th className="table-header">{t('page.materialsTooling.documentTypeLabel')}</th><th className="table-header">{t('page.materialsTooling.statusLabel')}</th><th className="table-header">{t('page.materialsTooling.department')}</th><th className="table-header">{t('page.materialsTooling.requestDate')}</th><th className="table-header"></th>
    </tr></thead><tbody>
      {loading && <tr><td colSpan={6} className="table-cell">{t('common.loading')}</td></tr>}
      {filtered.map(doc => <tr key={doc.id} className="border-b border-gray-100">
        <td className="table-cell tabular-nums">{doc.document_number}</td><td className="table-cell">{t(`page.materialsTooling.documentType.${doc.document_type}`)}</td><td className="table-cell">{t(`page.materialsTooling.status.${STATUS_MAP[doc.status] ?? 'draft'}`)}</td><td className="table-cell">{doc.department}</td><td className="table-cell">{doc.request_date}</td>
        <td className="table-cell text-right">{renderDocumentActions(doc)}</td>
      </tr>)}
      {!loading && filtered.length === 0 && <tr><td colSpan={6}><div className="empty-state">{t('page.materialsTooling.noData')}</div></td></tr>}
    </tbody></table></div>

    <SidePanel
      open={!!selected}
      onClose={() => {
        if (!uploading) setSelected(null);
      }}
      title={selected?.document_number || t('workspace.details')}
      subtitle={selected?.purpose || undefined}
      width="w-[min(720px,calc(100vw-1rem))]"
    >
      {selected && <>
        <div className="space-y-2 md:hidden">
          {(selected.lines ?? []).map((line: any) => (
            <article key={line.id} className="data-surface p-3">
              <p className="break-words text-sm font-medium text-gray-900">{line.item_name ?? line.material_item_id}</p>
              <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-gray-100 pt-3 text-sm">
                <div>
                  <dt className="section-label">{t('page.materialsTooling.quantity')}</dt>
                  <dd className="mt-1 tabular-nums text-gray-700">{line.execution_quantity || line.requested_quantity}</dd>
                </div>
                <div>
                  <dt className="section-label">{t('page.materialsTooling.unit')}</dt>
                  <dd className="mt-1 text-gray-700">{line.unit}</dd>
                </div>
              </dl>
            </article>
          ))}
          {(selected.lines ?? []).length === 0 && <div className="empty-state">{t('page.materialsTooling.noData')}</div>}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full"><thead><tr><th className="table-header">{t('page.materialsTooling.materials')}</th><th className="table-header">{t('page.materialsTooling.quantity')}</th><th className="table-header">{t('page.materialsTooling.unit')}</th></tr></thead><tbody>
            {(selected.lines ?? []).map((line: any) => <tr key={line.id}><td className="table-cell">{line.item_name ?? line.material_item_id}</td><td className="table-cell">{line.execution_quantity || line.requested_quantity}</td><td className="table-cell">{line.unit}</td></tr>)}
          </tbody></table>
        </div>
        {selected.tooling_request && <p className="mt-3 text-sm">{t('page.materialsTooling.action')}: {t(`page.materialsTooling.toolingAction.${selected.tooling_request.action}`)}</p>}
        <div className="mt-4 border-t border-gray-200 pt-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="label w-full sm:flex-1">{t('page.materialsTooling.attachmentCategory')}
              <select className="input mt-1 w-full" value={attachmentCategory} onChange={event => setAttachmentCategory(event.target.value)}>
                {['other', 'quotation', 'contract', 'invoice', 'delivery_note', 'acceptance_record', 'signed_copy', 'tooling_photo'].map(category => <option key={category} value={category}>{t(`page.materialsTooling.attachmentType.${category}`)}</option>)}
              </select>
            </label>
            <label className="label w-full sm:flex-1">{t('page.materialsTooling.attachment')}<input className="input mt-1 w-full" type="file" onChange={event => setAttachmentFile(event.target.files?.[0] ?? null)} /></label>
            <button className="btn-primary btn-sm w-full sm:w-auto" disabled={!attachmentFile || uploading} onClick={uploadAttachment}>{uploading ? t('common.loading') : t('page.materialsTooling.upload')}</button>
          </div>
          <ul className="mt-3 divide-y divide-gray-100">{attachments.map(attachment => <li key={attachment.id} className="flex flex-col gap-2 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"><span className="break-words text-gray-700">{attachment.original_name}</span><button className="self-start text-xs text-blue-600 sm:self-auto" onClick={() => downloadAttachment(attachment)}>{t('page.materialsTooling.export.downloadPdf')}</button></li>)}</ul>
        </div>
      </>}
    </SidePanel>
  </div>;
}
