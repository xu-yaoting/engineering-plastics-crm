import { useState, useEffect } from 'react';
import SidePanel from './SidePanel';
import templates, { getTemplatesByCategory, getCategories, fillTemplate, EmailTemplate } from '../../data/email-templates';
import Icon from './Icon';
import { useTranslation } from 'react-i18next';

export default function EmailDraftPanel({
  open,
  onClose,
  context,
}: {
  open: boolean;
  onClose: () => void;
  context: Record<string, string>;
}) {
  const [category, setCategory] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [step, setStep] = useState<'select' | 'preview'>('select');

  const categories = getCategories();
  const filteredTemplates = category ? getTemplatesByCategory(category) : templates;

  useEffect(() => {
    // Initialize variables from context
    setVariables({
      sender: 'Sarah Chen',
      sender_email: 'sarah@company.com',
      sender_phone: '+1-555-0100',
      sender_company: 'Engineering Plastics Supply',
      ...context,
    });
  }, [context]);

  const selectTemplate = (tpl: EmailTemplate) => {
    setSelectedTemplate(tpl);
    // Pre-fill variables with context
    const vars = { ...variables };
    tpl.variables.forEach(v => {
      if (!vars[v]) vars[v] = '';
    });
    setVariables(vars);
    setStep('preview');
  };

  const updateVar = (key: string, value: string) => {
    setVariables(prev => ({ ...prev, [key]: value }));
  };

  const generatePreview = () => {
    if (!selectedTemplate) return { subject: '', body: '' };
    return fillTemplate(selectedTemplate, variables);
  };

  const preview = generatePreview();

  const copyToClipboard = async () => {
    const text = `${t('page.emailDraft.subject')}: ${preview.subject}\n\n${preview.body}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const reset = () => {
    setStep('select');
    setSelectedTemplate(null);
    setCopied(false);
  };

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title={t('page.emailDraft.emailDraft')}
      subtitle={step === 'preview' ? selectedTemplate?.title : t('page.emailDraft.selectTemplate')}
    >
      {/* Template Selector */}
      {step === 'select' && (
        <div className="space-y-4">
          {/* Category filter */}
          <div className="segmented-control">
            <button
              onClick={() => setCategory('')}
              className={`segmented-option ${!category ? 'segmented-option-active' : ''}`}
            >
              {t('page.emailDraft.all')}
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`segmented-option ${category === cat ? 'segmented-option-active' : ''}`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Template cards */}
          <div className="data-surface divide-y divide-gray-100">
            {filteredTemplates.map(tpl => (
              <button
                key={tpl.id}
                onClick={() => selectTemplate(tpl)}
                className="w-full p-3 text-left transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600"
              >
                <div className="text-xs font-medium text-gray-900">{tpl.title}</div>
                <div className="text-2xs text-gray-500 mt-0.5 truncate">{tpl.subject}</div>
                <div className="flex gap-1 mt-1.5">
                  <span className="text-2xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{tpl.category}</span>
                  <span className="text-2xs text-gray-400">{tpl.variables.length} {t('page.emailDraft.variables')}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Preview / Edit */}
      {step === 'preview' && selectedTemplate && (
        <div className="space-y-4 h-full flex flex-col">
          {/* Variables form */}
          <div className="space-y-2">
            <h4 className="section-label">{t('page.emailDraft.fillVariables')}</h4>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {selectedTemplate.variables.filter(v => !v.startsWith('sender')).map(v => (
                <div key={v} className={`min-w-0 ${v.length > 12 ? 'sm:col-span-2' : ''}`}>
                  <label className="text-2xs text-gray-400 block capitalize" htmlFor={`email-draft-variable-${v}`}>{v.replace(/_/g, ' ')}</label>
                  <input
                    id={`email-draft-variable-${v}`}
                    className="input w-full text-xs mt-0.5"
                    value={variables[v] || ''}
                    onChange={e => updateVar(v, e.target.value)}
                    placeholder={`{{${v}}}`}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="text-2xs text-gray-400 block">{t('page.emailDraft.subject')}</label>
            <div className="input mt-0.5 h-auto min-h-8 break-words py-1.5 font-medium text-gray-900">
              {preview.subject || t('page.emailDraft.fillVariablesAbove')}
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 min-h-0">
            <label className="text-2xs text-gray-400 block mb-1" htmlFor="email-draft-body">{t('page.emailDraft.body')}</label>
            <textarea
              id="email-draft-body"
              className="input h-full min-h-[200px] resize-y py-2 font-sans text-xs leading-relaxed"
              value={preview.body}
              readOnly
            />
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-2 border-t border-gray-100 sm:flex-row">
            <button onClick={copyToClipboard} className="btn-primary w-full sm:flex-1 text-sm">
              {copied ? (
                <><Icon name="check" size={13} className="mr-1" />{t('page.emailDraft.copied')}</>
              ) : (
                <><Icon name="copy" size={13} className="mr-1" />{t('page.emailDraft.copyToClipboard')}</>
              )}
            </button>
            <button onClick={reset} className="btn-secondary w-full sm:w-auto text-sm">{t('common.back')}</button>
          </div>
        </div>
      )}
    </SidePanel>
  );
}
