import axios from 'axios';
import { API_BASE_URL } from './client';

/** Herkese açık hesap silme sayfasının (`/hesap-silme`) uçları.
 *
 *  **Neden ortak `api` istemcisi kullanılmıyor** — iki ayrı sebep, ikisi de
 *  bu sayfaya özgü:
 *
 *  1. `client.js` her isteğe localStorage'daki token'ı ekliyor ve 401 alınca
 *     `forceLogout()` ile `/giris`e **yönlendiriyor**. Bu sayfada oturum yok;
 *     araya giren bir 401 kullanıcıyı silme akışının ortasında dışarı atardı.
 *  2. Sayfa, aynı tarayıcıda açık olabilecek rehber oturumuna dokunmamalı.
 *     Buradaki token yalnız bileşenin state'inde yaşıyor, localStorage'a hiç
 *     yazılmıyor: öğrenci ya da veli hesabıyla giren biri panele girmiş
 *     olmuyor, girişli bir rehberin oturumu da bozulmuyor.
 *
 *  Uçlar üçü de mevcut: sözleşme `docs/api-reference.md` §2 ve §5.4d.
 */
const client = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

const bearer = (access) => ({ headers: { Authorization: `Bearer ${access}` } });

/** `POST /auth/login/` — kimliği doğrular, token'ı **döndürür** (saklamaz).
 *
 *  Silme ucu kimlik doğrulanmış istek istiyor; hesabını silmek isteyen kişinin
 *  elinde de yalnız kullanıcı adı ve şifresi var. Bu yüzden akış girişle
 *  başlıyor. Rol fark etmez: rehber, öğrenci ve veli aynı uçtan giriyor.
 */
export async function verifyCredentials(username, password) {
  const { data } = await client.post('/auth/login/', {
    username: username.trim(),
    password,
  });
  return { access: data.access, user: data.user };
}

/** `GET /auth/delete-account/` — silinirse neyin gideceğinin özeti.
 *  Alanlar role göre değişir; yorumlaması `HesapSilme.jsx` içinde. */
export async function fetchDeleteImpact(access) {
  const { data } = await client.get('/auth/delete-account/', bearer(access));
  return data;
}

/** `POST /auth/delete-account/` — hesabı kalıcı olarak siler.
 *
 *  Şifre sunucuda bir kez daha doğrulanıyor. Girişte kullanılan şifrenin
 *  aynısını yolluyoruz: kullanıcıya iki kez yazdırmak güvenlik eklemiyor,
 *  çünkü token zaten o şifreyle alındı. */
export async function deleteAccount(access, password) {
  const { data } = await client.post(
    '/auth/delete-account/',
    { password },
    bearer(access),
  );
  return data;
}
