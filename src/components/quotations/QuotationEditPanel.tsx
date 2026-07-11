import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import SidePanel from '../shared/SidePanel';
import { quotations } from '../../lib/api';
import { currencySymbol } from '../../lib/currency';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

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
  onSaved: () => void;
}) {
  const isNew = !quotation?.id;

  const [form, setForm] = useState({
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
  });

  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!quotation) return;
    setForm({
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
    });
    if (quotation.line_items) {
      setLineItems(quotation.line_items);
    }
  }, [quotation]);

  const set = (field: string, value: any) => setForm(prev => ({ ...prev, [field]: value }));

  const addLine = () => {
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

  const sym = currencySymbol(form.currency);

  const subtotal = lineItems.reduce((sum, item) => sum + (item.line_total || 0), 0);
  const discountAmount = subtotal * (form.discount_percent / 100);
  const afterDiscount = subtotal - discountAmount;
  const taxAmount = form.tax_type === 'domestic_vat' ? afterDiscount * (form.domestic_vat_rate / 100) : 0;
  const total = afterDiscount + taxAmount + (form.shipping_handling || 0);

  const save = async () => {
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

      if (isNew) {
        await quotations.create({
          ...payload,
          company_id: quotation.company_id,
          contact_id: quotation.contact_id,
          inquiry_id: quotation.inquiry_id,
        });
      } else {
        await quotations.update(quotation.id, payload);
      }

      toast.success(isNew ? t('page.quotationDetail.quotationCreated') : t('page.quotationDetail.quotationUpdated'));
      onSaved();
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
      subtitle={quotation?.quotation_number}
      width="w-[560px]"
    >
      <div className="space-y-5 h-full flex flex-col">
        {/* Line Items — scrollable */}
        <div className="flex-1 overflow-y-auto space-y-5 -mx-5 px-5">
          {/* Line Items Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-450 text-gray-500 uppercase tracking-[0.08em]">{t('page.quotationDetail.editPanel.lineItems')}</h4>
              <button onClick={addLine} className="btn-ghost btn-sm text-xs">{t('page.quotationDetail.editPanel.add')}</button>
            </div>

            <div className="space-y-2">
              {lineItems.map((item, idx) => (
                <div key={item.id} className="card p-3 space-y-2 relative">
                  <div className="flex items-center justify-between">
                    <span className="text-2xs text-gray-400">#{idx + 1}</span>
                    {lineItems.length > 1 && (
                      <button onClick={() => removeLine(item.id)} className="text-2xs text-red-400 hover:text-red-600">✕</button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2">
                      <label className="text-2xs text-gray-400 block">{t('page.quotationDetail.editPanel.productGrade')}</label>
                      <input className="input text-sm mt-0.5" value={item.product_grade_snapshot}
                        onChange={e => updateLine(item.id, 'product_grade_snapshot', e.target.value)}
                        placeholder={t('page.quotationDetail.editPanel.placeholderProduct')} />
                    </div>
                    <div>
                      <label className="text-2xs text-gray-400 block">{t('page.quotationDetail.editPanel.unit')}</label>
                      <select className="input text-sm mt-0.5" value={item.unit_of_measure}
                        onChange={e => updateLine(item.id, 'unit_of_measure', e.target.value)}>
                        <option value="kg">kg</option>
                        <option value="lb">lb</option>
                        <option value="m">m</option>
                        <option value="sheet">sheet</option>
                        <option value="pc">pc</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-2xs text-gray-400 block">{t('page.quotationDetail.editPanel.qty')}</label>
                      <input className="input text-sm mt-0.5" type="number" min="0" step="0.001" value={item.quantity}
                        onChange={e => updateLine(item.id, 'quantity', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div>
                      <label className="text-2xs text-gray-400 block">{t('page.quotationDetail.editPanel.unitPrice')}</label>
                      <input className="input text-sm mt-0.5 tabular-nums" type="number" min="0" step="0.01" value={item.unit_price}
                        onChange={e => updateLine(item.id, 'unit_price', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div>
                      <label className="text-2xs text-gray-400 block">{t('page.quotationDetail.editPanel.discPercent')}</label>
                      <input className="input text-sm mt-0.5" type="number" min="0" max="100" value={item.discount_percent}
                        onChange={e => updateLine(item.id, 'discount_percent', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div className="col-span-2">
                      <label className="text-2xs text-gray-400 block">{t('page.quotationDetail.editPanel.lineTotal')}</label>
                      <div className="text-sm tabular-nums text-gray-900 mt-0.5 px-3 py-2 bg-gray-50 rounded-lg">
                        {sym}{(item.line_total || 0).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {lineItems.length === 0 && (
                <div className="text-center py-6 text-xs text-gray-400 border border-dashed border-gray-200 rounded-lg">
                  {t('page.quotationDetail.editPanel.noLineItems')}
                </div>
              )}
            </div>
          </div>

          {/* Terms */}
          <div className="border-t border-gray-100 pt-4">
            <h4 className="text-xs font-450 text-gray-500 uppercase tracking-[0.08em] mb-3">{t('page.quotationDetail.editPanel.terms')}</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">{t('page.quotationDetail.editPanel.currency')}</label>
                <select className="input" value={form.currency} onChange={e => set('currency', e.target.value)}>
                  <option value="USD">USD</option>
                  <option value="CNY">CNY</option>
                </select>
              </div>
              <div>
                <label className="label">{t('page.quotationDetail.editPanel.incoterm')}</label>
                <input className="input" value={form.incoterm} onChange={e => set('incoterm', e.target.value)} placeholder={t('page.quotationDetail.editPanel.placeholderIncoterm')} />
              </div>
              <div className="col-span-2">
                <label className="label">{t('page.quotationDetail.editPanel.paymentTerms')}</label>
                <input className="input" value={form.payment_term} onChange={e => set('payment_term', e.target.value)} placeholder={t('page.quotationDetail.editPanel.placeholderPayment')} />
              </div>
              <div className="col-span-2">
                <label className="label">{t('page.quotationDetail.editPanel.deliveryTerms')}</label>
                <input className="input" value={form.delivery_term} onChange={e => set('delivery_term', e.target.value)} placeholder={t('page.quotationDetail.editPanel.placeholderDelivery')} />
              </div>
              <div className="col-span-2">
                <label className="label">{t('page.quotationDetail.quotationDate')}</label>
                <input className="input" type="date" value={form.quotation_date} onChange={e => set('quotation_date', e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className="label">{t('page.quotationDetail.editPanel.validUntil')}</label>
                <input className="input" type="date" value={form.valid_until} onChange={e => set('valid_until', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Tax Type */}
          <div className="border-t border-gray-100 pt-4">
            <h4 className="text-xs font-450 text-gray-500 uppercase tracking-[0.08em] mb-3">{t('page.quotationDetail.editPanel.taxation')}</h4>
            <div className="flex gap-2 mb-3">
              {(['domestic_vat', 'export', 'none'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => set('tax_type', type)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    form.tax_type === type
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {type === 'domestic_vat' ? t('page.quotationDetail.editPanel.domesticVat') : type === 'export' ? t('page.quotationDetail.editPanel.exportTax') : t('page.quotationDetail.editPanel.none')}
                </button>
              ))}
            </div>
            {form.tax_type === 'domestic_vat' && (
              <div>
                <label className="label">{t('page.quotationDetail.editPanel.vatRate')}</label>
                <input className="input" type="number" min="0" max="100" step="0.01"
                  value={form.domestic_vat_rate || ''}
                  onChange={e => set('domestic_vat_rate', parseFloat(e.target.value) || 0)} />
              </div>
            )}
            {form.tax_type === 'export' && (
              <div>
                <label className="label">{t('page.quotationDetail.editPanel.exportTaxRebateRate')}</label>
                <input className="input" type="number" min="0" max="100" step="0.01"
                  value={form.export_tax_rebate_rate || ''}
                  onChange={e => set('export_tax_rebate_rate', parseFloat(e.target.value) || 0)} />
              </div>
            )}
          </div>

          {/* Shipping & Discount */}
          <div className="border-t border-gray-100 pt-4">
            <h4 className="text-xs font-450 text-gray-500 uppercase tracking-[0.08em] mb-3">{t('page.quotationDetail.editPanel.shippingDiscount')}</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">{t('page.quotationDetail.editPanel.shippingHandling')}</label>
                <input className="input tabular-nums" type="number" min="0" step="0.01"
                  value={form.shipping_handling || ''}
                  onChange={e => set('shipping_handling', parseFloat(e.target.value) || 0)} />
              </div>
              <div>
                <label className="label">{t('page.quotationDetail.editPanel.overallDiscount')}</label>
                <input className="input" type="number" min="0" max="100" step="0.1"
                  value={form.discount_percent || ''}
                  onChange={e => set('discount_percent', parseFloat(e.target.value) || 0)} />
              </div>
            </div>
          </div>

          {/* Internal Notes */}
          <div>
            <label className="label">{t('page.quotationDetail.editPanel.internalNotes')}</label>
            <textarea className="input min-h-[60px] resize-y" value={form.internal_notes}
              onChange={e => set('internal_notes', e.target.value)} />
          </div>
        </div>

        {/* Price Summary — sticky footer */}
        <div className="border-t border-gray-200 pt-4 flex-shrink-0">
          <div className="bg-gray-50 rounded-lg p-4 space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>{t('page.quotationDetail.editPanel.subtotal')}</span>
              <span className="tabular-nums">{sym}{subtotal.toFixed(2)}</span>
            </div>
            {form.discount_percent > 0 && (
              <div className="flex justify-between text-gray-500">
                <span>{t('page.quotationDetail.editPanel.discount')} ({form.discount_percent}%)</span>
                <span className="tabular-nums">-{sym}{discountAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-gray-500">
              <span>{t('page.quotationDetail.editPanel.shipping')}</span>
              <span className="tabular-nums">{sym}{(form.shipping_handling || 0).toFixed(2)}</span>
            </div>
            {form.tax_type === 'domestic_vat' && form.domestic_vat_rate > 0 && (
              <div className="flex justify-between text-gray-500">
                <span>{t('page.quotationDetail.editPanel.vat')} ({form.domestic_vat_rate}%)</span>
                <span className="tabular-nums">{sym}{taxAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-gray-900 pt-2 border-t border-gray-200">
              <span>{t('page.quotationDetail.editPanel.total')}</span>
              <span className="tabular-nums text-base">{sym}{total.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button onClick={save} disabled={saving || lineItems.length === 0} className="btn-primary flex-1">
              {saving ? t('page.quotationDetail.editPanel.saving') : isNew ? t('page.quotationDetail.editPanel.createQuotation') : t('page.quotationDetail.editPanel.saveChanges')}
            </button>
            <button onClick={onClose} disabled={saving} className="btn-secondary">{t('common.cancel')}</button>
          </div>
        </div>
      </div>
    </SidePanel>
  );
}
