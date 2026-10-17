/**
 * Export data as CSV file download.
 * Triggers browser download with the given filename.
 */
export function exportCsv(rows: Record<string, any>[], filename: string) {
  if (rows.length === 0) return;

  const headers = Object.keys(rows[0]);
  const csvContent = [
    headers.join(','),
    ...rows.map(row =>
      headers.map(h => {
        const val = row[h];
        if (val === null || val === undefined) return '';
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(',')
    ),
  ].join('\n');

  const BOM = '﻿';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Fetch ALL records from an API endpoint and export every field as CSV.
 * Filters out soft-deleted records and internal fields like `id`, `deleted_at`.
 */
export async function exportFullCsv(apiUrl: string, filename: string, excludeFields: string[] = []) {
  const skipFields = new Set(['id', 'deleted_at', 'custom_fields', 'tags', ...excludeFields]);

  try {
    const res = await fetch(apiUrl);
    if (!res.ok) throw new Error(`Export request failed: ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return;

    // Use all fields from the first record, minus skip fields
    const headers = Object.keys(data[0]).filter(h => !skipFields.has(h));

    const rows = data.map((row: any) =>
      headers.map(h => {
        let val = row[h];
        if (val === null || val === undefined) return '';
        // Handle JSON objects/arrays
        if (typeof val === 'object') val = JSON.stringify(val);
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      })
    );

    const csvContent = [headers.join(','), ...rows.map((r: string[]) => r.join(','))].join('\n');

    const BOM = '﻿';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error('Export failed:', e);
  }
}
