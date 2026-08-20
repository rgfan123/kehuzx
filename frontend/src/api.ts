import type { Customer, Demand, LoginResponse, OperationLog, Order, Page, Supplier, Template, User } from './types'

const TOKEN_KEY = 'khzx-token'
const USER_KEY = 'khzx-user'

export function getToken(): string | null { return localStorage.getItem(TOKEN_KEY) }
export function setToken(token: string, user: User) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}
export function getUser(): User | null {
  const raw = localStorage.getItem(USER_KEY)
  return raw ? JSON.parse(raw) : null
}
export function clearAuth() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY) }
export function isLoggedIn(): boolean { return !!getToken() }

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> || {}),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const response = await fetch(url, { ...init, headers })

  if (response.status === 401) {
    clearAuth()
    window.location.href = '/login'
    throw new Error('登录已过期')
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    const detail = payload?.detail
    throw new Error(typeof detail === 'string' ? detail : '操作失败，请稍后重试')
  }
  return response.status === 204 ? (undefined as T) : response.json()
}

const qs = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => value !== undefined && value !== '' && search.set(key, String(value)))
  return search.toString()
}

export const api = {
  // Auth
  login: (username: string, password: string) =>
    request<LoginResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  me: () => request<User>('/api/auth/me'),

  // Logs
  logs: (params: Record<string, string | number | undefined> = {}) =>
    request<Page<OperationLog>>(`/api/logs?${qs({ page: 1, pageSize: 20, ...params })}`),
  entityLogs: (entityType: string, entityId: string) =>
    request<OperationLog[]>(`/api/logs/${entityType}/${entityId}`),

  // Customers
  customers: (params: Record<string, string | number | undefined>) => request<Page<Customer>>(`/api/customers?${qs(params)}`),
  customer: (id: string) => request<Customer>(`/api/customers/${id}`),
  saveCustomer: (data: Partial<Customer>, id?: string) => request<Customer>(id ? `/api/customers/${id}` : '/api/customers', { method: id ? 'PUT' : 'POST', body: JSON.stringify(data) }),
  deleteCustomer: (id: string) => request<void>(`/api/customers/${id}`, { method: 'DELETE' }),

  // Demands
  demands: (customerId: string, page = 1) => request<Page<Demand>>(`/api/customers/${customerId}/demands?page=${page}&pageSize=5`),
  demand: (id: string) => request<Demand>(`/api/demands/${id}`),
  createDemand: (customerId: string, data: Partial<Demand>) => request<Demand>(`/api/customers/${customerId}/demands`, { method: 'POST', body: JSON.stringify(data) }),
  updateDemand: (id: string, data: Partial<Demand>) => request<Demand>(`/api/demands/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDemand: (id: string) => request<void>(`/api/demands/${id}`, { method: 'DELETE' }),
  createTemplateFromDemand: (id: string) => request<Template>(`/api/demands/${id}/template`, { method: 'POST' }),

  // Templates
  templates: (params: Record<string, string | number | undefined> = {}) => request<Page<Template>>(`/api/templates?${qs({ page: 1, pageSize: 5, ...params })}`),
  template: (id: string) => request<Template>(`/api/templates/${id}`),
  createTemplate: (data: Record<string, unknown>) => request<Template>('/api/templates', { method: 'POST', body: JSON.stringify(data) }),
  updateTemplate: (id: string, data: Record<string, unknown>) => request<Template>(`/api/templates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTemplate: (id: string) => request<void>(`/api/templates/${id}`, { method: 'DELETE' }),
  duplicateTemplate: (id: string) => request<Template>(`/api/templates/${id}/duplicate`, { method: 'POST' }),
  updateTemplateStatus: (id: string, status: string) => request<Template>(`/api/templates/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  // Suppliers
  suppliers: (params: Record<string, string | number | undefined> = {}) => request<Page<Supplier>>(`/api/suppliers?${qs({ page: 1, pageSize: 5, ...params })}`),
  createSupplier: (data: Partial<Supplier>) => request<Supplier>('/api/suppliers', { method: 'POST', body: JSON.stringify(data) }),
  updateSupplier: (id: string, data: Partial<Supplier>) => request<Supplier>(`/api/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSupplier: (id: string) => request<void>(`/api/suppliers/${id}`, { method: 'DELETE' }),

  // Orders
  orders: (type: 'sample' | 'formal', params: Record<string, string | number | undefined>) => request<Page<Order>>(`/api/${type === 'sample' ? 'sample-orders' : 'formal-orders'}?${qs(params)}`),
  order: (type: 'sample' | 'formal', id: string) => request<Order>(`/api/${type === 'sample' ? 'sample-orders' : 'formal-orders'}/${id}`),
  createOrder: (type: 'sample' | 'formal', data: Record<string, unknown>) => request<Order>(`/api/${type === 'sample' ? 'sample-orders' : 'formal-orders'}`, { method: 'POST', body: JSON.stringify(data) }),
  updateOrder: (type: 'sample' | 'formal', id: string, data: Record<string, unknown>) => request<Order>(`/api/${type === 'sample' ? 'sample-orders' : 'formal-orders'}/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  orderAction: (type: 'sample' | 'formal', id: string, action: 'submit' | 'advance' | 'suspend' | 'resume', body?: unknown) => request<Order>(`/api/${type === 'sample' ? 'sample-orders' : 'formal-orders'}/${id}/${action}`, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  deleteOrder: (type: 'sample' | 'formal', id: string) => request<void>(`/api/${type === 'sample' ? 'sample-orders' : 'formal-orders'}/${id}`, { method: 'DELETE' }),
}
