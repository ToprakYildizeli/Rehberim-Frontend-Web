import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable,
} from '@dnd-kit/core';
import { X, Trash2, RotateCcw, Bookmark, FolderOpen, Send, ChevronDown, Repeat, Pencil, Printer, StickyNote } from 'lucide-react';
import {
  Card, Button, Field, Select, Input, Textarea, NumberInput, PillGroup, Spinner, Modal,
} from '../components/ui';
import DateField from '../components/ui/DateField';
import StudentPicker from '../components/ui/StudentPicker';
import { listStudents } from '../api/students';
import { getSchedule, saveSchedule, setGeneralWindow } from '../api/schedule';
import {
  getStudentPrograms, updateProgramWindow, listProgramRanges, openStudentProgram,
  forgetStudentProgram, deleteProgram, windowDays, windowRangeText, studyMinutes, externalMinutes,
  addDays, fmtMin, fmtHours, SLOT_MIN, DEFAULT_DAY_COUNT, programDefaults, today,
} from '../api/programs';
import {
  listTemplates, createTemplate, updateTemplate, deleteTemplate, templateToBlocks,
  assignBoard, assignTemplate, setRoutine, clearRoutine,
} from '../api/templates';
import {
  listSubjects, listFieldSubjects, listTaskTypes, listTopics, listBooks,
  loadDurationMemory, durationKey,
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
/** Program uzunluğu: en az 1, en çok 7 gün. */
const MIN_DAYS = 1;
const MAX_DAYS = 7;
/** Tahta düzeni: satırlar saat ya da ders (yol haritası A2). */
const VIEWS = [
  { value: 'hours', label: 'Saat satırlı' },
  { value: 'subjects', label: 'Ders satırlı' },
];
const cx = (...parts) => parts.filter(Boolean).join(' ');

const MIN_DURATION = 5;
const MAX_DURATION = 12 * 60;
/* Yönerge bir cümle olsun diye sınırlı: bloğa sığmayan bir metin tahtayı
   okunmaz hâle getiriyor. Backend'de `TextField`, yani sınır yalnız burada. */
const NOTE_MAX = 280;

/* Ders satırı tercihleri yalnız bir görünüm ayarı; sunucuya yazılmıyor (yol
   haritası A2 kararı), ama her açılışta sıfırlanmasın diye tarayıcıda saklanıyor. */
function readRowPrefs(key) {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeRowPrefs(key, rows) {
  try {
    window.localStorage.setItem(key, JSON.stringify(rows));
  } catch {
    /* kota dolu / gizli mod — tercih kaydedilmez, akış bozulmaz */
  }
}

function clearRowPrefs(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* yok sayılabilir */
  }
}

/** Bir başlangıç tarihinin seçilemez olup olmadığını söyleyen fonksiyon üretir.
 *
 *  Programlar örtüşemediğinden, `dayCount` günlük pencere mevcut bir programın
 *  aralığına değiyorsa o başlangıç kapalıdır. Kapalı günler dağınık aralıklar
 *  hâlinde olduğu için native date girdisinin min/max'ı yetmiyor. */
function makeStartBlocker(busyRanges, dayCount) {
  if (!busyRanges.length) return undefined;
  return (iso) => {
    const end = addDays(iso, Math.max(1, dayCount) - 1);
    return busyRanges.some((r) => iso <= r.end && r.start <= end);
  };
}

/** `from`dan itibaren `dayCount` günlük pencerenin hiçbir programla çakışmadığı
 *  ilk başlangıç günü. */
function firstFreeStart(ranges, dayCount, from = today()) {
  const blocked = makeStartBlocker(ranges, dayCount);
  let d = from;
  for (let i = 0; blocked && i < 730 && blocked(d); i += 1) d = addDays(d, 1);
  return d;
}

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
const timeRange = (b) => `${fmtMin(b.startMin)}-${fmtMin(b.startMin + b.durationMin)}`;

/** Tahtanın son dakikası (son saat satırının sonu) — bloklar bunu aşamaz. */
const BOARD_END_MIN = (HOURS[HOURS.length - 1] + 1) * 60;
const BOARD_START_MIN = HOURS[0] * 60;

/** True when [start, start+duration) on `dayIndex` collides with an existing block.
 *  Dış meşguliyet blokları da sayılır — okuldayken çalışma bloğu konulamaz. */
function overlaps(blocks, dayIndex, startMin, durationMin, ignoreId) {
  return blocks.some(
    (b) =>
      b.id !== ignoreId &&
      b.dayIndex === dayIndex &&
      startMin < b.startMin + b.durationMin &&
      b.startMin < startMin + durationMin
  );
}

/** Verilen günde bloğun sığacağı ilk boş başlangıç (yoksa null).
 *
 *  Adaylar: 15 dk'lık ızgara **artı mevcut blokların bitiş saatleri**. Bitişler de
 *  aday olmasa 20 dk'lık bloklar ızgaraya oturmak zorunda kalır ve aralarında
 *  gereksiz boşluk kalırdı (09:00, 09:30, 10:00 yerine 09:00, 09:20, 09:40). */
function firstFreeSlot(blocks, dayIndex, durationMin, ignoreId) {
  const sameDay = blocks.filter((b) => b.dayIndex === dayIndex && b.id !== ignoreId);
  const candidates = new Set();
  for (let t = BOARD_START_MIN; t + durationMin <= BOARD_END_MIN; t += SLOT_MIN) {
    candidates.add(t);
  }
  sameDay.forEach((b) => {
    const end = b.startMin + b.durationMin;
    if (end >= BOARD_START_MIN && end + durationMin <= BOARD_END_MIN) candidates.add(end);
  });
  const sorted = [...candidates].sort((a, b) => a - b);
  return sorted.find((t) => !overlaps(sameDay, dayIndex, t, durationMin)) ?? null;
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
  // Ders satırlı görünümde sürüklerken üstünde durulan gün sütunu (tümü vurgulanır).
  const [overDay, setOverDay] = useState(null);
  // Ders satırlı görünümde tıklanan hücre: { dayIndex, rowKey } → düzenleme penceresi.
  const [cellEdit, setCellEdit] = useState(null);
  // Sürükleme bitince bırakılan hücreye "tıklama" da düşer; o tıklama pencere açmasın.
  const lastDragEnd = useRef(0);

  // Program penceresi: başlangıç günü + gün sayısı. Tahtanın sütunları budur.
  const [win, setWin] = useState({ startDate: null, dayCount: DEFAULT_DAY_COUNT });
  /* Öğrenci modunda tahtada AÇIK olan program; `null` = yeni plan taslağı.
     Taslak hiçbir yere kaydedilmez, yalnız "Ata" ile yeni program olur. Mevcut
     bir programı düzenlemek için şeritteki program seçiminden açıkça seçilir
     (19 Eyl 2026). Eskiden öğrenci modu doğrudan güncel programı açıyor ve her
     değişikliği ona yazıyordu: rehber yeni hafta planladığını sanırken eski
     programı değiştiriyordu. */
  const [programId, setProgramId] = useState(null);
  const [windowError, setWindowError] = useState('');
  // Öğrencinin programlarının tarih aralıkları (dolu günler + program seçimi).
  const [ranges, setRanges] = useState([]);
  // Taslaktan bir programa geçip geri dönünce taslak kaybolmasın.
  const draftStore = useRef({ blocks: [], win: null });
  // "Programı sil" onay penceresi.
  const [deleteAsk, setDeleteAsk] = useState(false);
  const [deleting, setDeleting] = useState(false);
  /* Tema uyumlu onay penceresi (tarayıcının düz window.confirm kutusu yerine):
     `{ title, body, confirmLabel, danger, onConfirm }`. */
  const [confirmAsk, setConfirmAsk] = useState(null);

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
  // Süre hafızası (A4): durationKey(ders, metod, konu) → dakika. Rehber özelinde.
  const [durationMemory, setDurationMemory] = useState(() => new Map());

  // Tahta düzeni artık tercihlerden geliyor (13 Eyl 2026): rehber her cihazda
  // yeniden seçmesin. Sayfada değiştirmek yine serbest, o oturumluk kalır.
  const [view, setView] = useState('hours');
  const [draft, setDraft] = useState({
    kind: 'study', examScope: 'tyt', externalTitle: '',
    category: 'tyt', subject: '', type: '', topic: '', book: '',
    note: '', durationMin: 60, days: [],
  });

  /* Yerleştirilmiş bir bloğun yönergesini düzenleme kipi: `{ id, text }`.
     Blok listesine ancak kaydedilince dokunuluyor — her tuşta `commit`
     çağırmak tahtayı ve kaydetme kuyruğunu gereksiz yere döverdi. */
  const [noteEdit, setNoteEdit] = useState(null);

  const scope = mode === 'ogrenci' && studentId ? studentId : null;

  const subjectMap = useMemo(
    () => Object.fromEntries(subjects.map((x) => [String(x.id), x])),
    [subjects]
  );
  const taskTypeMap = useMemo(
    () => Object.fromEntries(taskTypes.map((x) => [String(x.id), x])),
    [taskTypes]
  );
  /* Bileşeni olan sınav bölümleri ("TYT Fen Bilimleri" gibi). Bunlar deneme
   * için anlamlı, çalışma için değil: öğrenci Fizik çalışır, "Fen Bilimleri"
   * çalışmaz. Bileşeni olmayan bölüm (TYT Türkçe zaten tam bir bölüm) normal
   * bir derstir, süzülmez. */
  const aggregateSectionIds = useMemo(() => {
    const keysWithMembers = new Set(
      subjects.filter((x) => !x.isSection && x.sectionKey).map((x) => x.sectionKey)
    );
    return new Set(
      subjects.filter((x) => x.isSection && keysWithMembers.has(x.sectionKey)).map((x) => x.id)
    );
  }, [subjects]);

  /* Sadece seçili sınav (TYT/AYT) dersleri; okul dersleri gösterilmez.
   * Deneme bloğunda bölümler de listelenir — rehber "TYT Fen denemesi"
   * yazdırabilsin diye. Çalışma bloğunda listelenmez. */
  const filteredSubjects = useMemo(
    () => subjects.filter(
      (x) => x.category === draft.category
        && (draft.kind === 'exam' || !aggregateSectionIds.has(x.id))
    ),
    [subjects, draft.category, draft.kind, aggregateSectionIds]
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
    Promise.all([
      listSubjects(), listTaskTypes(), listStudents(),
      // Hafıza olmaması normal (ilk kullanım) — katalog yüklemesini düşürmesin.
      loadDurationMemory().catch(() => new Map()),
    ]).then(
      ([subs, types, sts, memory]) => {
        if (!alive) return;
        setSubjects(subs);
        setTaskTypes(types);
        setStudents(sts);
        setDurationMemory(memory);
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
    setProgramId(null);
    draftStore.current = { blocks: [], win: null };
    if (!scope) {
      setRanges([]);
      setLibrary([]);
      getSchedule(null).then((d) => {
        if (!alive) return;
        setBlocks(d.blocks);
        setWin({ startDate: d.startDate, dayCount: d.dayCount });
      });
      return () => { alive = false; };
    }
    // Öğrenci modu: taslakla açılır, pencere ilk boş günden başlar. Öğrencinin
    // rutini varsa taslak onun görevleriyle dolu gelir (19 Eyl 2026 kararı):
    // rutin "her hafta buradan başla" demek, rehber üstünde oynayıp Ata der.
    forgetStudentProgram(scope);
    Promise.all([
      listProgramRanges(scope),
      programDefaults(),
      listTemplates().catch(() => []),
    ])
      .then(([r, defaults, tpls]) => {
        if (!alive) return;
        const dayCount = defaults.dayCount || DEFAULT_DAY_COUNT;
        const startDate = firstFreeStart(r, dayCount);
        const routine = tpls.find((t) => t.auto_apply && String(t.student) === String(scope));
        setRanges(r);
        setWin({ startDate, dayCount });
        setBlocks(routine ? templateToBlocks(routine, startDate, dayCount).blocks : []);
      })
      .catch(() => {
        if (!alive) return;
        setWin({ startDate: today(), dayCount: DEFAULT_DAY_COUNT });
        setBlocks([]);
      });
    listBooks(scope).then((d) => { if (alive) setLibrary(d); });
    return () => { alive = false; };
  }, [scope]);

  /** Öğrencinin program listesi değişince (atama, taşıma) dolu günler ve özet. */
  const refreshStudentData = useCallback(() => {
    if (!scope) return;
    listProgramRanges(scope).then(setRanges).catch(() => {});
    getStudentPrograms(scope).then(setHistory).catch(() => {});
  }, [scope]);

  /** Öğrenci modunda tahtayı sunucudaki gerçek hâline getirir.
   *  Tahtanın dışında (atama penceresinden) program değişince ya da bir kayıt
   *  reddedilince çağrılır; aksi hâlde tahta sunucuda olmayan bir şeyi gösterir. */
  const reloadBoard = useCallback(async () => {
    if (!scope) return;
    if (programId != null) {
      try {
        const d = await openStudentProgram(scope, programId);
        setBlocks(d.blocks);
        setWin({ startDate: d.startDate, dayCount: d.dayCount });
      } catch {
        /* tahta olduğu gibi kalır; hata mesajı zaten gösteriliyor */
      }
    }
    refreshStudentData();
  }, [scope, programId, refreshStudentData]);

  const commit = useCallback(
    (raw) => {
      // Ders satırlı görünümde satır değiştirmek bloğun türünü de değiştirebilir;
      // dış bloğun adı boş kalmasın (backend başlık ister).
      const next = raw.map(ensureBlockValid);
      setBlocks(next);                       // iyimser güncelleme
      // Öğrenci taslağı kaydedilmez; program yalnız "Ata" ile oluşur.
      if (scope && programId == null) return;
      saveSchedule(scope, next, win)
        .then((saved) => {
          if (!saved) return;
          setBlocks(saved);                  // geçici id'ler → gerçek task id'leri
          // Backend blok kaydedilirken süre hafızasını günceller; yerel kopyayı tazele.
          loadDurationMemory().then(setDurationMemory).catch(() => {});
        })
        .catch((err) => {
          // Eskiden sessizce yutuluyordu: blok tahtada kalıyor ama sunucuya hiç
          // gitmiyordu (ör. program oluşturma örtüşmeden 400). Rehber kaydettiğini
          // sanıyordu, öğrenci hiçbir şey görmüyordu. Artık hata gösteriliyor ve
          // tahta sunucudaki gerçek hâline dönüyor.
          setWindowError(apiMessage(err, 'Değişiklik kaydedilemedi.'));
          reloadBoard();
        });
    },
    [scope, win, programId, reloadBoard]
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
      if (programId == null) { setWin(next); return; }   // taslak: yalnız yerel
      try {
        await updateProgramWindow(programId, next);
        const d = await openStudentProgram(scope, programId);
        setWin({ startDate: d.startDate, dayCount: d.dayCount });
        setBlocks(d.blocks);
        refreshStudentData();
      } catch (err) {
        setWindowError(apiMessage(err, 'Pencere değiştirilemedi.'));
      }
    },
    [win, scope, programId, refreshStudentData]
  );

  /** Açık programı siler (ör. hatalı atamayla boş kalmış hafta) ve taslağa döner.
   *  Yalnız onay penceresinden çağrılır. */
  async function removeOpenProgram() {
    if (!scope || programId == null) return;
    setDeleting(true);
    try {
      await deleteProgram(programId);
      refreshStudentData();
      setDeleteAsk(false);
      await selectProgram('');
    } catch (err) {
      setDeleteAsk(false);
      setWindowError(apiMessage(err, 'Program silinemedi.'));
    } finally {
      setDeleting(false);
    }
  }

  /** Şerit: taslak ("") ya da düzenlenecek mevcut program. */
  async function selectProgram(id) {
    setWindowError('');
    if (!id) {
      forgetStudentProgram(scope);
      setProgramId(null);
      const saved = draftStore.current;
      setBlocks(saved.blocks || []);
      setWin(saved.win || { startDate: firstFreeStart(ranges, win.dayCount), dayCount: win.dayCount });
      return;
    }
    const r = ranges.find((x) => String(x.id) === String(id));
    if (r?.isApproved) return;   // listede zaten seçilemez
    const label = r ? windowRangeText(r.start, r.dayCount) : 'Seçilen';
    setConfirmAsk({
      title: 'Haftayı düzenle',
      body: <><strong>{label}</strong> haftasının programını düzenlemek istediğinize emin misiniz? Değişiklikler öğrenciye anında yansır.</>,
      confirmLabel: 'Düzenle',
      onConfirm: () => openProgram(id),
    });
  }

  async function openProgram(id) {
    if (programId == null) draftStore.current = { blocks: blocks || [], win };
    setBlocks(null);
    try {
      const d = await openStudentProgram(scope, id);
      setProgramId(Number(id));
      setBlocks(d.blocks);
      setWin({ startDate: d.startDate, dayCount: d.dayCount });
    } catch (err) {
      setWindowError(apiMessage(err, 'Program açılamadı.'));
      setProgramId(null);
      setBlocks(draftStore.current.blocks || []);
    }
  }

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

  /* Tahta düzeni tercihi (Ayarlar → Program varsayılanları). Bir kez, açılışta
     uygulanıyor: sonrasında sayfadaki düğmeyle değiştirmek serbest ve o
     değişiklik tercihi ezmez — geçici bir bakış için ayarlara gitmek gerekmesin. */
  useEffect(() => {
    let alive = true;
    programDefaults()
      .then(({ boardLayout }) => { if (alive && boardLayout) setView(boardLayout); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
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
      // Boş taslaktayken rutin açıldıysa hemen görünsün.
      if (mode === 'ogrenci' && programId == null && !(blocks || []).length) {
        setBlocks(templateToBlocks(tpl, win.startDate, win.dayCount).blocks);
      }
    }
    await reloadTemplates();
  }

  // Çalışma saati dış meşguliyetleri saymaz; onlar ayrı gösterilir.
  const totalMin = useMemo(() => studyMinutes(blocks ?? []), [blocks]);
  const outsideMin = useMemo(() => externalMinutes(blocks ?? []), [blocks]);
  const days = useMemo(
    () => (win.startDate ? windowDays(win.startDate, win.dayCount) : []),
    [win.startDate, win.dayCount]
  );

  // Öğrencinin dolu tarih aralıkları — düzenlenen programın kendisi hariç.
  // Programlar örtüşemediği için bu aralıklara denk gelen başlangıçlar seçilemez.
  const busyRanges = useMemo(
    () => ranges
      .filter((r) => r.id !== programId)
      .map((r) => ({ start: r.start, end: r.end })),
    [ranges, programId]
  );
  const isStartBlocked = useMemo(
    () => makeStartBlocker(busyRanges, win.dayCount),
    [busyRanges, win.dayCount]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  function handleDragStart(event) {
    setActiveDrag(event.active.data.current);
  }

  function handleDragOver(event) {
    const parts = event.over ? String(event.over.id).split(':') : [];
    setOverDay(parts[1] === 'row' ? Number(parts[0]) : null);
  }

  function handleDragEnd(event) {
    setActiveDrag(null);
    setOverDay(null);
    lastDragEnd.current = Date.now();
    const { active, over } = event;
    if (!over) return;

    const payload = active.data.current;
    const durationMin = payload.durationMin ?? 60;
    // Droppable id iki biçimde gelir:
    //   saat düzeni  → "gun:dakika"            (15 dk'lık dilim)
    //   ders düzeni  → "gun:row:<satır anahtarı>" (saat serbest → ilk boş dilim)
    const parts = String(over.id).split(':');
    const dayIndex = Number(parts[0]);

    let startMin;
    if (parts[1] === 'row') {
      // Ders düzeninde bırakma yeri GÜN SÜTUNU: hangi satırın üstüne
      // bırakılırsa bırakılsın blok o günün kendi ders satırına düşer (dersini
      // değiştirmek istenmiyor). Eskiden yalnız kendi satırı kabul ediliyordu,
      // yanlış satıra bırakınca hiçbir şey olmuyordu.
      startMin = firstFreeSlot(blocks, dayIndex, durationMin, payload.blockId);
      if (startMin === null) return;                       // o güne sığmıyor
    } else {
      startMin = Number(parts[1]);
    }

    if (startMin + durationMin > BOARD_END_MIN) return;
    if (overlaps(blocks, dayIndex, startMin, durationMin, payload.blockId)) return;

    if (payload.dragKind === 'new') {
      commit([...blocks, {
        ...blockFromPayload(payload), id: `b${Date.now()}`, dayIndex, startMin, durationMin,
      }]);
    } else {
      commit(blocks.map((b) => (b.id === payload.blockId ? { ...b, dayIndex, startMin } : b)));
    }
  }

  function openNote(id) {
    const block = blocks.find((b) => b.id === id);
    if (block) setNoteEdit({ id, text: block.note || '' });
  }

  function saveNote() {
    if (!noteEdit) return;
    const text = noteEdit.text.trim();
    commit(blocks.map((b) => (b.id === noteEdit.id ? { ...b, note: text } : b)));
    setNoteEdit(null);
  }

  function removeBlock(id) {
    commit(blocks.filter((b) => b.id !== id));
  }

  /** Hücre penceresindeki düzenlemeleri uygular. Süre uzayıp o günkü başka bir
   *  blokla çakışırsa blok günün ilk boş dilimine kayar; sığmazsa hata döner. */
  function saveCell(edits) {
    let next = blocks.map((b) => {
      const e = edits[b.id];
      if (!e) return b;
      const patch = { durationMin: e.durationMin, note: (e.note || '').trim() };
      if (b.kind === 'external') {
        patch.topic = (e.topic || '').trim() || 'Dış meşguliyet';
      } else if (b.kind === 'study') {
        const book = library.find((bk) => String(bk.id) === e.book);
        Object.assign(patch, {
          type: e.type,
          typeName: e.type ? taskTypeMap[e.type]?.name ?? b.typeName : null,
          topic: e.topic,
          book: e.book ? Number(e.book) : null,
          bookLabel: e.book ? (book?.label ?? b.bookLabel) : null,
        });
      }
      return { ...b, ...patch };
    });
    for (const id of Object.keys(edits)) {
      const b = next.find((x) => x.id === id);
      if (!b) continue;
      if (b.startMin + b.durationMin <= BOARD_END_MIN
        && !overlaps(next, b.dayIndex, b.startMin, b.durationMin, b.id)) continue;
      const slot = firstFreeSlot(next, b.dayIndex, b.durationMin, b.id);
      if (slot === null) return `${b.durationMin} dakikalık blok bu güne sığmıyor.`;
      next = next.map((x) => (x.id === id ? { ...x, startMin: slot } : x));
    }
    commit(next);
    return null;
  }

  function clearAll() {
    // Açık bir programda "Temizle" öğrencinin görevlerini siler; taslakta değil.
    const doClear = () => {
      commit([]);
      setLoadedTemplate(null);   // boş board = artık bir şablon düzenlenmiyor
    };
    if (scope && programId != null) {
      const r = ranges.find((x) => x.id === programId);
      const label = r ? windowRangeText(r.start, r.dayCount) : 'Bu';
      setConfirmAsk({
        title: 'Programı temizle',
        body: <><strong>{label}</strong> haftasındaki bütün görevler silinecek. Öğrenci bu görevleri artık göremeyecek.</>,
        confirmLabel: 'Evet, temizle',
        danger: true,
        onConfirm: doClear,
      });
      return;
    }
    doClear();
  }

  /** Tahtanın penceresinden önce başlayan en yakın programın bloklarını getirir.
   *  Bloklar kopya: görev kimlikleri atılır, tamamlanma sıfırlanır. */
  function loadLastWeek() {
    const candidates = history.filter((p) => p.id !== programId && p.blocks?.length);
    const prev = candidates.find((p) => p.startDate < win.startDate) || candidates[0];
    if (!prev) { setWindowError('Yüklenecek önceki program yok.'); return; }
    const stamp = Date.now();
    commit(prev.blocks.map((b, i) => ({
      ...b, id: `b${stamp}-${i}`, taskId: undefined, completion: 'none', isCompleted: false,
    })));
  }

  /** "Bu güne ekle": draft'ı seçili günlere ilk boş dilime bırakır. */
  function addToSelectedDays() {
    if (draft.days.length === 0 || !draftFields) return;
    const base = draftFields;
    let next = [...blocks];
    draft.days.forEach((dayIndex) => {
      const slot = firstFreeSlot(next, dayIndex, draft.durationMin);
      if (slot === null) return;
      next = [
        ...next,
        {
          ...base,
          id: `b${Date.now()}-${dayIndex}`,
          dayIndex,
          startMin: slot,
          durationMin: draft.durationMin,
        },
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

  // Kitap yalnız çalışma bloğunda anlamlı; dış/deneme bloklarında kaynak kitap yok.
  const isBookMode = draft.kind === 'study' && draft.category === 'kitap';
  const isExternal = draft.kind === 'external';
  const isExam = draft.kind === 'exam';
  const isGeneralExam = isExam && Boolean(draft.examScope);

  // Tür toggle: TYT/AYT her zaman; Kitap yalnız öğrenci modunda (kitap
  // öğrenciye bağlı) ve yalnız çalışma bloğunda — denemenin kaynak kitabı olmaz.
  const typeOptions = useMemo(
    () => (mode === 'ogrenci' && !isExam
      ? [...CATEGORIES, { value: 'kitap', label: 'Kitap' }]
      : CATEGORIES),
    [mode, isExam]
  );

  // Ders alanı: dış blokta ve genel denemede gösterilmez.
  const showSubjectFields = !isExternal && !isGeneralExam;
  /* Çalışma türü ve konu **denemede sorulmaz**: deneme kendi başına bir çalışma
     türüdür ve tek bir konusu yoktur, sınavın kapsadığı her şeyi içerir. */
  const showMethodFields = showSubjectFields && !isExam;

  /* Süre hafızası (A4): ders/metod/konu üçlüsü değişince, rehberin bu kombinasyonda
     en son kullandığı süre varsayılan olarak gelir — hafıza rehber özelinde olduğu
     için başka bir öğrencide de aynı süre açılır. Kombinasyon değişmedikçe tetiklenmez,
     böylece elle girilen süre ezilmez. Ders/metodu olmayan bloklarda (dış meşguliyet,
     genel deneme) hafıza yoktur. */
  useEffect(() => {
    if (!showSubjectFields) return;
    const remembered = durationMemory.get(
      durationKey(draft.subject, draft.type, draft.topic)
    );
    if (remembered) setDraft((d) => ({ ...d, durationMin: remembered }));
  }, [showSubjectFields, draft.subject, draft.type, draft.topic, durationMemory]);

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

  // Ders satırlı görünümün satırları. Kullanıcının yönettiği bir liste: varsayılanı
  // öğrencinin alanına düşen dersler (backend'den), üstüne ekleyip çıkarabiliyor.
  // Blok içeren satırlar listede olmasa da gösterilir — hiçbir blok gizlenmemeli.
  const [rowKeys, setRowKeys] = useState(null);
  const [rowsEditing, setRowsEditing] = useState(false);

  // Öğrenci (ya da genel mod) değişince varsayılan satırları kur. Kullanıcının
  // önceki düzenlemesi varsa localStorage'dan geri gelir; görünüm tercihi olduğu
  // için sunucuya yazılmıyor.
  useEffect(() => {
    let alive = true;
    const storeKey = `dp-rows-${scope || 'genel'}`;
    const saved = readRowPrefs(storeKey);
    if (saved) { setRowKeys(saved); return () => { alive = false; }; }
    setRowKeys(null);
    listFieldSubjects(scope || undefined)
      .then((subs) => { if (alive) setRowKeys(subs.map((x) => `sub-${x.id}`)); })
      .catch(() => { if (alive) setRowKeys([]); });
    return () => { alive = false; };
  }, [scope]);

  const setRows = useCallback((next) => {
    setRowKeys(next);
    writeRowPrefs(`dp-rows-${scope || 'genel'}`, next);
  }, [scope]);

  // Satır anahtarı → görünen ad/renk. Blok taşıyan satırlar için bloğun kendi
  // alanlarından, boş satırlar için ders kataloğundan çözülür.
  const rowInfo = useCallback((key) => {
    const withBlock = (blocks ?? []).find((b) => subjectRowKey(b) === key);
    if (withBlock) {
      return { key, label: subjectRowLabel(withBlock), color: withBlock.subjectColor,
        order: subjectRowOrder(withBlock) };
    }
    const fields = subjectRowFields(key, subjects);
    return { key, label: subjectRowLabel(fields), color: fields.subjectColor,
      order: subjectRowOrder(fields) };
  }, [blocks, subjects]);

  const subjectRows = useMemo(() => {
    const keys = new Set(rowKeys ?? []);
    // Blok taşıyan ve taslağın satırı her hâlükârda görünür.
    (blocks ?? []).forEach((b) => keys.add(subjectRowKey(b)));
    if (draftFields) keys.add(subjectRowKey(draftFields));
    return [...keys].map(rowInfo).sort(
      (a, b) => a.order - b.order || a.label.localeCompare(b.label, 'tr')
    );
  }, [rowKeys, blocks, draftFields, rowInfo]);

  // Henüz satırı olmayan, eklenebilir seçenekler.
  const addableRows = useMemo(() => {
    const shown = new Set(subjectRows.map((r) => r.key));
    const opts = subjects
      // Tahta satırları çalışma satırıdır; toplu bölümler satır olarak açılmaz.
      .filter((x) => !aggregateSectionIds.has(x.id))
      .map((x) => ({ key: `sub-${x.id}`, label: x.label }))
      .concat([
        { key: 'exam-tyt', label: 'Genel TYT' },
        { key: 'exam-ayt', label: 'Genel AYT' },
        { key: 'ext', label: 'Dış meşguliyet' },
      ]);
    return opts.filter((o) => !shown.has(o.key));
  }, [subjects, subjectRows, aggregateSectionIds]);

  /** Blok taşıyan satır silinemez — silinirse blokları görünmez olurdu. */
  const rowHasBlocks = useCallback(
    (key) => (blocks ?? []).some((b) => subjectRowKey(b) === key),
    [blocks]
  );

  /** Satırları öğrencinin alan listesine geri döndürür. */
  const resetRows = useCallback(() => {
    clearRowPrefs(`dp-rows-${scope || 'genel'}`);
    setRowKeys(null);
    listFieldSubjects(scope || undefined)
      .then((subs) => setRowKeys(subs.map((x) => `sub-${x.id}`)))
      .catch(() => setRowKeys([]));
  }, [scope]);

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
      <div className={s.screen}>
      {/* Tek şerit: mod, pencere ve eylemler ayrı satırlara bölünmüyor. Önce iki
          ayrı çubuktu (mod + pencere) ve ikisi birlikte 117px yer kaplayıp tahtayı
          ekrandan taşırıyordu. Gruplar arasına ince ayıraç konuyor; alan
          yetmezse şerit sarar. */}
      {/* Şerit iki AÇIK satır. Tek saran flex satırıyken eylemler alta düşüyor
          ve o satırın solu bomboş kalıyordu; ızgara denemesi ise ayarları
          547px'e sıkıştırıp üç satıra çıkardı. Burada her satırın iki ucu da
          dolu: solda bağlam, sağda o satırın çıktısı. */}
      {/* Şeridin tamamı baskıda düşer: öğrenci adı ve hafta aralığı
          tahtanın kendi baskı başlığında zaten yazıyor. */}
      <div data-print="hide" className={s.ribbon}>
        <div className={s.ribbonRow}>
          <div className={s.ribbonGroup}>
            <PillGroup options={MODES} value={mode} onChange={switchMode} />
            {mode === 'ogrenci' && (
              <StudentPicker
                className={s.studentSelect}
                students={students}
                value={studentId}
                onChange={(id) => {
                  setStudentId(id);
                  setParams({ ogrenci: id }, { replace: true });
                }}
                ariaLabel="Öğrenci seç"
              />
            )}
            {mode === 'ogrenci' && studentId && (
              <Select
                className={s.programSelect}
                value={programId ?? ''}
                onChange={(e) => selectProgram(e.target.value)}
                aria-label="Program"
              >
                <option value="">Yeni Plan</option>
                {ranges.map((r) => (
                  <option key={r.id} value={r.id} disabled={r.isApproved}>
                    {windowRangeText(r.start, r.dayCount)}{r.isApproved ? ' · onaylı' : ''}
                  </option>
                ))}
              </Select>
            )}
            {mode === 'ogrenci' && programId != null && (
              <Button variant="danger" size="sm" onClick={() => setDeleteAsk(true)} title="Bu programı sil">
                <Trash2 size={13} /> Programı sil
              </Button>
            )}
          </div>

          {win.startDate && (
            <div className={s.ribbonGroup}>
              {/* Etiketler Field'ın üstten bloklu düzeni yerine yan yana:
                  şeritte dikey yer kalmıyor. */}
              <label className={s.inlineField} title="Program başlangıç tarihi">
                <DateField
                  value={win.startDate}
                  onChange={(iso) => changeWindow({ startDate: iso })}
                  isDisabled={isStartBlocked}
                  disabledHint={busyRanges.length
                    ? 'Üstü çizili günler öğrencinin mevcut bir programıyla çakışıyor.'
                    : undefined}
                  ariaLabel="Program başlangıç tarihi"
                />
              </label>
              <label className={s.inlineField}>
                <span className={s.inlineLabel}>Gün</span>
                <NumberInput
                  className={s.dayCountInput}
                  value={win.dayCount}
                  min={MIN_DAYS}
                  max={MAX_DAYS}
                  onCommit={(n) => changeWindow({ dayCount: n })}
                  aria-label="Gün sayısı"
                />
              </label>
              {/* Şeritteki tarih aralığı yazısı kaldırıldı (9 Eylül 2026):
                  bu grup başlangıç gününü ve kaç günlük olduğunu SEÇMEK için;
                  aralık ikisinden zaten çıkıyor ve tahtanın gün başlıklarında
                  tarihler yazılı. Kâğıda basarken aralık gerekiyor, o yüzden
                  tahtanın baskı başlığında duruyor. */}
            </div>
          )}
        </div>

        <div className={s.ribbonRow}>
          <div className={s.ribbonGroup}>
            {win.startDate && (
              <PillGroup options={VIEWS} value={view} onChange={setView} />
            )}
          </div>

          <div className={s.ribbonEnd}>
            <span className={s.totalStat}>
              <span className={s.totalStatLabel}>Çalışma</span>
              <span className={s.totalStatValue}>{fmtHours(totalMin)}</span>
              {outsideMin > 0 && (
                <span className={s.totalStatSub}>+{fmtHours(outsideMin)} dış</span>
              )}
            </span>

            {/* Eylem düğmeleri tek tip: aynı boyut, aynı görünüm. Yalnız "Ata"
                birincil eylem olduğu için dolgulu. */}
            <div className={s.actions}>
              <Button className={s.action} variant="soft" size="sm" onClick={handleSaveTemplate} title="Bu programı isimli şablon olarak kaydet">
                <Bookmark size={13} /> Şablon
              </Button>
              <TemplateMenu
                templates={templates}
                activeStudent={activeStudent}
                onLoad={handleLoadTemplate}
                onAssign={(tpl) => setAssignSource({ type: 'template', id: tpl.id, name: tpl.name })}
                onDelete={handleDeleteTemplate}
                onToggleRoutine={handleToggleRoutine}
              />
              {mode === 'ogrenci' && (
                <Button className={s.action} variant="soft" size="sm" onClick={loadLastWeek} title="Geçen haftanın programını yükle">
                  <RotateCcw size={13} /> Geçen Hafta
                </Button>
              )}
              {/* Tek düğme, iki iş: tarayıcının baskı penceresinde hedef olarak
                  yazıcı ya da "PDF olarak kaydet" seçilir. Ayrı bir "PDF indir"
                  düğmesi aynı pencereyi açardı; gerçek bir indirme için PDF
                  üreten bir kitaplık ya da sunucu ucu gerekir. */}
              <Button
                className={s.action}
                variant="soft"
                size="sm"
                onClick={() => window.print()}
                title="Programı yazdır veya PDF olarak kaydet"
              >
                <Printer size={13} /> Yazdır / PDF
              </Button>
              <Button className={s.action} variant="danger" size="sm" onClick={clearAll} title="Tümünü temizle">
                <Trash2 size={13} /> Temizle
              </Button>
              {!(mode === 'ogrenci' && programId != null) && (
                <Button className={s.action} variant="primary" size="sm" onClick={() => setAssignSource({ type: 'board' })}>
                  <Send size={13} /> Ata
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

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
          onDragOver={handleDragOver}
          onDragCancel={() => { setActiveDrag(null); setOverDay(null); }}
        >
          <div className={s.layout}>
            {/* Baskıda kâğıda yalnız bu kutu çıkar; kenar çubuğu, üst çubuk,
                araç şeridi ve sağdaki blok paneli `data-print="hide"` ile
                gizleniyor (bkz. index.css → @media print). */}
            <Card className={s.gridCard} data-print="board">
              {/* Yalnız baskıda görünür: kâğıtta kimin programı ve hangi hafta
                  olduğu yazmazsa sayfa tek başına anlamsız kalıyor. */}
              <div className={s.printHeader} aria-hidden="true">
                <strong>{activeStudent ? activeStudent.name : 'Ders Programı'}</strong>
                <span>{windowRangeText(win.startDate, win.dayCount)}</span>
              </div>
              {/* Ders satırlı görünümde ilk sütun ders adlarını taşıdığı için
                  saat sütunundan çok daha geniş olmalı. */}
              <div
                className={s.grid}
                style={{ '--cols': days.length, '--labelw': view === 'subjects' ? '156px' : '46px' }}
              >
                <span className={s.corner} />
                {days.map((d) => (
                  <span className={s.dayHead} key={d.index}>
                    {d.short}
                    <span className={s.dayHeadDate}>{d.dayNum} {d.monthShort}</span>
                  </span>
                ))}

                {view === 'hours'
                  ? HOURS.map((hour) => (
                    <HourRow key={hour} hour={hour} days={days} blocks={blocks}
                             onRemove={removeBlock} onEditNote={openNote} />
                  ))
                  : subjectRows.map((row) => (
                    <SubjectRow
                      key={row.key}
                      row={row}
                      days={days}
                      blocks={blocks}
                      onRemove={removeBlock}
                      onEditNote={openNote}
                      editing={rowsEditing}
                      onRemoveRow={(key) => setRows((rowKeys ?? []).filter((k) => k !== key))}
                      canRemoveRow={!rowHasBlocks(row.key)}
                      overDay={overDay}
                      dragRowKey={activeDrag?.rowKey ?? null}
                      onOpenCell={(dayIndex, rowKey) => {
                        if (Date.now() - lastDragEnd.current < 300) return;
                        setCellEdit({ dayIndex, rowKey });
                      }}
                    />
                  ))}
              </div>

              {/* Satır ekle/çıkar kontrolleri normalde gizli; "Satırları düzenle"
                  açıldığında beliriyor ki tahta kalabalık görünmesin. */}
              {view === 'subjects' && (
                <div className={s.rowTools}>
                  <Button
                    variant={rowsEditing ? 'primary' : 'soft'}
                    size="sm"
                    onClick={() => setRowsEditing((v) => !v)}
                  >
                    <Pencil size={13} /> {rowsEditing ? 'Bitir' : 'Satırları düzenle'}
                  </Button>

                  {rowsEditing && (
                    <>
                      <Select
                        value=""
                        aria-label="Ders satırı ekle"
                        className={s.rowAddSelect}
                        disabled={addableRows.length === 0}
                        onChange={(e) => {
                          if (e.target.value) setRows([...(rowKeys ?? []), e.target.value]);
                        }}
                      >
                        <option value="">
                          {addableRows.length ? 'Satır ekle…' : 'Tüm satırlar açık'}
                        </option>
                        {addableRows.map((o) => (
                          <option value={o.key} key={o.key}>{o.label}</option>
                        ))}
                      </Select>
                      <Button variant="soft" size="sm" onClick={resetRows}>
                        Varsayılana dön
                      </Button>
                      <span className={s.rowToolsHint}>
                        Blok taşıyan satırlar gizlenemez.
                      </span>
                    </>
                  )}
                </div>
              )}
            </Card>

            <div data-print="hide" className={s.rail}>
            <Card className={s.blockCard}>
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
                    ) : showMethodFields ? (
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
                    ) : null}
                    </>
                    )}

                    <Field label="Süre (dakika)">
                      <NumberInput
                        value={draft.durationMin}
                        min={MIN_DURATION}
                        max={MAX_DURATION}
                        onCommit={(n) => setDraft((d) => ({ ...d, durationMin: n }))}
                        aria-label="Süre (dakika)"
                      />
                    </Field>

                    {/* Yönerge: bloğun ne olduğu değil, öğrencinin ne yapacağı.
                        Öğrenci bunu salt-okur — kendi cevabı üç düğmeyle. */}
                    <Field label="Açıklama (opsiyonel)">
                      <Textarea
                        value={draft.note}
                        rows={2}
                        maxLength={NOTE_MAX}
                        placeholder="Ör. 45-70. sayfa · 40 soru · önce konu tekrarı"
                        onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
                      />
                      <span className={s.noteHint}>
                        Öğrenci bu notu görür, değiştiremez.
                      </span>
                    </Field>
                  </div>

                  <p className={s.previewLabel}>Sürüklenebilir blok</p>
                  {draftFields ? (
                    <>
                      <DraftBlock fields={draftFields} durationMin={draft.durationMin} />
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

      {/* Ekranın dışında: öğrenci modunda tahta bir ekranı tam kapladığı için
          özet çubuğu kaydırılarak görülür. Sürükleme bağlamına ihtiyacı yok. */}
      <SummaryBar
        current={blocks}
        history={history}
        subjectMap={subjectMap}
        inStudent={mode === 'ogrenci'}
      />

      {cellEdit && (() => {
        const items = (blocks || [])
          .filter((b) => b.dayIndex === cellEdit.dayIndex && subjectRowKey(b) === cellEdit.rowKey)
          .sort((a, b) => a.startMin - b.startMin);
        if (!items.length) return null;
        const day = days.find((d) => d.index === cellEdit.dayIndex);
        return (
          <CellEditor
            key={`${cellEdit.dayIndex}:${cellEdit.rowKey}`}
            items={items}
            dayText={day ? `${day.dayNum} ${day.monthShort} ${day.short}` : ''}
            taskTypes={taskTypes}
            library={library}
            onSave={saveCell}
            onRemove={removeBlock}
            onClose={() => setCellEdit(null)}
          />
        );
      })()}

      {confirmAsk && (
        <Modal open onClose={() => setConfirmAsk(null)} width={460} labelledBy="confirm-title">
          <h2 id="confirm-title" className={s.modalTitle}>{confirmAsk.title}</h2>
          <div className={s.assignForm}>
            <p>{confirmAsk.body}</p>
            {confirmAsk.danger && <p className={s.assignError}>Bu işlem geri alınamaz.</p>}
            <div className={s.assignActions}>
              <Button variant="ghost" onClick={() => setConfirmAsk(null)}>Vazgeç</Button>
              <Button
                variant={confirmAsk.danger ? 'danger' : 'primary'}
                onClick={() => { const run = confirmAsk.onConfirm; setConfirmAsk(null); run(); }}
              >
                {confirmAsk.confirmLabel}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {deleteAsk && programId != null && (() => {
        const r = ranges.find((x) => x.id === programId);
        const label = r ? windowRangeText(r.start, r.dayCount) : 'Bu';
        const count = (blocks || []).length;
        return (
          <Modal open onClose={() => !deleting && setDeleteAsk(false)} width={460} labelledBy="delete-title">
            <h2 id="delete-title" className={s.modalTitle}>Programı sil</h2>
            <div className={s.assignForm}>
              <p>
                <strong>{activeStudent?.name}</strong> için <strong>{label}</strong> haftasının
                programı{count ? <> ve içindeki <strong>{count} görev</strong></> : ''} kalıcı
                olarak silinecek. Öğrenci bu programı artık göremeyecek.
              </p>
              <p className={s.assignError}>Bu işlem geri alınamaz. Emin misiniz?</p>
              <div className={s.assignActions}>
                <Button variant="ghost" onClick={() => setDeleteAsk(false)} disabled={deleting}>
                  Vazgeç
                </Button>
                <Button variant="danger" onClick={removeOpenProgram} disabled={deleting}>
                  {deleting ? 'Siliniyor…' : 'Evet, sil'}
                </Button>
              </div>
            </div>
          </Modal>
        );
      })()}

      {assignSource && mode === 'ogrenci' && activeStudent && (
        <AssignConfirm
          source={assignSource}
          student={activeStudent}
          win={win}
          busyRanges={busyRanges}
          blocks={blocks || []}
          onAssigned={() => {
            // Yeni program listeye ve dolu günlere hemen yansısın. Taslak
            // tahtada kalır, pencere bir sonraki boş güne kayar: aynı plan
            // başka bir haftaya da atanabilsin.
            getStudentPrograms(scope).then(setHistory).catch(() => {});
            listProgramRanges(scope).then((r) => {
              setRanges(r);
              setWin((w) => ({ ...w, startDate: firstFreeStart(r, w.dayCount, w.startDate) }));
            }).catch(() => {});
          }}
          onClose={() => setAssignSource(null)}
        />
      )}
      {assignSource && mode !== 'ogrenci' && (
        <AssignModal
          source={assignSource}
          students={students}
          blocks={blocks || []}
          boardStart={win.startDate}
          boardDayCount={win.dayCount}
          onClose={() => setAssignSource(null)}
        />
      )}

      {noteEdit && (
        <Modal open onClose={() => setNoteEdit(null)} width={420} labelledBy="note-title">
          <h2 id="note-title" className={s.modalTitle}>Blok açıklaması</h2>
          <Field label="Öğrenciye yönerge">
            <Textarea
              autoFocus
              rows={4}
              maxLength={NOTE_MAX}
              value={noteEdit.text}
              placeholder="Ör. 45-70. sayfa · 40 soru · önce konu tekrarı"
              onChange={(e) => setNoteEdit((n) => ({ ...n, text: e.target.value }))}
            />
            <span className={s.noteHint}>
              Öğrenci bu notu görür, değiştiremez. Boş bırakırsanız açıklama silinir.
            </span>
          </Field>
          <div className={s.assignActions}>
            <Button variant="soft" onClick={() => setNoteEdit(null)}>Vazgeç</Button>
            <Button onClick={saveNote}>Kaydet</Button>
          </div>
        </Modal>
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
      <Button className={s.action} variant="soft" size="sm" onClick={() => setOpen((o) => !o)}>
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
        </div>
      )}
    </div>
  );
}

/** Atama modalı — öğrenci + pencere (başlangıç + gün sayısı) seçilir. */
/**
 * Öğrenci modunda atama: öğrenci, tarih ve plan ana ekranda zaten belli.
 * Pencere yalnız özet gösterip onay ister; burada hiçbir şey değiştirilmez
 * (kullanıcı kararı, 19 Eyl 2026). Her zaman yeni program açar.
 */
function AssignConfirm({ source, student, win, busyRanges, blocks, onAssigned, onClose }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const blocked = makeStartBlocker(busyRanges, win.dayCount);
  const clash = Boolean(win.startDate && blocked && blocked(win.startDate));
  const isTemplate = source.type === 'template';
  const noBoard = !isTemplate && blocks.length === 0;
  const range = win.startDate ? windowRangeText(win.startDate, win.dayCount) : '—';

  async function confirm() {
    setBusy(true); setError('');
    const target = { startDate: win.startDate, dayCount: win.dayCount };
    try {
      const prog = isTemplate
        ? await assignTemplate(source.id, student.id, target)
        : await assignBoard(student.id, blocks, win.startDate, target);
      onAssigned?.(prog);
      setResult(prog);
    } catch (err) {
      setError(apiMessage(err, 'Atama başarısız oldu.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} width={480} labelledBy="assign-title">
      <h2 id="assign-title" className={s.modalTitle}>
        {isTemplate ? 'Şablonu ata' : 'Programı ata'}
      </h2>
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
          <p>Aşağıdaki program atanacak. Emin misiniz?</p>
          <dl className={s.assignSummary}>
            <dt>Öğrenci</dt><dd>{student.name}{student.grade ? ` · ${student.grade}` : ''}</dd>
            <dt>Tarih</dt><dd>{range} · {win.dayCount} gün</dd>
            {isTemplate
              ? <><dt>Şablon</dt><dd>{source.name}</dd></>
              : <><dt>Görev</dt><dd>{blocks.length} blok</dd></>}
          </dl>
          {clash && (
            <p className={s.assignError}>
              Bu tarih aralığı öğrencinin mevcut bir programıyla çakışıyor. Ana ekrandan başka bir başlangıç günü seçin.
            </p>
          )}
          {noBoard && <p className={s.assignError}>Tahta boş — önce blok ekleyin.</p>}
          {error && <p className={s.assignError}>{error}</p>}
          <div className={s.assignActions}>
            <Button variant="ghost" onClick={onClose}>Vazgeç</Button>
            <Button onClick={confirm} disabled={busy || clash || noBoard || !win.startDate}>
              {busy ? 'Atanıyor…' : 'Ata'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/**
 * Genel Program'dan atama: öğrenci ve tarih burada seçilir. **Her zaman yeni
 * program açar**; öğrencinin mevcut programlarına dokunmaz, hepsi dolu gün sayılır.
 */
function AssignModal({
  source, students, onAssigned, blocks, boardStart, boardDayCount, onClose,
}) {
  const [studentId, setStudentId] = useState('');
  const [date, setDate] = useState('');
  const [dayCount, setDayCount] = useState(boardDayCount || DEFAULT_DAY_COUNT);
  const [ranges, setRanges] = useState([]);
  const [loadingRanges, setLoadingRanges] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  // Seçilen öğrencinin dolu aralıkları (hafif liste) + varsayılan tarih.
  // Yüklenene kadar hiçbir gün seçilemez: eskiden bu arada bütün günler boş
  // görünüyordu ve dolu bir gün seçilebiliyordu.
  useEffect(() => {
    if (!studentId) { setRanges([]); setDate(''); return undefined; }
    let alive = true;
    setLoadingRanges(true);
    setDate('');
    setError('');
    listProgramRanges(studentId)
      .then((r) => {
        if (!alive) return;
        const rr = r.map((x) => ({ start: x.start, end: x.end }));
        setRanges(rr);
        // Tahtada seçili gün uygunsa o, değilse ilk boş gün.
        const blocked = makeStartBlocker(rr, dayCount);
        const preferred = source.type === 'board' && boardStart && boardStart >= today()
          ? boardStart : null;
        setDate(preferred && !(blocked && blocked(preferred))
          ? preferred
          : firstFreeStart(rr, dayCount));
      })
      .catch(() => { if (alive) setError('Öğrencinin programları yüklenemedi.'); })
      .finally(() => { if (alive) setLoadingRanges(false); });
    return () => { alive = false; };
  }, [studentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const isBlocked = useMemo(
    () => (loadingRanges ? () => true : makeStartBlocker(ranges, dayCount)),
    [loadingRanges, ranges, dayCount]
  );
  const dateBlocked = Boolean(date && isBlocked && isBlocked(date));

  async function confirm() {
    if (!studentId || !date || dateBlocked) return;
    setBusy(true); setError('');
    const win = { startDate: date, dayCount };
    try {
      const prog = source.type === 'template'
        ? await assignTemplate(source.id, studentId, win)
        : await assignBoard(studentId, blocks, boardStart, win);
      onAssigned?.(prog);
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
    <Modal open onClose={onClose} width={560} labelledBy="assign-title" className={s.assignModal}>
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
            <StudentPicker
              students={students}
              value={studentId}
              onChange={setStudentId}
              placeholder="Öğrenci adı yazın…"
              ariaLabel="Öğrenci"
            />
          </Field>
          <div className={s.assignWindow}>
            <Field label="Başlangıç (görüşme günü)">
              <DateField
                value={date}
                onChange={setDate}
                isDisabled={studentId ? isBlocked : undefined}
                disabledHint={loadingRanges
                  ? 'Öğrencinin programları yükleniyor…'
                  : ranges.length
                    ? 'Üstü çizili günler öğrencinin mevcut bir programıyla çakışıyor.'
                    : undefined}
                ariaLabel="Program başlangıç tarihi"
              />
            </Field>
            <Field label="Gün sayısı">
              <NumberInput
                value={dayCount}
                min={MIN_DAYS}
                max={MAX_DAYS}
                onCommit={setDayCount}
                aria-label="Gün sayısı"
              />
            </Field>
          </div>
          {loadingRanges && <p className={s.assignHint}>Öğrencinin programları yükleniyor…</p>}
          {date && !loadingRanges && (
            <p className={dateBlocked ? s.assignError : s.assignHint}>
              {dateBlocked
                ? 'Bu tarih aralığı öğrencinin mevcut bir programıyla çakışıyor.'
                : `Bitiş: ${addDays(date, dayCount - 1)}`}
            </p>
          )}
          {noBoard && <p className={s.assignHint}>Board boş — önce blok ekleyin.</p>}
          {error && <p className={s.assignError}>{error}</p>}
          <div className={s.assignActions}>
            <Button variant="ghost" onClick={onClose}>Vazgeç</Button>
            <Button
              onClick={confirm}
              disabled={busy || !studentId || !date || loadingRanges || dateBlocked || noBoard}
            >
              {busy ? 'Atanıyor…' : 'Ata'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/** Bloklardan ağırlık özeti üretir (toplam dk, TYT/AYT %, ders donut'u).
 *  Dış meşguliyet blokları çalışma saati olmadığı için tamamen dışarıda bırakılır;
 *  genel denemeler kapsamlarına (TYT/AYT) sayılır. Süreler dakika cinsindendir;
 *  yalnız gösterimde saate çevrilir. */
function computeWeights(allBlocks, subjectMap) {
  const blocks = (allBlocks || []).filter((b) => b.kind !== 'external');
  const total = studyMinutes(blocks);
  const cat = { tyt: 0, ayt: 0 };
  const bySub = {};
  blocks.forEach((b) => {
    const c = b.examScope || subjectMap[String(b.subject)]?.category;
    if (c === 'tyt' || c === 'ayt') cat[c] += b.durationMin;
    const label = blockLabel(b);
    if (!bySub[label]) bySub[label] = { minutes: 0, color: b.subjectColor };
    bySub[label].minutes += b.durationMin;
  });
  const examTotal = cat.tyt + cat.ayt;
  const tytPct = examTotal ? Math.round((cat.tyt / examTotal) * 100) : 0;
  const aytPct = examTotal ? 100 - tytPct : 0;

  let subs = Object.entries(bySub)
    .map(([label, v]) => ({ label, minutes: v.minutes, color: v.color }))
    .sort((a, b) => b.minutes - a.minutes);
  const MAX = 5;
  if (subs.length > MAX) {
    const rest = subs.slice(MAX).reduce((sum, x) => sum + x.minutes, 0);
    subs = [...subs.slice(0, MAX), { label: 'Diğer', minutes: rest, color: 'var(--subj-genel)' }];
  }
  let acc = 0;
  const stops = subs.map((x) => {
    const start = total ? (acc / total) * 100 : 0;
    acc += x.minutes;
    const end = total ? (acc / total) * 100 : 0;
    return `${x.color} ${start}% ${end}%`;
  });
  return { total, tytPct, aytPct, subs, pieStyle: { background: `conic-gradient(${stops.join(', ')})` } };
}

/** Alttaki yatay özet çubuğunun tek sütunu (geçen hafta / şu anki / toplam). */
function SummaryColumn({ title, blocks, subjectMap, accent }) {
  const w = computeWeights(blocks, subjectMap);
  const pctOf = (min) => (w.total ? Math.round((min / w.total) * 100) : 0);
  return (
    <div className={`${s.sumCol} ${accent ? s.sumColActive : ''}`}>
      <span className={s.sumTitle}>{title}</span>
      {w.total === 0 ? (
        <span className={s.sumEmpty}>Kayıt yok</span>
      ) : (
        <div className={s.sumBody}>
          <div className={s.sumPie} style={w.pieStyle}><div className={s.sumPieHole} /></div>
          <div className={s.sumInfo}>
            <span className={s.sumTotal}>{fmtHours(w.total)}</span>
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
                  <span className={s.sumLegPct}>%{pctOf(x.minutes)}</span>
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

  // Genel modda özet yok (kullanıcı kararı, 2 Eyl 2026): tek sütunlu "Bu Genel
  // Plan" kutusu geçen hafta/toplam kıyası olmadığı için bilgi taşımıyordu ve
  // ekranın tam sığmasını engelliyordu. Öğrenci modunda üç sütun anlamlı.
  if (!inStudent) return null;
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
      type: '', typeName: null, topic: title, note: draft.note.trim(),
      book: null, bookLabel: null };
    return { ...b, subjectColor: blockColor(b) };
  }
  const isExam = draft.kind === 'exam';
  const isGeneralExam = isExam && draft.examScope;
  const sub = isGeneralExam ? null : subjectMap[draft.subject];
  const tt = taskTypeMap[draft.type];
  /* Deneme bloğu çalışma türü ve konu taşımaz — ders bazlı olanı da. Deneme
     kendi başına bir çalışma türüdür; konusu da sınavın kapsadığı her şeydir,
     tek bir konu seçmek yanlış bilgi üretir. */
  const b = {
    kind: draft.kind,
    examScope: isGeneralExam ? draft.examScope : '',
    subject: isGeneralExam ? '' : draft.subject,
    subjectLabel: sub?.label,
    type: isExam ? '' : draft.type,
    typeName: isExam ? null : tt?.name,
    topic: isExam ? '' : draft.topic,
    // Yönerge her blok türünde anlamlı: denemede "TYT 1. deneme", çalışmada
    // "45-70. sayfa", dış blokta "servis 07:40'ta".
    note: draft.note.trim(),
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
    note: payload.note ?? '',
    book: payload.book ?? null,
    bookLabel: payload.bookLabel ?? null,
  };
}

/** Bir saat satırı. Hücre 15 dk'lık dört bırakma dilimine bölünür ki 20 dk'lık
 *  bloklar da saat başına oturmak zorunda kalmasın. */
function HourRow({ hour, days, blocks, onRemove, onEditNote }) {
  const from = hour * 60;
  return (
    <>
      <span className={s.hourLabel}>{fmtHour(hour)}</span>
      {days.map((day) => (
        <HourCell
          key={`${day.index}:${hour}`}
          day={day.index}
          from={from}
          // Blok, başladığı saatin hücresinde çizilir; taşma bir sonraki satıra sarkar.
          items={blocks.filter(
            (b) => b.dayIndex === day.index && b.startMin >= from && b.startMin < from + 60
          )}
          onRemove={onRemove}
          onEditNote={onEditNote}
        />
      ))}
    </>
  );
}

const SLOTS_PER_HOUR = Math.round(60 / SLOT_MIN);

function HourCell({ day, from, items, onRemove, onEditNote }) {
  return (
    <div className={s.cell} data-cell={`${day}:${from}`}>
      {Array.from({ length: SLOTS_PER_HOUR }, (_, i) => (
        <QuarterSlot key={i} day={day} startMin={from + i * SLOT_MIN} index={i} />
      ))}
      {items.map((b) => (
        <PlacedBlock key={b.id} block={b} hourStart={from}
                     onRemove={onRemove} onEditNote={onEditNote} />
      ))}
    </div>
  );
}

function QuarterSlot({ day, startMin, index }) {
  const { setNodeRef, isOver } = useDroppable({ id: `${day}:${startMin}` });
  return (
    <div
      ref={setNodeRef}
      className={`${s.slot} ${isOver ? s.slotOver : ''}`}
      style={{ top: `${(index / SLOTS_PER_HOUR) * 100}%` }}
    />
  );
}

/* ---------------- Ders satırlı görünüm (A2) ----------------
   Aynı görevler; satırlar saat yerine DERS. Dış meşguliyetler ve genel denemeler
   bir dersle eşleşmediğinden kendi satırlarını alır. */

/** Bloğun hangi ders satırına düştüğü. */
function subjectRowKey(b) {
  if (b.kind === 'external') return 'ext';
  if (b.examScope) return `exam-${b.examScope}`;
  return `sub-${b.subject || ''}`;
}

/** Satır başlığı — blok adı değil, satırın kendi adı (aynı satırda çok blok olur). */
function subjectRowLabel(b) {
  if (b.kind === 'external') return 'Dış meşguliyet';
  if (b.examScope) return blockLabel(b);
  return b.subjectLabel || 'Dersi yok';
}

/** Sıralama: dersler önce, sonra genel denemeler, en sonda dış meşguliyet. */
function subjectRowOrder(b) {
  if (b.kind === 'external') return 2;
  if (b.examScope) return 1;
  return 0;
}

/** Bir satıra bırakılan bloğun alması gereken alanlar (satır = ders/tür). */
function subjectRowFields(key, subjects) {
  if (key === 'ext') {
    return { kind: 'external', examScope: '', subject: '', subjectLabel: null,
      type: '', typeName: null, book: null, bookLabel: null,
      subjectColor: blockColor({ kind: 'external' }) };
  }
  if (key.startsWith('exam-')) {
    const examScope = key.slice(5);
    return { kind: 'exam', examScope, subject: '', subjectLabel: null,
      type: '', typeName: null, book: null, bookLabel: null,
      subjectColor: blockColor({ examScope }) };
  }
  const id = key.slice(4);
  const sub = subjects.find((x) => String(x.id) === id);
  return { kind: 'study', examScope: '', subject: id,
    subjectLabel: sub?.label, subjectColor: sub?.color };
}

/** Dış bloğun adı boş kalamaz (backend başlık ister) — düşülecek son çare. */
function ensureBlockValid(b) {
  if (b.kind === 'external' && !(b.topic || '').trim()) {
    return { ...b, topic: b.subjectLabel || 'Dış meşguliyet' };
  }
  return b;
}

function SubjectRow({ row, days, blocks, editing, onRemoveRow, canRemoveRow,
                     overDay, dragRowKey, onOpenCell }) {
  return (
    <>
      <span className={s.rowLabel} title={row.label}>
        <span className={s.rowDot} style={{ background: row.color }} />
        <span className={s.rowName}>{row.label}</span>
        {editing && (
          <button
            type="button"
            className={s.rowRemove}
            disabled={!canRemoveRow}
            title={canRemoveRow
              ? `${row.label} satırını gizle`
              : 'Bu satırda blok var; önce blokları kaldırın'}
            aria-label={`${row.label} satırını gizle`}
            onClick={() => onRemoveRow(row.key)}
          >
            <X size={11} />
          </button>
        )}
      </span>
      {days.map((day) => (
        <SubjectCell
          key={`${day.index}:${row.key}`}
          dayIndex={day.index}
          rowKey={row.key}
          columnOver={overDay === day.index}
          isTarget={overDay === day.index && dragRowKey === row.key}
          items={blocks
            .filter((b) => b.dayIndex === day.index && subjectRowKey(b) === row.key)
            .sort((a, b) => a.startMin - b.startMin)}
          onOpen={onOpenCell}
        />
      ))}
    </>
  );
}

function SubjectCell({ dayIndex, rowKey, items, columnOver, isTarget, onOpen }) {
  // Bırakma yeri gün sütunu; hücre yalnız o sütunun bir parçası (bkz. handleDragEnd).
  const { setNodeRef } = useDroppable({ id: `${dayIndex}:row:${rowKey}` });
  return (
    <div
      ref={setNodeRef}
      className={cx(s.subjCell, columnOver && s.colOver, isTarget && s.cellTarget,
        items.length > 0 && s.subjCellFilled)}
      onClick={items.length ? () => onOpen(dayIndex, rowKey) : undefined}
    >
      {items.length > 0 && <SubjectChip block={items[0]} extra={items.length - 1} />}
    </div>
  );
}

/** Ders satırlı görünümde bloğun içinde yazan tek şey: KONU.
 *  Satır zaten dersi söylüyor; saat ve süre bu ekranda gösterilmiyor. */
function chipText(b) {
  if (b.kind === 'exam') return 'Deneme';
  return b.topic || b.bookLabel || b.typeName || blockLabel(b);
}

/** Hücreyi bloğun rengiyle tamamen kaplar. Aynı hücrede birden çok görev varsa
 *  ilki görünür, kalanı "+N" rozetiyle; hepsi tıklayınca açılan pencerede. */
function SubjectChip({ block, extra }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: block.id,
    data: {
      dragKind: 'move',
      blockId: block.id,
      rowKey: subjectRowKey(block),
      durationMin: block.durationMin,
      subjectLabel: blockLabel(block),
      subjectColor: block.subjectColor,
    },
  });
  return (
    <div
      ref={setNodeRef}
      className={cx(s.chipFill, isDragging && s.blockDragging)}
      style={{ background: block.subjectColor }}
      title={block.note || chipText(block)}
      {...listeners}
      {...attributes}
    >
      <span className={s.chipFillText}>{chipText(block)}</span>
      {block.note && <StickyNote size={10} className={s.chipFillNote} aria-hidden />}
      {extra > 0 && <span className={s.chipMore}>+{extra}</span>}
    </div>
  );
}

/**
 * Ders satırlı görünümde tıklanan hücrenin görevleri: hepsi görünür ve
 * düzenlenir (çalışma türü, konu, kitap, süre, açıklama) ya da silinir.
 * Ders değiştirilemez — satır dersin kendisi; başka derse taşımak istenmiyor.
 */
function CellEditor({ items, dayText, taskTypes, library, onSave, onRemove, onClose }) {
  const [edits, setEdits] = useState(() => Object.fromEntries(items.map((b) => [b.id, {
    type: b.type ? String(b.type) : '',
    topic: b.topic || '',
    book: b.book != null ? String(b.book) : '',
    durationMin: b.durationMin,
    note: b.note || '',
  }])));
  const [topicsBySubject, setTopicsBySubject] = useState({});
  const [error, setError] = useState('');

  const subjectIds = [...new Set(items.filter((b) => b.kind === 'study' && b.subject)
    .map((b) => String(b.subject)))].join(',');
  useEffect(() => {
    let alive = true;
    subjectIds.split(',').filter(Boolean).forEach((id) => {
      listTopics(id)
        .then((t) => { if (alive) setTopicsBySubject((m) => ({ ...m, [id]: t })); })
        .catch(() => {});
    });
    return () => { alive = false; };
  }, [subjectIds]);

  const set = (id, patch) => setEdits((e) => ({ ...e, [id]: { ...e[id], ...patch } }));

  function save() {
    const msg = onSave(edits);
    if (msg) setError(msg); else onClose();
  }

  return (
    <Modal open onClose={onClose} width={560} labelledBy="cell-title">
      <h2 id="cell-title" className={s.modalTitle}>
        {blockLabel(items[0])} · {dayText}
      </h2>
      <div className={s.assignForm}>
        {items.map((b) => {
          const e = edits[b.id] ?? {};
          const topics = topicsBySubject[String(b.subject)] ?? [];
          const books = library.filter((bk) => bk.kind === 'ders'
            && String(bk.subject) === String(b.subject));
          const hasBook = books.some((bk) => String(bk.id) === e.book);
          return (
            <div key={b.id} className={s.cellItem} style={{ borderLeftColor: b.subjectColor }}>
              <div className={s.cellItemHead}>
                <strong>
                  {b.kind === 'exam' ? 'Deneme' : b.kind === 'external' ? 'Dış meşguliyet' : 'Çalışma'}
                </strong>
                <Button variant="ghost" size="sm" onClick={() => onRemove(b.id)}>
                  <Trash2 size={13} /> Sil
                </Button>
              </div>
              {b.kind === 'external' && (
                <Field label="Ad">
                  <Input value={e.topic} onChange={(ev) => set(b.id, { topic: ev.target.value })} />
                </Field>
              )}
              {b.kind === 'study' && (
                <div className={s.cellItemGrid}>
                  <Field label="Çalışma türü">
                    <Select value={e.type} onChange={(ev) => set(b.id, { type: ev.target.value })}>
                      <option value="">—</option>
                      {taskTypes.map((x) => <option value={x.id} key={x.id}>{x.name}</option>)}
                    </Select>
                  </Field>
                  <Field label="Konu">
                    <Select value={e.topic} onChange={(ev) => set(b.id, { topic: ev.target.value })}>
                      <option value="">Konu yok</option>
                      {e.topic && !topics.some((t) => t.name === e.topic) && (
                        <option value={e.topic}>{e.topic}</option>
                      )}
                      {topics.map((t) => <option value={t.name} key={t.id}>{t.name}</option>)}
                    </Select>
                  </Field>
                  {(books.length > 0 || e.book) && (
                    <Field label="Kitap">
                      <Select value={e.book} onChange={(ev) => set(b.id, { book: ev.target.value })}>
                        <option value="">Kitap yok</option>
                        {e.book && !hasBook && <option value={e.book}>{b.bookLabel || 'Mevcut kitap'}</option>}
                        {books.map((bk) => <option value={bk.id} key={bk.id}>{bk.label}</option>)}
                      </Select>
                    </Field>
                  )}
                </div>
              )}
              <div className={s.cellItemGrid}>
                <Field label="Süre (dk)">
                  <NumberInput
                    value={e.durationMin}
                    min={MIN_DURATION}
                    max={MAX_DURATION}
                    onCommit={(n) => set(b.id, { durationMin: n })}
                    aria-label="Süre (dakika)"
                  />
                </Field>
              </div>
              <Field label="Açıklama (öğrenci görür)">
                <Textarea
                  rows={2}
                  maxLength={NOTE_MAX}
                  value={e.note}
                  placeholder="Ör. 45-70. sayfa · 40 soru"
                  onChange={(ev) => set(b.id, { note: ev.target.value })}
                />
              </Field>
            </div>
          );
        })}
        {error && <p className={s.assignError}>{error}</p>}
        <div className={s.assignActions}>
          <Button variant="ghost" onClick={onClose}>Vazgeç</Button>
          <Button onClick={save}>Kaydet</Button>
        </div>
      </div>
    </Modal>
  );
}

/** Blok içeriğinin ikinci satırı: dış blokta yok, denemede kapsam, çalışmada kitap/metod. */
function blockMetaText(b) {
  if (b.kind === 'external') return 'Çalışma saatine sayılmaz';
  // Ders bazlı deneme de deneme: çalışma türü ve konu taşımıyor.
  if (b.kind === 'exam') return 'Deneme';
  return `${b.bookLabel || b.typeName || ''}${b.topic ? ` · ${b.topic}` : ''}`;
}

function PlacedBlock({ block, hourStart, onRemove, onEditNote }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: block.id,
    data: {
      dragKind: 'move',
      blockId: block.id,
      rowKey: subjectRowKey(block),
      durationMin: block.durationMin,
      subjectLabel: blockLabel(block),
      subjectColor: block.subjectColor,
    },
  });
  const label = blockLabel(block);
  const meta = blockMetaText(block);
  // Saat satırı 1 saat = ROW_H piksel; blok saat içindeki dakikasından başlar.
  const offset = ((block.startMin - hourStart) / 60) * ROW_H;
  const height = (block.durationMin / 60) * ROW_H - 4;
  const isShort = block.durationMin < 45;

  return (
    <div
      ref={setNodeRef}
      data-block={block.id}
      className={[
        s.block,
        isDragging ? s.blockDragging : '',
        block.kind === 'external' ? s.blockExternal : '',
        isShort ? s.blockShort : '',
      ].filter(Boolean).join(' ')}
      style={{
        background: block.subjectColor,
        top: offset + 2,
        height: Math.max(height, 14),
      }}
      title={block.note || undefined}
      {...listeners}
      {...attributes}
    >
      <span className={s.blockSubject}>
        {block.kind === 'external' ? '🚫 ' : block.book ? '📖 ' : ''}{label}
      </span>
      {block.durationMin >= 90 && meta && <span className={s.blockMeta}>{meta}</span>}
      {/* Yönerge bloğun içinde okunabildiği kadar görünsün; tamamı `title`da. */}
      {block.note && block.durationMin >= 60 && (
        <span className={s.blockNote}>{block.note}</span>
      )}
      {!isShort && <span className={s.blockTime}>{timeRange(block)}</span>}
      <div className={s.blockActions}>
        <button
          type="button"
          className={cx(s.blockBtn, block.note && s.blockBtnOn)}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onEditNote(block.id)}
          title={block.note || 'Açıklama ekle'}
          aria-label={`${label} bloğunun açıklamasını düzenle`}
        >
          <StickyNote size={11} />
        </button>
        <button
          type="button"
          className={s.blockBtn}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onRemove(block.id)}
          aria-label={`${label} bloğunu kaldır`}
        >
          <X size={11} />
        </button>
      </div>
    </div>
  );
}

/** Önizleme bloğu: moda göre üretilen alanları (ders akışı veya kitap) sürüklenebilir
 *  bir blok olarak gösterir; bir güne bırakılınca yeni blok oluşur. */
function DraftBlock({ fields, durationMin }) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: 'draft',
    // `dragKind` sürükleme türü (yeni/taşı); `fields.kind` bloğun kendi türü.
    // subjectLabel sürükleme katmanının (DragOverlay) gösterdiği ad — dış blokta
    // ders olmadığı için blockLabel ile çözülür.
    data: {
      dragKind: 'new',
      durationMin,
      ...fields,
      rowKey: subjectRowKey(fields),
      subjectLabel: blockLabel(fields),
    },
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
        {meta ? `${meta} · ` : ''}{durationMin} dk
      </span>
    </div>
  );
}
