import { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import SidePanel from '../shared/SidePanel';
import { quotations, companies, contacts, team, type TeamMember } from '../../lib/api';
import { formatCurrency } from '../../lib/currency';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import Icon from '../shared/Icon';
import { useAuth } from '../../lib/auth';

interface LineItem {
  id: string;
  product_grade_snapshot: string;
  unit_of_measure: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  line_total: number;
  description?: string;
}

interface QuotationContact {
  id: string;
  company_id: string;
  first_name: string;
  last_name: string;
  is_primary_contact?: boolean | number;
  is_active?: boolean | number;
}

export default function QuotationEditPanel({
  quotation,
  onClose,
  onSaved,
}: {
  quotation: any;
  onClose: () => void;
  onSaved: (savedQuotation?: any) => void | Promise<void>;
}) {
  const isNew = !quotation?.id;
  const { user } = useAuth();

  const [form, setForm] = useState({
    company_id: quotation.company_id || '',
    contact_id: quotation.contact_id || '',
    currency: 'USD',
    incoterm: '',
    payment_term: '',
    delivery_term: '',
    quotation_date: new Date().toISOString().slice(0, 10),
    valid_until: '',
    tax_type: 'none' as 'domestic_vat' | 'export' | 'none',
    domestic_vat_rate: 0,
    export_tax_rebate_rate: 0,
    shipping_handling: 0,
    internal_notes: '',
    owner_user_id: '',
  });

  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [showFeeSection, setShowFeeSection] = useState(false);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [membersLoadError, setMembersLoadError] = useState(false);
  const [companyList, setCompanyList] = useState<any[]>([]);
  const [contactList, setContactList] = useState<QuotationContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const contactRequest = useRef(0);
  const [companyLoadError, setCompanyLoadError] = useState(false);
  const [contactLoadError, setContactLoadError] = useState(false);
  const [errors, setErrors] = useState<{ lineItems?: string; company_id?: string }>({});

  const loadCompanies = () => {
    setCompanyLoadError(false);
    companies.list()
      .then(setCompanyList)
      .catch(() => {
        setCompanyList([]);
        setCompanyLoadError(true);
      });
  };

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
    loadCompanies();
    if (user?.role === 'admin') {
      loadMembers();
    } else {
      setMembers([]);
      setMembersLoadError(false);
    }
  }, [user?.role]);

  const loadContacts = (companyId: string) => {
    const requestId = ++contactRequest.current;
    setContactLoadError(false);
    setContactList([]);
    setContactsLoading(Boolean(companyId));
    if (!companyId) {
      return;
    }
    contacts.list(companyId)
      .then((rows: QuotationContact[]) => {
        if (requestId !== contactRequest.current) return;
        const available = rows.filter(contact =>
          contact.company_id === companyId && contact.is_active !== 0 && contact.is_active !== false,
        );
        setContactList(available);
        setForm(prev => {
          if (prev.company_id !== companyId || available.some(contact => contact.id === prev.contact_id)) return prev;
          const primary = available.filter(contact => contact.is_primary_contact);
          const defaultContact = primary.length === 1 ? primary[0] : available.length === 1 ? available[0] : undefined;
          return { ...prev, contact_id: defaultContact?.id || '' };
        });
      })
      .catch(() => {
        if (requestId !== contactRequest.current) return;
        setContactLoadError(true);
      })
      .finally(() => {
        if (requestId === contactRequest.current) setContactsLoading(false);
      });
  };

  useEffect(() => {
    if (!isNew) return;
    loadContacts(form.company_id);
    return () => { contactRequest.current += 1; };
  }, [form.company_id, isNew]);

  useEffect(() => {
    if (!quotation) return;
    setShowFeeSection(Boolean(quotation.id && (quotation.tax_type !== 'none' || quotation.shipping_handling)));
    setForm(prev => ({
      ...prev,
      company_id: quotation.company_id || '',
      contact_id: quotation.contact_id || '',
      currency: quotation.currency || 'USD',
      incoterm: quotation.incoterm || '',
      payment_term: quotation.payment_term || '',
      delivery_term: quotation.delivery_term || '',
      quotation_date: quotation.quotation_date || new Date().toISOString().slice(0, 10),
      valid_until: quotation.valid_until || '',
      tax_type: quotation.tax_type || 'none',
      domestic_vat_rate: quotation.domestic_vat_rate || 0,
      export_tax_rebate_rate: quotation.export_tax_rebate_rate || 0,
      shipping_handling: quotation.shipping_handling || 0,
      internal_notes: quotation.internal_notes || '',
      owner_user_id: quotation.owner_user_id || '',
    }));
    if (quotation.line_items) {
      setLineItems(quotation.line_items);
    }
  }, [quotation]);

  const set = (field: string, value: any) => setForm(prev => ({ ...prev, [field]: value }));

  const addLine = () => {
    setErrors({});
    setLineItems(prev => [...prev, {
      id: uuidv4(),
      product_grade_snapshot: '',
      unit_of_measure: 'kg',
      quantity: 1,
      unit_price: 0,
      discount_percent: 0,
      line_total: 0,
    }]);
  };

  const updateLine = (id: string, field: string, value: any) => {
    setLineItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      if (['quantity', 'unit_price'].includes(field)) {
        updated.discount_percent = 0;
        updated.line_total = updated.quantity * updated.unit_price;
      }
      return updated;
    }));
  };

  const removeLine = (id: string) => {
    setLineItems(prev => prev.filter(item => item.id !== id));
  };

  const lineSubtotal = lineItems.reduce((sum, item) => sum + (item.line_total || 0), 0);
  const pricingUnchanged = !isNew
    && lineItems.length === (quotation.line_items?.length ?? 0)
    && lineItems.every((item, index) => {
      const original = quotation.line_items[index];
      return item.quantity === original.quantity && item.unit_price === original.unit_price
        && item.line_total === original.line_total;
    })
    && form.tax_type === (quotation.tax_type || 'none')
    && form.domestic_vat_rate === (quotation.domestic_vat_rate || 0)
    && form.export_tax_rebate_rate === (quotation.export_tax_rebate_rate || 0)
    && form.shipping_handling === (quotation.shipping_handling || 0);
  const subtotal = pricingUnchanged ? quotation.subtotal ?? lineSubtotal : lineSubtotal;
  const calculatedTaxAmount = form.tax_type === 'domestic_vat' ? subtotal * (form.domestic_vat_rate / 100) : 0;
  const taxAmount = pricingUnchanged ? quotation.tax_amount ?? calculatedTaxAmount : calculatedTaxAmount;
  const total = pricingUnchanged ? quotation.total ?? (subtotal + taxAmount + (form.shipping_handling || 0))
    : subtotal + taxAmount + (form.shipping_handling || 0);

  const save = async () => {
    if (saving || contactsLoading) return;
    const nextErrors: { lineItems?: string; company_id?: string } = {};
    if (isNew && !form.company_id) nextErrors.company_id = t('page.inquiryNew.companyRequired');
    if (lineItems.length === 0) {
      nextErrors.lineItems = t('page.quotationDetail.editPanel.noLineItems');
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setSaving(true);
    try {
      const payload = {
        ...form,
        subtotal,
        tax_amount: taxAmount,
        total,
        discount_percent: pricingUnchanged ? quotation.discount_percent ?? 0 : 0,
        discount_amount: pricingUnchanged ? quotation.discount_amount ?? 0 : 0,
        status: isNew ? 'draft' : (quotation.status || 'draft'),
        version: (quotation?.version || 0) + 1,
        line_items: lineItems.map((item, idx) => ({
          line_number: idx + 1,
          product_grade_snapshot: item.product_grade_snapshot || t('page.quotationDetail.customItem'),
          unit_of_measure: item.unit_of_measure,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_percent: pricingUnchanged ? item.discount_percent ?? 0 : 0,
          line_total: item.line_total,
          description: item.description,
        })),
      };

      let savedQuotation;
      if (isNew) {
        savedQuotation = await quotations.create({
          ...payload,
          company_id: form.company_id,
          contact_id: form.contact_id || undefined,
        });
      } else {
        savedQuotation = await quotations.update(quotation.id, payload);
      }

      toast.success(isNew ? t('page.quotationDetail.quotationCreated') : t('page.quotationDetail.quotationUpdated'));
      await onSaved(savedQuotation);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('page.quotationDetail.quotationSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SidePanel
      open={true}
      onClose={onClose}
      title={isNew ? t('page.quotationDetail.editPanel.newQuotation') : t('page.quotationDetail.editPanel.editQuotation')}
      subtitle={quotation?.quotation_number || quotation?.inquiry_number}
      width="w-[min(560px,calc(100vw-1rem))]"
    >
      <div className="space-y-5 h-full flex flex-col">
        {/* Line Items — scrollable */}
        <div className="flex-1 overflow-y-auto space-y-5 -mx-5 px-5">
          {/* Customer — editable for new, read-only context for edit */}
          {isNew ? (
            <fieldset className="border-t border-border pt-4">
              <legend className="section-label mb-3">{t('page.inquiryDetail.customer')}</legend>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="quotation-company">{t('page.inquiryNew.company')} *</label>
                  <select
                    id="quotation-company"
                    className={errors.company_id ? 'input-error' : 'input'}
                    value={form.company_id}
                    required
                    aria-invalid={!!errors.company_id}
                    onChange={e => {
                      contactRequest.current += 1;
                      setContactList([]);
                      setContactsLoading(Boolean(e.target.value));
                      setContactLoadError(false);
                      set('company_id', e.target.value);
                      set('contact_id', '');
                      if (e.target.value) setErrors(prev => ({ ...prev, company_id: undefined }));
                    }}
                  >
                    <option value="">{t('page.inquiryNew.selectCompany')}</option>
                    {companyList.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  {errors.company_id && <p className="field-error" role="alert">{errors.company_id}</p>}
                  {companyLoadError && (
                    <div className="mt-1 flex items-center justify-between gap-2" role="alert">
                      <span className="text-2xs text-danger">{t('page.error.loadFailed')}</span>
                      <button type="button" onClick={loadCompanies} className="text-2xs text-brand hover:underline">
                        {t('common.refresh')}
                      </button>
                    </div>
                  )}
                </div>
                <div>
                  <label className="label" htmlFor="quotation-contact">{t('page.inquiryNew.contact')}</label>
                  <select id="quotation-contact" className="input" value={form.contact_id} disabled={!form.company_id || contactsLoading} aria-busy={contactsLoading} onChange={e => set('contact_id', e.target.value)}>
                    <option value="">{t('page.inquiryNew.selectContact')}</option>
                    {contactList.map(c => (
                      <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                    ))}
                  </select>
                  {contactLoadError && (
                    <div className="mt-1 flex items-center justify-between gap-2" role="alert">
                      <span className="text-2xs text-danger">{t('page.error.loadFailed')}</span>
                      <button type="button" onClick={() => loadContacts(form.company_id)} className="text-2xs text-brand hover:underline">
                        {t('common.refresh')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </fieldset>
          ) : (
            <div className="rounded-lg border border-brand bg-brand-soft/60 px-3 py-2.5 text-xs text-ink">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-2xs text-ink-muted">{t('page.inquiryDetail.customer')}</span>
                <span className="min-w-0 truncate font-medium text-ink">{quotation.company_name || '—'}</span>
              </div>
              {quotation.contact_name && (
                <div className="mt-1 flex items-baseline justify-between gap-3">
                  <span className="text-2xs text-ink-muted">{t('page.inquiryDetail.contact')}</span>
                  <span className="min-w-0 truncate text-ink">{quotation.contact_name}</span>
                </div>
              )}
            </div>
          )}

          {user?.role === 'admin' && (
            <div>
              <label className="label" htmlFor="quotation-edit-owner">{t('accountability.owner')}</label>
              <select id="quotation-edit-owner" className="input" value={form.owner_user_id} onChange={e => set('owner_user_id', e.target.value)}>
                <option value="">{t('accountability.unassigned')}</option>
                {members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
              </select>
              {membersLoadError && (
                <div className="mt-1 flex items-center justify-between gap-2" role="alert">
                  <span className="text-2xs text-danger">{t('page.error.loadFailed')}</span>
                  <button type="button" onClick={loadMembers} className="inline-flex items-center gap-1 text-2xs text-brand hover:underline">
                    <Icon name="refresh" size={12} />
                    {t('common.refresh')}
                  </button>
                </div>
              )}
            </div>
          )}
          {/* Line Items Section */}
          <div
            id="quotation-line-items"
            aria-describedby={errors.lineItems ? 'quotation-line-items-error' : undefined}
          >
            <div className="flex items-center justify-between mb-2">
              <h4 className="section-label">{t('page.quotationDetail.editPanel.lineItems')}</h4>
              <button type="button" onClick={addLine} className="btn-ghost btn-sm text-xs">{t('page.quotationDetail.editPanel.add')}</button>
            </div>

            <div className="space-y-2">
              {lineItems.map((item, idx) => (
                <div key={item.id} className="card p-3 space-y-2 relative">
                  <div className="flex items-center justify-between">
                    <span className="text-2xs text-ink-subtle">#{idx + 1}</span>
                    {lineItems.length > 1 && (
                      <button onClick={() => removeLine(item.id)} className="icon-btn text-danger hover:text-danger" aria-label={t('common.delete')} title={t('common.delete')}><Icon name="delete" size={13} /></button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="text-2xs text-ink-subtle block" htmlFor={`quotation-edit-grade-${idx}`}>{t('page.quotationDetail.editPanel.productGrade')}</label>
                      <input id={`quotation-edit-grade-${idx}`} className="input text-sm mt-0.5" value={item.product_grade_snapshot}
                        onChange={e => updateLine(item.id, 'product_grade_snapshot', e.target.value)}
                        placeholder={t('page.quotationDetail.editPanel.placeholderProduct')} />
                    </div>
                    <div>
                      <label className="text-2xs text-ink-subtle block" htmlFor={`quotation-edit-unit-${idx}`}>{t('page.quotationDetail.editPanel.unit')}</label>
                      <select id={`quotation-edit-unit-${idx}`} className="input text-sm mt-0.5" value={item.unit_of_measure}
                        onChange={e => updateLine(item.id, 'unit_of_measure', e.target.value)}>
                        <option value="kg">kg</option>
                        <option value="lb">lb</option>
                        <option value="m">m</option>
                        <option value="sheet">sheet</option>
                        <option value="pc">pc</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-2xs text-ink-subtle block" htmlFor={`quotation-edit-quantity-${idx}`}>{t('page.quotationDetail.editPanel.qty')}</label>
                      <input id={`quotation-edit-quantity-${idx}`} className="input text-sm mt-0.5" type="number" min="0" step="0.001" value={item.quantity}
                        onChange={e => updateLine(item.id, 'quantity', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div>
                      <label className="text-2xs text-ink-subtle block" htmlFor={`quotation-edit-unit-price-${idx}`}>{t('page.quotationDetail.editPanel.unitPrice')}</label>
                      <input id={`quotation-edit-unit-price-${idx}`} className="input text-sm mt-0.5 tabular-nums" type="number" min="0" step="0.01" value={item.unit_price}
                        onChange={e => updateLine(item.id, 'unit_price', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-2xs text-ink-subtle block" htmlFor={`quotation-edit-line-total-${idx}`}>{t('page.quotationDetail.editPanel.lineTotal')}</label>
                      <output id={`quotation-edit-line-total-${idx}`} className="block text-sm tabular-nums text-ink mt-0.5 px-3 py-2 bg-canvas rounded-lg">
                        {formatCurrency(item.line_total || 0, form.currency)}
                      </output>
                    </div>
                  </div>
                </div>
              ))}

              {lineItems.length === 0 && (
                errors.lineItems ? (
                  <p id="quotation-line-items-error" className="field-error" role="alert">{errors.lineItems}</p>
                ) : (
                  <div className="text-center py-6 text-xs text-ink-subtle border border-dashed border-border rounded-lg">
                    {t('page.quotationDetail.editPanel.noLineItems')}
                  </div>
                )
              )}
            </div>
          </div>

          {/* Terms */}
          <fieldset className="border-t border-border pt-4">
            <legend className="section-label mb-3">{t('page.quotationDetail.editPanel.terms')}</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="quotation-edit-currency">{t('page.quotationDetail.editPanel.currency')}</label>
                <select id="quotation-edit-currency" className="input" value={form.currency} onChange={e => set('currency', e.target.value)}>
                  <option value="USD">USD</option>
                  <option value="CNY">CNY</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="quotation-edit-incoterm">{t('page.quotationDetail.editPanel.incoterm')}</label>
                <input id="quotation-edit-incoterm" className="input" value={form.incoterm} onChange={e => set('incoterm', e.target.value)} placeholder={t('page.quotationDetail.editPanel.placeholderIncoterm')} />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="quotation-edit-payment-terms">{t('page.quotationDetail.editPanel.paymentTerms')}</label>
                <input id="quotation-edit-payment-terms" className="input" value={form.payment_term} onChange={e => set('payment_term', e.target.value)} placeholder={t('page.quotationDetail.editPanel.placeholderPayment')} />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="quotation-edit-delivery-terms">{t('page.quotationDetail.editPanel.deliveryTerms')}</label>
                <input id="quotation-edit-delivery-terms" className="input" value={form.delivery_term} onChange={e => set('delivery_term', e.target.value)} placeholder={t('page.quotationDetail.editPanel.placeholderDelivery')} />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="quotation-edit-quotation-date">{t('page.quotationDetail.quotationDate')}</label>
                <input id="quotation-edit-quotation-date" className="input" type="date" value={form.quotation_date} onChange={e => set('quotation_date', e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="quotation-edit-valid-until">{t('page.quotationDetail.editPanel.validUntil')}</label>
                <input id="quotation-edit-valid-until" className="input" type="date" value={form.valid_until} onChange={e => set('valid_until', e.target.value)} />
              </div>
            </div>
          </fieldset>

          {/* Fees (collapsible) */}
          <fieldset className="border-t border-border pt-4">
            <legend className="flex w-full items-center justify-between">
              <span className="section-label">{t('page.quotationDetail.editPanel.fees')}</span>
              <button type="button" onClick={() => setShowFeeSection(v => !v)} className="text-xs text-brand hover:underline">
                {showFeeSection ? t('common.collapse') : t('common.expand')}
              </button>
            </legend>
            {!showFeeSection ? (
              <p className="mt-2 text-sm text-ink-muted">
                {[
                  form.shipping_handling > 0 ? `${t('page.quotationDetail.editPanel.shippingHandling')}: ${formatCurrency(form.shipping_handling, form.currency)}` : '',
                  form.tax_type !== 'none' ? `${t('page.quotationDetail.editPanel.taxation')}: ${form.tax_type === 'domestic_vat' ? `${form.domestic_vat_rate}% VAT` : `${form.export_tax_rebate_rate}% ${t('page.quotationDetail.editPanel.exportTax')}`}` : '',
                ].filter(Boolean).join(' · ') || t('page.quotationDetail.editPanel.none')}
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                <div>
                  <label className="label" htmlFor="quotation-edit-shipping-handling">{t('page.quotationDetail.editPanel.shippingHandling')}</label>
                  <input id="quotation-edit-shipping-handling" className="input tabular-nums" type="number" min="0" step="0.01"
                    value={form.shipping_handling || ''}
                    onChange={e => set('shipping_handling', parseFloat(e.target.value) || 0)} />
                </div>
                <div>
                  <span className="label">{t('page.quotationDetail.editPanel.taxation')}</span>
                  <div className="segmented-control mt-1 mb-2">
                    {(['domestic_vat', 'export', 'none'] as const).map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => set('tax_type', type)}
                        aria-pressed={form.tax_type === type}
                        className={`segmented-option ${form.tax_type === type ? 'segmented-option-active' : ''}`}
                      >
                        {type === 'domestic_vat' ? t('page.quotationDetail.editPanel.domesticVat') : type === 'export' ? t('page.quotationDetail.editPanel.exportTax') : t('page.quotationDetail.editPanel.none')}
                      </button>
                    ))}
                  </div>
                  {form.tax_type === 'domestic_vat' && (
                    <div>
                      <label className="label" htmlFor="quotation-edit-vat-rate">{t('page.quotationDetail.editPanel.vatRate')}</label>
                      <input id="quotation-edit-vat-rate" className="input" type="number" min="0" max="100" step="0.01"
                        value={form.domestic_vat_rate || ''}
                        onChange={e => set('domestic_vat_rate', parseFloat(e.target.value) || 0)} />
                    </div>
                  )}
                  {form.tax_type === 'export' && (
                    <div>
                      <label className="label" htmlFor="quotation-edit-export-rebate-rate">{t('page.quotationDetail.editPanel.exportTaxRebateRate')}</label>
                      <input id="quotation-edit-export-rebate-rate" className="input" type="number" min="0" max="100" step="0.01"
                        value={form.export_tax_rebate_rate || ''}
                        onChange={e => set('export_tax_rebate_rate', parseFloat(e.target.value) || 0)} />
                    </div>
                  )}
                </div>
              </div>
            )}
          </fieldset>

          {/* Internal Notes */}
          <div>
            <label className="label" htmlFor="quotation-edit-internal-notes">{t('page.quotationDetail.editPanel.internalNotes')}</label>
            <textarea id="quotation-edit-internal-notes" className="input min-h-[60px] resize-y" value={form.internal_notes}
              onChange={e => set('internal_notes', e.target.value)} />
          </div>
        </div>

        {/* Price Summary — sticky footer */}
        <div className="sticky bottom-0 z-10 -mx-5 flex-shrink-0 border-t border-border bg-surface px-5 pt-4">
          <div className="bg-canvas rounded-lg p-4 space-y-1.5 text-sm">
            <div className="flex justify-between text-ink-muted">
              <span>{t('page.quotationDetail.editPanel.subtotal')}</span>
              <span className="tabular-nums">{formatCurrency(subtotal, form.currency)}</span>
            </div>
            <div className="flex justify-between text-ink-muted">
              <span>{t('page.quotationDetail.editPanel.shipping')}</span>
              <span className="tabular-nums">{formatCurrency(form.shipping_handling || 0, form.currency)}</span>
            </div>
            {form.tax_type === 'domestic_vat' && form.domestic_vat_rate > 0 && (
              <div className="flex justify-between text-ink-muted">
                <span>{t('page.quotationDetail.editPanel.vat')} ({form.domestic_vat_rate}%)</span>
                <span className="tabular-nums">{formatCurrency(taxAmount, form.currency)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-ink pt-2 border-t border-border">
              <span>{t('page.quotationDetail.editPanel.total')}</span>
              <span className="tabular-nums text-base">{formatCurrency(total, form.currency)}</span>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button onClick={save} disabled={saving || contactsLoading} className="btn-primary flex-1">
              {saving ? t('page.quotationDetail.editPanel.saving') : isNew ? t('page.quotationDetail.editPanel.createQuotation') : t('page.quotationDetail.editPanel.saveChanges')}
            </button>
            <button onClick={onClose} disabled={saving} className="btn-secondary">{t('common.cancel')}</button>
          </div>
        </div>
      </div>
    </SidePanel>
  );
}
