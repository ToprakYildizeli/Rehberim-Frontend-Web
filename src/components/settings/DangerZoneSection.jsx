import { useEffect, useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { Card, CardHeader, Button, Field, Input, Modal, Spinner } from '../ui';
import { deleteAccount, getDeleteImpact } from '../../api/auth';
import s from './settings.module.css';

/**
 * Hesabı kalıcı olarak silme (D3).
 *
 * Üç kademeli koruma: (1) ayrı bir onay modalı, (2) **mevcut şifre** — açık
 * kalmış bir oturumu ele geçirenin hesabı tek tıkla yok etmesini engeller,
 * (3) silmeden önce neyin gideceğinin **sayısal özeti**.
 *
 * Özet sunucudan geliyor (`GET /api/auth/delete-account/`) çünkü kuralı
 * modellerdeki `on_delete` belirliyor; burada tahmin edilseydi ikisi zamanla
 * ayrışırdı. Rehberde en kritik ayrım: **öğrenciler silinmez, yalnız bağları
 * kopar** — kullanıcı bunu görmeden onaylamamalı.
 */

/** Sunucunun etki alanları → ekranda gösterilecek satırlar. Rol başına ayrı
 *  liste; sunucu yalnız o role ait alanları döndürüyor. */
const IMPACT_ROWS = {
  counselor: [
    ['students_unlinked', 'öğrencinin bağı kopacak', 'hesapları ve verileri silinmez'],
    ['achievements_deleted', 'başarım silinecek', null],
    ['calendar_events_deleted', 'takvim etkinliği silinecek', null],
    ['parent_invites_deleted', 'veli daveti silinecek', null],
  ],
  student: [
    ['programs_deleted', 'program silinecek', null],
    ['exams_deleted', 'deneme silinecek', null],
    ['books_deleted', 'kitap silinecek', null],
    ['goals_deleted', 'hedef silinecek', null],
  ],
  parent: [
    ['students_unlinked', 'öğrenciyle bağınız kopacak', 'öğrencinin verisi silinmez'],
  ],
};

export default function DangerZoneSection({ onDeleted }) {
  const [open, setOpen] = useState(false);
  const [impact, setImpact] = useState(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Özet yalnız modal açılınca çekilir: Ayarlar'ı her açanın silme ucuna
  // istek atması gereksiz.
  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    setImpact(null);
    getDeleteImpact()
      .then((data) => alive && setImpact(data))
      .catch(() => alive && setImpact({ role: null }));
    return () => { alive = false; };
  }, [open]);

  function close() {
    setOpen(false);
    setPassword('');
    setError(null);
  }

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await deleteAccount(password);
      await onDeleted();
    } catch (err) {
      const data = err?.response?.data;
      const first = data && !data.detail ? Object.values(data).flat()[0] : data?.detail;
      setError(first ?? 'Hesap silinemedi. Lütfen tekrar dene.');
      setBusy(false);
    }
  }

  const rows = (IMPACT_ROWS[impact?.role] ?? [])
    .map(([key, label, hint]) => [impact[key], label, hint])
    .filter(([count]) => count > 0);

  return (
    <>
      <Card className={s.danger}>
        <CardHeader
          title="Hesabı sil"
          subtitle="Hesabınız ve ona bağlı veriler kalıcı olarak silinir"
        />
        <div className={s.dangerRow}>
          <p className={s.dangerText}>
            <AlertTriangle size={14} /> Bu işlem geri alınamaz.
          </p>
          <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
            <Trash2 size={14} /> Hesabımı sil
          </Button>
        </div>
      </Card>

      <Modal open={open} onClose={close} width={440} labelledBy="delete-account-title">
        <h2 id="delete-account-title" className={s.modalTitle}>Hesabınızı silmek üzeresiniz</h2>

        {impact === null ? (
          <div className={s.loading}><Spinner /></div>
        ) : (
          <>
            <p className={s.modalText}>
              Bu işlem <strong>geri alınamaz</strong>. Onayladığınızda:
            </p>
            <ul className={s.impactList}>
              {rows.map(([count, label, hint]) => (
                <li key={label}>
                  <strong>{count}</strong> {label}
                  {hint && <span className={s.impactHint}> — {hint}</span>}
                </li>
              ))}
              {rows.length === 0 && <li>Hesabınıza bağlı başka bir kayıt yok.</li>}
            </ul>

            <div className={s.modalForm}>
              <Field label="Onaylamak için şifrenizi girin" error={error}>
                <Input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(null); }}
                />
              </Field>
            </div>

            <div className={s.modalActions}>
              <Button variant="ghost" size="sm" onClick={close} disabled={busy}>Vazgeç</Button>
              <Button
                variant="danger"
                size="sm"
                onClick={confirm}
                disabled={!password || busy}
              >
                {busy ? 'Siliniyor…' : 'Hesabımı kalıcı olarak sil'}
              </Button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
