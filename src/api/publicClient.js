import axios from 'axios';
import { API_BASE_URL } from './client';

/** Herkese açık sayfaların (`/gizlilik`, `/hesap-silme`) kullandığı ham
 *  istemci — `client.js`'teki interceptor'lardan **bilerek** muaf.
 *
 *  İki sebep, ikisi de bu sayfalara özgü:
 *
 *  1. `client.js` her isteğe localStorage'daki token'ı ekliyor. Tarayıcıda
 *     bayat bir token duruyorsa, kimlik istemeyen bir uca bile gönderilir ve
 *     `JWTAuthentication` başlığı geçersiz bulup **401 fırlatır** —
 *     `permission_classes = [AllowAny]` olmasına rağmen. O 401 de
 *     `forceLogout()` ile ziyaretçiyi `/giris`e atardı: mağaza incelemecisine
 *     verdiğimiz adres, kullanıcıyı giriş ekranına götüren bir adres olurdu.
 *  2. Bu sayfalar tarayıcıda açık olan rehber oturumuna dokunmamalı.
 *
 *  Buradan giden isteklere Authorization **elle** eklenir; kendiliğinden
 *  hiçbir token eklenmez ve hiçbir yanıt oturumu değiştirmez.
 */
const publicApi = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

/** Elle Authorization başlığı — token'ı çağıran taşır, depoda tutulmaz. */
export const bearer = (access) => ({
  headers: { Authorization: `Bearer ${access}` },
});

export default publicApi;
