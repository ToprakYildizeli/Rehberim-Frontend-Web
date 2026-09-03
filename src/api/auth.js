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

/** GET /api/auth/delete-account/ — hesap silinirse neyin gideceğinin özeti.
 *  Alanlar role göre değişir (auth-contract §5.4d). */
export async function getDeleteImpact() {
  const { data } = await api.get('/auth/delete-account/');
  return data;
}

/** POST /api/auth/delete-account/ — hesabı kalıcı olarak siler.
 *  Şifre zorunlu. Başarılıysa çağıran oturumu **kendisi temizlemeli**: JWT
 *  durumsuz olduğu için elindeki access token biçimsel olarak hâlâ duruyor. */
export async function deleteAccount(password) {
  const { data } = await api.post('/auth/delete-account/', { password });
  return data;
}

/** POST /api/auth/me/avatar/ — profil fotoğrafı yükler, güncel kullanıcıyı döner.
 *  JPG/PNG/WEBP/GIF, en fazla 2 MB (auth-contract §5.4e). */
export async function uploadAvatar(file) {
  const body = new FormData();
  body.append('file', file);
  const { data } = await api.post('/auth/me/avatar/', body, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

/** DELETE /api/auth/me/avatar/ — fotoğrafı kaldırır (fotoğraf yoksa da başarılı). */
export async function removeAvatar() {
  const { data } = await api.delete('/auth/me/avatar/');
  return data;
}
