/* Rehber tercihleri (D3) — /api/preferences/.

   İki tür ayarı bir arada taşır:
   - **Yeni program varsayılanları** (gün sayısı, saatli/saatsiz, tahta düzeni):
     Ders Programı'nda program açılırken ön dolgu olarak kullanılır.
   - **Panel bölümleri**: Panel'deki her bloğun görünüp görünmeyeceği. Uygulamada
     e-posta/push teslimat altyapısı yok; "bildirim tercihi" burada Panel'in zaten
     hesapladığı bölümleri süzmek demek (api-reference §5.9).

   Değer **modül düzeyinde önbelleklenir**: Panel ve Ders Programı aynı ayarı
   birbirinden habersiz okuyor, her açılışta ayrı istek atmasınlar diye.
   `updatePreferences` önbelleği kendi yanıtıyla tazeler; çıkışta
   `clearPreferencesCache` ile boşaltılır. */
import api from './client';

/* Tahta düzeni iki adla anılıyor: backend SATIRLARA bakıp `hours`/`subjects`
   diyor, ekran SÜTUNLARA bakıp `days`/`subjects`. İkisi aynı iki düzen — saat
   satırlı tahtanın sütunları zaten gündür.

   Çeviri burada, uçla ekran arasında duruyor (30 Eki 2026). Yoksa ayar iki
   yönden birden kırılıyordu: ekran "Gün sütunlu"yu seçince uç
   `{"default_board_layout": ["\"days\" geçerli bir seçim değil."]}` ile `400`
   veriyor, geri dönen `hours` da hiçbir `<option>` değerine uymadığı için
   seçim boş görünüyordu. */
const DUZEN_SUNUCUDAN = { hours: 'days', subjects: 'subjects' };
const DUZEN_SUNUCUYA = { days: 'hours', subjects: 'subjects' };

function ekranaCevir(data = {}) {
  const d = data.default_board_layout;
  if (d == null) return data;
  return { ...data, default_board_layout: DUZEN_SUNUCUDAN[d] ?? 'days' };
}

function sunucuyaCevir(fields = {}) {
  const d = fields.default_board_layout;
  if (d == null) return fields;
  return { ...fields, default_board_layout: DUZEN_SUNUCUYA[d] ?? 'hours' };
}

/** Sunucu erişilemezse kullanılan varsayılanlar — backend'deki model
 *  varsayılanlarının karşılığı; Panel'in eski davranışını korur.
 *  Tahta düzeni burada EKRAN adıyla duruyor (`days` = backend'in `hours`'u). */
export const DEFAULT_PREFERENCES = {
  default_day_count: 7,
  default_schedule_type: 'timed',
  default_board_layout: 'days',    // gün sütunlu mu ders satırlı mı (uçta 'hours')
  // Planlayıcı (20 Eyl 2026)
  board_start_hour: 7,             // saatli tahtanın ilk satırı
  board_end_hour: 23,              // son satırın bitişi (7–23 → 07:00–23:00)
  default_block_minutes: 60,       // yeni bloğun süresi; süre hafızası varsa o kazanır
  routine_prefill: true,           // öğrencinin rutini Yeni Plan'ı doldursun
  notify_student_on_assign: false, // atamada öğrenciye e-posta
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
      .then(({ data }) => {
        cached = { ...DEFAULT_PREFERENCES, ...ekranaCevir(data) };
        return cached;
      })
      .catch(() => ({ ...DEFAULT_PREFERENCES }))
      .finally(() => { inflight = null; });
  }
  return inflight;
}

/** PATCH — yalnız değişen alanları gönderir, güncel tercihleri döndürür. */
export async function updatePreferences(fields) {
  const { data } = await api.patch('/preferences/', sunucuyaCevir(fields));
  cached = { ...DEFAULT_PREFERENCES, ...ekranaCevir(data) };
  return cached;
}

/** Önbelleği temizler (ör. çıkış yapılınca başka bir rehber girebilir). */
export function clearPreferencesCache() {
  cached = null;
  inflight = null;
}
