import { useEffect, useState } from 'react';
import { UserMinus } from 'lucide-react';
import { Card, CardHeader, Button, Avatar, Spinner, Modal } from '../ui';
import { listStudents, removeStudent } from '../../api/students';
import s from './settings.module.css';

/**
 * Rehberin öğrenci listesi + listeden çıkarma.
 *
 * Çıkarma **silme değildir**: sunucu yalnızca `Student.counselor`'ı boşaltır,
 * öğrencinin hesabı/programları/denemeleri yerinde kalır ve başka bir rehberin
 * davet koduyla yeniden bağlanabilir. Onay kutusundaki metin bunu açıkça
 * söylüyor — "sil" sanıp vazgeçen olmasın.
 */
export default function StudentsSection() {
  const [students, setStudents] = useState(null);
  const [pending, setPending] = useState(null);     // çıkarılmak üzere seçilen öğrenci
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    listStudents()
      .then((rows) => alive && setStudents(rows))
      .catch(() => alive && setStudents([]));
    return () => { alive = false; };
  }, []);

  async function confirmRemove() {
    setBusy(true);
    setError(null);
    try {
      await removeStudent(pending.id);
      setStudents((prev) => prev.filter((x) => x.id !== pending.id));
      setPending(null);
    } catch (err) {
      setError(err?.response?.data?.detail ?? 'Öğrenci çıkarılamadı.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Öğrencilerim"
        subtitle={students ? `${students.length} öğrenci` : 'Yükleniyor…'}
      />

      {students === null ? (
        <div className={s.loading}><Spinner /></div>
      ) : students.length === 0 ? (
        <p className={s.note}>Henüz öğrenciniz yok.</p>
      ) : (
        <ul className={s.rows}>
          {students.map((st) => (
            <li key={st.id} className={s.row}>
              <Avatar name={st.name} color={st.color} size="sm" />
              <div className={s.rowMain}>
                <p className={s.rowTitle}>{st.name}</p>
                <p className={s.rowHint}>{st.grade}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setPending(st)}>
                <UserMinus size={14} /> Çıkar
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Modal open={!!pending} onClose={() => !busy && setPending(null)} width={440}>
        <h3 className={s.modalTitle}>{pending?.name} listenizden çıkarılsın mı?</h3>
        <p className={s.modalText}>
          Öğrencinin hesabı <strong>silinmez</strong>. Programları, denemeleri ve
          kitaplığı yerinde kalır; yalnızca sizinle bağı kopar ve artık listenizde
          görünmez. Dilerse davet kodunuzla tekrar bağlanabilir.
        </p>
        <p className={s.modalText}>
          Bağ koptuğu sürece başarımları boş görünür ve velisi yeni onaylı program
          göremez — onayı verecek rehber kalmadığı için.
        </p>
        {error && <p className={s.error}>{error}</p>}
        <div className={s.modalActions}>
          <Button variant="ghost" onClick={() => setPending(null)} disabled={busy}>
            Vazgeç
          </Button>
          <Button variant="danger" onClick={confirmRemove} disabled={busy}>
            {busy ? 'Çıkarılıyor…' : 'Listeden çıkar'}
          </Button>
        </div>
      </Modal>
    </Card>
  );
}
