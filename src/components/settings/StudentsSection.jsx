import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, UserMinus } from 'lucide-react';
import { Card, CardHeader, Button, Avatar, Spinner, Modal } from '../ui';
import { listStudents, removeStudent } from '../../api/students';
import s from './settings.module.css';

/**
 * Rehberin öğrenci listesi + listeden çıkarma.
 *
 * Liste **10'arlı sayfalar** hâlinde: otuz öğrencili bir rehberde tek bir
 * uzun liste Ayarlar sayfasını metrelerce uzatıyordu ve altındaki kartlara
 * ulaşmak zorlaşıyordu (kullanıcı isteği, 13 Eyl 2026).
 *
 * Çıkarma **silme değildir**: sunucu yalnızca `Student.counselor`'ı boşaltır,
 * öğrencinin hesabı/programları/denemeleri yerinde kalır ve başka bir rehberin
 * davet koduyla yeniden bağlanabilir. Onay kutusundaki metin bunu açıkça
 * söylüyor — "sil" sanıp vazgeçen olmasın.
 */
const PAGE_SIZE = 10;

export default function StudentsSection() {
  const [students, setStudents] = useState(null);
  const [page, setPage] = useState(0);
  const [pending, setPending] = useState(null);     // çıkarılmak üzere seçilen öğrenci
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    listStudents()
      // Alfabetik: rehber aradığı öğrenciyi sayfalar arasında el yordamıyla
      // değil, adının nerede olacağını bilerek buluyor. `localeCompare`
      // Türkçe ile: ç/ğ/ı/ö/ş/ü yoksa listenin sonuna düşüyor.
      .then((rows) => alive && setStudents(
        [...rows].sort((a, b) => a.name.localeCompare(b.name, 'tr'))
      ))
      .catch(() => alive && setStudents([]));
    return () => { alive = false; };
  }, []);

  const pageCount = Math.max(1, Math.ceil((students?.length ?? 0) / PAGE_SIZE));
  // Son sayfadaki tek öğrenci çıkarılınca o sayfa yok oluyor; boş bir sayfada
  // kalmamak için geçerli aralığa çekiliyor.
  const safePage = Math.min(page, pageCount - 1);
  const visible = useMemo(
    () => (students ?? []).slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE),
    [students, safePage]
  );

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
          {visible.map((st) => (
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

      {students !== null && pageCount > 1 && (
        <div className={s.pager}>
          <Button
            variant="ghost"
            size="sm"
            disabled={safePage === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            <ChevronLeft size={14} /> Önceki
          </Button>
          <span className={s.pagerLabel}>{safePage + 1} / {pageCount}</span>
          <Button
            variant="ghost"
            size="sm"
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
          >
            Sonraki <ChevronRight size={14} />
          </Button>
        </div>
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
