import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const api = axios.create({
  baseURL: API_URL,
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth APIs
export const authAPI = {
  signup: (data) => api.post('/api/auth/signup', data),
  login: (data) => api.post('/api/auth/login', data),
  firebaseLogin: (idToken, name) => api.post('/api/auth/firebase-login', { id_token: idToken, name }),
  resetPassword: (data) => api.post('/api/auth/reset-password', data),
  deleteAccount: () => api.delete('/api/auth/account'),
  getMe: () => api.get('/api/auth/me'),
  updateProfile: (data) => api.put('/api/auth/profile', data),
};

// Upload & Generate APIs
export const codeAPI = {
  upload: (formData) => api.post('/api/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  generate: (data) => api.post('/api/generate', data),
  chat: (data) => api.post('/api/chat', data),
};

// Project APIs
export const projectAPI = {
  create: (data) => api.post('/api/projects', data),
  getAll: () => api.get('/api/projects'),
  getOne: (id) => api.get(`/api/projects/${id}`),
  update: (id, data) => api.put(`/api/projects/${id}`, data),
  delete: (id) => api.delete(`/api/projects/${id}`),
};

// Admin APIs
export const adminAPI = {
  getStats: () => api.get('/api/admin/stats'),
  getUsers: (params) => api.get('/api/admin/users', { params }),
  getUserDetails: (userId) => api.get(`/api/admin/users/${userId}/stats`),
  deleteUser: (userId) => api.delete(`/api/admin/users/${userId}`),
  reactivateUser: (userId) => api.post(`/api/admin/users/${userId}/reactivate`),
  getAdminProjects: (params) => api.get('/api/admin/projects', { params }),
  getAdminProjectDetails: (projectId) => api.get(`/api/admin/projects/${projectId}`),
  deleteAdminProject: (projectId) => api.delete(`/api/admin/projects/${projectId}`),
};


export default api;