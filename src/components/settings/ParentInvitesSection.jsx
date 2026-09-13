import { useEffect, useState } from 'react';
import { Check, Copy, Plus, X } from 'lucide-react';
import { Card, CardHeader, Button, Field, Input, Select, Spinner, Badge } from '../ui';
import Toggle from './Toggle';
import { listStudents } from '../../api/students';
import {
  createParentInvite, deleteParentInvite, listParentInvites,
  PARENT_SCOPES, ALL_SCOPES_ON,
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
 *
 * **Her veli aynı değil (13 Eyl 2026, hocanın isteği).** Davet kurulurken o
 * velinin hangi ekranları göreceği tek tek seçiliyor; seçim davet kullanıldığı
 * anda bağlantıya kopyalanıyor. Kurulmuş bir davetin izinleri sonradan
 * değiştirilemez — davet dururken izin değiştirmek, bağlanmış velinin
 * erişimini habersiz kaydırırdı; gerekirse davet iptal edilip yenisi açılır.
 */
/** "8 ekranın 3'ü" gibi kısa bir özet; hangileri olduğu satıra sığmıyor.
 *  Hepsi açıksa sayı yerine tek kelime — en sık durum bu. */
function scopeSummary(scopes) {
  const acik = PARENT_SCOPES.filter(({ key }) => scopes?.[key]).length;
  if (acik === PARENT_SCOPES.length) return 'tüm ekranlar';
  if (acik === 0) return 'hiçbir ekran';
  return `${acik}/${PARENT_SCOPES.length} ekran`;
}

export default function ParentInvitesSection() {
  const [students, setStudents] = useState([]);
  const [invites, setInvites] = useState(null);
  const [studentId, setStudentId] = useState('');
  const [label, setLabel] = useState('');
  const [scopes, setScopes] = useState(ALL_SCOPES_ON);
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
      const created = await createParentInvite(Number(studentId), label.trim(), scopes);
      setInvites((prev) => [created, ...(prev ?? [])]);
      setLabel('');
      setScopes(ALL_SCOPES_ON);
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
              onClick={() => setScopes(
                Object.fromEntries(PARENT_SCOPES.map(({ key }) => [key, false]))
              )}
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
                  {' · '}
                  {scopeSummary(inv.scopes)}
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
