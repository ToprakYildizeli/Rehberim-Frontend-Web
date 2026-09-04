import { useEffect, useState } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Card, CardHeader, Button, Input, Spinner } from '../ui';
import s from './settings.module.css';

/**
 * Bir referans kataloğunu (çalışma türü, yayınevi) listeler; ekleme, düzeltme ve
 * silme yapar. Tek bileşen iki katalogu da karşılıyor çünkü ikisinin de
 * sözleşmesi aynı: `{ id, name }` listesi + ada göre yazma.
 *
 * **Katalog rehbere aittir** (kullanıcı kararı, 4 Eylül 2026). Buradaki hiçbir
 * değişiklik başka bir rehberi etkilemez; rehberin kendi öğrencileri ve velileri
 * bu listeyi okur. Önceki sürümde katalog globaldi ve düzeltme/silme yoktu —
 * yanlış yazılan bir kayıt herkeste kalıyor, ekleyen bile geri alamıyordu.
 */
export default function CatalogSection({
  title, load, create, rename, remove, addLabel,
}) {
  const [items, setItems] = useState(null);         // null = yükleniyor
  const [name, setName] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);     // { id, value } | null

  useEffect(() => {
    let alive = true;
    load()
      .then((rows) => alive && setItems(rows))
      .catch(() => alive && setItems([]));
    return () => { alive = false; };
  }, [load]);

  const byName = (a, b) => a.name.localeCompare(b.name, 'tr');

  function fail(err, fallback) {
    const data = err?.response?.data;
    setError((Array.isArray(data?.name) ? data.name[0] : data?.detail) ?? fallback);
  }

  async function add() {
    const value = name.trim();
    if (!value) return;
    setBusy(true);
    setError(null);
    try {
      const created = await create(value);
      setItems((prev) => [...(prev ?? []), created].sort(byName));
      setName('');
    } catch (err) {
      fail(err, 'Eklenemedi. Lütfen tekrar dene.');
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit() {
    const value = editing.value.trim();
    if (!value) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await rename(editing.id, value);
      setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)).sort(byName));
      setEditing(null);
    } catch (err) {
      fail(err, 'Değiştirilemedi. Lütfen tekrar dene.');
    } finally {
      setBusy(false);
    }
  }

  async function drop(item) {
    // Geri alınamaz bir işlem: onay iste. (Ekranlarda "nasıl çalışır" kutuları
    // yok ama geri alınamaz işlem uyarıları kalıyor.)
    if (!window.confirm(`"${item.name}" listeden kaldırılsın mı?`)) return;
    setBusy(true);
    setError(null);
    try {
      await remove(item.id);
      setItems((prev) => prev.filter((x) => x.id !== item.id));
    } catch (err) {
      fail(err, 'Silinemedi. Lütfen tekrar dene.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader title={title} />

      {items === null ? (
        <div className={s.loading}><Spinner /></div>
      ) : (
        <ul className={s.chips}>
          {items.map((x) => (
            <li key={x.id} className={s.chip}>
              {editing?.id === x.id ? (
                <span className={s.chipEdit}>
                  <input
                    className={s.chipInput}
                    value={editing.value}
                    autoFocus
                    onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit();
                      if (e.key === 'Escape') setEditing(null);
                    }}
                  />
                  <button
                    type="button" className={s.chipBtn} onClick={saveEdit}
                    disabled={busy || !editing.value.trim()} aria-label="Kaydet"
                  >
                    <Check size={13} />
                  </button>
                  <button
                    type="button" className={s.chipBtn} onClick={() => setEditing(null)}
                    aria-label="Vazgeç"
                  >
                    <X size={13} />
                  </button>
                </span>
              ) : (
                <>
                  {x.name}
                  <button
                    type="button" className={s.chipBtn} disabled={busy}
                    onClick={() => { setError(null); setEditing({ id: x.id, value: x.name }); }}
                    aria-label={`${x.name} adını değiştir`}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    type="button" className={`${s.chipBtn} ${s.chipBtnDanger}`} disabled={busy}
                    onClick={() => drop(x)}
                    aria-label={`${x.name} kaydını sil`}
                  >
                    <Trash2 size={13} />
                  </button>
                </>
              )}
            </li>
          ))}
          {items.length === 0 && <li className={s.chipEmpty}>Henüz kayıt yok.</li>}
        </ul>
      )}

      <div className={s.addRow}>
        <Input
          value={name}
          placeholder={addLabel}
          onChange={(e) => { setName(e.target.value); setError(null); }}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <Button size="sm" onClick={add} disabled={!name.trim() || busy}>
          <Plus size={14} /> Ekle
        </Button>
      </div>

      {error && <p className={s.error}>{error}</p>}
    </Card>
  );
}
