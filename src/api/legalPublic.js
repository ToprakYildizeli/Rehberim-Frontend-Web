import publicApi from './publicClient';

/** `GET /legal/documents/` — yürürlükteki hukuki metinler, gövdeleriyle.
 *
 *  `api/legal.js` içindeki `listLegalDocuments` ile aynı ucu çağırıyor; fark
 *  istemcide. Oradaki ortak `api` oturum açmış rehber için doğru, **herkese
 *  açık sayfa için değil**: bayat bir token'la gelen ziyaretçiyi `/giris`e
 *  yönlendirirdi (bkz. `publicClient.js`).
 *
 *  Dönen: `[{ kind, label, version, body }, …]`
 */
export async function fetchPublicLegalDocuments() {
  const { data } = await publicApi.get('/legal/documents/');
  return Array.isArray(data) ? data : [];
}
