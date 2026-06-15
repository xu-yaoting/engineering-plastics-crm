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
    const text = `Subject: ${preview.subject}\n\n${preview.body}`;
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
    <SidePanel open={open} onClose={onClose} title="Email Draft" subtitle={step === 'preview' ? selectedTemplate?.title : 'Select a template'}>
      {/* Template Selector */}
      {step === 'select' && (
        <div className="space-y-4">
          {/* Category filter */}
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setCategory('')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                !category ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  category === cat ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Template cards */}
          <div className="space-y-2">
            {filteredTemplates.map(tpl => (
              <button
                key={tpl.id}
                onClick={() => selectTemplate(tpl)}
                className="w-full text-left card p-3 hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <div className="text-xs font-medium text-gray-900">{tpl.title}</div>
                <div className="text-2xs text-gray-500 mt-0.5 truncate">{tpl.subject}</div>
                <div className="flex gap-1 mt-1.5">
                  <span className="text-2xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{tpl.category}</span>
                  <span className="text-2xs text-gray-400">{tpl.variables.length} variables</span>
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
            <h4 className="text-2xs font-semibold text-gray-500 uppercase tracking-wider">Fill in Variables</h4>
            <div className="grid grid-cols-2 gap-2">
              {selectedTemplate.variables.filter(v => !v.startsWith('sender')).map(v => (
                <div key={v} className={v.length > 12 ? 'col-span-2' : ''}>
                  <label className="text-2xs text-gray-400 block capitalize">{v.replace(/_/g, ' ')}</label>
                  <input
                    className="input text-xs mt-0.5"
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
            <label className="text-2xs text-gray-400 block">Subject</label>
            <div className="text-sm text-gray-900 font-medium bg-gray-50 rounded-lg px-3 py-2 mt-0.5 border border-gray-200">
              {preview.subject || '(fill variables above)'}
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 min-h-0">
            <label className="text-2xs text-gray-400 block mb-1">Body</label>
            <textarea
              className="w-full h-full min-h-[200px] text-xs text-gray-700 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200 resize-y font-sans leading-relaxed focus:outline-none focus:ring-1 focus:ring-blue-600"
              value={preview.body}
              readOnly
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t border-gray-100">
            <button onClick={copyToClipboard} className="btn-primary flex-1 text-sm">
              {copied ? <><Icon name="check" size={13} className="mr-1" />Copied!</> : <><Icon name="copy" size={13} className="mr-1" />Copy to Clipboard</>}
            </button>
            <button onClick={reset} className="btn-secondary text-sm">{t('common.back')}</button>
          </div>
        </div>
      )}
    </SidePanel>
  );
}
