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

/** PATCH /api/auth/me/ — ad/soyad (rehberse kurum) günceller, güncel kullanıcı
 *  objesini döner. Kısmi: yalnızca gönderilen alanlar değişir (auth-contract §5.4b).
 *  **E-posta buradan değişmez** (v2.1) — gönderilirse sunucu sessizce yok sayar. */
export async function updateMe(fields) {
  const { data } = await api.patch('/auth/me/', fields);
  return data;
}

/** POST /api/auth/change-password/ — mevcut + yeni şifre.
 *  Yanıt taze bir token çifti içerir; çağıran bunları saklamalı, yoksa kullanıcı
 *  bir sonraki istekte değil ama refresh sırasında düşer. */
export async function changePassword(currentPassword, newPassword) {
  const { data } = await api.post('/auth/change-password/', {
    current_password: currentPassword,
    new_password: newPassword,
  });
  return data;
}
