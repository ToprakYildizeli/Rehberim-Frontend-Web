import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable,
} from '@dnd-kit/core';
import { X, Trash2, RotateCcw } from 'lucide-react';
import {
  Card, Button, Field, Input, Select, PillGroup, Spinner,
} from '../components/ui';
import { listStudents } from '../api/students';
import { getSchedule, saveSchedule, getStudentLibrary } from '../api/schedule';
import { DAYS, HOURS, SUBJECTS, SUBJECT_MAP, STUDY_TYPES } from '../mocks/data';
import s from './DersProgrami.module.css';

const ROW_H = 46;
const MODES = [
  { value: 'genel', label: 'Genel Program' },
  { value: 'ogrenci', label: 'Öğrenciye Özel' },
];

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

  const [draft, setDraft] = useState({
    subject: 'matematik',
    type: 'konu',
    topic: '',
    duration: 1,
    days: [],
  });

  // Snapshot of the previous week, so "Geçen Haftayı Yükle" has something to restore.
  const lastWeek = useRef(null);

  const scope = mode === 'ogrenci' && studentId ? studentId : null;

  useEffect(() => {
    let alive = true;
    listStudents().then((d) => {
      if (!alive) return;
      setStudents(d);
      setStudentId((id) => id || String(d[0]?.id ?? ''));
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    setBlocks(null);
    getSchedule(scope).then((d) => {
      if (!alive) return;
      setBlocks(d);
      lastWeek.current = d;
    });
    if (scope) {
      getStudentLibrary(Number(scope)).then((d) => { if (alive) setLibrary(d); });
    } else {
      setLibrary([]);
    }
    return () => { alive = false; };
  }, [scope]);

  // Persist to the (mock) API whenever the board changes.
  const commit = useCallback(
    (next) => {
      setBlocks(next);
      saveSchedule(scope, next);
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

    // Must fit inside the visible day and not collide with an existing block.
    if (start + duration > HOURS[HOURS.length - 1] + 1) return;
    if (overlaps(blocks, day, start, duration, payload.blockId)) return;

    if (payload.kind === 'new') {
      commit([
        ...blocks,
        {
          id: `b${Date.now()}`,
          day,
          start,
          duration,
          subject: payload.subject,
          type: payload.type,
          topic: payload.topic,
        },
      ]);
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

  /** "Bu güne ekle" pills: drop the draft onto each selected day at the first free slot. */
  function addToSelectedDays() {
    if (draft.days.length === 0) return;
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
        {
          id: `b${Date.now()}-${day}`,
          day,
          start: slot,
          duration: draft.duration,
          subject: draft.subject,
          type: draft.type,
          topic: draft.topic,
        },
      ];
    });
    commit(next);
    setDraft((d) => ({ ...d, days: [] }));
  }

  function switchMode(next) {
    setMode(next);
    if (next === 'genel') setParams({}, { replace: true });
    else setParams({ ogrenci: studentId }, { replace: true });
  }

  const activeStudent = students.find((x) => String(x.id) === String(studentId));
  const draftSubject = SUBJECT_MAP[draft.subject];

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
          {activeStudent.name} için geçen haftanın programı yüklendi — düzenleyerek yeni
          haftayı oluştur.
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

            <Card>
              <h2 className={s.railTitle}>Blok Oluştur</h2>
              <p className={s.railSub}>
                Bloğu sürükleyip bir güne bırakın veya gün seçip ekleyin.
              </p>

              <div className={s.railForm}>
                <Field label="Ders">
                  <Select
                    value={draft.subject}
                    onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))}
                  >
                    {SUBJECTS.map((x) => (
                      <option value={x.id} key={x.id}>{x.name}</option>
                    ))}
                  </Select>
                </Field>

                <Field label="Çalışma Türü">
                  <Select
                    value={draft.type}
                    onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value }))}
                  >
                    {STUDY_TYPES.map((x) => (
                      <option value={x.id} key={x.id}>{x.name}</option>
                    ))}
                  </Select>
                </Field>

                <Field label="Konu">
                  <Input
                    placeholder="Örn. Yazım Kuralları"
                    value={draft.topic}
                    onChange={(e) => setDraft((d) => ({ ...d, topic: e.target.value }))}
                  />
                </Field>

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
              <DraftBlock draft={draft} subject={draftSubject} />
              <p className={s.previewHint}>
                Bu bloğu bir güne sürükle ya da aşağıdan gün seç
              </p>

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
                disabled={draft.days.length === 0}
                onClick={addToSelectedDays}
              >
                Seçili {draft.days.length || ''} güne ekle
              </Button>

              {mode === 'ogrenci' && activeStudent && (
                <div className={s.library}>
                  <h3 className={s.libraryTitle}>{activeStudent.name} Kütüphanesi</h3>
                  <p className={s.librarySub}>Kitaplığındaki kaynaklar</p>
                  {library.length === 0 ? (
                    <p className={s.librarySub}>Kayıtlı kaynak yok.</p>
                  ) : (
                    <div className={s.chips}>
                      {library.map((name, i) => (
                        <span className={s.chip} key={name}>
                          <span
                            className={s.chipDot}
                            style={{ background: SUBJECTS[i % SUBJECTS.length].color }}
                          />
                          {name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>

          <DragOverlay dropAnimation={null}>
            {activeDrag && (
              <div
                className={s.overlayBlock}
                style={{ background: SUBJECT_MAP[activeDrag.subject]?.color }}
              >
                {SUBJECT_MAP[activeDrag.subject]?.name}
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
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
      subject: block.subject,
    },
  });

  const subject = SUBJECT_MAP[block.subject];
  const studyType = STUDY_TYPES.find((t) => t.id === block.type);

  return (
    <div
      ref={setNodeRef}
      data-block={block.id}
      className={`${s.block} ${isDragging ? s.blockDragging : ''}`}
      style={{
        background: subject?.color,
        height: block.duration * ROW_H - 4,
      }}
      {...listeners}
      {...attributes}
    >
      <span className={s.blockSubject}>{subject?.name}</span>
      {block.duration > 1 && (
        <span className={s.blockMeta}>
          {studyType?.name}
          {block.topic ? ` · ${block.topic}` : ''}
        </span>
      )}
      <span className={s.blockTime}>{timeRange(block)}</span>
      <button
        type="button"
        className={s.blockRemove}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => onRemove(block.id)}
        aria-label={`${subject?.name} bloğunu kaldır`}
      >
        <X size={11} />
      </button>
    </div>
  );
}

function DraftBlock({ draft, subject }) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: 'draft',
    data: {
      kind: 'new',
      duration: draft.duration,
      subject: draft.subject,
      type: draft.type,
      topic: draft.topic,
    },
  });

  const studyType = STUDY_TYPES.find((t) => t.id === draft.type);

  return (
    <div
      ref={setNodeRef}
      data-draft-block
      className={s.preview}
      style={{ background: subject?.color }}
      {...listeners}
      {...attributes}
    >
      <span className={s.previewSubject}>{subject?.name}</span>
      <span className={s.previewMeta}>
        {studyType?.name}
        {draft.topic ? ` · ${draft.topic}` : ''} · {draft.duration} saat
      </span>
    </div>
  );
}
