import { useState } from 'react';
import { Button, Field, Modal, Select, Textarea } from '../ui';
import {
  FEEDBACK_CATEGORIES, FEEDBACK_MAX, FEEDBACK_MIN, sendFeedback,
} from '../../api/feedback';
import s from './settings.module.css';

/**
 * "Bildir" penceresi: uygulamada değişmesi istenen şeyi ekibe iletir
 * (kullanıcı isteği, 20 Eyl 2026).
 *
 * Sebep listeden seçilir, açıklama zorunlu. Gönderenin kim olduğunu sunucu
 * oturumdan yazıyor; burada ad/e-posta sorulmuyor. Bildirimin **nereye**
 * gittiği (ekip adresi) bilerek yazılmıyor: adres sunucuda duruyor.
 */
export default function FeedbackDialog({ onClose }) {
  const [category, setCategory] = useState(FEEDBACK_CATEGORIES[0].value);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const tooShort = message.trim().length < FEEDBACK_MIN;

  async function submit() {
    if (tooShort) return;
    setBusy(true);
    setError('');
    try {
      await sendFeedback({ category, message: message.trim() });
      setDone(true);
    } catch (err) {
      const data = err?.response?.data;
      const first = data && !data.detail ? Object.values(data).flat()[0] : data?.detail;
      setError(err?.response?.status === 429
        ? 'Çok fazla bildirim gönderildi. Lütfen biraz sonra tekrar deneyin.'
        : (first ?? 'Bildirim gönderilemedi. Lütfen tekrar deneyin.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} width={520} labelledBy="feedback-title">
      <h2 id="feedback-title" className={s.dialogTitle}>Bildir</h2>
      {done ? (
        <div className={s.dialogBody}>
          <p>Bildiriminiz iletildi. Teşekkürler!</p>
          <div className={s.dialogActions}>
            <Button onClick={onClose}>Kapat</Button>
          </div>
        </div>
      ) : (
        <div className={s.dialogBody}>
          <p className={s.dialogLead}>
            Uygulamada düzelmesini ya da eklenmesini istediğiniz şeyi yazın.
          </p>
          <Field label="Sebep">
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              {FEEDBACK_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Açıklama">
            <Textarea
              rows={5}
              autoFocus
              maxLength={FEEDBACK_MAX}
              value={message}
              placeholder="Ne oldu, ne bekliyordunuz? Hangi ekranda olduğunu da yazarsanız daha çabuk buluruz."
              onChange={(e) => setMessage(e.target.value)}
            />
            <span className={s.dialogHint}>
              {message.trim().length}/{FEEDBACK_MAX}
              {tooShort ? ` · en az ${FEEDBACK_MIN} karakter` : ''}
            </span>
          </Field>
          {error && <p className={s.error}>{error}</p>}
          <div className={s.dialogActions}>
            <Button variant="ghost" onClick={onClose} disabled={busy}>Vazgeç</Button>
            <Button onClick={submit} disabled={busy || tooShort}>
              {busy ? 'Gönderiliyor…' : 'Gönder'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
