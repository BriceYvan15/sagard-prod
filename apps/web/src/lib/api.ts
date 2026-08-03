import axios from 'axios'

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api',
  timeout: 30000,
})

api.interceptors.request.use(config => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('sagard_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  res => res.data,
  err => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('sagard_token')
      window.location.href = '/login'
    }
    return Promise.reject(err.response?.data ?? err)
  },
)

export const authApi = {
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  me: () => api.get('/auth/me'),
}

export const clientsApi = {
  list:   (params?: any) => api.get('/clients', { params }),
  get:    (id: string)   => api.get(`/clients/${id}`),
  create: (data: any)    => api.post('/clients', data),
  update: (id: string, data: any) => api.patch(`/clients/${id}`, data),
}

export const contractsApi = {
  list:   (params?: any) => api.get('/contracts', { params }),
  get:    (id: string)   => api.get(`/contracts/${id}`),
  create: (data: any)    => api.post('/contracts', data),
}

export const invoicesApi = {
  list:   (params?: any) => api.get('/invoices', { params }),
  get:    (id: string)   => api.get(`/invoices/${id}`),
  create: (data: any)    => api.post('/invoices', data),
}

export const agentsApi = {
  list:   (params?: any) => api.get('/agents', { params }),
  get:    (id: string)   => api.get(`/agents/${id}`),
  create: (data: any)    => api.post('/agents', data),
}

export const pointagesApi = {
  today:  (params?: any) => api.get('/pointages/today', { params }),
  report: (date: string) => api.get(`/pointages/report/${date}`),
}

export const sitesApi = {
  list: (params?: any) => api.get('/sites', { params }),
  get:  (id: string)   => api.get(`/sites/${id}`),
}

export const notificationsApi = {
  list:       () => api.get('/notifications'),
  unread:     () => api.get('/notifications/unread-count'),
  markRead:   (id: string) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
}

export const patrolsApi = {
  list:   (params?: any) => api.get('/patrols', { params }),
  get:    (id: string)   => api.get(`/patrols/${id}`),
}
