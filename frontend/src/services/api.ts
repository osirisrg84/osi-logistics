import axios from 'axios';

// Development: Vite proxy forwards /api → localhost:3001
// Production:  direct request to Render backend
const PROD_BACKEND = 'https://osi-logistics-backend.onrender.com';
const BASE_URL = import.meta.env.PROD ? `${PROD_BACKEND}/api` : '/api';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 35000,
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('osi_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401 && !window.location.pathname.includes('/login') &&
        !window.location.pathname.includes('/admin') &&
        !window.location.pathname.includes('/dispatcher') &&
        !window.location.pathname.includes('/driver')) {
      localStorage.removeItem('osi_token');
      localStorage.removeItem('osi_user');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  register: (data: unknown) => api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
  getDriversList: () => api.get('/auth/drivers-list'),
};

export const ordersApi = {
  getAll: (params?: Record<string, unknown>) => api.get('/orders', { params }),
  getById: (id: string) => api.get(`/orders/${id}`),
  getStats: () => api.get('/orders/stats'),
  create: (data: unknown) => api.post('/orders', data),
  update: (id: string, data: unknown) => api.put(`/orders/${id}`, data),
  assign: (id: string, data: { driver_id: string; truck_id: string }) => api.post(`/orders/${id}/assign`, data),
  updateStatus: (id: string, data: { status: string; notes?: string; lat?: number; lng?: number }) =>
    api.post(`/orders/${id}/status`, data),
  delete: (id: string) => api.delete(`/orders/${id}`),
};

export const driversApi = {
  getAll: (params?: Record<string, unknown>) => api.get('/drivers', { params }),
  getById: (id: string) => api.get(`/drivers/${id}`),
  getStats: () => api.get('/drivers/stats'),
  create: (data: unknown) => api.post('/drivers', data),
  update: (id: string, data: unknown) => api.put(`/drivers/${id}`, data),
  updateLocation: (id: string, data: unknown) => api.post(`/drivers/${id}/location`, data),
  delete: (id: string) => api.delete(`/drivers/${id}`),
  getFavorites: (id: string) => api.get(`/drivers/${id}/favorites`),
  addFavorite: (id: string, data: { name: string; address: string; type: string }) => api.post(`/drivers/${id}/favorites`, data),
  deleteFavorite: (driverId: string, favId: string) => api.delete(`/drivers/${driverId}/favorites/${favId}`),
};

export const trucksApi = {
  getAll: (params?: Record<string, unknown>) => api.get('/trucks', { params }),
  getById: (id: string) => api.get(`/trucks/${id}`),
  getStats: () => api.get('/trucks/stats'),
  create: (data: unknown) => api.post('/trucks', data),
  update: (id: string, data: unknown) => api.put(`/trucks/${id}`, data),
  delete: (id: string) => api.delete(`/trucks/${id}`),
};

export const trackingApi = {
  getLive: () => api.get('/tracking/live'),
  getDriverHistory: (id: string, hours?: number) => api.get(`/tracking/driver/${id}/history`, { params: { hours } }),
  getOrderTracking: (id: string) => api.get(`/tracking/order/${id}`),
};

export const analyticsApi = {
  getDashboard: () => api.get('/analytics/dashboard'),
  getOrdersReport: (params?: Record<string, unknown>) => api.get('/analytics/reports/orders', { params }),
  getDriversReport: () => api.get('/analytics/reports/drivers'),
  getFleetReport: () => api.get('/analytics/reports/fleet'),
};

export const billingApi = {
  getSummary:        ()              => api.get('/billing/summary'),
  getRecords:        (params?: Record<string, unknown>) => api.get('/billing/records', { params }),
  getByDriver:       ()              => api.get('/billing/by-driver'),
  getByDispatcher:   ()              => api.get('/billing/by-dispatcher'),
  settleOne:         (id: string)    => api.put(`/billing/${id}/settle`),
  settleDriverAll:   (driverId: string) => api.put(`/billing/driver/${driverId}/settle-all`),
};

export const userApi = {
  getProfile:    () => api.get('/auth/profile'),
  updateProfile: (data: { payout_method: string; payout_details: string }) => api.put('/auth/profile', data),
};

export const notificationsApi = {
  getAll: () => api.get('/notifications'),
  markRead: (id: string) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
  delete: (id: string) => api.delete(`/notifications/${id}`),
  deleteRead: () => api.delete('/notifications'),
};

export default api;
