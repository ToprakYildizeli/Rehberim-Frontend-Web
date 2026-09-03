import { useEffect, useState } from 'react';
import { Check, Copy, Plus, X } from 'lucide-react';
import { Card, CardHeader, Button, Field, Input, Select, Spinner, Badge } from '../ui';
import { listStudents } from '../../api/students';
import {
  createParentInvite, deleteParentInvite, listParentInvites,
} from '../../api/parentInvites';
import s from './settings.module.css';

/**
 * Öğrenciye veli ekleme (Faz D2).
 *
 * Rehber velinin hesabını AÇMAZ — bir davet kodu üretir, veli mobilden o kodla
 * kendi hesabını açar. Böylece rehber velinin şifresini hiçbir zaman bilmez.
 * Kod tek kullanımlıktır ve kullanılmadan önce iptal edilebilir.
 *
 * Kullanılmış davetler listede kalır (silinemez): hangi velinin hangi davetle
 * geldiği kaydı, sonradan "bu veli nereden bağlandı" sorusunun tek cevabı.
 */
export default function ParentInvitesSection() {
  const [students, setStudents] = useState([]);
  const [invites, setInvites] = useState(null);
  const [studentId, setStudentId] = useState('');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    let alive = true;
    Promise.all([listStudents(), listParentInvites()])
      .then(([st, inv]) => {
        if (!alive) return;
        setStudents(st);
        setInvites(inv);
      })
      .catch(() => alive && setInvites([]));
    return () => { alive = false; };
  }, []);

  async function create() {
    if (!studentId) return;
    setBusy(true);
    setError(null);
    try {
      const created = await createParentInvite(Number(studentId), label.trim());
      setInvites((prev) => [created, ...(prev ?? [])]);
      setLabel('');
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

  async function revoke(id) {
    setError(null);
    try {
      await deleteParentInvite(id);
      setInvites((prev) => prev.filter((x) => x.id !== id));
    } catch (err) {
      setError(err?.response?.data?.detail ?? 'Davet iptal edilemedi.');
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
          <Select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">Seçin…</option>
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
        <Button size="sm" onClick={create} disabled={!studentId || busy}>
          <Plus size={14} /> Davet oluştur
        </Button>
      </div>

      {error && <p className={s.error}>{error}</p>}

      {invites === null ? (
        <div className={s.loading}><Spinner /></div>
      ) : invites.length === 0 ? (
        <p className={s.note}>Henüz veli daveti oluşturmadınız.</p>
      ) : (
        <ul className={s.rows}>
          {invites.map((inv) => (
            <li key={inv.id} className={s.row}>
              <code className={`${s.inviteCode} ${inv.isUsed ? s.inviteCodeUsed : ''}`}>
                {inv.code}
              </code>
              <div className={s.rowMain}>
                <p className={s.rowTitle}>
                  {inv.studentName}
                  {inv.label && <span className={s.rowLabel}> · {inv.label}</span>}
                </p>
                <p className={s.rowHint}>
                  {inv.isUsed
                    ? `${inv.usedByName ?? 'Bir veli'} kullandı`
                    : 'Kullanılmayı bekliyor'}
                </p>
              </div>
              {inv.isUsed ? (
                <Badge tone="success">Kullanıldı</Badge>
              ) : (
                <div className={s.rowActions}>
                  <Button variant="ghost" size="sm" onClick={() => copy(inv.code)}>
                    {copied === inv.code ? <Check size={14} /> : <Copy size={14} />}
                    {copied === inv.code ? 'Kopyalandı' : 'Kopyala'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => revoke(inv.id)}>
                    <X size={14} /> İptal
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
