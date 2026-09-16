import api from './client';

/** Veli onayı kayıtları (KVKK, auth-contract §5.5).
 *
 *  Onay **kâğıt formla** alınır ve rehber varlığını sisteme işler; bu yüzden
 *  uçlar yalnız rehbere açıktır. Form sürümü ve işleyen rehber sunucuda
 *  atanır, gövdede gönderilmez. */

/** GET /api/parental-consents/ — rehberin kendi öğrencilerinin onay kayıtları. */
export async function listParentalConsents(studentId) {
  const { data } = await api.get('/parental-consents/', {
    params: studentId ? { student: studentId } : undefined,
  });
  return data;
}

/** POST /api/parental-consents/ — yeni kayıt.
 *  Öğrenci başına tek satır; ikinci POST 400 döner ve mesaj PATCH'e yönlendirir. */
export async function createParentalConsent(fields) {
  const { data } = await api.post('/parental-consents/', fields);
  return data;
}

/** PATCH /api/parental-consents/{id}/ — kaydı güncelle.
 *  `{ revoked: true }` onayı geri alır, `false` geri almayı iptal eder.
 *  **Silme yok**: kaydı silmek kanıtı silmek olurdu (sunucu DELETE'e 405 döner). */
export async function updateParentalConsent(id, fields) {
  const { data } = await api.patch(`/parental-consents/${id}/`, fields);
  return data;
}
