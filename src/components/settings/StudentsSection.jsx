import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Copy, UserMinus, Users, X } from 'lucide-react';
import { Card, CardHeader, Button, Avatar, Input, Spinner, Modal } from '../ui';
import { listStudents, removeStudent } from '../../api/students';
import {
  listParentAccesses, updateParentAccess, listParentInvites, deleteParentInvite,
  PARENT_SCOPES,
} from '../../api/parentInvites';
import Toggle from './Toggle';
import s from './settings.module.css';

/**
 * Rehberin öğrenci listesi + listeden çıkarma.
 *
 * Liste **aranabilir ve 10'arlı sayfalar** hâlinde: otuz öğrencili bir
 * rehberde tek bir uzun liste Ayarlar sayfasını metrelerce uzatıyordu ve
 * altındaki kartlara ulaşmak zorlaşıyordu (kullanıcı isteği, 13 Eyl 2026).
 * Sıra alfabetik; arama sonuçları da aynı sayfalamayı kullanıyor.
 *
 * **Velinin izinleri de burada** (13 Eyl 2026): ayrı bir "Bağlı veliler"
 * kartı vardı, aynı bilgi iki yere dağılıyordu. Öğrencinin satırındaki
 * "Veliler" düğmesi bir pencere açıyor, izinler orada değiştiriliyor —
 * satır içinde açılan panel sekiz anahtarla listeyi ikiye katlıyor ve
 * altındaki öğrenciler ekrandan taşıyordu.
 *
 * Pencere iki tür satır gösterir: **bağlanmış veli** (izin anahtarlarıyla) ve
 * **bekleyen davet** (kod + kime verildiği + açılacak ekranlar). Sayaç ikisini
 * birlikte sayar; hoca "bu öğrencinin velisi var mı" diye sorduğunda henüz
 * hesabını açmamış olan da bir cevaptır.
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
  const [query, setQuery] = useState('');
  const [accesses, setAccesses] = useState([]);      // bağlanmış veliler
  const [invites, setInvites] = useState([]);        // bekleyen davetler
  const [copied, setCopied] = useState(null);
  const [parentsOpen, setParentsOpen] = useState(null);  // veli penceresi açık öğrenci
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
    // Veli bağlantıları bir kez, topluca: her satır için ayrı istek atmak
    // on öğrencide on istek ederdi.
    listParentAccesses()
      .then((rows) => alive && setAccesses(rows))
      .catch(() => {});
    // Bekleyen davetler de veli sayılıyor: kod verilmiş ama hesap henüz
    // açılmamış olabilir.
    listParentInvites()
      .then((rows) => alive && setInvites(rows.filter((x) => !x.isUsed)))
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // Arama: ada göre, Türkçe harfe duyarsız. `toLocaleLowerCase('tr')` şart —
  // 'İ' varsayılan küçültmede 'i̇' (i + birleşen nokta) oluyor ve eşleşmiyor.
  const fold = (text) => (text ?? '').toLocaleLowerCase('tr');
  const filtered = useMemo(() => {
    const key = fold(query.trim());
    if (!key) return students ?? [];
    return (students ?? []).filter((st) => fold(st.name).includes(key));
  }, [students, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  // Son sayfadaki tek öğrenci çıkarılınca o sayfa yok oluyor; boş bir sayfada
  // kalmamak için geçerli aralığa çekiliyor.
  const safePage = Math.min(page, pageCount - 1);
  const visible = useMemo(
    () => filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE),
    [filtered, safePage]
  );

  /** O öğrenciye bağlı veliler. */
  const parentsOf = (studentId) => accesses.filter((a) => a.studentId === studentId);
  /** O öğrenci için kullanılmayı bekleyen davetler. */
  const invitesOf = (studentId) => invites.filter((i) => i.studentId === studentId);

  async function copyCode(code) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  }

  async function revokeInvite(id) {
    setError(null);
    try {
      await deleteParentInvite(id);
      setInvites((prev) => prev.filter((x) => x.id !== id));
    } catch (err) {
      setError(err?.response?.data?.detail ?? 'Davet iptal edilemedi.');
    }
  }

  async function toggleScope(row, key, value) {
    const previous = row.scopes[key];
    setError(null);
    setAccesses((prev) => prev.map((r) => (
      r.id === row.id ? { ...r, scopes: { ...r.scopes, [key]: value } } : r
    )));
    try {
      await updateParentAccess(row.id, { [key]: value });
    } catch (err) {
      setAccesses((prev) => prev.map((r) => (
        r.id === row.id ? { ...r, scopes: { ...r.scopes, [key]: previous } } : r
      )));
      setError(err?.response?.data?.detail ?? 'İzin güncellenemedi.');
    }
  }

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

      {students !== null && students.length > 0 && (
        <div className={s.searchRow}>
          <Input
            value={query}
            placeholder="Öğrenci ara"
            onChange={(e) => { setQuery(e.target.value); setPage(0); }}
          />
        </div>
      )}

      {students === null ? (
        <div className={s.loading}><Spinner /></div>
      ) : students.length === 0 ? (
        <p className={s.note}>Henüz öğrenciniz yok.</p>
      ) : filtered.length === 0 ? (
        <p className={s.note}>Aramaya uyan öğrenci yok.</p>
      ) : (
        <ul className={s.rows}>
          {visible.map((st) => {
            const parents = parentsOf(st.id);
            const waiting = invitesOf(st.id);
            const total = parents.length + waiting.length;
            return (
              <li key={st.id} className={s.studentItem}>
                <div className={s.row}>
                  <Avatar name={st.name} color={st.color} size="sm" />
                  <div className={s.rowMain}>
                    <p className={s.rowTitle}>{st.name}</p>
                    <p className={s.rowHint}>{st.grade}</p>
                  </div>
                  {/* Veli izinleri öğrencinin satırında: ayrı bir kartta
                      dururken aynı bilgi iki yere dağılıyordu. */}
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={total === 0}
                    onClick={() => setParentsOpen(st)}
                  >
                    <Users size={14} /> Veliler ({total})
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setPending(st)}>
                    <UserMinus size={14} /> Çıkar
                  </Button>
                </div>

              </li>
            );
          })}
        </ul>
      )}

      {error && <p className={s.error}>{error}</p>}

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

      {/* Veli izinleri penceresi: anahtarlara dokunmak anında yazıyor, ayrı
          bir kaydet adımı yok (Tercihler'le aynı yaklaşım). */}
      <Modal open={!!parentsOpen} onClose={() => setParentsOpen(null)} width={620}>
        <h3 className={s.modalTitle}>{parentsOpen?.name} · veliler</h3>
        <p className={s.modalText}>
          Velinin görebileceği ekranlar. Değişiklik <strong>anında</strong>
          {' '}yürürlüğe girer.
        </p>

        {/* Kodu verilmiş ama hesabı henüz açılmamış davetler. İzinleri burada
            değiştirilemez: davet kullanıldığı anda kopyalanıyor ve arada
            değiştirmek, bağlanacak velinin kapsamını habersiz kaydırırdı.
            Gerekirse iptal edilip yenisi açılır. */}
        {parentsOpen && invitesOf(parentsOpen.id).map((inv) => (
          <div key={`inv-${inv.id}`} className={s.accessRow}>
            <div className={s.accessHead}>
              <span className={s.rowTitle}>
                {inv.label || 'Veli'}
                <span className={s.rowLabel}> · kullanılmayı bekliyor</span>
              </span>
              <code className={s.inviteCode}>{inv.code}</code>
            </div>
            <p className={s.rowHint}>
              Hesap açılınca şu ekranlar açılacak:{' '}
              {PARENT_SCOPES.filter(({ key }) => inv.scopes[key])
                .map(({ label }) => label).join(', ') || 'hiçbiri'}
            </p>
            <div className={s.rowActions}>
              <Button variant="ghost" size="sm" onClick={() => copyCode(inv.code)}>
                {copied === inv.code ? <Check size={14} /> : <Copy size={14} />}
                {copied === inv.code ? 'Kopyalandı' : 'Kodu kopyala'}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => revokeInvite(inv.id)}>
                <X size={14} /> Daveti iptal et
              </Button>
            </div>
          </div>
        ))}

        {parentsOpen && parentsOf(parentsOpen.id).map((row) => (
          <div key={row.id} className={s.accessRow}>
            <div className={s.accessHead}>
              <span className={s.rowTitle}>
                {row.parentName}
                {row.label && <span className={s.rowLabel}> · {row.label}</span>}
              </span>
            </div>
            <ul className={s.scopeList}>
              {PARENT_SCOPES.map(({ key, label }) => (
                <li key={key}>
                  <Toggle
                    checked={row.scopes[key]}
                    onChange={(v) => toggleScope(row, key, v)}
                    label={label}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
        {error && <p className={s.error}>{error}</p>}
        <div className={s.modalActions}>
          <Button variant="ghost" onClick={() => setParentsOpen(null)}>Kapat</Button>
        </div>
      </Modal>

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
