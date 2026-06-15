const BASE = '/api';

let apiKeyPromise: Promise<string> | null = null;

async function getApiKey(): Promise<string> {
  if (!apiKeyPromise) {
    apiKeyPromise = fetch(`${BASE}/config`)
      .then(r => r.json())
      .then(data => data.apiKey as string)
      .catch(() => '');
  }
  return apiKeyPromise;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const key = await getApiKey();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (key) headers['x-api-key'] = key;

  const res = await fetch(`${BASE}${path}`, {
    headers,
    ...options,
  });
  if (res.status === 204) return undefined as T;
  if (res.status === 401) {
    // Key may have changed — reset promise so next call re-fetches
    apiKeyPromise = null;
    throw new Error('Unauthorized — please refresh the page');
  }
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json();
}

// Companies
export const companies = {
  list: () => request<any[]>('/companies'),
  get: (id: string) => request<any>(`/companies/${id}`),
  create: (data: any) => request<any>('/companies', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => request<any>(`/companies/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request<void>(`/companies/${id}`, { method: 'DELETE' }),
};

// Contacts
export const contacts = {
  list: (companyId?: string) => request<any[]>(`/contacts${companyId ? `?company_id=${companyId}` : ''}`),
  get: (id: string) => request<any>(`/contacts/${id}`),
  create: (data: any) => request<any>('/contacts', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => request<any>(`/contacts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request<void>(`/contacts/${id}`, { method: 'DELETE' }),
};

// Activities
export const activities = {
  list: (entityType?: string, entityId?: string) =>
    request<any[]>(`/activities${entityType && entityId ? `?entity_type=${entityType}&entity_id=${entityId}` : ''}`),
  recent: () => request<any[]>('/activities/recent'),
  create: (data: any) => request<any>('/activities', { method: 'POST', body: JSON.stringify(data) }),
};

// Tasks
export const tasks = {
  list: (params?: { status?: string; entity_type?: string; entity_id?: string }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.entity_type) q.set('entity_type', params.entity_type);
    if (params?.entity_id) q.set('entity_id', params.entity_id);
    return request<any[]>(`/tasks${q.toString() ? '?' + q : ''}`);
  },
  overdue: () => request<any[]>('/tasks/overdue'),
  get: (id: string) => request<any>(`/tasks/${id}`),
  create: (data: any) => request<any>('/tasks', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => request<any>(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request<void>(`/tasks/${id}`, { method: 'DELETE' }),
};

// Pipeline
export const pipeline = {
  list: () => request<any[]>('/pipeline'),
  move: (entityType: string, entityId: string, fromStage: string, toStage: string) =>
    request<any>('/pipeline/move', {
      method: 'PUT',
      body: JSON.stringify({ entityType, entityId, fromStage, toStage }),
    }),
};

// Inquiries
export const inquiries = {
  list: (companyId?: string) => request<any[]>(`/inquiries${companyId ? `?company_id=${companyId}` : ''}`),
  get: (id: string) => request<any>(`/inquiries/${id}`),
  create: (data: any) => request<any>('/inquiries', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => request<any>(`/inquiries/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
};

// Shipments
export const shipments = {
  list: (orderId?: string) => request<any[]>(`/shipments${orderId ? `?order_id=${orderId}` : ''}`),
  get: (id: string) => request<any>(`/shipments/${id}`),
  create: (data: any) => request<any>('/shipments', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => request<any>(`/shipments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
};

// Quotations
export const quotations = {
  list: (companyId?: string) => request<any[]>(`/quotations${companyId ? `?company_id=${companyId}` : ''}`),
  get: (id: string) => request<any>(`/quotations/${id}`),
  create: (data: any) => request<any>('/quotations', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => request<any>(`/quotations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
};
