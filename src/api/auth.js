import axios from 'axios';

const api = axios.create({
  baseURL: 'http://127.0.0.1:8000/api',
  headers: { 'Content-Type': 'application/json' },
});

export function login(username, password) {
  return api.post('/auth/login/', { username, password });
}

export function registerCounselor(data) {
  return api.post('/auth/register/counselor/', data);
}

export function refreshToken(refresh) {
  return api.post('/auth/refresh/', { refresh });
}

export function logout(refresh, accessToken) {
  return api.post(
    '/auth/logout/',
    { refresh },
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
}

export function getMe(accessToken) {
  return api.get('/auth/me/', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}
