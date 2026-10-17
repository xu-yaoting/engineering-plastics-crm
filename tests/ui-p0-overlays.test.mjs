import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const confirmDialogSource = readFileSync(
  new URL('../src/components/shared/ConfirmDialog.tsx', import.meta.url),
  'utf8',
);
const contactPanelSource = readFileSync(
  new URL('../src/components/contacts/ContactPanel.tsx', import.meta.url),
  'utf8',
);
const companiesSource = readFileSync(new URL('../src/pages/Companies.tsx', import.meta.url), 'utf8');
const quotationDetailSource = readFileSync(new URL('../src/pages/QuotationDetail.tsx', import.meta.url), 'utf8');
const orderDetailSource = readFileSync(new URL('../src/pages/OrderDetail.tsx', import.meta.url), 'utf8');
const shipmentsSource = readFileSync(new URL('../src/pages/Shipments.tsx', import.meta.url), 'utf8');
const paymentsSource = readFileSync(new URL('../src/pages/Payments.tsx', import.meta.url), 'utf8');
const contactsSource = readFileSync(new URL('../src/pages/Contacts.tsx', import.meta.url), 'utf8');
const shipmentDetailSource = readFileSync(new URL('../src/pages/ShipmentDetail.tsx', import.meta.url), 'utf8');
const ledgerSource = readFileSync(
  new URL('../src/components/materials-tooling/LedgerTab.tsx', import.meta.url),
  'utf8',
);
const activitiesSource = readFileSync(new URL('../src/pages/Activities.tsx', import.meta.url), 'utf8');

test('shared confirmation dialog exposes an accessible destructive decision', () => {
  assert.match(confirmDialogSource, /role="alertdialog"/);
  assert.match(confirmDialogSource, /aria-modal="true"/);
  assert.match(confirmDialogSource, /aria-labelledby=\{titleId\}/);
  assert.match(confirmDialogSource, /aria-describedby=\{descriptionId\}/);
  assert.match(confirmDialogSource, /e\.key === 'Escape'/);
  assert.match(confirmDialogSource, /stopImmediatePropagation/);
  assert.match(confirmDialogSource, /previouslyFocused\?\.focus\(\)/);
  assert.match(confirmDialogSource, /disabled=\{busy\}/);
  assert.match(confirmDialogSource, /modal-surface/);
});

test('record payment modal traps and restores focus with labeled fields', () => {
  assert.match(paymentsSource, /ref=\{paymentDialogRef\}/);
  assert.match(paymentsSource, /aria-labelledby=\{paymentDialogTitleId\}/);
  assert.match(paymentsSource, /paymentAmountRef\.current\?\.focus\(\)/);
  assert.match(paymentsSource, /event\.key === 'Escape'/);
  assert.match(paymentsSource, /event\.key !== 'Tab'/);
  assert.match(paymentsSource, /paymentDialogRef\.current\?\.querySelectorAll/);
  assert.match(paymentsSource, /previouslyFocused\?\.isConnected && previouslyFocused !== document\.body/);
  assert.match(paymentsSource, /paymentTriggerRef\.current\?\.focus\(\)/);
  for (const fieldId of ['payment-amount', 'payment-method', 'payment-reference']) {
    assert.match(paymentsSource, new RegExp(`htmlFor="${fieldId}"`));
    assert.match(paymentsSource, new RegExp(`id="${fieldId}"`));
  }
});

test('contact deletion uses the shared confirmation dialog instead of browser confirm', () => {
  assert.match(contactPanelSource, /import ConfirmDialog from '\.\.\/shared\/ConfirmDialog'/);
  assert.match(contactPanelSource, /<ConfirmDialog/);
  assert.match(contactPanelSource, /open=\{confirmDelete\}/);
  assert.match(contactPanelSource, /busy=\{deleting\}/);
  assert.doesNotMatch(contactPanelSource, /window\.confirm/);
});

test('company deletion leaves the table menu and uses the shared confirmation dialog', () => {
  assert.match(companiesSource, /import ConfirmDialog from '\.\.\/components\/shared\/ConfirmDialog'/);
  assert.match(companiesSource, /<ConfirmDialog/);
  assert.match(companiesSource, /open=\{!!deleteTarget\}/);
  assert.match(companiesSource, /busy=\{deleting\}/);
  assert.doesNotMatch(companiesSource, /confirmDelete !== c\.id/);
  assert.doesNotMatch(companiesSource, /window\.confirm/);
});

for (const [name, source] of [
  ['quotation detail', quotationDetailSource],
  ['order detail', orderDetailSource],
]) {
  test(`${name} deletion leaves the actions menu and uses the shared dialog`, () => {
    assert.match(source, /import ConfirmDialog from '\.\.\/components\/shared\/ConfirmDialog'/);
    assert.match(source, /<ConfirmDialog/);
    assert.match(source, /open=\{confirmDelete\}/);
    assert.match(source, /busy=\{deleting\}/);
    assert.doesNotMatch(source, /!confirmDelete \? \(/);
    assert.doesNotMatch(source, /<p className="text-2xs text-red-600 mb-1\.5">\{t\('common\.confirmDelete'\)\}<\/p>/);
  });
}

for (const [name, source] of [
  ['shipments', shipmentsSource],
  ['payments', paymentsSource],
]) {
  test(`${name} list deletion uses the shared confirmation dialog`, () => {
    assert.match(source, /import ConfirmDialog from '\.\.\/components\/shared\/ConfirmDialog'/);
    assert.match(source, /<ConfirmDialog/);
    assert.match(source, /open=\{!!deleteTarget\}/);
    assert.match(source, /busy=\{deleting\}/);
    assert.doesNotMatch(source, /confirmDelete !==/);
    assert.doesNotMatch(source, /<p className="text-2xs text-red-600 mb-1">/);
  });
}

for (const [name, source] of [
  ['contacts', contactsSource],
  ]) {
  test(`${name} deletion leaves the actions menu and uses the shared dialog`, () => {
    assert.match(source, /import ConfirmDialog from '\.\.\/components\/shared\/ConfirmDialog'/);
    assert.match(source, /<ConfirmDialog/);
    assert.match(source, /busy=\{deleting\}/);
    assert.doesNotMatch(source, /<p className="text-2xs text-red-600 mb-1/);
  });
}

test('shipment detail deletion leaves the actions menu and uses the shared dialog', () => {
  assert.match(shipmentDetailSource, /import ConfirmDialog from '\.\.\/components\/shared\/ConfirmDialog'/);
  assert.match(shipmentDetailSource, /<ConfirmDialog/);
  assert.match(shipmentDetailSource, /busy=\{deleting\}/);
  assert.doesNotMatch(shipmentDetailSource, /<p className="text-2xs text-red-600 mb-1\.5">/);
});

test('ledger period closing uses the shared dialog instead of browser confirm', () => {
  assert.match(ledgerSource, /import ConfirmDialog from '\.\.\/shared\/ConfirmDialog'/);
  assert.match(ledgerSource, /<ConfirmDialog/);
  assert.match(ledgerSource, /busy=\{closingPeriod\}/);
  assert.doesNotMatch(ledgerSource, /window\.confirm/);
});

test('activity deletion uses the shared dialog instead of inline confirmation', () => {
  assert.match(activitiesSource, /import ConfirmDialog from '\.\.\/components\/shared\/ConfirmDialog'/);
  assert.match(activitiesSource, /<ConfirmDialog/);
  assert.match(activitiesSource, /open=\{!!deleteTarget\}/);
  assert.match(activitiesSource, /busy=\{deleting\}/);
  assert.doesNotMatch(activitiesSource, /confirmDelete === a\.id/);
});
