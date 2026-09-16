import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, FileText, Pencil, Undo2 } from 'lucide-react';
import {
  Card, CardHeader, Button, Badge, Field, Input, Modal, SearchInput, Select, Spinner,
  Textarea,
} from '../ui';
import { getLegalDocument } from '../../api/legal';
import {
  createParentalConsent, listParentalConsents, updateParentalConsent,
} from '../../api/parentalConsents';
import { listStudents } from '../../api/students';
import s from './settings.module.css';

/**
 * Veli onayı kayıtları (KVKK, 16 Eylül 2026).
 *
 * Uygulama reşit olmayan öğrencilerin verisini işliyor; velinin onayı şart.
 * Onay **kâğıt formla** alınıyor (rehber veliye imzalatıyor, form kurumda
 * kalıyor) ve rehber buradan onayın varlığını işliyor. Karar kullanıcının:
 * öğrenciyi sisteme zaten rehber davet ediyor, onay da kurumda alınıyor.
 * E-postayla onay bağlantısı göndermek daha temiz olurdu ama e-posta
 * altyapısı henüz yok — şifre sıfırlama da aynı sebeple çalışmıyor.
 *
 * **Kayıt bir beyandır**, onayın kendisi değil: sistem formun varlığını, kimden
 * alındığını, tarihini ve kimin işlediğini belgeler. Bu yüzden kayıt
 * silinemiyor (sunucu DELETE'e 405 döner); geri alma satırı yerinde bırakıp
 * işaretliyor — onayın bir zaman var olduğu ve ne zaman çekildiği ikisi
 * birlikte kanıt.
 *
 * Liste **onayı olmayan öğrencileri de** gösteriyor ve varsayılan süzgeç
 * "eksikler": rehberin buraya gelme sebebi tamamlananları saymak değil,
 * eksiği kapatmak.
 */

const RELATIONS = [
  ['anne', 'Anne'],
  ['baba', 'Baba'],
  ['vasi', 'Yasal vasi'],
  ['diger', 'Diğer'],
];

const METHODS = [
  ['islak', 'Islak imzalı form'],
  ['eposta', 'E-posta'],
  ['kurum', 'Kurum kaydı'],
];

const EMPTY = {
  guardian_name: '', relation: 'anne', method: 'islak',
  collected_at: '', note: '',
};

export default function ParentalConsentSection() {
  const [students, setStudents] = useState(null);
  const [consents, setConsents] = useState([]);
  const [query, setQuery] = useState('');
  const [onlyMissing, setOnlyMissing] = useState(true);
  const [editing, setEditing] = useState(null);   // { student, consent | null }
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [note, setNote] = useState(null);
  const [formOpen, setFormOpen] = useState(false);

  const load = useCallback(() => {
    let alive = true;
    Promise.all([listStudents(), listParentalConsents()])
      .then(([st, rows]) => {
        if (!alive) return;
        setStudents(st);
        setConsents(rows);
      })
      .catch(() => alive && setStudents([]));
    return () => { alive = false; };
  }, []);

  useEffect(load, [load]);

  const byStudent = useMemo(
    () => new Map(consents.map((row) => [row.student, row])),
    [consents]
  );

  const rows = useMemo(() => {
    const list = (students ?? []).map((student) => ({
      student,
      consent: byStudent.get(student.id) ?? null,
    }));
    const needle = query.trim().toLocaleLowerCase('tr');
    return list.filter(({ student }) => {
      // "Eksik" kararı öğrenci listesinin kendi özetinden geliyor
      // (`parentalConsent`); iki kaynak aynı sunucu durumundan, aynı anda
      // çekiliyor.
      if (onlyMissing && student.parentalConsent?.is_valid) return false;
      if (!needle) return true;
      return student.name.toLocaleLowerCase('tr').includes(needle);
    });
  }, [students, byStudent, query, onlyMissing]);

  const missingCount = useMemo(
    () => (students ?? []).filter((st) => !st.parentalConsent?.is_valid).length,
    [students]
  );

  function open(student, consent) {
    setEditing({ student, consent });
    setForm(consent
      ? {
        guardian_name: consent.guardian_name,
        relation: consent.relation,
        method: consent.method,
        collected_at: consent.collected_at,
        note: consent.note ?? '',
      }
      : { ...EMPTY, collected_at: new Date().toISOString().slice(0, 10) });
    setError(null);
    setFormOpen(true);
  }

  function close() {
    setFormOpen(false);
    setEditing(null);
    setError(null);
  }

  function fieldError(data, field) {
    const value = data?.[field];
    return Array.isArray(value) ? value[0] : null;
  }

  async function save() {
    if (!editing) return;
    setBusy(true);
    setError(null);
    try {
      if (editing.consent) {
        await updateParentalConsent(editing.consent.id, form);
      } else {
        await createParentalConsent({ ...form, student: editing.student.id });
      }
      setNote(`${editing.student.name} için veli onayı kaydedildi.`);
      close();
      load();
    } catch (e) {
      const data = e?.response?.data;
      setError(
        fieldError(data, 'student')
        ?? fieldError(data, 'collected_at')
        ?? fieldError(data, 'guardian_name')
        ?? data?.detail
        ?? 'Kayıt tamamlanamadı.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function toggleRevoked(consent, revoked) {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      await updateParentalConsent(consent.id, { revoked });
      setNote(revoked
        ? 'Onay geri alındı. Öğrencinin verisi silinmeli — kaydı sizde duruyor.'
        : 'Onay yeniden geçerli.');
      load();
    } catch {
      setError('İşlem tamamlanamadı.');
    } finally {
      setBusy(false);
    }
  }

  async function showForm() {
    setNote(null);
    setError(null);
    try {
      const doc = await getLegalDocument('veli_onam');
      // Yeni pencerede değil aynı modalda: açılır pencere engelleyicileri
      // sessizce yutuyor ve rehber "bir şey olmadı" sanıyordu.
      setEditing({ document: doc });
      setFormOpen(false);
    } catch {
      setError('Form metni yüklenemedi.');
    }
  }

  return (
    <Card>
      <CardHeader
        title="Veli onayları"
        subtitle="18 yaşından küçük öğrencilerin verisi için velinin yazılı onayı gerekir."
        actions={(
          <Button variant="ghost" onClick={showForm}>
            <FileText size={15} /> Onam formu
          </Button>
        )}
      />

      {students === null ? (
        <div className={s.loading}><Spinner /></div>
      ) : (
        <>
          <p className={s.note}>
            Formu veliye imzalatın, imzalı belgeyi kurumda saklayın ve onayın
            varlığını buraya işleyin. {missingCount > 0
              ? `${missingCount} öğrencide onay eksik.`
              : 'Bütün öğrencilerde onay kayıtlı.'}
          </p>

          <div className={s.searchRow}>
            <SearchInput
              placeholder="Öğrenci ara"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Button
              variant={onlyMissing ? 'primary' : 'ghost'}
              onClick={() => setOnlyMissing((v) => !v)}
            >
              {onlyMissing ? 'Yalnız eksikler' : 'Hepsi'}
            </Button>
          </div>

          <div className={s.rows}>
            {rows.length === 0 && (
              <p className={s.note}>
                {onlyMissing ? 'Eksik onay yok.' : 'Öğrenci bulunamadı.'}
              </p>
            )}
            {rows.map(({ student, consent }) => (
              <div className={s.row} key={student.id}>
                <div className={s.rowMain}>
                  <div className={s.consentTitle}>
                    <span>{student.name}</span>
                    {consent?.is_valid && <Badge tone="success">Onaylı</Badge>}
                    {consent && !consent.is_valid && <Badge tone="danger">Geri alındı</Badge>}
                    {!consent && <Badge tone="warning">Eksik</Badge>}
                  </div>
                  <div className={s.rowHint}>
                    {consent
                      ? `${consent.guardian_name} · ${consent.relation_display} · `
                        + `${new Date(consent.collected_at).toLocaleDateString('tr-TR')}`
                        + ` · ${consent.method_display}`
                      : `${student.grade} · onay işlenmedi`}
                  </div>
                </div>
                <div className={s.rowActions}>
                  {consent ? (
                    <>
                      <Button variant="ghost" iconOnly title="Düzenle"
                        onClick={() => open(student, consent)}>
                        <Pencil size={15} />
                      </Button>
                      {consent.is_valid ? (
                        <Button variant="ghost" iconOnly title="Onayı geri al"
                          disabled={busy}
                          onClick={() => toggleRevoked(consent, true)}>
                          <Undo2 size={15} />
                        </Button>
                      ) : (
                        <Button variant="ghost" iconOnly title="Geri almayı iptal et"
                          disabled={busy}
                          onClick={() => toggleRevoked(consent, false)}>
                          <Check size={15} />
                        </Button>
                      )}
                    </>
                  ) : (
                    <Button onClick={() => open(student, null)}>Onayı işle</Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {note && <p className={s.savedNote}>{note}</p>}
      {error && !formOpen && <p className={s.error}>{error}</p>}

      {/* Onam formu metni */}
      <Modal
        open={Boolean(editing?.document)}
        onClose={() => setEditing(null)}
        width={720}
      >
        <h3 className={s.modalTitle}>
          Veli Onam Formu · sürüm {editing?.document?.version}
        </h3>
        <p className={s.modalText}>
          Bu formu yazdırıp veliye imzalatın; imzalı belge kurumda saklanır.
        </p>
        <pre className={s.legalBody}>{editing?.document?.body}</pre>
        <div className={s.modalActions}>
          <Button variant="ghost" onClick={() => setEditing(null)}>Kapat</Button>
          <Button onClick={() => window.print()}>Yazdır</Button>
        </div>
      </Modal>

      {/* Kayıt / düzenleme */}
      <Modal open={formOpen} onClose={close} width={520}>
        <h3 className={s.modalTitle}>
          {editing?.consent ? 'Veli onayını düzenle' : 'Veli onayını işle'}
        </h3>
        <p className={s.modalText}>
          {editing?.student?.name} — imzalı formdaki bilgileri girin.
        </p>
        <div className={s.modalForm}>
          <Field label="Veli adı soyadı">
            <Input
              value={form.guardian_name}
              onChange={(e) => setForm({ ...form, guardian_name: e.target.value })}
              placeholder="Formdaki ad soyad"
            />
          </Field>
          <div className={s.modalRow}>
            <Field label="Yakınlık">
              <Select
                value={form.relation}
                onChange={(e) => setForm({ ...form, relation: e.target.value })}
              >
                {RELATIONS.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Alınma biçimi">
              <Select
                value={form.method}
                onChange={(e) => setForm({ ...form, method: e.target.value })}
              >
                {METHODS.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Onay tarihi (formdaki imza tarihi)">
            <Input
              type="date"
              value={form.collected_at}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setForm({ ...form, collected_at: e.target.value })}
            />
          </Field>
          <Field label="Not (isteğe bağlı)">
            <Textarea
              rows={2}
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </Field>
        </div>
        {error && <p className={s.error}>{error}</p>}
        <div className={s.modalActions}>
          <Button variant="ghost" onClick={close}>Vazgeç</Button>
          <Button
            onClick={save}
            disabled={busy || !form.guardian_name.trim() || !form.collected_at}
          >
            {busy ? <Spinner size={14} /> : <Check size={15} />} Kaydet
          </Button>
        </div>
      </Modal>
    </Card>
  );
}
