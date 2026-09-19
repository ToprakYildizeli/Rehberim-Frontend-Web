import { useEffect, useRef, useState } from 'react';
import { Card, CardHeader, Field, NumberInput, Select, Spinner } from '../ui';
import { getPreferences, updatePreferences } from '../../api/preferences';
import Toggle from './Toggle';
import s from './settings.module.css';

/**
 * Rehberin tercihleri (D3): yeni program varsayılanları + Panel uyarı süzgeçleri.
 *
 * **Kaydet düğmesi yok, her değişiklik anında yazılır.** Ayarların tamamı tek
 * değerlik anahtar/sayı; bir formu doldurup onaylamak yerine dokunulan alan
 * hemen kaydediliyor, kullanıcı "kaydettim mi?" diye düşünmesin diye. Hata
 * olursa değer eski hâline döner ve mesaj gösterilir.
 *
 * Panel süzgeçleri **bildirim göndermez** — uygulamada e-posta/push teslimat
 * altyapısı yok. Buradaki anahtarlar Panel'in zaten hesapladığı uyarı
 * kartlarını gösterip gizler.
 */

/* ⚠️ "Program tipi" (saatli/saatsiz) seçeneği arayüzden **kaldırıldı**
 * (9 Eylül 2026). Tercih sunucuda kaydediliyor ve yeni program açılırken
 * `schedule_type` olarak gönderiliyordu, ama **tahta bu alanı hiç okumuyor**:
 * `untimed` kelimesi tüm arayüzde yalnız burada geçiyordu. Yani "Saatsiz"
 * seçmenin hiçbir görünür etkisi yoktu — çalışmayan bir ayarı ekranda tutmak
 * yanıltıcı. Backend alanı ve varsayılanı duruyor; tahtaya saatsiz görünüm
 * yazıldığında bu seçenek geri gelmeli. */

/** Panel'deki **her** bölüm. Sıra, Panel'deki yerleşim sırasıdır — listede
 *  yukarıdan aşağı okumak ekranı yukarıdan aşağı okumakla aynı olsun diye. */
const PANEL_SECTIONS = [
  { key: 'show_kpis', label: 'Özet kutuları' },
  { key: 'show_net_chart', label: 'Öğrenci Net Grafiği' },
  { key: 'show_upcoming', label: 'Yaklaşan Görüşmeler' },
  { key: 'show_missing_program', label: 'Program Gerekenler' },
  { key: 'show_net_change', label: 'Net Değişimi' },
  { key: 'show_compliance', label: 'Program Uyumu' },
  { key: 'show_topic_tracking', label: 'Konu Takibi' },
  { key: 'show_comparison', label: 'Öğrenci Kıyaslama' },
];

/** Bölüm değil **süzgeç**: Net Değişimi kartının içeriğini daraltır, kartı
 *  gizlemez. Ekranda diğerleriyle aynı ızgarada duruyor. */
const hourLabel = (h) => `${String(h).padStart(2, '0')}:00`;

const DROPS_ONLY = {
  key: 'net_change_drops_only',
  label: 'Yalnız net düşüşleri',
};

export default function PreferencesSection() {
  const [prefs, setPrefs] = useState(null);        // null = yükleniyor
  const [error, setError] = useState(null);
  const [savedAt, setSavedAt] = useState(null);
  const timers = useRef({});

  useEffect(() => {
    let alive = true;
    getPreferences().then((p) => { if (alive) setPrefs(p); });
    const pending = timers.current;
    // Bekleyen yazımlar bileşen kapanınca iptal: kaldırılmış state'e set edilmesin.
    return () => { alive = false; Object.values(pending).forEach(clearTimeout); };
  }, []);

  async function write(field, value, previous) {
    try {
      const updated = await updatePreferences({ [field]: value });
      setPrefs(updated);
      setSavedAt(Date.now());
    } catch (err) {
      setPrefs(previous);                          // sunucu reddetti → geri al
      const data = err?.response?.data;
      const first = data && !data.detail
        ? Object.values(data).flat()[0]
        : data?.detail;
      setError(first ?? 'Ayar kaydedilemedi. Lütfen tekrar dene.');
    }
  }

  /** `delay` yalnız sayı alanları için: `NumberInput` her rakamda commit ettiği
   *  için "50" yazmak aksi hâlde iki ayrı PATCH gönderirdi. */
  function save(field, value, delay = 0) {
    const previous = prefs;
    setPrefs((p) => ({ ...p, [field]: value }));    // iyimser: anahtar hemen dönsün
    setError(null);
    clearTimeout(timers.current[field]);
    if (!delay) {
      write(field, value, previous);
      return;
    }
    timers.current[field] = setTimeout(() => write(field, value, previous), delay);
  }

  if (prefs === null) {
    return <Card><div className={s.loading}><Spinner /></div></Card>;
  }

  return (
    <>
      {/* İki kart da tam genişlik: tek başına bir sütunda duran "Program
          varsayılanları" 1440px'de sağını boş bırakıyordu (D2'deki düzen
          geri bildiriminin aynısı). */}
      <Card className={s.wide}>
        <CardHeader title="Program varsayılanları" />
        {/* Alanlar içeriklerine göre dar: gün sayısı iki haneli bir sayı,
            kutunun kart genişliğine yayılması için sebep yok. */}
        {/* Beş alan üç eşit sütunlu bir ızgarada: hepsi aynı genişlik ve yükseklikte
            (20 Eyl 2026 geri bildirimi — içeriğe göre daralan satırda boyutlar
            birbirini tutmuyor, son alan alt satıra düşüyordu). */}
        <div className={s.prefGrid}>
          <Field label="Gün sayısı">
            <NumberInput
              value={prefs.default_day_count}
              min={1}
              max={31}
              onCommit={(v) => save('default_day_count', v, 600)}
            />
          </Field>
          <Field label="Blok süresi (dk)">
            <NumberInput
              value={prefs.default_block_minutes}
              min={5}
              max={720}
              onCommit={(v) => save('default_block_minutes', v, 600)}
            />
          </Field>
          {/* Tahta düzeni eskiden yalnız tarayıcıda tutuluyordu; rehber her
              cihazda yeniden seçmek zorunda kalıyordu (kullanıcı isteği,
              13 Eyl 2026). Artık tercihlerde. */}
          <Field label="Tahta düzeni">
            <Select
              value={prefs.default_board_layout}
              onChange={(e) => save('default_board_layout', e.target.value)}
            >
              <option value="hours">Saat satırlı</option>
              <option value="subjects">Ders satırlı</option>
            </Select>
          </Field>
          {/* Saatli tahtanın aralığı (20 Eyl 2026). Seçenekler birbirini
              kısıtlıyor ki bitiş başlangıçtan önce seçilemesin; sunucu da
              ayrıca reddediyor. */}
          <Field label="Tahta başlangıcı">
            <Select
              value={prefs.board_start_hour}
              onChange={(e) => save('board_start_hour', Number(e.target.value))}
            >
              {Array.from({ length: prefs.board_end_hour }, (_, h) => (
                <option key={h} value={h}>{hourLabel(h)}</option>
              ))}
            </Select>
          </Field>
          <Field label="Tahta bitişi">
            <Select
              value={prefs.board_end_hour}
              onChange={(e) => save('board_end_hour', Number(e.target.value))}
            >
              {Array.from({ length: 24 - prefs.board_start_hour }, (_, i) => {
                const h = prefs.board_start_hour + 1 + i;
                return <option key={h} value={h}>{hourLabel(h)}</option>;
              })}
            </Select>
          </Field>
        </div>
        <ul className={s.prefToggles}>
          <li>
            <Toggle
              checked={prefs.routine_prefill}
              onChange={(v) => save('routine_prefill', v)}
              label="Rutini Yeni Plan'a ekle"
            />
          </li>
          <li>
            <Toggle
              checked={prefs.notify_student_on_assign}
              onChange={(v) => save('notify_student_on_assign', v)}
              label="Atama e-postası"
            />
          </li>
        </ul>
      </Card>

      <Card className={s.wide}>
        <CardHeader title="Panel bölümleri" />
        {/* Sekiz bölüm + net düşüş süzgeci = dokuz anahtar, 3x3 ızgara.
            Süzgeç ayrı bir blokta dururken dokuzuncu bir "bölüm" gibi
            okunuyordu; aynı listede eşit ağırlıkta duruyor. */}
        <ul className={s.toggleList}>
          {[...PANEL_SECTIONS, DROPS_ONLY].map(({ key, label }) => (
            <li key={key}>
              <Toggle
                checked={prefs[key]}
                onChange={(v) => save(key, v)}
                label={label}
              />
            </li>
          ))}
        </ul>
      </Card>

      {error && <p className={s.error}>{error}</p>}
      {!error && savedAt && <p className={s.savedNote}>Ayarlar kaydedildi.</p>}
    </>
  );
}

