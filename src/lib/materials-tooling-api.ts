const BASE = '/api/materials-tooling';

export type MaterialsPermission = {
  enter: boolean;
  manageMaterials: boolean;
  approve: boolean;
  viewPrices: boolean;
  managePeriods: boolean;
};

export type LowStockItem = {
  id: string;
  code: string;
  name: string;
  unit: string;
  safety_quantity: number;
  current_quantity: number;
};

export type CurrentMonthSummary = {
  receiptQuantity: number;
  issueQuantity: number;
  receiptAmount?: number;
  issueReferenceAmount?: number;
};

export type Overview = {
  month: string;
  pendingApprovals: number;
  lowStockItems: LowStockItem[];
  currentMonth: CurrentMonthSummary;
  overdueToolingCount: number;
};

export type MaterialsAttachment = {
  id: string;
  category: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  is_sensitive: boolean;
  uploaded_at: string;
  notes?: string | null;
};

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers);
  const isMultipart = options?.body instanceof FormData;
  if (options?.body && !isMultipart && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
  });
  if (res.status === 204) return undefined as T;
  if (res.status === 401) {
    localStorage.removeItem('crm-token');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.message || data?.error || `API error: ${res.status}`);
  }
  return res.json();
}

async function downloadBlob(path: string): Promise<Blob> {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('crm-token') || ''}`,
    },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.message || data?.error || `Download error: ${res.status}`);
  }
  return res.blob();
}

export const materialsToolingApi = {
  // Permissions
  getMe: () => request<{ permissions: MaterialsPermission }>('/me'),

  // Overview
  getOverview: () => request<{ overview: Overview }>('/overview'),

  // Materials items
  listItems: () => request<{ items: any[] }>('/items'),
  createItem: (data: any) => request<any>('/items', { method: 'POST', body: JSON.stringify(data) }),
  updateItem: (id: string, data: any) => request<any>(`/items/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  listSuppliers: () => request<{ suppliers: any[] }>('/suppliers'),

  // Documents
  listDocuments: () => request<{ documents: any[] }>('/documents'),
  getDocument: (id: string) => request<any>(`/documents/${id}`),
  createDocument: (data: any) => request<any>('/documents', { method: 'POST', body: JSON.stringify(data) }),
  updateDocument: (id: string, data: any) => request<any>(`/documents/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  submitDocument: (id: string) => request<any>(`/documents/${id}/submit`, { method: 'POST' }),
  approveDocument: (id: string) => request<any>(`/documents/${id}/approve`, { method: 'POST' }),
  rejectDocument: (id: string, data: any) => request<any>(`/documents/${id}/reject`, { method: 'POST', body: JSON.stringify(data) }),
  withdrawDocument: (id: string) => request<any>(`/documents/${id}/withdraw`, { method: 'POST' }),
  executeDocument: (id: string) => request<any>(`/documents/${id}/execute`, { method: 'POST' }),
  voidAndReplaceDocument: (id: string, data: any) => request<any>(`/documents/${id}/void-and-replace`, { method: 'POST', body: JSON.stringify(data) }),

  // Attachments
  uploadAttachment: (docId: string, formData: FormData) =>
    request<any>(`/documents/${docId}/attachments`, { method: 'POST', body: formData }),
  listDocumentAttachments: (docId: string) =>
    request<{ attachments: MaterialsAttachment[] }>(`/documents/${docId}/attachments`),
  downloadAttachment: (_docId: string, attachmentId: string) =>
    downloadBlob(`/attachments/${attachmentId}/download`),
  downloadApplicationPdf: (docId: string) => downloadBlob(`/documents/${docId}/application.pdf`),
  downloadApprovedPdf: (docId: string) => downloadBlob(`/documents/${docId}/approved.pdf`),

  // Monthly ledger
  listLedger: (month?: string) => {
    const q = month ? `?month=${month}` : '';
    return request<{ ledger: any }>(`/ledger${q}`);
  },
  downloadLedgerXlsx: (month?: string) => {
    const q = month ? `?month=${month}` : '';
    return downloadBlob(`/ledger.xlsx${q}`);
  },
  downloadLedgerPdf: (month?: string) => {
    const q = month ? `?month=${month}` : '';
    return downloadBlob(`/ledger.pdf${q}`);
  },

  // Price history
  getPriceHistory: (itemId: string) => request<{ priceHistory: any }>(`/price-history/${itemId}`),

  // Periods
  closePeriod: (month: string) => request<any>(`/periods/${month}/close`, { method: 'POST' }),
  reopenPeriod: (month: string, data: any) => request<any>(`/periods/${month}/reopen`, { method: 'POST', body: JSON.stringify(data) }),

  // Tooling
  listTooling: () => request<{ tooling: any[] }>('/tooling'),
  getTooling: (id: string) => request<{ tooling: any }>(`/tooling/${id}`),
  createTooling: (data: any) => request<any>('/tooling', { method: 'POST', body: JSON.stringify(data) }),
  moveTooling: (id: string, data: any) => request<any>(`/tooling/${id}/movements`, { method: 'POST', body: JSON.stringify(data) }),

  // Permissions management
  getPermissions: () => request<any>('/permissions'),
  updatePermissions: (userId: string, data: any) => request<any>(`/permissions/${userId}`, { method: 'PUT', body: JSON.stringify(data) }),
  getApprovalConfig: () => request<any>('/approval-config'),
  updateApprovalConfig: (documentType: string, data: any) => request<any>(`/approval-config/${documentType}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Cutover import
  previewCutoverImport: (formData: FormData) =>
    request<any>('/imports/cutover/preview', { method: 'POST', body: formData }),
  confirmCutoverImport: (formData: FormData) =>
    request<any>('/imports/cutover', { method: 'POST', body: formData }),
};
