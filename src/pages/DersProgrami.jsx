import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable,
} from '@dnd-kit/core';
import { X, Trash2, RotateCcw } from 'lucide-react';
import {
  Card, Button, Field, Select, PillGroup, Spinner,
} from '../components/ui';
import { listStudents } from '../api/students';
import { getSchedule, saveSchedule } from '../api/schedule';
import { listSubjects, listTaskTypes, listTopics, listBooks } from '../api/catalog';
import { DAYS, HOURS } from '../mocks/data';
import s from './DersProgrami.module.css';

const ROW_H = 46;
const MODES = [
  { value: 'genel', label: 'Genel Program' },
  { value: 'ogrenci', label: 'Öğrenciye Özel' },
];
const CATEGORIES = [
  { value: 'tyt', label: 'TYT' },
  { value: 'ayt', label: 'AYT' },
];

// Kütüphaneden blok eklenince metod (task_type) kitabın formatından varsayılır;
// kullanıcı bloğu ekledikten sonra dilerse değiştirir. Okuma kitabında metod yok.
const FORMAT_TO_TYPE = {
  soru_bankasi: 'Test',
  paragraf: 'Test',
  konu_anlatimi: 'Konu Çalışması',
  deneme: 'Deneme',
};

const fmtHour = (h) => `${String(h).padStart(2, '0')}:00`;
const timeRange = (b) => `${fmtHour(b.start)}-${fmtHour(b.start + b.duration)}`;

/** True when [start, start+duration) on `day` collides with an existing block. */
function overlaps(blocks, day, start, duration, ignoreId) {
  return blocks.some(
    (b) =>
      b.id !== ignoreId &&
      b.day === day &&
      start < b.start + b.duration &&
      b.start < start + duration
  );
}

export default function DersProgrami() {
  const [params, setParams] = useSearchParams();
  const studentParam = params.get('ogrenci');

  const [mode, setMode] = useState(studentParam ? 'ogrenci' : 'genel');
  const [studentId, setStudentId] = useState(studentParam ?? '');
  const [students, setStudents] = useState([]);
  const [blocks, setBlocks] = useState(null);
  const [library, setLibrary] = useState([]);
  const [activeDrag, setActiveDrag] = useState(null);

  // Gerçek backend katalogları
  const [subjects, setSubjects] = useState([]);
  const [taskTypes, setTaskTypes] = useState([]);
  const [topics, setTopics] = useState([]);
  const [catalogError, setCatalogError] = useState(false);

  const [draft, setDraft] = useState({
    category: 'tyt', subject: '', type: '', topic: '', book: '', duration: 1, days: [],
  });

  const lastWeek = useRef(null);
  const scope = mode === 'ogrenci' && studentId ? studentId : null;

  const subjectMap = useMemo(
    () => Object.fromEntries(subjects.map((x) => [String(x.id), x])),
    [subjects]
  );
  const taskTypeMap = useMemo(
    () => Object.fromEntries(taskTypes.map((x) => [String(x.id), x])),
    [taskTypes]
  );
  // Sadece seçili sınav (TYT/AYT) dersleri; okul dersleri gösterilmez.
  const filteredSubjects = useMemo(
    () => subjects.filter((x) => x.category === draft.category),
    [subjects, draft.category]
  );
  // Metod adı → task_type id (kitap formatından varsayılan metodu çözmek için).
  const typeIdByName = useMemo(
    () => Object.fromEntries(taskTypes.map((t) => [t.name, String(t.id)])),
    [taskTypes]
  );

  /** Kütüphaneden sürüklenen kitabı bir bloğun alanlarına çevirir (kaynak = kitap). */
  const bookBlockFields = useCallback(
    (bk) => {
      const typeName = FORMAT_TO_TYPE[bk.bookFormat];
      return {
        subject: bk.subject || '',
        subjectLabel: bk.subjectLabel || bk.label,
        subjectColor: bk.color,
        type: typeName ? (typeIdByName[typeName] || '') : '',
        typeName: typeName || undefined,
        topic: '',
        book: bk.id,
        bookLabel: bk.label,
      };
    },
    [typeIdByName]
  );

  // Katalogları ve öğrencileri bir kez yükle; draft varsayılanlarını ata.
  useEffect(() => {
    let alive = true;
    Promise.all([listSubjects(), listTaskTypes(), listStudents()]).then(
      ([subs, types, sts]) => {
        if (!alive) return;
        setSubjects(subs);
        setTaskTypes(types);
        setStudents(sts);
        setStudentId((id) => id || String(sts[0]?.id ?? ''));
        setDraft((d) => {
          const firstInCat = subs.find((x) => x.category === d.category);
          return {
            ...d,
            subject: d.subject || String(firstInCat?.id ?? subs[0]?.id ?? ''),
            type: d.type || String(types[0]?.id ?? ''),
          };
        });
      }
    ).catch(() => { if (alive) setCatalogError(true); });
    return () => { alive = false; };
  }, []);

  // Seçili derse göre konu kataloğunu çek; ders değişince konuyu sıfırla.
  useEffect(() => {
    let alive = true;
    if (!draft.subject) { setTopics([]); return undefined; }
    listTopics(draft.subject).then((t) => {
      if (!alive) return;
      setTopics(t);
      setDraft((d) => ({ ...d, topic: '' }));
    });
    return () => { alive = false; };
  }, [draft.subject]);

  useEffect(() => {
    let alive = true;
    setBlocks(null);
    getSchedule(scope).then((d) => {
      if (!alive) return;
      setBlocks(d);
      lastWeek.current = d;
    });
    if (scope) {
      listBooks(scope).then((d) => { if (alive) setLibrary(d); });
    } else {
      setLibrary([]);
    }
    return () => { alive = false; };
  }, [scope]);

  const commit = useCallback(
    (next) => {
      setBlocks(next);                       // iyimser güncelleme
      saveSchedule(scope, next)
        .then((saved) => { if (saved) setBlocks(saved); })  // geçici id'leri gerçek task id'leriyle değiştir
        .catch(() => {});
    },
    [scope]
  );

  const totalHours = useMemo(
    () => (blocks ?? []).reduce((sum, b) => sum + b.duration, 0),
    [blocks]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  function handleDragStart(event) {
    setActiveDrag(event.active.data.current);
  }

  function handleDragEnd(event) {
    setActiveDrag(null);
    const { active, over } = event;
    if (!over) return;

    const [day, hourStr] = String(over.id).split(':');
    const start = Number(hourStr);
    const payload = active.data.current;
    const duration = payload.duration ?? 1;

    if (start + duration > HOURS[HOURS.length - 1] + 1) return;
    if (overlaps(blocks, day, start, duration, payload.blockId)) return;

    if (payload.kind === 'new') {
      commit([...blocks, { ...blockFromPayload(payload), id: `b${Date.now()}`, day, start, duration }]);
    } else {
      commit(blocks.map((b) => (b.id === payload.blockId ? { ...b, day, start } : b)));
    }
  }

  function removeBlock(id) {
    commit(blocks.filter((b) => b.id !== id));
  }

  function clearAll() {
    lastWeek.current = blocks;
    commit([]);
  }

  function loadLastWeek() {
    if (lastWeek.current) commit(lastWeek.current);
  }

  /** "Bu güne ekle": draft'ı seçili günlere ilk boş dilime bırakır. */
  function addToSelectedDays() {
    if (draft.days.length === 0 || !draftFields) return;
    const base = draftFields;
    let next = [...blocks];
    draft.days.forEach((day) => {
      const slot = HOURS.find(
        (h) =>
          h + draft.duration <= HOURS[HOURS.length - 1] + 1 &&
          !overlaps(next, day, h, draft.duration)
      );
      if (slot === undefined) return;
      next = [
        ...next,
        { ...base, id: `b${Date.now()}-${day}`, day, start: slot, duration: draft.duration },
      ];
    });
    commit(next);
    setDraft((d) => ({ ...d, days: [] }));
  }

  function switchMode(next) {
    setMode(next);
    if (next === 'genel') {
      setParams({}, { replace: true });
      // Genel modda kitap yok → Kitap türündeysek TYT'ye dön.
      setDraft((d) => {
        if (d.category !== 'kitap') return d;
        const first = subjects.find((x) => x.category === 'tyt');
        return { ...d, category: 'tyt', subject: String(first?.id ?? ''), book: '' };
      });
    } else {
      setParams({ ogrenci: studentId }, { replace: true });
    }
  }

  const activeStudent = students.find((x) => String(x.id) === String(studentId));
  const catalogReady = subjects.length > 0 && taskTypes.length > 0;

  // Tür toggle: TYT/AYT her zaman; Kitap yalnız öğrenci modunda (kitap öğrenciye bağlı).
  const typeOptions = useMemo(
    () => (mode === 'ogrenci' ? [...CATEGORIES, { value: 'kitap', label: 'Kitap' }] : CATEGORIES),
    [mode]
  );
  const isBookMode = draft.category === 'kitap';

  // Kitap modu: öğrencinin ders-kitaplarındaki dersler + seçilen derse göre kitaplar.
  const bookSubjects = useMemo(() => {
    const seen = new Map();
    library
      .filter((b) => b.kind === 'ders' && b.subject)
      .forEach((b) => { if (!seen.has(b.subject)) seen.set(b.subject, { id: b.subject, name: b.subjectLabel }); });
    return [...seen.values()];
  }, [library]);
  const booksForSubject = useMemo(
    () => library.filter((b) => b.kind === 'ders' && String(b.subject) === String(draft.subject)),
    [library, draft.subject]
  );
  const activeBook = useMemo(
    () => library.find((b) => String(b.id) === String(draft.book)) || null,
    [library, draft.book]
  );

  // Önizleme ve "güne ekle"nin kullandığı blok alanları — moda göre üretilir.
  const draftFields = useMemo(() => {
    if (isBookMode) return activeBook ? bookBlockFields(activeBook) : null;
    return draftBlockFields(draft, subjectMap, taskTypeMap);
  }, [isBookMode, activeBook, bookBlockFields, draft, subjectMap, taskTypeMap]);

  // Kitap modunda seçili ders/kitap kütüphaneyle tutarlı kalsın (öğrenci değişince
  // ya da moda ilk geçişte ilk uygun ders+kitaba düşer).
  useEffect(() => {
    if (!isBookMode) return;
    const subjectOk = bookSubjects.some((x) => String(x.id) === String(draft.subject));
    const subjectId = subjectOk ? draft.subject : String(bookSubjects[0]?.id ?? '');
    const books = library.filter((b) => b.kind === 'ders' && String(b.subject) === String(subjectId));
    const bookOk = books.some((b) => String(b.id) === String(draft.book));
    const bookId = bookOk ? draft.book : String(books[0]?.id ?? '');
    if (subjectId !== draft.subject || bookId !== draft.book) {
      setDraft((d) => ({ ...d, subject: subjectId, book: bookId }));
    }
  }, [isBookMode, library, bookSubjects, draft.subject, draft.book]);

  return (
    <div className={s.page}>
      <div className={s.toolbar}>
        <div className={s.toolbarLeft}>
          <PillGroup options={MODES} value={mode} onChange={switchMode} />
          {mode === 'ogrenci' && (
            <Select
              className={s.studentSelect}
              value={studentId}
              onChange={(e) => {
                setStudentId(e.target.value);
                setParams({ ogrenci: e.target.value }, { replace: true });
              }}
              aria-label="Öğrenci seç"
            >
              {students.map((st) => (
                <option value={st.id} key={st.id}>{st.name} · {st.grade}</option>
              ))}
            </Select>
          )}
        </div>

        <div className={s.toolbarRight}>
          <span className={s.totalPill}>Toplam: {totalHours} saat</span>
          {mode === 'ogrenci' && (
            <Button variant="ghost" size="sm" onClick={loadLastWeek}>
              <RotateCcw size={13} /> Geçen Haftayı Yükle
            </Button>
          )}
          <Button variant="danger" size="sm" onClick={clearAll}>
            <Trash2 size={13} /> Tümünü Temizle
          </Button>
        </div>
      </div>

      {mode === 'ogrenci' && activeStudent && (
        <p className={s.hint}>
          {activeStudent.name} için haftalık programı düzenle.
        </p>
      )}

      {!blocks ? (
        <div style={{ display: 'grid', placeItems: 'center', padding: 60 }}>
          <Spinner size={24} />
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveDrag(null)}
        >
          <div className={s.layout}>
            <Card className={s.gridCard}>
              <div className={s.grid}>
                <span className={s.corner} />
                {DAYS.map((d) => (
                  <span className={s.dayHead} key={d.id}>{d.short}</span>
                ))}

                {HOURS.map((hour) => (
                  <Row key={hour} hour={hour} blocks={blocks} onRemove={removeBlock} />
                ))}
              </div>
            </Card>

            <div className={s.rail}>
            <Card>
              <h2 className={s.railTitle}>Blok Oluştur</h2>
              <p className={s.railSub}>
                Bloğu sürükleyip bir güne bırakın veya gün seçip ekleyin.
              </p>

              {catalogError ? (
                <p className={s.librarySub}>Katalog yüklenemedi. Sayfayı yenileyin.</p>
              ) : !catalogReady ? (
                <div style={{ display: 'grid', placeItems: 'center', padding: 24 }}>
                  <Spinner />
                </div>
              ) : (
                <>
                  <div className={s.railForm}>
                    <Field label="Tür">
                      <PillGroup
                        className={s.catToggle}
                        options={typeOptions}
                        value={draft.category}
                        onChange={(val) => {
                          if (val === 'kitap') {
                            const firstSub = bookSubjects[0];
                            const firstBook = library.find(
                              (b) => b.kind === 'ders' && String(b.subject) === String(firstSub?.id)
                            );
                            setDraft((d) => ({
                              ...d, category: val,
                              subject: String(firstSub?.id ?? ''), book: String(firstBook?.id ?? ''),
                            }));
                          } else {
                            const first = subjects.find((x) => x.category === val);
                            setDraft((d) => ({ ...d, category: val, subject: String(first?.id ?? ''), book: '' }));
                          }
                        }}
                      />
                    </Field>

                    <Field label="Ders">
                      <Select
                        value={draft.subject}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (isBookMode) {
                            const fb = library.find(
                              (b) => b.kind === 'ders' && String(b.subject) === String(val)
                            );
                            setDraft((d) => ({ ...d, subject: val, book: String(fb?.id ?? '') }));
                          } else {
                            setDraft((d) => ({ ...d, subject: val }));
                          }
                        }}
                      >
                        {(isBookMode ? bookSubjects : filteredSubjects).map((x) => (
                          <option value={x.id} key={x.id}>{x.name}</option>
                        ))}
                      </Select>
                    </Field>

                    {isBookMode ? (
                      <Field label="Kitap">
                        <Select
                          value={draft.book}
                          onChange={(e) => setDraft((d) => ({ ...d, book: e.target.value }))}
                        >
                          {booksForSubject.length === 0 && <option value="">Bu derste kitap yok</option>}
                          {booksForSubject.map((b) => (
                            <option value={b.id} key={b.id}>{b.label}</option>
                          ))}
                        </Select>
                      </Field>
                    ) : (
                      <>
                        <Field label="Çalışma Türü">
                          <Select
                            value={draft.type}
                            onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value }))}
                          >
                            {taskTypes.map((x) => (
                              <option value={x.id} key={x.id}>{x.name}</option>
                            ))}
                          </Select>
                        </Field>

                        <Field label="Konu">
                          <Select
                            value={draft.topic}
                            onChange={(e) => setDraft((d) => ({ ...d, topic: e.target.value }))}
                          >
                            <option value="">
                              {topics.length ? 'Konu seçin (opsiyonel)' : 'Bu derse konu tanımlı değil'}
                            </option>
                            {topics.map((t) => (
                              <option value={t.name} key={t.id}>{t.name}</option>
                            ))}
                          </Select>
                        </Field>
                      </>
                    )}

                    <Field label="Süre">
                      <Select
                        value={draft.duration}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, duration: Number(e.target.value) }))
                        }
                      >
                        <option value={1}>1 Saat</option>
                        <option value={2}>2 Saat</option>
                        <option value={3}>3 Saat</option>
                      </Select>
                    </Field>
                  </div>

                  <p className={s.previewLabel}>Sürüklenebilir blok</p>
                  {draftFields ? (
                    <>
                      <DraftBlock fields={draftFields} duration={draft.duration} />
                      <p className={s.previewHint}>
                        Bu bloğu bir güne sürükle ya da aşağıdan gün seç
                      </p>
                    </>
                  ) : (
                    <p className={s.previewHint}>Önce bu öğrencinin kütüphanesinden bir kitap seçin.</p>
                  )}

                  <div className={s.dayPills} style={{ marginTop: 'var(--space-3)' }}>
                    {DAYS.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        className={`${s.dayPill} ${draft.days.includes(d.id) ? s.dayPillActive : ''}`}
                        onClick={() =>
                          setDraft((prev) => ({
                            ...prev,
                            days: prev.days.includes(d.id)
                              ? prev.days.filter((x) => x !== d.id)
                              : [...prev.days, d.id],
                          }))
                        }
                        aria-pressed={draft.days.includes(d.id)}
                      >
                        {d.short}
                      </button>
                    ))}
                  </div>

                  <Button
                    block
                    size="sm"
                    style={{ marginTop: 'var(--space-3)' }}
                    disabled={draft.days.length === 0 || !draftFields}
                    onClick={addToSelectedDays}
                  >
                    Seçili {draft.days.length || ''} güne ekle
                  </Button>
                </>
              )}

              {mode === 'ogrenci' && activeStudent && (
                <div className={s.library}>
                  <h3 className={s.libraryTitle}>{activeStudent.name} Kütüphanesi</h3>
                  <p className={s.librarySub}>
                    Programa eklemek için yukarıda Tür = Kitap seç.
                  </p>
                  {library.length === 0 ? (
                    <p className={s.librarySub}>Kayıtlı kaynak yok.</p>
                  ) : (
                    <div className={s.chips}>
                      {library.map((bk) => (
                        <span className={s.chip} key={bk.id} title={bk.label}>
                          <span className={s.chipDot} style={{ background: bk.color }} />
                          {bk.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Card>

            <WeightSummary blocks={blocks} subjectMap={subjectMap} />
            </div>
          </div>

          <DragOverlay dropAnimation={null}>
            {activeDrag && (
              <div className={s.overlayBlock} style={{ background: activeDrag.subjectColor }}>
                {activeDrag.subjectLabel}
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}

/** Programdaki blokların TYT/AYT ve ders bazlı saat ağırlığını gösterir. */
function WeightSummary({ blocks, subjectMap }) {
  const total = blocks.reduce((sum, b) => sum + b.duration, 0);
  const cat = { tyt: 0, ayt: 0 };
  const bySub = {};
  blocks.forEach((b) => {
    const c = subjectMap[String(b.subject)]?.category;
    if (c === 'tyt' || c === 'ayt') cat[c] += b.duration;
    const label = b.subjectLabel ?? 'Diğer';
    if (!bySub[label]) bySub[label] = { hours: 0, color: b.subjectColor };
    bySub[label].hours += b.duration;
  });

  // Sınav ağırlığı tamamlayıcı: TYT + AYT = %100 (topla oynama yüzdesi gibi).
  const examTotal = cat.tyt + cat.ayt;
  const tytPct = examTotal ? Math.round((cat.tyt / examTotal) * 100) : 0;
  const aytPct = examTotal ? 100 - tytPct : 0;

  // Ders dağılımı: en çok saatliden sırala; 6'dan fazlaysa kalanı "Diğer".
  let subs = Object.entries(bySub)
    .map(([label, v]) => ({ label, hours: v.hours, color: v.color }))
    .sort((a, b) => b.hours - a.hours);
  const MAX = 6;
  if (subs.length > MAX) {
    const rest = subs.slice(MAX).reduce((sum, x) => sum + x.hours, 0);
    subs = [...subs.slice(0, MAX), { label: 'Diğer', hours: rest, color: 'var(--subj-genel)' }];
  }

  // Donut için conic-gradient stopları (kesin oranlar).
  let acc = 0;
  const stops = subs.map((x) => {
    const start = (acc / total) * 100;
    acc += x.hours;
    const end = (acc / total) * 100;
    return `${x.color} ${start}% ${end}%`;
  });
  const pieStyle = { background: `conic-gradient(${stops.join(', ')})` };
  const pctOf = (h) => Math.round((h / total) * 100);

  return (
    <Card>
      <h2 className={s.railTitle}>Program Ağırlığı</h2>
      <p className={s.railSub}>Toplam {total} saat</p>
      {total === 0 ? (
        <p className={s.librarySub}>Blok ekledikçe ağırlık burada görünür.</p>
      ) : (
        <>
          <div className={s.wSection}>
            <span className={s.wSecLabel}>Sınav Ağırlığı</span>
            <div className={s.split}>
              {tytPct > 0 && (
                <div className={s.splitSeg} style={{ width: `${tytPct}%`, background: 'var(--accent)' }} />
              )}
              {aytPct > 0 && (
                <div className={s.splitSeg} style={{ width: `${aytPct}%`, background: 'var(--violet)' }} />
              )}
            </div>
            <div className={s.splitLegend}>
              <span className={s.splitItem}>
                <span className={s.wDot} style={{ background: 'var(--accent)' }} /> TYT %{tytPct}
              </span>
              <span className={s.splitItem}>
                AYT %{aytPct} <span className={s.wDot} style={{ background: 'var(--violet)' }} />
              </span>
            </div>
          </div>

          <div className={s.wSection}>
            <span className={s.wSecLabel}>Ders Ağırlığı</span>
            <div className={s.pieWrap}>
              <div className={s.pie} style={pieStyle}><div className={s.pieHole} /></div>
              <ul className={s.pieLegend}>
                {subs.map((x) => (
                  <li className={s.pieItem} key={x.label}>
                    <span className={s.wDot} style={{ background: x.color }} />
                    <span className={s.pieName} title={x.label}>{x.label}</span>
                    <span className={s.piePct}>%{pctOf(x.hours)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

/** Draft alanlarından bir bloğun denormalize gösterim alanlarını üretir. */
function draftBlockFields(draft, subjectMap, taskTypeMap) {
  const sub = subjectMap[draft.subject];
  const tt = taskTypeMap[draft.type];
  return {
    subject: draft.subject,
    subjectLabel: sub?.label,
    subjectColor: sub?.color,
    type: draft.type,
    typeName: tt?.name,
    topic: draft.topic,
    book: null,
    bookLabel: null,
  };
}

/** Sürükleme payload'ından bloğun denormalize alanlarını çıkarır. */
function blockFromPayload(payload) {
  return {
    subject: payload.subject,
    subjectLabel: payload.subjectLabel,
    subjectColor: payload.subjectColor,
    type: payload.type,
    typeName: payload.typeName,
    topic: payload.topic,
    book: payload.book ?? null,
    bookLabel: payload.bookLabel ?? null,
  };
}

function Row({ hour, blocks, onRemove }) {
  return (
    <>
      <span className={s.hourLabel}>{fmtHour(hour)}</span>
      {DAYS.map((day) => (
        <Cell
          key={`${day.id}:${hour}`}
          day={day.id}
          hour={hour}
          block={blocks.find((b) => b.day === day.id && b.start === hour)}
          onRemove={onRemove}
        />
      ))}
    </>
  );
}

function Cell({ day, hour, block, onRemove }) {
  const { setNodeRef, isOver } = useDroppable({ id: `${day}:${hour}` });
  return (
    <div
      ref={setNodeRef}
      data-cell={`${day}:${hour}`}
      className={`${s.cell} ${isOver ? s.cellOver : ''}`}
    >
      {block && <PlacedBlock block={block} onRemove={onRemove} />}
    </div>
  );
}

function PlacedBlock({ block, onRemove }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: block.id,
    data: {
      kind: 'move',
      blockId: block.id,
      duration: block.duration,
      subjectLabel: block.subjectLabel,
      subjectColor: block.subjectColor,
    },
  });

  return (
    <div
      ref={setNodeRef}
      data-block={block.id}
      className={`${s.block} ${isDragging ? s.blockDragging : ''}`}
      style={{
        background: block.subjectColor,
        height: block.duration * ROW_H - 4,
      }}
      {...listeners}
      {...attributes}
    >
      <span className={s.blockSubject}>
        {block.book ? '📖 ' : ''}{block.subjectLabel}
      </span>
      {block.duration > 1 && (
        <span className={s.blockMeta}>
          {block.bookLabel || block.typeName}
          {block.topic ? ` · ${block.topic}` : ''}
        </span>
      )}
      <span className={s.blockTime}>{timeRange(block)}</span>
      <button
        type="button"
        className={s.blockRemove}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => onRemove(block.id)}
        aria-label={`${block.subjectLabel} bloğunu kaldır`}
      >
        <X size={11} />
      </button>
    </div>
  );
}

/** Önizleme bloğu: moda göre üretilen alanları (ders akışı veya kitap) sürüklenebilir
 *  bir blok olarak gösterir; bir güne bırakılınca yeni blok oluşur. */
function DraftBlock({ fields, duration }) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: 'draft',
    data: { kind: 'new', duration, ...fields },
  });

  return (
    <div
      ref={setNodeRef}
      data-draft-block
      className={s.preview}
      style={{ background: fields.subjectColor }}
      {...listeners}
      {...attributes}
    >
      <span className={s.previewSubject}>
        {fields.book ? '📖 ' : ''}{fields.subjectLabel}
      </span>
      <span className={s.previewMeta}>
        {fields.bookLabel || fields.typeName}
        {fields.topic ? ` · ${fields.topic}` : ''} · {duration} saat
      </span>
    </div>
  );
}
