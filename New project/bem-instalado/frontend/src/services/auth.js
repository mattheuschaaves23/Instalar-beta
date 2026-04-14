import api from './api';

export async function loginRequest(payload) {
  const response = await api.post('/auth/login', payload);
  return response.data;
}

export async function registerRequest(payload) {
  const response = await api.post('/auth/register', payload);
  return response.data;
}

export async function getProfileRequest() {
  const response = await api.get('/users/profile');
  return response.data;
}

export async function setup2FARequest() {
  const response = await api.get('/auth/2fa/setup');
  return response.data;
}

export async function enable2FARequest(payload) {
  const response = await api.post('/auth/2fa/enable', payload);
  return response.data;
}

export async function disable2FARequest() {
  const response = await api.post('/auth/2fa/disable');
  return response.data;
}
