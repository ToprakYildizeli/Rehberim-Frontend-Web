import { useEffect, useRef, useState } from 'react';
import { Card, CardHeader, Field, NumberInput, Select, Spinner } from '../ui';
import { getPreferences, updatePreferences } from '../../api/preferences';
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

const SCHEDULE_TYPES = [
  { value: 'timed', label: 'Saatli (saat dilimli tahta)' },
  { value: 'untimed', label: 'Saatsiz (yalnız o günün listesi)' },
];

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
        <div className={s.prefRow}>
          <Field label="Gün sayısı" className={s.prefNum}>
            <NumberInput
              value={prefs.default_day_count}
              min={1}
              max={31}
              onCommit={(v) => save('default_day_count', v, 600)}
            />
          </Field>
          <Field label="Program tipi" className={s.prefSelect}>
            <Select
              value={prefs.default_schedule_type}
              onChange={(e) => save('default_schedule_type', e.target.value)}
            >
              {SCHEDULE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </Select>
          </Field>
        </div>
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

/** Anahtar (switch) — görünüşü CSS'te, erişilebilirliği gerçek bir checkbox'ta.
 *  `role="switch"` yerine native checkbox: ekran okuyucular ikisini de anlıyor
 *  ama checkbox klavye davranışını (space) bedavaya getiriyor. */
function Toggle({ checked, onChange, label }) {
  return (
    <label className={s.toggle}>
      <input
        type="checkbox"
        className={s.toggleInput}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className={s.toggleTrack} aria-hidden="true"><span className={s.toggleKnob} /></span>
      <span className={s.toggleLabel}>{label}</span>
    </label>
  );
}
