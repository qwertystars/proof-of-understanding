const API_BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    credentials: 'include',
  });
  
  const data: any = await res.json();
  
  if (!res.ok) {
    throw new Error(data.error || `Request failed: ${res.status}`);
  }
  
  return data as T;
}

export const api = {
  getCountry: () => request<any>('/auth/country'),

  setCountry: (country: string) => request<any>('/auth/country', {
    method: 'POST',
    body: JSON.stringify({ country }),
  }),

  getTopics: (params?: { page?: number; category?: string; status?: string; region?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.category) searchParams.set('category', params.category);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.region) searchParams.set('region', params.region);
    const qs = searchParams.toString();
    return request<any>(`/topics${qs ? `?${qs}` : ''}`);
  },
  
  getTopic: (id: number) => request<any>(`/topics/${id}`),
  
  createTopic: (data: any) => request<any>('/topics', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  
  startQuiz: (topicId: number, position: string) => request<any>(`/topics/${topicId}/quiz`, {
    method: 'POST',
    body: JSON.stringify({ position }),
  }),
  
  submitQuiz: (topicId: number, sessionId: string, answers: number[]) => request<any>(
    `/topics/${topicId}/quiz/${sessionId}/submit`,
    { method: 'POST', body: JSON.stringify({ answers }) }
  ),
  
  vote: (topicId: number, position: string) => request<any>(`/topics/${topicId}/vote`, {
    method: 'POST',
    body: JSON.stringify({ position }),
  }),
  
  flagTopic: (topicId: number, reason?: string) => request<any>(`/topics/${topicId}/flag`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  }),
  
  register: (email: string, password: string, display_name?: string) => request<any>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, display_name }),
  }),
  
  login: (email: string, password: string) => request<any>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }),

  getCategories: (search?: string) => {
    const qs = search ? `?search=${encodeURIComponent(search)}` : '';
    return request<any>(`/categories${qs}`);
  },

  createCategory: (name: string, description?: string) => request<any>('/categories', {
    method: 'POST',
    body: JSON.stringify({ name, description }),
  }),

  getMe: () => request<any>('/auth/me'),

  logout: () => request<any>('/auth/logout', { method: 'POST' }),
};
