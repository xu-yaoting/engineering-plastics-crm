import { useState, useEffect } from 'react';
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
    application_description: '',
    target_material_requested: '',
    quantity_estimate: '',
    urgency: 'within_1_month',
    source: 'email',
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
    discount_percent: 0,
    internal_notes: '',
    owner_user_id: '',
  });

  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [companyList, setCompanyList] = useState<any[]>([]);
  const [contactList, setContactList] = useState<any[]>([]);
  const [errors, setErrors] = useState<{ lineItems?: string; company_id?: string; application_description?: string }>({});

  useEffect(() => {
    companies.list().then(setCompanyList);
    if (user?.role === 'admin') {
      team.list().then(setMembers).catch(() => setMembers([]));
    }
  }, [user?.role]);

  useEffect(() => {
    if (form.company_id) {
      contacts.list(form.company_id).then(setContactList);
    } else {
      setContactList([]);
    }
  }, [form.company_id]);

  useEffect(() => {
    if (!quotation) return;
    setForm(prev => ({
      ...prev,
      company_id: quotation.company_id || '',
      contact_id: quotation.contact_id || '',
      application_description: quotation.application_description || '',
      target_material_requested: quotation.target_material_requested || '',
      quantity_estimate: quotation.quantity_estimate || '',
      urgency: quotation.urgency || 'within_1_month',
      source: quotation.source || 'email',
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
      discount_percent: quotation.discount_percent || 0,
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
      product_grade_snapshot: quotation.target_material_requested || '',
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
      // Recalculate line total
      if (['quantity', 'unit_price', 'discount_percent'].includes(field)) {
        const qty = field === 'quantity' ? value : updated.quantity;
        const price = field === 'unit_price' ? value : updated.unit_price;
        const disc = field === 'discount_percent' ? value : updated.discount_percent;
        const subtotal = qty * price;
        updated.line_total = subtotal - (subtotal * (disc / 100));
      }
      return updated;
    }));
  };

  const removeLine = (id: string) => {
    setLineItems(prev => prev.filter(item => item.id !== id));
  };

  const subtotal = lineItems.reduce((sum, item) => sum + (item.line_total || 0), 0);
  const discountAmount = subtotal * (form.discount_percent / 100);
  const afterDiscount = subtotal - discountAmount;
  const taxAmount = form.tax_type === 'domestic_vat' ? afterDiscount * (form.domestic_vat_rate / 100) : 0;
  const total = afterDiscount + taxAmount + (form.shipping_handling || 0);

  const save = async () => {
    const nextErrors: { lineItems?: string; company_id?: string; application_description?: string } = {};
    if (isNew && !form.company_id) nextErrors.company_id = t('page.inquiryNew.companyRequired');
    if (isNew && !form.application_description.trim()) {
      nextErrors.application_description = t('page.inquiryNew.descriptionRequired');
    }
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
        discount_amount: discountAmount,
        tax_amount: taxAmount,
        total,
        status: isNew ? 'draft' : (quotation.status || 'draft'),
        version: (quotation?.version || 0) + 1,
        line_items: lineItems.map((item, idx) => ({
          line_number: idx + 1,
          product_grade_snapshot: item.product_grade_snapshot || t('page.quotationDetail.customItem'),
          unit_of_measure: item.unit_of_measure,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_percent: item.discount_percent,
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
          {/* Customer & Requirements — editable for new, read-only context for edit */}
          {isNew ? (
            <fieldset className="border-t border-gray-100 pt-4">
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
                </div>
                <div>
                  <label className="label" htmlFor="quotation-contact">{t('page.inquiryNew.contact')}</label>
                  <select id="quotation-contact" className="input" value={form.contact_id} onChange={e => set('contact_id', e.target.value)}>
                    <option value="">{t('page.inquiryNew.selectContact')}</option>
                    {contactList.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </fieldset>
          ) : (
            <div className="rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2.5 text-xs text-gray-700">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-2xs text-gray-500">{t('page.inquiryDetail.customer')}</span>
                <span className="min-w-0 truncate font-medium text-gray-900">{quotation.company_name || '—'}</span>
              </div>
              {quotation.contact_name && (
                <div className="mt-1 flex items-baseline justify-between gap-3">
                  <span className="text-2xs text-gray-500">{t('page.inquiryDetail.contact')}</span>
                  <span className="min-w-0 truncate text-gray-700">{quotation.contact_name}</span>
                </div>
              )}
            </div>
          )}

          {/* Requirements (editable for new, shown as context for edit) */}
          <fieldset className="border-t border-gray-100 pt-4">
            <legend className="section-label mb-3">{t('page.inquiryDetail.applicationDescription')}</legend>
            <div>
              <label className="label" htmlFor="quotation-description">{t('page.inquiryNew.applicationDescription')}{isNew ? ' *' : ''}</label>
              <textarea
                id="quotation-description"
                className={errors.application_description ? 'input-error' : 'input'}
                rows={3}
                value={form.application_description}
                required={isNew}
                aria-invalid={!!errors.application_description}
                onChange={e => {
                  set('application_description', e.target.value);
                  if (e.target.value.trim()) setErrors(prev => ({ ...prev, application_description: undefined }));
                }}
                placeholder={t('page.inquiryNew.placeholderDescription')}
              />
              {errors.application_description && <p className="field-error" role="alert">{errors.application_description}</p>}
            </div>
            <div className="grid grid-cols-1 gap-3 mt-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="quotation-target-material">{t('page.inquiryNew.targetMaterial')}</label>
                <input id="quotation-target-material" className="input" value={form.target_material_requested}
                  onChange={e => set('target_material_requested', e.target.value)}
                  placeholder={t('page.inquiryNew.placeholderMaterial')} />
              </div>
              <div>
                <label className="label" htmlFor="quotation-quantity">{t('page.inquiryDetail.quantity')}</label>
                <input id="quotation-quantity" className="input" value={form.quantity_estimate}
                  onChange={e => set('quantity_estimate', e.target.value)}
                  placeholder={t('page.inquiryNew.placeholderQuantityKg')} />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 mt-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="quotation-urgency">{t('page.inquiryNew.urgency')}</label>
                <select id="quotation-urgency" className="input" value={form.urgency} onChange={e => set('urgency', e.target.value)}>
                  <option value="immediate">{t('page.inquiryNew.immediate')}</option>
                  <option value="within_2_weeks">{t('page.inquiryNew.within2Weeks')}</option>
                  <option value="within_1_month">{t('page.inquiryNew.within1Month')}</option>
                  <option value="no_rush">{t('page.inquiryNew.noRush')}</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="quotation-source">{t('page.inquiryNew.source')}</label>
                <select id="quotation-source" className="input" value={form.source} onChange={e => set('source', e.target.value)}>
                  <option value="email">{t('page.inquiryNew.email')}</option>
                  <option value="phone_wechat">{t('page.inquiryNew.phoneWechat')}</option>
                  <option value="website">{t('page.inquiryNew.website')}</option>
                  <option value="social_media">{t('page.inquiryNew.socialMedia')}</option>
                  <option value="alibaba_platform">{t('page.inquiryNew.alibabaPlatform')}</option>
                  <option value="trade_show">{t('page.inquiryNew.tradeShow')}</option>
                  <option value="referral">{t('page.inquiryNew.referral')}</option>
                </select>
              </div>
            </div>
          </fieldset>

          {user?.role === 'admin' && (
            <div>
              <label className="label" htmlFor="quotation-edit-owner">{t('accountability.owner')}</label>
              <select id="quotation-edit-owner" className="input" value={form.owner_user_id} onChange={e => set('owner_user_id', e.target.value)}>
                <option value="">{t('accountability.unassigned')}</option>
                {members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
              </select>
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
                    <span className="text-2xs text-gray-400">#{idx + 1}</span>
                    {lineItems.length > 1 && (
                      <button onClick={() => removeLine(item.id)} className="icon-btn text-red-400 hover:text-red-600" aria-label={t('common.delete')} title={t('common.delete')}><Icon name="delete" size={13} /></button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="text-2xs text-gray-400 block" htmlFor={`quotation-edit-grade-${idx}`}>{t('page.quotationDetail.editPanel.productGrade')}</label>
                      <input id={`quotation-edit-grade-${idx}`} className="input text-sm mt-0.5" value={item.product_grade_snapshot}
                        onChange={e => updateLine(item.id, 'product_grade_snapshot', e.target.value)}
                        placeholder={t('page.quotationDetail.editPanel.placeholderProduct')} />
                    </div>
                    <div>
                      <label className="text-2xs text-gray-400 block" htmlFor={`quotation-edit-unit-${idx}`}>{t('page.quotationDetail.editPanel.unit')}</label>
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
                      <label className="text-2xs text-gray-400 block" htmlFor={`quotation-edit-quantity-${idx}`}>{t('page.quotationDetail.editPanel.qty')}</label>
                      <input id={`quotation-edit-quantity-${idx}`} className="input text-sm mt-0.5" type="number" min="0" step="0.001" value={item.quantity}
                        onChange={e => updateLine(item.id, 'quantity', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div>
                      <label className="text-2xs text-gray-400 block" htmlFor={`quotation-edit-unit-price-${idx}`}>{t('page.quotationDetail.editPanel.unitPrice')}</label>
                      <input id={`quotation-edit-unit-price-${idx}`} className="input text-sm mt-0.5 tabular-nums" type="number" min="0" step="0.01" value={item.unit_price}
                        onChange={e => updateLine(item.id, 'unit_price', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div>
                      <label className="text-2xs text-gray-400 block" htmlFor={`quotation-edit-discount-${idx}`}>{t('page.quotationDetail.editPanel.discPercent')}</label>
                      <input id={`quotation-edit-discount-${idx}`} className="input text-sm mt-0.5" type="number" min="0" max="100" value={item.discount_percent}
                        onChange={e => updateLine(item.id, 'discount_percent', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-2xs text-gray-400 block" htmlFor={`quotation-edit-line-total-${idx}`}>{t('page.quotationDetail.editPanel.lineTotal')}</label>
                      <output id={`quotation-edit-line-total-${idx}`} className="block text-sm tabular-nums text-gray-900 mt-0.5 px-3 py-2 bg-gray-50 rounded-lg">
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
                  <div className="text-center py-6 text-xs text-gray-400 border border-dashed border-gray-200 rounded-lg">
                    {t('page.quotationDetail.editPanel.noLineItems')}
                  </div>
                )
              )}
            </div>
          </div>

          {/* Terms */}
          <fieldset className="border-t border-gray-100 pt-4">
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

          {/* Tax Type */}
          <fieldset className="border-t border-gray-100 pt-4">
            <legend className="section-label mb-3">{t('page.quotationDetail.editPanel.taxation')}</legend>
            <div className="segmented-control mb-3">
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
          </fieldset>

          {/* Shipping & Discount */}
          <fieldset className="border-t border-gray-100 pt-4">
            <legend className="section-label mb-3">{t('page.quotationDetail.editPanel.shippingDiscount')}</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="quotation-edit-shipping-handling">{t('page.quotationDetail.editPanel.shippingHandling')}</label>
                <input id="quotation-edit-shipping-handling" className="input tabular-nums" type="number" min="0" step="0.01"
                  value={form.shipping_handling || ''}
                  onChange={e => set('shipping_handling', parseFloat(e.target.value) || 0)} />
              </div>
              <div>
                <label className="label" htmlFor="quotation-edit-overall-discount">{t('page.quotationDetail.editPanel.overallDiscount')}</label>
                <input id="quotation-edit-overall-discount" className="input" type="number" min="0" max="100" step="0.1"
                  value={form.discount_percent || ''}
                  onChange={e => set('discount_percent', parseFloat(e.target.value) || 0)} />
              </div>
            </div>
          </fieldset>

          {/* Internal Notes */}
          <div>
            <label className="label" htmlFor="quotation-edit-internal-notes">{t('page.quotationDetail.editPanel.internalNotes')}</label>
            <textarea id="quotation-edit-internal-notes" className="input min-h-[60px] resize-y" value={form.internal_notes}
              onChange={e => set('internal_notes', e.target.value)} />
          </div>
        </div>

        {/* Price Summary — sticky footer */}
        <div className="sticky bottom-0 z-10 -mx-5 flex-shrink-0 border-t border-gray-200 bg-white px-5 pt-4">
          <div className="bg-gray-50 rounded-lg p-4 space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>{t('page.quotationDetail.editPanel.subtotal')}</span>
              <span className="tabular-nums">{formatCurrency(subtotal, form.currency)}</span>
            </div>
            {form.discount_percent > 0 && (
              <div className="flex justify-between text-gray-500">
                <span>{t('page.quotationDetail.editPanel.discount')} ({form.discount_percent}%)</span>
                <span className="tabular-nums">-{formatCurrency(discountAmount, form.currency)}</span>
              </div>
            )}
            <div className="flex justify-between text-gray-500">
              <span>{t('page.quotationDetail.editPanel.shipping')}</span>
              <span className="tabular-nums">{formatCurrency(form.shipping_handling || 0, form.currency)}</span>
            </div>
            {form.tax_type === 'domestic_vat' && form.domestic_vat_rate > 0 && (
              <div className="flex justify-between text-gray-500">
                <span>{t('page.quotationDetail.editPanel.vat')} ({form.domestic_vat_rate}%)</span>
                <span className="tabular-nums">{formatCurrency(taxAmount, form.currency)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-gray-900 pt-2 border-t border-gray-200">
              <span>{t('page.quotationDetail.editPanel.total')}</span>
              <span className="tabular-nums text-base">{formatCurrency(total, form.currency)}</span>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button onClick={save} disabled={saving} className="btn-primary flex-1">
              {saving ? t('page.quotationDetail.editPanel.saving') : isNew ? t('page.quotationDetail.editPanel.createQuotation') : t('page.quotationDetail.editPanel.saveChanges')}
            </button>
            <button onClick={onClose} disabled={saving} className="btn-secondary">{t('common.cancel')}</button>
          </div>
        </div>
      </div>
    </SidePanel>
  );
}
