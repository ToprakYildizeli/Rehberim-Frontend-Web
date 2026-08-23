import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable,
} from '@dnd-kit/core';
import { X, Trash2, RotateCcw, Bookmark, FolderOpen, Send, ChevronDown, Repeat } from 'lucide-react';
import {
  Card, Button, Field, Select, Input, PillGroup, Spinner, Modal,
} from '../components/ui';
import { listStudents } from '../api/students';
import { getSchedule, saveSchedule, setGeneralWindow } from '../api/schedule';
import {
  suggestNextWeekStart, getStudentPrograms, updateProgramWindow,
  windowDays, windowRangeText, studyHours, externalHours,
  addDays, DEFAULT_DAY_COUNT,
} from '../api/programs';
import {
  listTemplates, createTemplate, updateTemplate, deleteTemplate, templateToBlocks,
  assignBoard, assignTemplate, setRoutine, clearRoutine,
} from '../api/templates';
import {
  listSubjects, listTaskTypes, listTopics, listBooks,
  BLOCK_KINDS, EXAM_SCOPES, blockLabel, blockColor,
} from '../api/catalog';
import { HOURS } from '../mocks/data';
import s from './DersProgrami.module.css';

const ROW_H = 38;
const MODES = [
  { value: 'genel', label: 'Genel Program' },
  { value: 'ogrenci', label: 'Öğrenciye Özel' },
];
const CATEGORIES = [
  { value: 'tyt', label: 'TYT' },
  { value: 'ayt', label: 'AYT' },
];
/** Program uzunluğu seçenekleri (backend 1-31 kabul eder). */
const DAY_COUNTS = [3, 5, 7, 10, 14];

/** Backend hata gövdesinden ilk okunabilir mesajı çıkarır. */
function apiMessage(err, fallback) {
  const data = err?.response?.data;
  if (typeof data === 'string') return data;
  if (data && typeof data === 'object') {
    const first = Object.values(data)[0];
    if (Array.isArray(first) && first.length) return String(first[0]);
    if (typeof first === 'string') return first;
  }
  return fallback;
}

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

/** True when [start, start+duration) on `dayIndex` collides with an existing block.
 *  Dış meşguliyet blokları da sayılır — okuldayken çalışma bloğu konulamaz. */
function overlaps(blocks, dayIndex, start, duration, ignoreId) {
  return blocks.some(
    (b) =>
      b.id !== ignoreId &&
      b.dayIndex === dayIndex &&
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

  // Program penceresi: başlangıç günü + gün sayısı. Tahtanın sütunları budur.
  const [win, setWin] = useState({ startDate: null, dayCount: DEFAULT_DAY_COUNT });
  const [programId, setProgramId] = useState(null);
  const [windowError, setWindowError] = useState('');

  // Şablonlar + atama
  const [templates, setTemplates] = useState([]);
  const [assignSource, setAssignSource] = useState(null); // {type:'board'} | {type:'template',id,name}
  const [loadedTemplate, setLoadedTemplate] = useState(null); // {id,name} — düzenlenen şablon
  const [history, setHistory] = useState([]); // öğrencinin tüm programları (geçen hafta + toplam özeti)

  // Gerçek backend katalogları
  const [subjects, setSubjects] = useState([]);
  const [taskTypes, setTaskTypes] = useState([]);
  const [topics, setTopics] = useState([]);
  const [catalogError, setCatalogError] = useState(false);

  const [draft, setDraft] = useState({
    kind: 'study', examScope: 'tyt', externalTitle: '',
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
        kind: 'study',
        examScope: '',
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

  // Pencere daralınca dışarıda kalan gün seçimleri düşer.
  useEffect(() => {
    setDraft((d) =>
      d.days.some((i) => i >= win.dayCount)
        ? { ...d, days: d.days.filter((i) => i < win.dayCount) }
        : d
    );
  }, [win.dayCount]);

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
    setWindowError('');
    getSchedule(scope).then((d) => {
      if (!alive) return;
      setBlocks(d.blocks);
      setWin({ startDate: d.startDate, dayCount: d.dayCount });
      setProgramId(d.programId);
      lastWeek.current = d.blocks;
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
      saveSchedule(scope, next, win)
        .then((saved) => {
          if (!saved) return;
          // Öğrenci modunda ilk blokla birlikte program açılmış olabilir.
          if (scope && programId == null) getSchedule(scope).then((d) => setProgramId(d.programId));
          setBlocks(saved);                  // geçici id'ler → gerçek task id'leri
        })
        .catch(() => {});
    },
    [scope, win, programId]
  );

  /** Pencereyi değiştirir. Program varsa backend'e PATCH'lenir (örtüşme reddedilir). */
  const changeWindow = useCallback(
    async (patch) => {
      const next = { ...win, ...patch };
      setWindowError('');
      if (!scope) {
        setGeneralWindow(next);
        setWin(next);
        return;
      }
      if (programId == null) { setWin(next); return; }
      try {
        const saved = await updateProgramWindow(programId, next);
        setWin({ startDate: saved.start_date, dayCount: saved.day_count });
        const fresh = await getSchedule(scope);
        setBlocks(fresh.blocks);
      } catch (err) {
        setWindowError(apiMessage(err, 'Pencere değiştirilemedi.'));
      }
    },
    [win, scope, programId]
  );

  // Öğrenci geçmişi (alttaki özet çubuğu: geçen hafta + toplam)
  useEffect(() => {
    if (mode === 'ogrenci' && studentId) {
      getStudentPrograms(studentId).then(setHistory).catch(() => setHistory([]));
    } else {
      setHistory([]);
    }
  }, [mode, studentId]);

  // Şablonları yükle
  useEffect(() => { listTemplates().then(setTemplates).catch(() => {}); }, []);
  const reloadTemplates = () => listTemplates().then(setTemplates).catch(() => {});

  async function handleSaveTemplate() {
    // Bir şablon yüklüyse: aynı objeyi güncelle (adı korunur). İstersen yeni olarak da kaydet.
    if (loadedTemplate) {
      const update = window.confirm(
        `"${loadedTemplate.name}" şablonunu güncelle?\n(İptal: yeni şablon olarak kaydet)`
      );
      if (update) {
        try {
          await updateTemplate(loadedTemplate.id, loadedTemplate.name, blocks || [], win.startDate);
          await reloadTemplates();
          window.alert(`"${loadedTemplate.name}" güncellendi.`);
        } catch (err) {
          window.alert(apiMessage(err, 'Şablon güncellenemedi.'));
        }
        return;
      }
    }
    const name = window.prompt('Şablon adı (ör. "Sayısal 1 default"):');
    if (!name || !name.trim()) return;
    try {
      const created = await createTemplate(name.trim(), blocks || [], win.startDate);
      await reloadTemplates();
      setLoadedTemplate({ id: created.id, name: created.name });   // artık bu şablonu düzenliyoruz
      window.alert(`"${name.trim()}" şablonu kaydedildi.`);
    } catch (err) {
      window.alert(apiMessage(err, 'Şablon kaydedilemedi (aynı isim olabilir).'));
    }
  }

  function handleLoadTemplate(tpl) {
    // Şablon hafta gününe göre saklanır; pencereye düşmeyen günler atlanır.
    const { blocks: loaded, skipped } = templateToBlocks(tpl, win.startDate, win.dayCount);
    commit(loaded);                                      // tahtaya yükle (mode'a göre kaydedilir)
    setLoadedTemplate({ id: tpl.id, name: tpl.name });   // düzenlenen şablon = bu obje
    if (skipped > 0) {
      window.alert(
        `${skipped} blok bu ${win.dayCount} günlük pencereye düşmediği için yüklenmedi. `
        + 'Gün sayısını artırıp yeniden yükleyebilirsin.'
      );
    }
  }

  async function handleDeleteTemplate(id) {
    if (!window.confirm('Şablon silinsin mi?')) return;
    await deleteTemplate(id);
    if (loadedTemplate?.id === id) setLoadedTemplate(null);
    reloadTemplates();
  }

  /** Şablonu seçili öğrencinin rutini yapar / rutini kapatır.
   *  Hata TemplateMenu'de yakalanır (ör. öğrencinin zaten rutini varsa). */
  async function handleToggleRoutine(tpl) {
    if (tpl.auto_apply) {
      await clearRoutine(tpl.id);
    } else {
      if (!activeStudent) return;
      await setRoutine(tpl.id, activeStudent.id);
    }
    await reloadTemplates();
  }

  // Çalışma saati dış meşguliyetleri saymaz; onlar ayrı gösterilir.
  const totalHours = useMemo(() => studyHours(blocks ?? []), [blocks]);
  const outsideHours = useMemo(() => externalHours(blocks ?? []), [blocks]);
  const days = useMemo(
    () => (win.startDate ? windowDays(win.startDate, win.dayCount) : []),
    [win.startDate, win.dayCount]
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

    const [dayStr, hourStr] = String(over.id).split(':');
    const dayIndex = Number(dayStr);
    const start = Number(hourStr);
    const payload = active.data.current;
    const duration = payload.duration ?? 1;

    if (start + duration > HOURS[HOURS.length - 1] + 1) return;
    if (overlaps(blocks, dayIndex, start, duration, payload.blockId)) return;

    if (payload.dragKind === 'new') {
      commit([...blocks, { ...blockFromPayload(payload), id: `b${Date.now()}`, dayIndex, start, duration }]);
    } else {
      commit(blocks.map((b) => (b.id === payload.blockId ? { ...b, dayIndex, start } : b)));
    }
  }

  function removeBlock(id) {
    commit(blocks.filter((b) => b.id !== id));
  }

  function clearAll() {
    lastWeek.current = blocks;
    commit([]);
    setLoadedTemplate(null);   // boş board = artık bir şablon düzenlenmiyor
  }

  function loadLastWeek() {
    if (lastWeek.current) commit(lastWeek.current);
  }

  /** "Bu güne ekle": draft'ı seçili günlere ilk boş dilime bırakır. */
  function addToSelectedDays() {
    if (draft.days.length === 0 || !draftFields) return;
    const base = draftFields;
    let next = [...blocks];
    draft.days.forEach((dayIndex) => {
      const slot = HOURS.find(
        (h) =>
          h + draft.duration <= HOURS[HOURS.length - 1] + 1 &&
          !overlaps(next, dayIndex, h, draft.duration)
      );
      if (slot === undefined) return;
      next = [
        ...next,
        { ...base, id: `b${Date.now()}-${dayIndex}`, dayIndex, start: slot, duration: draft.duration },
      ];
    });
    commit(next);
    setDraft((d) => ({ ...d, days: [] }));
  }

  function switchMode(next) {
    setMode(next);
    setLoadedTemplate(null);   // mod değişince şablon düzenleme bağlamı biter
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
  // Kitap yalnız çalışma bloğunda anlamlı; dış/deneme bloklarında kaynak kitap yok.
  const isBookMode = draft.kind === 'study' && draft.category === 'kitap';
  const isExternal = draft.kind === 'external';
  const isGeneralExam = draft.kind === 'exam' && Boolean(draft.examScope);
  // Ders/metod/konu alanları: dış blokta ve genel denemede gösterilmez.
  const showSubjectFields = !isExternal && !isGeneralExam;

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
          {loadedTemplate && (
            <span className={s.tplBadge} title="Şablon Kaydet bu şablonu günceller">
              <Bookmark size={12} /> {loadedTemplate.name}
              <button type="button" className={s.tplBadgeX} onClick={() => setLoadedTemplate(null)} aria-label="Şablon bağını kaldır">
                <X size={11} />
              </button>
            </span>
          )}
        </div>

        <div className={s.toolbarRight}>
          <span className={s.totalPill}>
            Çalışma: {totalHours} saat
            {outsideHours > 0 && <span className={s.totalOutside}> · +{outsideHours} dış</span>}
          </span>
          <Button variant="soft" size="sm" onClick={handleSaveTemplate} title="Bu programı isimli şablon olarak kaydet">
            <Bookmark size={13} /> Şablon Kaydet
          </Button>
          <TemplateMenu
            templates={templates}
            activeStudent={activeStudent}
            onLoad={handleLoadTemplate}
            onAssign={(tpl) => setAssignSource({ type: 'template', id: tpl.id, name: tpl.name })}
            onDelete={handleDeleteTemplate}
            onToggleRoutine={handleToggleRoutine}
          />
          <Button variant="primary" size="sm" onClick={() => setAssignSource({ type: 'board' })}>
            <Send size={13} /> Ata
          </Button>
          {mode === 'ogrenci' && (
            <Button variant="ghost" size="sm" onClick={loadLastWeek} title="Geçen haftanın programını yükle">
              <RotateCcw size={13} /> Geçen Hafta
            </Button>
          )}
          <Button variant="danger" size="sm" onClick={clearAll} title="Tümünü temizle">
            <Trash2 size={13} /> Temizle
          </Button>
        </div>
      </div>

      {win.startDate && (
        <div className={s.windowBar}>
          <Field label="Başlangıç" className={s.windowField}>
            <Input
              type="date"
              value={win.startDate}
              onChange={(e) => e.target.value && changeWindow({ startDate: e.target.value })}
            />
          </Field>
          <Field label="Gün sayısı" className={s.windowField}>
            <Select
              value={win.dayCount}
              onChange={(e) => changeWindow({ dayCount: Number(e.target.value) })}
            >
              {DAY_COUNTS.map((n) => <option key={n} value={n}>{n} gün</option>)}
              {!DAY_COUNTS.includes(win.dayCount) && (
                <option value={win.dayCount}>{win.dayCount} gün</option>
              )}
            </Select>
          </Field>
          <span className={s.windowRange}>
            {windowRangeText(win.startDate, win.dayCount)}
            <span className={s.windowRangeSub}>
              {programId != null
                ? 'Bu programın penceresi — değiştirince kaydedilir'
                : 'Atamadan önce serbestçe değiştirebilirsin'}
            </span>
          </span>
          {mode === 'ogrenci' && activeStudent && (
            <span className={s.windowStudent}>{activeStudent.name}</span>
          )}
        </div>
      )}
      {windowError && <p className={s.windowError}>{windowError}</p>}

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
              <div className={s.grid} style={{ '--cols': days.length }}>
                <span className={s.corner} />
                {days.map((d) => (
                  <span className={s.dayHead} key={d.index}>
                    {d.short}
                    <span className={s.dayHeadDate}>{d.dayNum} {d.monthShort}</span>
                  </span>
                ))}

                {HOURS.map((hour) => (
                  <Row key={hour} hour={hour} days={days} blocks={blocks} onRemove={removeBlock} />
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
                    <Field label="Blok Türü">
                      <PillGroup
                        className={s.catToggle}
                        options={BLOCK_KINDS}
                        value={draft.kind}
                        onChange={(val) =>
                          setDraft((d) => ({
                            ...d,
                            kind: val,
                            // Denemeye geçince varsayılan genel TYT; çalışmaya dönünce kapsam düşer.
                            examScope: val === 'exam' ? (d.examScope || 'tyt') : '',
                            // Dış/deneme bloğunda kitap kaynağı yok.
                            category: val === 'study' ? d.category : 'tyt',
                            book: val === 'study' ? d.book : '',
                          }))
                        }
                      />
                    </Field>

                    {isExternal && (
                      <Field label="Ad">
                        <Input
                          value={draft.externalTitle}
                          placeholder="Okul, antrenman, doktor…"
                          onChange={(e) => setDraft((d) => ({ ...d, externalTitle: e.target.value }))}
                        />
                      </Field>
                    )}

                    {draft.kind === 'exam' && (
                      <Field label="Deneme Kapsamı">
                        <Select
                          value={draft.examScope}
                          onChange={(e) => setDraft((d) => ({ ...d, examScope: e.target.value }))}
                        >
                          {EXAM_SCOPES.map((x) => (
                            <option value={x.value} key={x.value}>{x.label}</option>
                          ))}
                          <option value="">Ders bazlı deneme…</option>
                        </Select>
                      </Field>
                    )}

                    {showSubjectFields && (
                    <>
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
                    <p className={s.previewHint}>
                      {isExternal
                        ? 'Dış meşguliyet bloğu için bir ad girin.'
                        : 'Önce bu öğrencinin kütüphanesinden bir kitap seçin.'}
                    </p>
                  )}

                  <div
                    className={s.dayPills}
                    style={{ '--cols': days.length, marginTop: 'var(--space-3)' }}
                  >
                    {days.map((d) => (
                      <button
                        key={d.index}
                        type="button"
                        className={`${s.dayPill} ${draft.days.includes(d.index) ? s.dayPillActive : ''}`}
                        title={`${d.dayNum} ${d.monthShort}`}
                        onClick={() =>
                          setDraft((prev) => ({
                            ...prev,
                            days: prev.days.includes(d.index)
                              ? prev.days.filter((x) => x !== d.index)
                              : [...prev.days, d.index],
                          }))
                        }
                        aria-pressed={draft.days.includes(d.index)}
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

            </Card>
            </div>
          </div>

          <SummaryBar
            current={blocks}
            history={history}
            subjectMap={subjectMap}
            inStudent={mode === 'ogrenci'}
          />

          <DragOverlay dropAnimation={null}>
            {activeDrag && (
              <div className={s.overlayBlock} style={{ background: activeDrag.subjectColor }}>
                {activeDrag.subjectLabel}
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {assignSource && (
        <AssignModal
          source={assignSource}
          students={students}
          defaultStudentId={mode === 'ogrenci' ? studentId : ''}
          blocks={blocks || []}
          boardStart={win.startDate}
          boardDayCount={win.dayCount}
          onClose={() => setAssignSource(null)}
        />
      )}
    </div>
  );
}

/** Kayıtlı şablonlar dropdown'ı — yükle / ata / sil. */
function TemplateMenu({ templates, activeStudent, onLoad, onAssign, onDelete, onToggleRoutine }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  useEffect(() => { if (!open) setError(''); }, [open]);

  async function toggleRoutine(tpl) {
    setError('');
    try {
      await onToggleRoutine(tpl);
    } catch (err) {
      const data = err?.response?.data;
      const first = data && typeof data === 'object' ? Object.values(data)[0] : null;
      setError(Array.isArray(first) ? first[0] : 'Rutin ayarlanamadı.');
    }
  }

  return (
    <div className={s.tplMenu} ref={ref}>
      <Button variant="soft" size="sm" onClick={() => setOpen((o) => !o)}>
        <FolderOpen size={13} /> Şablonlar <ChevronDown size={12} />
      </Button>
      {open && (
        <div className={s.tplList} role="menu">
          {templates.length === 0 ? (
            <p className={s.tplEmpty}>Kayıtlı şablon yok.</p>
          ) : templates.map((tpl) => {
            const isRoutine = tpl.auto_apply;
            // Rutin bir öğrenciye bağlanır; kapatmak için seçim gerekmez.
            const canToggle = isRoutine || Boolean(activeStudent);
            const title = isRoutine
              ? `${tpl.student_name} rutini — kapatmak için tıkla`
              : activeStudent
                ? `${activeStudent.name} için rutin yap`
                : 'Rutin yapmak için önce bir öğrenci seç';
            return (
              <div className={s.tplItem} key={tpl.id}>
                <span className={s.tplNameWrap}>
                  <span className={s.tplName} title={tpl.name}>{tpl.name}</span>
                  {isRoutine && <span className={s.tplRoutineTag}>{tpl.student_name} rutini</span>}
                </span>
                <span className={s.tplActions}>
                  <button
                    type="button"
                    className={isRoutine ? s.tplRoutineOn : s.tplBtn}
                    disabled={!canToggle}
                    title={title}
                    aria-pressed={isRoutine}
                    onClick={() => toggleRoutine(tpl)}
                  >
                    <Repeat size={12} />
                  </button>
                  <button type="button" className={s.tplBtn} onClick={() => { onLoad(tpl); setOpen(false); }}>Yükle</button>
                  <button type="button" className={s.tplBtn} onClick={() => { onAssign(tpl); setOpen(false); }}>Ata</button>
                  <button type="button" className={s.tplDel} onClick={() => onDelete(tpl.id)} aria-label="Sil"><X size={12} /></button>
                </span>
              </div>
            );
          })}
          {error && <p className={s.tplError}>{error}</p>}
          <p className={s.tplHint}>
            <Repeat size={11} /> Rutin: yeni hafta açıldığında görevler o haftaya kendiliğinden düşer.
          </p>
        </div>
      )}
    </div>
  );
}

/** Atama modalı — öğrenci + pencere (başlangıç + gün sayısı) seçilir. */
function AssignModal({ source, students, defaultStudentId, blocks, boardStart, boardDayCount, onClose }) {
  const [studentId, setStudentId] = useState(defaultStudentId || String(students[0]?.id || ''));
  const [date, setDate] = useState('');
  const [dayCount, setDayCount] = useState(boardDayCount || DEFAULT_DAY_COUNT);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!studentId) return undefined;
    let alive = true;
    suggestNextWeekStart(studentId).then((d) => { if (alive) setDate(d); }).catch(() => {});
    return () => { alive = false; };
  }, [studentId]);

  async function confirm() {
    if (!studentId) return;
    setBusy(true); setError('');
    const win = { startDate: date || undefined, dayCount };
    try {
      const prog = source.type === 'template'
        ? await assignTemplate(source.id, studentId, win)
        : await assignBoard(studentId, blocks, boardStart, win);
      setResult(prog);
    } catch (err) {
      setError(apiMessage(err, 'Atama başarısız oldu.'));
    } finally {
      setBusy(false);
    }
  }

  const title = source.type === 'template' ? `Şablonu ata: ${source.name}` : 'Programı ata';
  const noBoard = source.type === 'board' && blocks.length === 0;

  return (
    <Modal open onClose={onClose} width={430} labelledBy="assign-title">
      <h2 id="assign-title" className={s.modalTitle}>{title}</h2>
      {result ? (
        <div className={s.assignForm}>
          <p><strong>{result.student_name}</strong> için program atandı.</p>
          <p className={s.assignWeek}>
            {result.start_date} – {result.end_date} ({result.day_count} gün) · {result.tasks?.length || 0} görev
          </p>
          <Button block onClick={onClose}>Kapat</Button>
        </div>
      ) : (
        <div className={s.assignForm}>
          <Field label="Öğrenci">
            <Select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
              {students.map((st) => <option key={st.id} value={st.id}>{st.name} · {st.grade}</option>)}
            </Select>
          </Field>
          <div className={s.assignWindow}>
            <Field label="Başlangıç (görüşme günü)">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Gün sayısı">
              <Select value={dayCount} onChange={(e) => setDayCount(Number(e.target.value))}>
                {DAY_COUNTS.map((n) => <option key={n} value={n}>{n} gün</option>)}
              </Select>
            </Field>
          </div>
          <p className={s.assignHint}>
            {date
              ? `Bitiş: ${addDays(date, dayCount - 1)}. `
              : ''}
            Program atanmamış ilk gün önerildi; dilersen değiştir. Aralık öğrencinin
            mevcut bir programıyla çakışamaz.
          </p>
          {noBoard && <p className={s.assignHint}>Board boş — önce blok ekleyin.</p>}
          {error && <p className={s.assignError}>{error}</p>}
          <div className={s.assignActions}>
            <Button variant="ghost" onClick={onClose}>Vazgeç</Button>
            <Button onClick={confirm} disabled={busy || !studentId || noBoard}>
              {busy ? 'Atanıyor…' : 'Ata'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/** Bloklardan saat ağırlığı özeti üretir (toplam, TYT/AYT %, ders donut'u).
 *  Dış meşguliyet blokları çalışma saati olmadığı için tamamen dışarıda bırakılır;
 *  genel denemeler kapsamlarına (TYT/AYT) sayılır. */
function computeWeights(allBlocks, subjectMap) {
  const blocks = (allBlocks || []).filter((b) => b.kind !== 'external');
  const total = blocks.reduce((sum, b) => sum + b.duration, 0);
  const cat = { tyt: 0, ayt: 0 };
  const bySub = {};
  blocks.forEach((b) => {
    const c = b.examScope || subjectMap[String(b.subject)]?.category;
    if (c === 'tyt' || c === 'ayt') cat[c] += b.duration;
    const label = blockLabel(b);
    if (!bySub[label]) bySub[label] = { hours: 0, color: b.subjectColor };
    bySub[label].hours += b.duration;
  });
  const examTotal = cat.tyt + cat.ayt;
  const tytPct = examTotal ? Math.round((cat.tyt / examTotal) * 100) : 0;
  const aytPct = examTotal ? 100 - tytPct : 0;

  let subs = Object.entries(bySub)
    .map(([label, v]) => ({ label, hours: v.hours, color: v.color }))
    .sort((a, b) => b.hours - a.hours);
  const MAX = 5;
  if (subs.length > MAX) {
    const rest = subs.slice(MAX).reduce((sum, x) => sum + x.hours, 0);
    subs = [...subs.slice(0, MAX), { label: 'Diğer', hours: rest, color: 'var(--subj-genel)' }];
  }
  let acc = 0;
  const stops = subs.map((x) => {
    const start = total ? (acc / total) * 100 : 0;
    acc += x.hours;
    const end = total ? (acc / total) * 100 : 0;
    return `${x.color} ${start}% ${end}%`;
  });
  return { total, tytPct, aytPct, subs, pieStyle: { background: `conic-gradient(${stops.join(', ')})` } };
}

/** Alttaki yatay özet çubuğunun tek sütunu (geçen hafta / şu anki / toplam). */
function SummaryColumn({ title, blocks, subjectMap, accent }) {
  const w = computeWeights(blocks, subjectMap);
  const pctOf = (h) => (w.total ? Math.round((h / w.total) * 100) : 0);
  return (
    <div className={`${s.sumCol} ${accent ? s.sumColActive : ''}`}>
      <span className={s.sumTitle}>{title}</span>
      {w.total === 0 ? (
        <span className={s.sumEmpty}>Kayıt yok</span>
      ) : (
        <div className={s.sumBody}>
          <div className={s.sumPie} style={w.pieStyle}><div className={s.sumPieHole} /></div>
          <div className={s.sumInfo}>
            <span className={s.sumTotal}>{w.total} saat</span>
            <div className={s.split}>
              {w.tytPct > 0 && <div className={s.splitSeg} style={{ width: `${w.tytPct}%`, background: 'var(--accent)' }} />}
              {w.aytPct > 0 && <div className={s.splitSeg} style={{ width: `${w.aytPct}%`, background: 'var(--violet)' }} />}
            </div>
            <span className={s.sumSplitTxt}>TYT %{w.tytPct} · AYT %{w.aytPct}</span>
            <ul className={s.sumLegend}>
              {w.subs.slice(0, 4).map((x) => (
                <li className={s.sumLegItem} key={x.label}>
                  <span className={s.wDot} style={{ background: x.color }} />
                  <span className={s.sumLegName} title={x.label}>{x.label}</span>
                  <span className={s.sumLegPct}>%{pctOf(x.hours)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

/** Program ağırlığı — alt yatay çubuk: geçen hafta · şu anki plan · toplam. */
function SummaryBar({ current, history, subjectMap, inStudent }) {
  const curIdx = Math.max(0, history.findIndex((p) => p.isCurrent));
  const lastWeek = history[curIdx + 1] || null;
  const totalBlocks = history.flatMap((p) => p.blocks || []);

  if (!inStudent) {
    // Genel modda geçen hafta/toplam kavramı yok → yalnız şu anki plan.
    return (
      <div className={s.sumBar}>
        <SummaryColumn title="Bu Genel Plan" blocks={current || []} subjectMap={subjectMap} accent />
      </div>
    );
  }
  return (
    <div className={s.sumBar}>
      <SummaryColumn title="Geçen Hafta" blocks={lastWeek?.blocks || []} subjectMap={subjectMap} />
      <SummaryColumn title="Şu Anki Plan" blocks={current || []} subjectMap={subjectMap} accent />
      <SummaryColumn title="Toplam (tüm haftalar)" blocks={totalBlocks} subjectMap={subjectMap} />
    </div>
  );
}

/** Draft alanlarından bir bloğun denormalize gösterim alanlarını üretir.
 *  Blok türüne göre şekil değişir: dış blokta yalnız ad, genel denemede kapsam. */
function draftBlockFields(draft, subjectMap, taskTypeMap) {
  if (draft.kind === 'external') {
    const title = draft.externalTitle.trim();
    if (!title) return null;                       // dış blokta ad zorunlu
    const b = { kind: 'external', examScope: '', subject: '', subjectLabel: null,
      type: '', typeName: null, topic: title, book: null, bookLabel: null };
    return { ...b, subjectColor: blockColor(b) };
  }
  const isGeneralExam = draft.kind === 'exam' && draft.examScope;
  const sub = isGeneralExam ? null : subjectMap[draft.subject];
  const tt = taskTypeMap[draft.type];
  const b = {
    kind: draft.kind,
    examScope: isGeneralExam ? draft.examScope : '',
    subject: isGeneralExam ? '' : draft.subject,
    subjectLabel: sub?.label,
    type: isGeneralExam ? '' : draft.type,
    typeName: isGeneralExam ? null : tt?.name,
    topic: isGeneralExam ? '' : draft.topic,
    book: null,
    bookLabel: null,
  };
  return { ...b, subjectColor: blockColor(b) };
}

/** Sürükleme payload'ından bloğun denormalize alanlarını çıkarır. */
function blockFromPayload(payload) {
  return {
    kind: payload.kind || 'study',
    examScope: payload.examScope || '',
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

function Row({ hour, days, blocks, onRemove }) {
  return (
    <>
      <span className={s.hourLabel}>{fmtHour(hour)}</span>
      {days.map((day) => (
        <Cell
          key={`${day.index}:${hour}`}
          day={day.index}
          hour={hour}
          block={blocks.find((b) => b.dayIndex === day.index && b.start === hour)}
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

/** Blok içeriğinin ikinci satırı: dış blokta yok, denemede kapsam, çalışmada kitap/metod. */
function blockMetaText(b) {
  if (b.kind === 'external') return 'Çalışma saatine sayılmaz';
  if (b.examScope) return 'Deneme';
  return `${b.bookLabel || b.typeName || ''}${b.topic ? ` · ${b.topic}` : ''}`;
}

function PlacedBlock({ block, onRemove }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: block.id,
    data: {
      dragKind: 'move',
      blockId: block.id,
      duration: block.duration,
      subjectLabel: blockLabel(block),
      subjectColor: block.subjectColor,
    },
  });
  const label = blockLabel(block);
  const meta = blockMetaText(block);

  return (
    <div
      ref={setNodeRef}
      data-block={block.id}
      className={`${s.block} ${isDragging ? s.blockDragging : ''} ${block.kind === 'external' ? s.blockExternal : ''}`}
      style={{
        background: block.subjectColor,
        height: block.duration * ROW_H - 4,
      }}
      {...listeners}
      {...attributes}
    >
      <span className={s.blockSubject}>
        {block.kind === 'external' ? '🚫 ' : block.book ? '📖 ' : ''}{label}
      </span>
      {block.duration > 1 && meta && <span className={s.blockMeta}>{meta}</span>}
      <span className={s.blockTime}>{timeRange(block)}</span>
      <button
        type="button"
        className={s.blockRemove}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => onRemove(block.id)}
        aria-label={`${label} bloğunu kaldır`}
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
    // `dragKind` sürükleme türü (yeni/taşı); `fields.kind` bloğun kendi türü.
    // subjectLabel sürükleme katmanının (DragOverlay) gösterdiği ad — dış blokta
    // ders olmadığı için blockLabel ile çözülür.
    data: { dragKind: 'new', duration, ...fields, subjectLabel: blockLabel(fields) },
  });
  const meta = blockMetaText(fields);

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
        {fields.kind === 'external' ? '🚫 ' : fields.book ? '📖 ' : ''}{blockLabel(fields)}
      </span>
      <span className={s.previewMeta}>
        {meta ? `${meta} · ` : ''}{duration} saat
      </span>
    </div>
  );
}
