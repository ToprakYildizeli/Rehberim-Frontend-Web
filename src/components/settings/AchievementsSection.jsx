import { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import {
  Card, CardHeader, Button, Field, Input, Select, Spinner, Modal, NumberInput,
} from '../ui';
import {
  createAchievement, deleteAchievement, listAchievements, updateAchievement,
} from '../../api/achievements';
import s from './settings.module.css';

/** Backend `AchievementMetric` ile birebir. Eşik birimi ölçüye göre değişiyor:
 *  net bir sayı, diğer ikisi yüzde. */
const METRICS = [
  { value: 'exam_net', label: 'Deneme Neti', unit: 'net', needsScope: true },
  { value: 'topic_completion', label: 'Konu Tamamlama', unit: '%', needsScope: false },
  { value: 'compliance', label: 'Program Uyumu', unit: '%', needsScope: false },
];
const METRIC_BY_VALUE = Object.fromEntries(METRICS.map((m) => [m.value, m]));

const EMPTY = {
  name: '', description: '', metric: 'exam_net', scope: 'tyt', threshold: 100,
};

/**
 * Başarım tanımlarının yönetimi (C3'ün eksik kalan arayüzü).
 *
 * Tanımlar **rehbere aittir**, global katalog değil: yeni rehbere 12'lik
 * varsayılan set kopyalanır, sonrası tamamen kendisine kalmıştır. Bu yüzden
 * buradaki silme güvenlidir — yalnız kendi listesini etkiler (kataloglardan
 * farklı olarak).
 *
 * Kazanım saklanmaz, her istekte hesaplanır; eşiği değiştirmek öğrencilerin
 * durumunu anında ve geriye dönük olarak günceller.
 */
export default function AchievementsSection() {
  const [items, setItems] = useState(null);
  const [editing, setEditing] = useState(null);     // { ...form, id? } | null
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    listAchievements()
      .then((rows) => alive && setItems(rows))
      .catch(() => alive && setItems([]));
    return () => { alive = false; };
  }, []);

  const metric = METRIC_BY_VALUE[editing?.metric] ?? METRICS[0];

  function openNew() {
    setErrors({});
    setFormError(null);
    setEditing({ ...EMPTY });
  }

  function openEdit(a) {
    setErrors({});
    setFormError(null);
    setEditing({
      id: a.id, name: a.name, description: a.description ?? '',
      metric: a.metric, scope: a.scope || 'tyt', threshold: a.threshold,
    });
    // `is_active` bilerek forma alınmıyor: gönderilmediği için PATCH onu
    // olduğu gibi bırakıyor. Görünürlük anahtarı istenirse ayrı bir iş.
  }

  async function save() {
    setBusy(true);
    setErrors({});
    setFormError(null);
    // Kapsam yalnız deneme netinde anlamlı; sunucu diğerlerinde dolu gelirse
    // reddediyor, o yüzden burada boşaltılıyor.
    const body = {
      name: editing.name,
      description: editing.description,
      metric: editing.metric,
      scope: metric.needsScope ? editing.scope : '',
      threshold: editing.threshold,
    };
    try {
      if (editing.id) {
        const updated = await updateAchievement(editing.id, body);
        setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      } else {
        const created = await createAchievement(body);
        setItems((prev) => [...prev, created]);
      }
      setEditing(null);
    } catch (err) {
      const data = err?.response?.data;
      if (data && typeof data === 'object' && !data.detail) {
        setErrors(Object.fromEntries(
          Object.entries(data).map(([k, v]) => [k, Array.isArray(v) ? v[0] : String(v)])
        ));
      } else {
        setFormError(data?.detail ?? 'Kaydedilemedi.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    await deleteAchievement(id);
    setItems((prev) => prev.filter((x) => x.id !== id));
  }

  const set = (patch) => setEditing((e) => ({ ...e, ...patch }));

  return (
    <Card>
      <CardHeader
        title="Başarımlar"
        subtitle="Öğrencilerinizin kazanabileceği hedefler"
        actions={
          <Button size="sm" onClick={openNew}><Plus size={14} /> Yeni</Button>
        }
      />

      {items === null ? (
        <div className={s.loading}><Spinner /></div>
      ) : items.length === 0 ? (
        <p className={s.note}>Hiç başarımınız yok.</p>
      ) : (
        <ul className={s.rows}>
          {items.map((a) => (
            <li key={a.id} className={s.row}>
              <div className={s.rowMain}>
                <p className={s.rowTitle}>{a.name}</p>
                <p className={s.rowHint}>
                  {a.metricLabel}
                  {a.scope && ` · ${a.scope.toUpperCase()}`}
                  {' · eşik '}
                  {a.threshold}
                  {METRIC_BY_VALUE[a.metric]?.unit === '%' ? '%' : ' net'}
                </p>
              </div>
              <div className={s.rowActions}>
                <Button variant="ghost" size="sm" onClick={() => openEdit(a)}>
                  <Pencil size={14} />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => remove(a.id)}>
                  <Trash2 size={14} />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={!!editing} onClose={() => !busy && setEditing(null)} width={480}>
        <h3 className={s.modalTitle}>
          {editing?.id ? 'Başarımı düzenle' : 'Yeni başarım'}
        </h3>
        {editing && (
          <div className={s.modalForm}>
            <Field label="Ad" error={errors.name}>
              <Input
                value={editing.name}
                onChange={(e) => set({ name: e.target.value })}
                placeholder="ör. TYT'de 100 net"
              />
            </Field>
            <Field label="Açıklama" error={errors.description}>
              <Input
                value={editing.description}
                onChange={(e) => set({ description: e.target.value })}
                placeholder="Öğrenciye gösterilecek kısa metin"
              />
            </Field>
            <div className={s.modalRow}>
              <Field label="Ölçü">
                <Select
                  value={editing.metric}
                  onChange={(e) => set({ metric: e.target.value })}
                >
                  {METRICS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </Select>
              </Field>
              {metric.needsScope && (
                <Field label="Kapsam" error={errors.scope}>
                  <Select
                    value={editing.scope}
                    onChange={(e) => set({ scope: e.target.value })}
                  >
                    <option value="tyt">TYT</option>
                    <option value="ayt">AYT</option>
                  </Select>
                </Field>
              )}
              <Field label={`Eşik (${metric.unit})`} error={errors.threshold}>
                <NumberInput
                  value={editing.threshold}
                  min={0}
                  max={metric.unit === '%' ? 100 : 500}
                  onCommit={(v) => set({ threshold: v })}
                />
              </Field>
            </div>
            {formError && <p className={s.error}>{formError}</p>}
            <div className={s.modalActions}>
              <Button variant="ghost" onClick={() => setEditing(null)} disabled={busy}>
                Vazgeç
              </Button>
              <Button onClick={save} disabled={!editing.name.trim() || busy}>
                {busy ? 'Kaydediliyor…' : 'Kaydet'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </Card>
  );
}
