/* Rehber tercihleri (D3) — /api/preferences/.

   İki tür ayarı bir arada taşır:
   - **Yeni program varsayılanları** (gün sayısı, saatli/saatsiz): Ders Programı'nda
     program açılırken ön dolgu olarak kullanılır.
   - **Panel bölümleri**: Panel'deki her bloğun görünüp görünmeyeceği. Uygulamada
     e-posta/push teslimat altyapısı yok; "bildirim tercihi" burada Panel'in zaten
     hesapladığı bölümleri süzmek demek (api-reference §5.9).

   Değer **modül düzeyinde önbelleklenir**: Panel ve Ders Programı aynı ayarı
   birbirinden habersiz okuyor, her açılışta ayrı istek atmasınlar diye.
   `updatePreferences` önbelleği kendi yanıtıyla tazeler; çıkışta
   `clearPreferencesCache` ile boşaltılır. */
import api from './client';

/** Sunucu erişilemezse kullanılan varsayılanlar — backend'deki model
 *  varsayılanlarının birebir aynısı; Panel'in eski davranışını korur. */
export const DEFAULT_PREFERENCES = {
  default_day_count: 7,
  default_schedule_type: 'timed',
  // Panel'in sekiz bölümü — sıra Panel'deki yerleşim sırası.
  show_kpis: true,
  show_net_chart: true,
  show_upcoming: true,
  show_missing_program: true,
  show_net_change: true,
  show_compliance: true,
  show_topic_tracking: true,
  show_comparison: true,
  net_change_drops_only: false,
};

let cached = null;      // son bilinen değer
let inflight = null;    // aynı anda gelen çağrılar tek isteği paylaşsın

/** Tercihleri döndürür (önbellekten). Sunucu hata verirse varsayılanlara düşer —
 *  tercih okunamadı diye Panel'in boş kalması, süzülmemiş görünmesinden kötüdür. */
export async function getPreferences() {
  if (cached) return cached;
  if (!inflight) {
    inflight = api.get('/preferences/')
      .then(({ data }) => { cached = { ...DEFAULT_PREFERENCES, ...data }; return cached; })
      .catch(() => ({ ...DEFAULT_PREFERENCES }))
      .finally(() => { inflight = null; });
  }
  return inflight;
}

/** PATCH — yalnız değişen alanları gönderir, güncel tercihleri döndürür. */
export async function updatePreferences(fields) {
  const { data } = await api.patch('/preferences/', fields);
  cached = { ...DEFAULT_PREFERENCES, ...data };
  return cached;
}

/** Önbelleği temizler (ör. çıkış yapılınca başka bir rehber girebilir). */
export function clearPreferencesCache() {
  cached = null;
  inflight = null;
}
