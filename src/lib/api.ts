const BASE = '/api';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('crm-token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

let authenticatedFetchInstalled = false;

export function installAuthenticatedFetch(): void {
  if (authenticatedFetchInstalled) return;

  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const url = rawUrl.startsWith(window.location.origin) ? rawUrl.slice(window.location.origin.length) : rawUrl;
    const token = localStorage.getItem('crm-token');

    if (!url.startsWith('/api/') || !token) {
      return originalFetch(input, init);
    }

    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
    if (!headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    return originalFetch(input, { ...init, headers });
  };
  authenticatedFetchInstalled = true;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  for (const [key, value] of Object.entries(getAuthHeaders())) {
    if (!headers.has(key)) headers.set(key, value);
  }

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
  });
  if (res.status === 204) return undefined as T;
  if (res.status === 401 && path !== '/auth/login') {
    localStorage.removeItem('crm-token');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error || data?.message || `API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// Auth
export const auth = {
  status: () => request<{ requiresSetup: boolean }>('/auth/status'),
  setup: (name: string, pin: string) => request<{ user: { id: string; name: string; role: string }; token: string }>('/auth/setup', {
    method: 'POST',
    body: JSON.stringify({ name, pin }),
  }),
  login: (name: string, pin: string) => request<{ user: { id: string; name: string; role: string }; token: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ name, pin }),
  }),
  me: () => request<{ user: { id: string; name: string; role: string } }>('/auth/me'),
};

export type TeamMember = { id: string; name: string; role: string };
export type AuditEntry = {
  id: string;
  entity_type: string;
  entity_id: string;
  user_id: string;
  user_name: string;
  action: string;
  changes: Record<string, { old: unknown; new: unknown }>;
  created_at: string;
};
export type DevelopmentStage =
  | 'uncontacted'
  | 'contacted'
  | 'replied'
  | 'qualified'
  | 'converted'
  | 'nurturing'
  | 'stopped';
export type ActivityOutcome =
  | 'no_response'
  | 'replied'
  | 'interested'
  | 'no_current_need'
  | 'not_interested';
export type FollowUpBucket = 'all' | 'overdue' | 'today' | 'thisWeek' | 'upcoming' | 'none';
export type FollowUpWorkbenchItem = {
  company_id: string;
  company_name: string;
  development_stage: DevelopmentStage;
  company_status: string;
  classification: string | null;
  owner_user_id: string | null;
  owner_name: string | null;
  contact_id: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone_direct: string | null;
  contact_phone_mobile: string | null;
  last_activity_type: string | null;
  last_activity_subject: string | null;
  last_outcome: ActivityOutcome | null;
  last_activity_at: string | null;
  next_follow_up_task_id: string | null;
  next_follow_up_subject: string | null;
  next_follow_up_due_date: string | null;
  next_follow_up_due_time: string | null;
  next_follow_up_priority: string | null;
  next_follow_up_contact_id: string | null;
  next_follow_up_assignee_id: string | null;
};
export type RecordFollowUpInput = {
  company_id: string;
  contact_id?: string;
  activity_type: 'email' | 'call' | 'meeting' | 'note';
  subject: string;
  description?: string;
  direction?: 'inbound' | 'outbound' | 'internal';
  outcome?: ActivityOutcome;
  channel?: string;
  duration_minutes?: number;
  development_stage?: DevelopmentStage;
  current_task_id?: string;
  next_task?: {
    subject: string;
    description?: string;
    due_date: string;
    due_time?: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    contact_id?: string;
    assigned_to_user_id?: string;
    reminder_at?: string;
    tags?: string[];
  };
};
export type RecordFollowUpResult = {
  activity: {
    id: string;
    entity_id: string;
    activity_type: string;
    subject: string;
    outcome: ActivityOutcome | null;
    created_at: string;
  };
  completed_task: {
    id: string;
    subject: string;
    status: 'completed';
    completed_at: string;
  } | null;
  next_task: {
    id: string;
    subject: string;
    status: 'pending';
    due_date: string;
    contact_id: string | null;
  } | null;
  company: {
    id: string;
    name: string;
    development_stage: DevelopmentStage;
    last_activity_at: string;
  };
};

export const team = {
  list: () => request<TeamMember[]>('/team'),
};

export const audit = {
  list: (entityType: string, entityId: string, limit = 20) => {
    const query = new URLSearchParams({ entity_type: entityType, entity_id: entityId, limit: String(limit) });
    return request<AuditEntry[]>(`/audit?${query}`);
  },
};

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

export const followUps = {
  list: (params?: {
    bucket?: FollowUpBucket;
    stage?: DevelopmentStage;
    owner_user_id?: string;
    q?: string;
  }) => {
    const query = new URLSearchParams();
    if (params?.bucket) query.set('bucket', params.bucket);
    if (params?.stage) query.set('stage', params.stage);
    if (params?.owner_user_id) query.set('owner_user_id', params.owner_user_id);
    if (params?.q) query.set('q', params.q);
    return request<FollowUpWorkbenchItem[]>(`/activities/follow-ups${query.size ? `?${query}` : ''}`);
  },
  record: (data: RecordFollowUpInput) =>
    request<RecordFollowUpResult>('/activities/follow-ups', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
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
