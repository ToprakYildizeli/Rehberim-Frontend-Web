import publicApi, { bearer } from './publicClient';

/** Herkese açık hesap silme sayfasının (`/hesap-silme`) uçları.
 *
 *  İstekler `publicClient` üzerinden gidiyor: ortak `api` istemcisinin token
 *  ekleyen ve 401'de `/giris`e yönlendiren interceptor'ları bu sayfada zararlı
 *  olurdu (gerekçe o dosyada). Buradaki token yalnız bileşenin state'inde
 *  yaşıyor, localStorage'a hiç yazılmıyor — öğrenci ya da veli hesabıyla
 *  giren biri rehber paneline girmiş olmuyor.
 *
 *  Uçlar: sözleşme `docs/api-reference.md` §2 ve §5.4d.
 */

/** `POST /auth/login/` — kimliği doğrular, token'ı **döndürür** (saklamaz).
 *
 *  Silme ucu kimlik doğrulanmış istek istiyor; hesabını silmek isteyen kişinin
 *  elinde de yalnız kullanıcı adı ve şifresi var. Bu yüzden akış girişle
 *  başlıyor. Rol fark etmez: rehber, öğrenci ve veli aynı uçtan giriyor.
 */
export async function verifyCredentials(username, password) {
  const { data } = await publicApi.post('/auth/login/', {
    username: username.trim(),
    password,
  });
  return { access: data.access, user: data.user };
}

/** `GET /auth/delete-account/` — silinirse neyin gideceğinin özeti.
 *  Alanlar role göre değişir; yorumlaması `HesapSilme.jsx` içinde. */
export async function fetchDeleteImpact(access) {
  const { data } = await publicApi.get('/auth/delete-account/', bearer(access));
  return data;
}

/** `POST /auth/delete-account/` — hesabı kalıcı olarak siler.
 *
 *  Şifre sunucuda bir kez daha doğrulanıyor. Girişte kullanılan şifrenin
 *  aynısını yolluyoruz: kullanıcıya iki kez yazdırmak güvenlik eklemiyor,
 *  çünkü token zaten o şifreyle alındı. */
export async function deleteAccount(access, password) {
  const { data } = await publicApi.post(
    '/auth/delete-account/',
    { password },
    bearer(access),
  );
  return data;
}
