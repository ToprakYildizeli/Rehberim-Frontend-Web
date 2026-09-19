/* Ayarlar → Bildir — /api/feedback/ (auth-contract §5.11).

   Kullanıcının uygulama hakkındaki bildirimi. Sunucu kaydı veritabanına
   yazıp ekip adresine mail atıyor; **alıcı adres istemcide yok** ve
   gösterilmemeli (sunucuda `FEEDBACK_EMAIL`). */
import api from './client';

/** Sebep seçenekleri — backend `Feedback.Category` ile birebir. */
export const FEEDBACK_CATEGORIES = [
  { value: 'hata', label: 'Bir şey çalışmıyor' },
  { value: 'oneri', label: 'Yeni özellik önerisi' },
  { value: 'tasarim', label: 'Görünüm ve kullanım' },
  { value: 'veri', label: 'Eksik veya yanlış veri' },
  { value: 'diger', label: 'Diğer' },
];

export const FEEDBACK_MIN = 10;
export const FEEDBACK_MAX = 2000;

export async function sendFeedback({ category, message }) {
  const { data } = await api.post('/feedback/', { category, message });
  return data;
}
