import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/components/shared/QuoteAssistant.tsx', import.meta.url), 'utf8')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\/[^\n]*/g, '');
const dictionarySource = readFileSync(new URL('../src/lib/i18n.tsx', import.meta.url), 'utf8');

test('quote assistant no longer renders obvious hard-coded English UI labels', () => {
  const forbidden = [
    /Quote Assistant/,
    /Add a product grade to see pricing suggestions/,
    /Suggested Price/,
    />Range</,
    /Margin Analysis/,
    /At suggested price/,
    /At target price/,
    />Cost</,
    /Volume Discount Suggestions/,
    /Quick Discounts/,
    /Insights/,
    />Apply/,
    /PEEK pricing is volatile/,
    /Premium grade/,
    /Healthy margin/,
    /consider increasing/,
  ];

  for (const pattern of forbidden) {
    assert.doesNotMatch(source, pattern);
  }
});

test('quote assistant localization dictionary contains the batch keys', () => {
  const requiredKeys = [
    'quoteAssistant', 'addProductGrade', 'suggestedPrice', 'range',
    'marginAnalysis', 'atSuggestedPrice', 'atTargetPrice', 'cost',
    'volumeDiscountSuggestions', 'quickDiscounts', 'insights', 'apply',
    'priceVolatile', 'premiumLeadTime', 'lowMargin', 'healthyMargin',
  ];

  for (const key of requiredKeys) {
    assert.match(dictionarySource, new RegExp(`${key}:`));
  }
});

test('quote assistant uses a flat neutral analysis surface', () => {
  assert.match(source, /className="data-surface p-4"/);
  assert.match(source, /status-edge-warning/);
  assert.doesNotMatch(source, /bg-gradient|rounded-lg/);
});
