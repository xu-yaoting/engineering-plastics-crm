/**
 * Centralized currency formatting for the CRM.
 * Every monetary display MUST use this function — never hardcode "$" or "¥".
 */
const SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  CNY: '¥',
  GBP: '£',
  JPY: '¥',
  KRW: '₩',
  HKD: 'HK$',
  SGD: 'S$',
  TWD: 'NT$',
};

export function currencySymbol(code: string | undefined | null): string {
  return SYMBOLS[code || 'USD'] || '$';
}

export function formatCurrency(amount: number | undefined | null, currencyCode: string | undefined | null): string {
  const sym = currencySymbol(currencyCode || 'USD');
  const val = amount ?? 0;
  return `${sym}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
