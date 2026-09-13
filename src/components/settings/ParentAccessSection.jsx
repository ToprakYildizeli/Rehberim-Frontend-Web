import { useEffect, useState } from 'react';
import { Card, CardHeader, Spinner } from '../ui';
import Toggle from './Toggle';
import {
  listParentAccesses, updateParentAccess, PARENT_SCOPES,
} from '../../api/parentInvites';
import s from './settings.module.css';

/**
 * Bağlanmış velilerin izinleri — **sonradan** düzenlenebilir (13 Eyl 2026).
 *
 * Davetteki seçim başlangıç değeridir, son söz değil: "A velisi denemeleri
 * göremiyordu, hoca sonradan izin vermek isterse verebilmeli."
 *
 * Kaydet düğmesi yok, dokunulan anahtar anında yazılıyor (Tercihler'le aynı
 * yaklaşım); hata olursa değer eski hâline dönüyor.
 */
export default function ParentAccessSection() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    listParentAccesses()
      .then((r) => alive && setRows(r))
      .catch(() => alive && setRows([]));
    return () => { alive = false; };
  }, []);

  async function toggle(row, key, value) {
    const previous = row.scopes[key];
    setError(null);
    setRows((prev) => prev.map((r) => (
      r.id === row.id ? { ...r, scopes: { ...r.scopes, [key]: value } } : r
    )));
    try {
      await updateParentAccess(row.id, { [key]: value });
    } catch (err) {
      setRows((prev) => prev.map((r) => (
        r.id === row.id ? { ...r, scopes: { ...r.scopes, [key]: previous } } : r
      )));
      setError(err?.response?.data?.detail ?? 'İzin güncellenemedi.');
    }
  }

  return (
    <Card className={s.wide}>
      <CardHeader
        title="Bağlı veliler"
        subtitle={rows ? `${rows.length} bağlantı` : 'Yükleniyor…'}
      />

      {error && <p className={s.error}>{error}</p>}

      {rows === null ? (
        <div className={s.loading}><Spinner /></div>
      ) : rows.length === 0 ? (
        <p className={s.note}>Henüz bir veli bağlanmamış.</p>
      ) : (
        <ul className={s.accessList}>
          {rows.map((row) => (
            <li key={row.id} className={s.accessRow}>
              <div className={s.accessHead}>
                <span className={s.rowTitle}>
                  {row.parentName}
                  {row.label && <span className={s.rowLabel}> · {row.label}</span>}
                </span>
                <span className={s.rowHint}>{row.studentName}</span>
              </div>
              <ul className={s.scopeList}>
                {PARENT_SCOPES.map(({ key, label, detail }) => (
                  <li key={key} className={detail ? s.scopeDetail : undefined}>
                    <Toggle
                      checked={row.scopes[key]}
                      onChange={(v) => toggle(row, key, v)}
                      label={label}
                    />
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
