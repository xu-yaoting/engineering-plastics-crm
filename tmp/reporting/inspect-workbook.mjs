import fs from 'node:fs/promises';
import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';

const source = new URL('./materials-ledger-2026-07.xlsx', import.meta.url).pathname;
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(source));
const summary = await workbook.inspect({
  kind: 'workbook,sheet,table',
  maxChars: 5000,
  tableMaxRows: 8,
  tableMaxCols: 16,
  tableMaxCellChars: 80,
});
console.log(summary.ndjson);
const range = await workbook.inspect({
  kind: 'region',
  sheetId: '月度明细账',
  range: 'A1:P8',
  maxChars: 5000,
});
console.log(range.ndjson);
const errors = await workbook.inspect({
  kind: 'match',
  searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A',
  options: { useRegex: true, maxResults: 100 },
  summary: 'formula error scan',
});
console.log(errors.ndjson);
const preview = await workbook.render({ sheetName: '月度明细账', range: 'A1:P8', scale: 1.5, format: 'png' });
await fs.writeFile(new URL('./materials-ledger-2026-07-xlsx.png', import.meta.url), new Uint8Array(await preview.arrayBuffer()));
