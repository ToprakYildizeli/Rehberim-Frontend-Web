import { useEffect, useState } from 'react';
import { Check, Copy, Plus } from 'lucide-react';
import { Card, CardHeader, Button, Field, Input, Select, Modal } from '../ui';
import Toggle from './Toggle';
import { listStudents } from '../../api/students';
import {
  createParentInvite, PARENT_SCOPES, ALL_SCOPES_ON, ALL_SCOPES_OFF,
} from '../../api/parentInvites';
import s from './settings.module.css';

/**
 * Öğrenciye veli ekleme (Faz D2).
 *
 * Rehber velinin hesabını AÇMAZ — bir davet kodu üretir, veli mobilden o kodla
 * kendi hesabını açar. Böylece rehber velinin şifresini hiçbir zaman bilmez.
 * Kod tek kullanımlıktır ve kullanılmadan önce iptal edilebilir.
 *
 * **Burada liste yok** (13 Eyl 2026): bekleyen davetler de bağlanmış veliler
 * de Öğrencilerim listesinde, kendi öğrencisinin satırındaki "Veliler"
 * penceresinde duruyor. Aynı bilgiyi iki yerde göstermek, hangisinin güncel
 * olduğunu sorduruyordu. Bu kart yalnız yeni davet **kurar**; kurulan kod
 * bir kere, pencerede gösterilir.
 *
 * **Her veli aynı değil (13 Eyl 2026, hocanın isteği).** Davet kurulurken o
 * velinin hangi ekranları göreceği tek tek seçiliyor; seçim davet kullanıldığı
 * anda bağlantıya kopyalanıyor. Kurulmuş bir davetin izinleri sonradan
 * değiştirilemez — davet dururken izin değiştirmek, bağlanmış velinin
 * erişimini habersiz kaydırırdı; gerekirse davet iptal edilip yenisi açılır.
 */
export default function ParentInvitesSection({ onCreated }) {
  const [students, setStudents] = useState([]);
  const [created, setCreated] = useState(null);   // yeni kurulan davet (pencere)
  const [studentId, setStudentId] = useState('');
  const [label, setLabel] = useState('');
  // Form kapalı başlıyor: rehber ne paylaşacağını bilerek seçsin, farkında
  // olmadan her şeyi açmış olmasın.
  const [scopes, setScopes] = useState(ALL_SCOPES_OFF);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    let alive = true;
    listStudents()
      .then((st) => alive && setStudents(st))
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  async function create() {
    if (!studentId) return;
    setBusy(true);
    setError(null);
    try {
      const yeni = await createParentInvite(Number(studentId), label.trim(), scopes);
      // Kod bir kere burada gösteriliyor; sonrası Öğrencilerim listesinde.
      setCreated(yeni);
      setLabel('');
      setScopes(ALL_SCOPES_OFF);
      // Üstteki öğrenci listesi bekleyen davetleri de sayıyor; yeni kodun
      // orada görünmesi için sayfa yenilemek gerekmesin.
      onCreated?.(yeni);
    } catch (err) {
      const data = err?.response?.data;
      setError(
        (Array.isArray(data?.student) ? data.student[0] : data?.detail) ??
        'Davet oluşturulamadı.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function copy(code) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  }

  return (
    <Card>
      <CardHeader title="Veli davetleri" />

      <div className={s.inviteForm}>
        <Field label="Öğrenci">
          <Select
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            disabled={students.length === 0}
          >
            <option value="">{students.length === 0 ? 'Henüz öğrenciniz yok' : 'Seçin…'}</option>
            {students.map((st) => (
              <option key={st.id} value={st.id}>{st.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Not (isteğe bağlı)">
          <Input
            value={label}
            placeholder="ör. annesi"
            onChange={(e) => setLabel(e.target.value)}
          />
        </Field>
      </div>

      {/* Görüntülenebilecek ekranlar — davetin parçası, sonradan değişmez. */}
      <div className={s.scopeBox}>
        <div className={s.scopeHead}>
          <span className={s.scopeTitle}>Görüntülenebilecek ekranlar</span>
          <div className={s.scopeBulk}>
            <button
              type="button"
              className={s.linkBtn}
              onClick={() => setScopes(ALL_SCOPES_ON)}
            >
              Hepsi
            </button>
            <button
              type="button"
              className={s.linkBtn}
              onClick={() => setScopes(ALL_SCOPES_OFF)}
            >
              Hiçbiri
            </button>
          </div>
        </div>
        <ul className={s.scopeList}>
          {PARENT_SCOPES.map(({ key, label: name, detail, hint }) => (
            <li key={key} className={detail ? s.scopeDetail : undefined}>
              <Toggle
                checked={scopes[key]}
                onChange={(v) => setScopes((p) => ({ ...p, [key]: v }))}
                label={name}
              />
              {hint && <span className={s.scopeHint}>{hint}</span>}
            </li>
          ))}
        </ul>
      </div>

      <div className={s.inviteActions}>
        <Button size="sm" onClick={create} disabled={!studentId || busy}>
          <Plus size={14} /> Davet oluştur
        </Button>
      </div>

      {error && <p className={s.error}>{error}</p>}

      {/* Kurulan davet bir kere burada gösteriliyor: kod ekrandan kaybolmadan
          kopyalansın. Sonrası Öğrencilerim listesinde, öğrencinin satırında. */}
      <Modal open={!!created} onClose={() => setCreated(null)} width={420}>
        <h3 className={s.modalTitle}>Davet oluşturuldu</h3>
        <div className={s.inviteSummary}>
          <span className={s.rowTitle}>{created?.studentName}</span>
          {created?.label && <span className={s.rowHint}>{created.label}</span>}
          <code className={s.inviteCodeBig}>{created?.code}</code>
        </div>
        <div className={s.modalActions}>
          <Button variant="ghost" onClick={() => copy(created.code)}>
            {copied === created?.code ? <Check size={14} /> : <Copy size={14} />}
            {copied === created?.code ? 'Kopyalandı' : 'Kodu kopyala'}
          </Button>
          <Button onClick={() => setCreated(null)}>Tamam</Button>
        </div>
      </Modal>

    </Card>
  );
}
