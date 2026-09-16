import api from './client';

/** Hukuki metinler ve KVKK onayları (auth-contract §5.5). */

/** GET /api/legal/documents/ — yürürlükteki metinler.
 *  **Kimlik istemez**: kayıt ekranı metni oturum açmadan gösteriyor.
 *  `withBody=false` gövdeleri atlar; yalnız sürüm karşılaştırması yapılacaksa
 *  her metnin Markdown'ını indirmenin anlamı yok. */
export async function listLegalDocuments(withBody = true) {
  const { data } = await api.get('/legal/documents/', {
    params: withBody ? undefined : { body: '0' },
  });
  return data;
}

/** GET /api/legal/documents/?kind=… — tek metin (gövdesiyle). */
export async function getLegalDocument(kind) {
  const { data } = await api.get('/legal/documents/', { params: { kind } });
  return data;
}

/** GET /api/legal/consents/ — kullanıcının onay geçmişi + eksikleri.
 *  `{ consents: [...], pending: [...] }` döner. Geçmiş, eski sürüm ve geri
 *  alınmış onayları da içerir: "ne zaman neyi onayladım" ilgili kişinin hakkı. */
export async function listConsents() {
  const { data } = await api.get('/legal/consents/');
  return data;
}

/** POST /api/legal/consents/ — onay verir.
 *  **Sürüm gönderilmez**; sunucu yürürlükteki sürümü yazar. */
export async function acceptConsent(kind) {
  const { data } = await api.post('/legal/consents/', { kind });
  return data;
}

/** POST /api/legal/consents/withdraw/ — açık rızayı geri alır (KVKK md. 7).
 *  Aydınlatma metni geri alınamaz; sunucu 400 döner.
 *  Geri alma hesabı KAPATMAZ — silme ayrı bir eylemdir. */
export async function withdrawConsent(kind = 'acik_riza') {
  const { data } = await api.post('/legal/consents/withdraw/', { kind });
  return data;
}

/** GET /api/auth/export-data/ — kullanıcının kendi verisini indirir (KVKK md. 11).
 *
 *  `?inline=1` ile çekiliyor: dosya `Authorization` başlığı gerektirdiği için
 *  düz bir link kullanılamıyor (takvim `.ics` indirmesindeki durum). Gövdeyi
 *  axios alıyor — böylece 401'de token yenileme araya girebiliyor — dosya
 *  burada üretiliyor.
 *
 *  Dönen: indirilen dosyanın adı (çağıran kullanıcıya gösterebilsin). */
export async function downloadMyData(username = 'verilerim') {
  const { data } = await api.get('/auth/export-data/', { params: { inline: '1' } });
  const gun = new Date().toISOString().slice(0, 10);
  const filename = `rehberim-verilerim-${username}-${gun}.json`;
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Nesne URL'i hemen bırakılırsa indirme bazı tarayıcılarda yarıda kalıyor.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return filename;
}
