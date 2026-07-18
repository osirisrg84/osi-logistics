import axios from 'axios';

const PROD_BACKEND = 'https://osi-logistics-backend.onrender.com';
const BASE_URL = import.meta.env.PROD ? `${PROD_BACKEND}/api` : '/api';

// Separate axios instance for the driver portal.
// Reads osi_driver_token so the driver session is fully independent
// from any concurrent dispatcher/admin session (which uses osi_token).
const api = axios.create({ baseURL: BASE_URL, timeout: 35000 });

api.interceptors.request.use(config => {
  const token = localStorage.getItem('osi_driver_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('osi_driver_token');
      localStorage.removeItem('osi_driver_user');
      window.location.href = '/driver/login';
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login:  (email: string, password: string) => api.post('/auth/login', { email, password }),
  me:     () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
};

export const ordersApi = {
  getAll:       (params?: Record<string, unknown>) => api.get('/orders', { params }),
  accept:       (id: string) => api.post(`/orders/${id}/accept`),
  ignore:       (id: string) => api.post(`/orders/${id}/ignore`),
  updateStatus: (id: string, data: { status: string; notes?: string; lat?: number; lng?: number }) =>
    api.post(`/orders/${id}/status`, data),
};

export const driversApi = {
  update:         (id: string, data: unknown) => api.put(`/drivers/${id}`, data),
  updateLocation: (id: string, data: unknown) => api.post(`/drivers/${id}/location`, data),
  getFavorites:   (id: string) => api.get(`/drivers/${id}/favorites`),
  addFavorite:    (id: string, data: { name: string; address: string; type: string }) =>
    api.post(`/drivers/${id}/favorites`, data),
  deleteFavorite: (driverId: string, favId: string) =>
    api.delete(`/drivers/${driverId}/favorites/${favId}`),
};

export const billingApi = {
  getRecords: (params?: Record<string, unknown>) => api.get('/billing/records', { params }),
};

export const notificationsApi = {
  markRead:         (id: string)         => api.put(`/notifications/${id}/read`),
  getDriverNotifs:  (driverId: string)   => api.get(`/notifications/driver/${driverId}`),
  markDriverAllRead:(driverId: string)   => api.put(`/notifications/driver/${driverId}/read-all`),
};

export const userApi = {
  getProfile:           () => api.get('/auth/profile'),
  updateProfile:        (data: Record<string, unknown>) => api.put('/auth/profile', data),
  sendVerification:     (type: 'email' | 'phone') => api.post('/auth/send-verification', { type }),
  verifyCode:           (type: 'email' | 'phone', code: string) =>
    api.post('/auth/verify-code', { type, code }),
  confirmPhoneVerified: (firebaseToken: string) =>
    api.post('/auth/confirm-phone-verified', { firebaseToken }),
};

export default api;
