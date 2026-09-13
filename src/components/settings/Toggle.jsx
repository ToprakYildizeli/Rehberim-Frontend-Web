import s from './settings.module.css';

/** Anahtar (switch) — görünüşü CSS'te, erişilebilirliği gerçek bir checkbox'ta.
 *  `role="switch"` yerine native checkbox: ekran okuyucular ikisini de anlıyor
 *  ama checkbox klavye davranışını (space) bedavaya getiriyor.
 *
 *  Tercihler bölümünün içindeydi; veli daveti de aynı anahtarı kullanınca
 *  ortak dosyaya çıkarıldı (13 Eyl 2026). Stilleri `settings.module.css`'te
 *  kaldığı için Ayarlar klasöründe duruyor, tasarım sistemine taşınmadı. */
export default function Toggle({ checked, onChange, label }) {
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
