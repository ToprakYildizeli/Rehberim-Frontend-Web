import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Card, CardHeader, Button, Input, Spinner } from '../ui';
import s from './settings.module.css';

/**
 * Global bir referans kataloğunu (çalışma türü, yayınevi) listeler ve yenisini
 * ekler. Tek bileşen iki katalogu da karşılıyor çünkü ikisinin de sözleşmesi
 * aynı: `{ id, name }` listesi + ada göre oluşturma.
 *
 * **Silme ve düzenleme bilerek yok.** Katalog global (kullanıcı kararı,
 * 2 Eyl 2026): eklenen kayıt tüm rehberlerin dropdown'ına düşer, dolayısıyla
 * silme de herkesi etkilerdi. Sunucuda da bu uçlar açılmadı.
 */
export default function CatalogSection({ title, subtitle, load, create, addLabel, hint }) {
  const [items, setItems] = useState(null);         // null = yükleniyor
  const [name, setName] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    load()
      .then((rows) => alive && setItems(rows))
      .catch(() => alive && setItems([]));
    return () => { alive = false; };
  }, [load]);

  async function add() {
    const value = name.trim();
    if (!value) return;
    setBusy(true);
    setError(null);
    try {
      const created = await create(value);
      setItems((prev) => [...(prev ?? []), created].sort((a, b) =>
        a.name.localeCompare(b.name, 'tr')));
      setName('');
    } catch (err) {
      const data = err?.response?.data;
      setError(
        (Array.isArray(data?.name) ? data.name[0] : data?.detail) ??
        'Eklenemedi. Lütfen tekrar dene.'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} />

      {items === null ? (
        <div className={s.loading}><Spinner /></div>
      ) : (
        <ul className={s.chips}>
          {items.map((x) => <li key={x.id} className={s.chip}>{x.name}</li>)}
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
      <p className={s.note}>{hint}</p>
    </Card>
  );
}
