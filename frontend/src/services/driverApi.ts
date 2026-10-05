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

export { api as driverAxios };

export const authApi = {
  login:          (email: string, password: string) => api.post('/auth/login', { email, password }),
  me:             () => api.get('/auth/me'),
  logout:         () => api.post('/auth/logout'),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  resetPassword:  (email: string, code: string, new_password: string) =>
    api.post('/auth/reset-password', { email, code, new_password }),
};

export const ordersApi = {
  getAll:       (params?: Record<string, unknown>) => api.get('/orders', { params }),
  accept:       (id: string) => api.post(`/orders/${id}/accept`),
  ignore:       (id: string) => api.post(`/orders/${id}/ignore`),
  updateStatus: (id: string, data: { status: string; notes?: string; lat?: number; lng?: number }) =>
    api.post(`/orders/${id}/status`, data),
  getDocuments:    (id: string) => api.get(`/orders/${id}/documents`),
  uploadDocument:  (id: string, data: { type: string; filename: string; data: string }) =>
    api.post(`/orders/${id}/documents`, data),
  deleteDocument:  (id: string, docId: string) => api.delete(`/orders/${id}/documents/${docId}`),
  getRateCon:      (id: string) => api.get(`/orders/${id}/rate-con`),
  uploadRateCon:   (id: string, data: { filename: string; data: string }) => api.post(`/orders/${id}/rate-con`, data),
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
  settleAll:  (driverId: string) => api.put(`/billing/driver/${driverId}/settle-all`),
};

export const analyticsApi = {
  getLeaderboard: () => api.get('/analytics/leaderboard'),
};

export const communityApi = {
  getPosts: () => api.get('/community'),
  createPost: (message: string) => api.post('/community', { message }),
  toggleLike: (id: string) => api.post(`/community/${id}/like`),
};

export const incidentsApi = {
  create: (data: { category: string; description: string; order_number?: string }) => api.post('/incidents', data),
};

export const assistantApi = {
  chat: (message: string, history?: Array<{ role: 'user' | 'assistant'; content: string }>) =>
    api.post('/assistant/chat', { message, history }),
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
