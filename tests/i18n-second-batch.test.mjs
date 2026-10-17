import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const files = [
  '../src/pages/Quotations.tsx',
  '../src/pages/QuotationDetail.tsx',
];

const source = files
  .map((file) => readFileSync(new URL(file, import.meta.url), 'utf8'))
  .join('\n');

const dictionarySource = readFileSync(new URL('../src/lib/i18n.tsx', import.meta.url), 'utf8');
const quotationEditSource = readFileSync(new URL('../src/components/quotations/QuotationEditPanel.tsx', import.meta.url), 'utf8');
const quotationsSource = readFileSync(new URL('../src/pages/Quotations.tsx', import.meta.url), 'utf8');

test('inquiry and quotation batch no longer renders obvious hard-coded English UI labels', () => {
  const forbidden = [
    /Inquiry created/,
    /Failed to create inquiry/,
    /Status changed to/,
    /Failed to change status/,
    /Quotation created/,
    /Failed to create quotation/,
    /Inquiry duplicated/,
    /Failed to duplicate/,
    /Inquiry deleted/,
    /Failed to delete inquiry/,
    /Creating\.\.\./,
    />Duplicate</,
    />Delete</,
    />Confirm\?</,
    />Yes</,
    />No</,
    /Contact:/,
    /Created:/,
    /Source:/,
    /No description provided\./,
    />Quantity</,
    />Chemical Exposure</,
    />Mechanical Load</,
    />Regulatory Requirements</,
    />Activity</,
    />Details</,
    />Status</,
    />Urgency</,
    />Customer</,
    />Tasks</,
    />Edit Inquiry</,
    />Immediate</,
    />Within 2 Weeks</,
    />Within 1 Month</,
    />No Rush</,
    />Email</,
    />Phone \/ WeChat</,
    />Social Media</,
    />Alibaba Platform</,
    />Trade Show</,
    />Referral</,
    />Save Changes</,
    />All</,
    />Pending Approval</,
    />Approved</,
    />Number</,
    />Date</,
    />Company</,
    />Total</,
    />Currency</,
    />Valid Until</,
    />Version</,
    />Rev /,
    /Quotation date: newest first/,
    /Quotation date: oldest first/,
    /Total: high to low/,
    /Total: low to high/,
  ];

  for (const pattern of forbidden) {
    assert.doesNotMatch(source, pattern, `Unexpected hard-coded English UI text: ${pattern}`);
  }
});

test('second localization batch has dictionary entries for quotation UI', () => {
  const requiredKeys = [
    'statusChangeFailed',
    'quotationCreated',
    'quotationCreateFailed',
    'duplicateFailed',
    'deleteFailed',
    'saving',
    'rev',
    'quotationDateNewest',
    'quotationDateOldest',
    'totalHighToLow',
    'totalLowToHigh',
    'pendingApproval',
    'approved',
    'companyRequired',
    'descriptionRequired',
  ];

  for (const key of requiredKeys) {
    assert.match(dictionarySource, new RegExp(`${key}:`), `Missing i18n key: ${key}`);
  }
});

test('quotation edit form keeps customer, product, notes and commercial controls accessible', () => {
  for (const fieldId of ['quotation-company', 'quotation-contact', 'quotation-edit-owner', 'quotation-edit-internal-notes']) {
    assert.match(quotationEditSource, new RegExp(`htmlFor="${fieldId}"`));
    assert.match(quotationEditSource, new RegExp(`id="${fieldId}"`));
  }
  assert.match(quotationEditSource, /aria-invalid/);
});

const require = createRequire(import.meta.url);
const compiledEditor = ts.transpileModule(quotationEditSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;

// Exercise the real editor's handlers and asynchronous effects without a DOM or a business database.
function quotationEditor({ quotation = {}, listContacts = async () => [] } = {}) {
  const hooks = [];
  let cursor = 0;
  let dirty = true;
  let effects = [];
  let tree;
  const creates = [];
  const updates = [];
  const toastErrors = [];
  const user = { id: 'fixture-user', role: 'admin' };
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = typeof initial === 'function' ? initial() : initial;
      return [hooks[index], value => {
        const next = typeof value === 'function' ? value(hooks[index]) : value;
        if (!Object.is(next, hooks[index])) { hooks[index] = next; dirty = true; }
      }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = { current: initial };
      return hooks[index];
    },
    useEffect(effect, deps) {
      const index = cursor++;
      const previous = hooks[index];
      if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
        hooks[index] = { deps };
        effects.push(() => {
          previous?.cleanup?.();
          hooks[index].cleanup = effect();
        });
      }
    },
  };
  const api = {
    companies: { list: async () => [] },
    contacts: { list: listContacts },
    team: { list: async () => [] },
    quotations: {
      create: async payload => { creates.push(payload); return { id: 'fixture-quote' }; },
      update: async (id, payload) => { updates.push({ id, payload }); return { id }; },
    },
  };
  const modules = {
    react,
    '../../lib/api': api,
    '../../lib/auth': { useAuth: () => ({ user }) },
    '../../lib/currency': { formatCurrency: value => String(value) },
    '../shared/SidePanel': 'aside',
    '../shared/Icon': 'svg',
    'react-i18next': { useTranslation: () => ({ t: key => key }) },
    'react-hot-toast': { success() {}, error: message => toastErrors.push(message) },
  };
  const module = { exports: {} };
  runInNewContext(compiledEditor, {
    module, exports: module.exports,
    require: id => id in modules ? modules[id] : require(id),
  });
  function nodes(node) {
    if (!node || typeof node !== 'object') return [];
    if (Array.isArray(node)) return node.flatMap(child => nodes(child));
    return [node, ...nodes(node.props?.children)];
  }
  async function flush() {
    for (let pass = 0; pass < 30; pass += 1) {
      if (dirty) {
        dirty = false;
        cursor = 0;
        effects = [];
        tree = module.exports.default({ quotation, onClose() {}, onSaved() {} });
        for (const effect of effects) effect();
      }
      await new Promise(resolve => setImmediate(resolve));
      if (!dirty) return;
    }
    throw new Error('Quotation editor did not settle');
  }
  function field(id) { return nodes(tree).find(node => node.props?.id === id); }
  return {
    flush, field, creates, updates, toastErrors,
    async change(id, value) {
      assert.ok(field(id), `Missing control ${id}`);
      field(id).props.onChange({ target: { value } });
      await flush();
    },
    async click(label) {
      const button = nodes(tree).find(node => node.type === 'button' && node.props.children === label);
      assert.ok(button, `Missing button ${label}`);
      await button.props.onClick();
      await flush();
    },
  };
}

const contact = (id, companyId, extra = {}) => ({
  id, company_id: companyId, first_name: 'Fixture', last_name: id, is_active: 1, ...extra,
});

test('new quotation saves product requirements without application, urgency or source inputs', async () => {
  const editor = quotationEditor();
  await editor.flush();
  for (const id of ['quotation-description', 'quotation-urgency', 'quotation-source']) {
    assert.equal(editor.field(id), undefined, `Unexpected requirement control ${id}`);
  }
  await editor.change('quotation-company', 'company-a');
  await editor.click('page.quotationDetail.editPanel.add');
  await editor.change('quotation-edit-grade-0', 'Fixture material');
  await editor.change('quotation-edit-internal-notes', 'Customer-specified dimensions');
  await editor.click('page.quotationDetail.editPanel.createQuotation');
  assert.equal(editor.creates.length, 1);
  assert.equal(editor.creates[0].company_id, 'company-a');
  assert.equal(editor.creates[0].internal_notes, 'Customer-specified dimensions');
  assert.equal(editor.creates[0].line_items.length, 1);
  for (const field of ['application_description', 'source', 'urgency']) {
    assert.equal(Object.hasOwn(editor.creates[0], field), false);
  }
});

test('company contact defaults are unambiguous, active and company-scoped', async () => {
  const cases = [
    { rows: [contact('other', 'company-b', { is_primary_contact: 1 }), contact('main', 'company-a', { is_primary_contact: 1 }), contact('second', 'company-a')], expected: 'main' },
    { rows: [contact('sole', 'company-a')], expected: 'sole' },
    { rows: [contact('disabled', 'company-a', { is_active: 0, is_primary_contact: 1 }), contact('sole', 'company-a')], expected: 'sole' },
    { rows: [contact('first', 'company-a'), contact('second', 'company-a')], expected: '' },
    { rows: [], expected: '' },
  ];
  for (const { rows, expected } of cases) {
    const editor = quotationEditor({ listContacts: async () => rows });
    await editor.flush();
    await editor.change('quotation-company', 'company-a');
    assert.equal(editor.field('quotation-contact').props.value, expected);
  }
});

test('an explicit contact is preserved and switching company clears the previous contact', async () => {
  const editor = quotationEditor({
    quotation: { company_id: 'company-a', contact_id: 'chosen' },
    listContacts: async companyId => companyId === 'company-a'
      ? [contact('primary', companyId, { is_primary_contact: 1 }), contact('chosen', companyId)] : [],
  });
  await editor.flush();
  assert.equal(editor.field('quotation-contact').props.value, 'chosen');
  await editor.change('quotation-contact', 'primary');
  assert.equal(editor.field('quotation-contact').props.value, 'primary');
  await editor.change('quotation-company', 'company-b');
  assert.equal(editor.field('quotation-contact').props.value, '');
});

test('late responses cannot replace contacts after switching companies, including A to B to A', async () => {
  const requests = [];
  const editor = quotationEditor({ listContacts: companyId => new Promise(resolve => requests.push({ companyId, resolve })) });
  await editor.flush();
  await editor.change('quotation-company', 'company-a');
  await editor.change('quotation-company', 'company-b');
  await editor.change('quotation-company', 'company-a');
  assert.equal(editor.field('quotation-contact').props.disabled, true);
  requests[2].resolve([contact('latest', 'company-a')]);
  await editor.flush();
  requests[0].resolve([contact('stale-a', 'company-a')]);
  requests[1].resolve([contact('stale-b', 'company-b')]);
  await editor.flush();
  assert.equal(editor.field('quotation-contact').props.value, 'latest');
  assert.equal(editor.field('quotation-contact').props.disabled, false);
});

test('editing an existing quotation leaves historical application, urgency and source untouched', async () => {
  const editor = quotationEditor({ quotation: {
    id: 'existing', company_id: 'company-a', contact_id: 'historic',
    application_description: 'Historical customer request', source: 'referral', urgency: 'immediate',
    line_items: [{ id: 'line-a', product_grade_snapshot: 'Fixture material', unit_of_measure: 'pc', quantity: 1, unit_price: 10, line_total: 10 }],
  } });
  await editor.flush();
  await editor.click('page.quotationDetail.editPanel.saveChanges');
  assert.equal(editor.updates.length, 1);
  assert.equal(editor.updates[0].payload.contact_id, 'historic');
  for (const field of ['application_description', 'source', 'urgency']) {
    assert.equal(Object.hasOwn(editor.updates[0].payload, field), false, `Historical ${field} must not be overwritten`);
  }
});

test('quotations list defaults to quotation date sorting and exposes sort options', () => {
  assert.match(quotationsSource, /useState\('quotation_date_desc'\)/);
  assert.match(quotationsSource, /dateValue\(b\.quotation_date \|\| b\.created_at\) - dateValue\(a\.quotation_date \|\| a\.created_at\)/);
  assert.match(quotationsSource, /value=\{sortBy\}/);
  assert.match(quotationsSource, /setSortBy\(e\.target\.value\)/);
  assert.match(quotationsSource, /value="quotation_date_desc"/);
  assert.match(quotationsSource, /value="quotation_date_asc"/);
  assert.match(quotationsSource, /value="total_desc"/);
  assert.match(quotationsSource, /value="total_asc"/);
});
