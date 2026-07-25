import api from './client';

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
