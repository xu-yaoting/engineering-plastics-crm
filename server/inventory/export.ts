import XLSX from 'xlsx';

type StockItem = {
  id: string;
  inventory_type: 'full_sheet' | 'full_rod' | 'full_tube' | 'remnant';
  length_mm: number | null;
  width_mm: number | null;
  thickness_mm: number | null;
  diameter_mm: number | null;
  outer_diameter_mm: number | null;
  inner_diameter_mm: number | null;
  estimated_weight_kg: number | null;
  stored_estimated_weight_kg: number | null;
  recommended_estimated_weight_kg: number | null;
  actual_weight_kg: number | null;
  actual_weight_min_kg: number | null;
  actual_weight_max_kg: number | null;
  measurement_sample_count: number;
  measured_thickness_mm: number | null;
  calculation_thickness_mm: number | null;
  reference_thickness_mm: number | null;
  reference_length_mm: number | null;
  reference_width_mm: number | null;
  reference_unit_weight_kg: number | null;
  reference_source: string | null;
  reference_note: string | null;
  weight_basis: 'scale' | 'measured_thickness' | 'supplier_reference' | 'tolerance_rule' | 'geometric' | 'legacy_estimate' | 'missing_rule';
  display_weight_kg: number | null;
  weight_status: 'estimated' | 'actual' | 'missing_rule';
  legacy_sku: string | null;
  parent_item_id: string | null;
  current_quantity: number;
};

type StockGroup = {
  sku: string;
  material_name: string;
  shape: 'sheet' | 'rod' | 'tube';
  standard_length_mm: number | null;
  standard_width_mm: number | null;
  standard_thickness_mm: number | null;
  standard_diameter_mm: number | null;
  standard_outer_diameter_mm: number | null;
  standard_inner_diameter_mm: number | null;
  items: StockItem[];
};

const HEADERS = [
  '主体 SKU', '材料', '标准规格', '实际规格', '库存类型', '数量（件）',
  '预估单重（kg/件）', '实际单重（kg/件）', '显示单重（kg/件）',
  '显示总重量（kg）', '重量依据', '父级来源', '旧 SKU',
  '计算采用厚度（mm）', '仓库实测厚度（mm）',
  '实称最轻单重（kg/件）', '实称最重单重（kg/件）', '抽样件数',
  '厂家参考整板规格', '厂家参考厚度（mm）', '厂家参考单重（kg/片）',
  '厂家参考来源', '建议预计单重（kg/件）', '厂家参考备注',
];

function numberText(value: number | null): string {
  if (value === null || !Number.isFinite(Number(value))) return '';
  return Number.isInteger(Number(value)) ? String(value) : String(Number(value));
}

function specification(group: StockGroup, item?: StockItem): string {
  if (group.shape === 'sheet') {
    return item
      ? `${numberText(item.length_mm)} × ${numberText(item.width_mm)} × ${numberText(item.thickness_mm)} mm`
      : `${numberText(group.standard_length_mm)} × ${numberText(group.standard_width_mm)} × ${numberText(group.standard_thickness_mm)} mm`;
  }
  if (group.shape === 'rod') {
    return item
      ? `Ø${numberText(item.diameter_mm)} × ${numberText(item.length_mm)} mm`
      : `Ø${numberText(group.standard_diameter_mm)} × ${numberText(group.standard_length_mm)} mm`;
  }
  return item
    ? `Ø${numberText(item.outer_diameter_mm)} / ${numberText(item.inner_diameter_mm)} × ${numberText(item.length_mm)} mm`
    : `Ø${numberText(group.standard_outer_diameter_mm)} / ${numberText(group.standard_inner_diameter_mm)} × ${numberText(group.standard_length_mm)} mm`;
}

function inventoryTypeLabel(value: StockItem['inventory_type']): string {
  return ({
    full_sheet: '整板',
    full_rod: '整棒',
    full_tube: '整管',
    remnant: '余料',
  })[value];
}

function weightBasis(item: StockItem): string {
  return ({
    scale: '实际称重',
    measured_thickness: '按仓库实测厚度估算',
    supplier_reference: '按厂家规格厚度估算',
    tolerance_rule: '按公差规则估算',
    geometric: '按尺寸和密度估算',
    legacy_estimate: '历史预计重量（建议复核）',
    missing_rule: '未提供',
  })[item.weight_basis];
}

function referenceSpecification(item: StockItem): string {
  if (item.reference_length_mm === null || item.reference_width_mm === null) return '';
  return `${numberText(item.reference_length_mm)} × ${numberText(item.reference_width_mm)} mm`;
}

function buildWorksheet(
  title: string,
  groups: StockGroup[],
  generatedAt: Date,
  parentLabels: Map<string, string>,
): XLSX.WorkSheet {
  const rows = groups.flatMap((group) => group.items.map((item) => {
    const displayWeight = item.display_weight_kg;
    return [
      group.sku,
      group.material_name,
      specification(group),
      specification(group, item),
      inventoryTypeLabel(item.inventory_type),
      Number(item.current_quantity || 0),
      item.estimated_weight_kg,
      item.actual_weight_kg,
      displayWeight,
      displayWeight === null ? null : Math.round(displayWeight * Number(item.current_quantity || 0) * 1000) / 1000,
      weightBasis(item),
      item.parent_item_id ? parentLabels.get(item.parent_item_id) || item.parent_item_id : '',
      item.legacy_sku || '',
      item.calculation_thickness_mm,
      item.measured_thickness_mm,
      item.actual_weight_min_kg,
      item.actual_weight_max_kg,
      item.measurement_sample_count || null,
      referenceSpecification(item),
      item.reference_thickness_mm,
      item.reference_unit_weight_kg,
      item.reference_source || '',
      item.recommended_estimated_weight_kg,
      item.reference_note || '',
    ];
  }));
  const worksheet = XLSX.utils.aoa_to_sheet([
    [title],
    [`导出时间：${generatedAt.toLocaleString('zh-CN', { hour12: false, timeZone: 'Asia/Shanghai' })}`],
    [],
    HEADERS,
    ...rows,
  ]);
  worksheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: HEADERS.length - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: HEADERS.length - 1 } },
  ];
  worksheet['!cols'] = [
    { wch: 24 }, { wch: 12 }, { wch: 24 }, { wch: 24 }, { wch: 12 }, { wch: 12 },
    { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 34 }, { wch: 24 },
    { wch: 20 }, { wch: 22 }, { wch: 23 }, { wch: 23 }, { wch: 12 }, { wch: 24 },
    { wch: 23 }, { wch: 25 }, { wch: 24 }, { wch: 25 }, { wch: 42 },
  ];
  if (rows.length > 0) worksheet['!autofilter'] = { ref: `A4:${XLSX.utils.encode_col(HEADERS.length - 1)}${rows.length + 4}` };
  if (worksheet.A1) worksheet.A1.s = { font: { bold: true, sz: 14, color: { rgb: '1F2937' } } };
  for (let column = 0; column < HEADERS.length; column += 1) {
    const cell = worksheet[XLSX.utils.encode_cell({ r: 3, c: column })];
    if (cell) cell.s = {
      fill: { fgColor: { rgb: '2563EB' } },
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      alignment: { horizontal: 'center', vertical: 'center' },
    };
  }
  for (let row = 4; row < rows.length + 4; row += 1) {
    for (const column of [5, 6, 7, 8, 9, 13, 14, 15, 16, 17, 19, 20, 22]) {
      const cell = worksheet[XLSX.utils.encode_cell({ r: row, c: column })];
      if (cell?.t === 'n') cell.z = column === 5 ? '#,##0.###' : column === 17 ? '#,##0' : '#,##0.000';
    }
  }
  return worksheet;
}

export function exportInventoryWorkbook(
  sheetStock: unknown[],
  rodStock: unknown[],
  generatedAt = new Date(),
  sheets: Array<'sheet' | 'rod'> = ['sheet', 'rod'],
): { buffer: Buffer; filename: string } {
  const sheetGroups = sheetStock as StockGroup[];
  const rodGroups = rodStock as StockGroup[];
  const parentLabels = new Map<string, string>();
  for (const group of [...sheetGroups, ...rodGroups]) {
    for (const item of group.items) parentLabels.set(item.id, `${group.sku} · ${specification(group, item)}`);
  }
  const workbook = XLSX.utils.book_new();
  if (sheets.includes('sheet')) {
    XLSX.utils.book_append_sheet(workbook, buildWorksheet('板材库存', sheetGroups, generatedAt, parentLabels), '板材库存');
  }
  if (sheets.includes('rod')) {
    XLSX.utils.book_append_sheet(workbook, buildWorksheet('棒材库存', rodGroups, generatedAt, parentLabels), '棒材库存');
  }
  const output = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx', compression: true }) as Buffer;
  return {
    buffer: Buffer.from(output),
    filename: `inventory-${generatedAt.toISOString().slice(0, 10)}.xlsx`,
  };
}
