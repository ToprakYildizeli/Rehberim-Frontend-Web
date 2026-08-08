/* Öğrenciye özel Ders Programı — gerçek backend (/api/programs/ + /api/tasks/).
   Board hafta-günü + saat ile çalışır; backend Task tarihlidir. 7 günlük pencere
   her günü tam bir kez kapsadığından tarih↔gün birebir eşlenir. */
import api from './client';
import { subjectColor } from './catalog';

// DAYS id sırası (Pzt..Paz) — mocks/data.js ile aynı.
const DAY_IDS = ['pzt', 'sal', 'car', 'per', 'cum', 'cmt', 'paz'];

const pad2 = (n) => String(n).padStart(2, '0');
const isoDate = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const parseDate = (str) => { const [y, m, d] = str.split('-').map(Number); return new Date(y, m - 1, d); };
// JS getDay(): Paz=0..Cmt=6 → DAY_IDS (Pzt=0..Paz=6)
const dayIdOf = (dateStr) => DAY_IDS[(parseDate(dateStr).getDay() + 6) % 7];
const hourOf = (t) => (t ? parseInt(t.slice(0, 2), 10) : 0);

/** startDate penceresinde (7 gün) verilen güne düşen tarihi bulur. */
function dateForDay(startDate, dayId) {
  const base = parseDate(startDate);
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    if (dayIdOf(isoDate(d)) === dayId) return isoDate(d);
  }
  return startDate;
}

/** Backend Task → board bloğu (denormalize gösterim alanlarıyla). */
function mapTaskToBlock(task) {
  return {
    id: `t${task.id}`,
    taskId: task.id,
    day: dayIdOf(task.date),
    start: hourOf(task.start_time),
    duration: (task.duration_minutes || 60) / 60,
    subject: task.subject != null ? String(task.subject) : '',
    subjectLabel: task.subject_label,
    subjectColor: subjectColor(task.subject_label || ''),
    type: task.task_type != null ? String(task.task_type) : '',
    typeName: task.task_type_name,
    topic: task.title || '',
    book: task.book != null ? task.book : null,
    bookLabel: task.book_label || null,
  };
}

// Diff için scope başına son yüklenen durum: { programId, startDate, blocks }
const cache = new Map();

/** Öğrencinin mevcut haftasının programını board bloklarına çevirir. */
export async function getStudentProgram(studentId) {
  const { data } = await api.get('/programs/');
  const mine = data.filter((p) => String(p.student) === String(studentId));
  const today = isoDate(new Date());
  const current =
    mine.find((p) => p.start_date <= today && today <= p.end_date) ||
    mine.sort((a, b) => (a.start_date < b.start_date ? 1 : -1))[0] ||
    null;

  const blocks = current ? current.tasks.map(mapTaskToBlock) : [];
  const entry = {
    programId: current ? current.id : null,
    startDate: current ? current.start_date : today,
    blocks,
  };
  cache.set(String(studentId), entry);
  // Referans kopyası döndür (board mutasyonu cache'i bozmasın)
  return blocks.map((b) => ({ ...b }));
}

/** Board değişikliklerini backend'e yazar; reconcile edilmiş blokları döndürür. */
export async function persistStudentSchedule(studentId, nextBlocks) {
  const key = String(studentId);
  const entry = cache.get(key) || { programId: null, startDate: isoDate(new Date()), blocks: [] };
  const prevById = new Map(entry.blocks.map((b) => [b.id, b]));

  // Program yoksa ve eklenen blok varsa önce oluştur.
  let { programId } = entry;
  if (programId == null && nextBlocks.length > 0) {
    const { data } = await api.post('/programs/', {
      student: Number(studentId),
      start_date: entry.startDate,
      schedule_type: 'timed',
    });
    programId = data.id;
    entry.programId = data.id;
    entry.startDate = data.start_date;
  }

  const taskPayload = (b) => ({
    subject: b.subject ? Number(b.subject) : null,
    task_type: b.type ? Number(b.type) : null,
    book: b.book ? Number(b.book) : null,
    title: b.topic || '',
    date: dateForDay(entry.startDate, b.day),
    start_time: `${pad2(Math.floor(b.start))}:00`,
    duration_minutes: Math.round(b.duration * 60),
  });

  const changed = (a, b) =>
    a.day !== b.day || a.start !== b.start || a.duration !== b.duration ||
    a.subject !== b.subject || a.type !== b.type || a.topic !== b.topic ||
    a.book !== b.book;

  const nextIds = new Set(nextBlocks.map((b) => b.id));
  // Silinenler
  const deletes = entry.blocks
    .filter((b) => b.taskId && !nextIds.has(b.id))
    .map((b) => api.delete(`/tasks/${b.taskId}/`));

  // Ekle / güncelle
  const result = [];
  const ops = nextBlocks.map(async (b) => {
    if (!b.taskId) {
      const { data } = await api.post(`/programs/${programId}/tasks/`, taskPayload(b));
      result.push(mapTaskToBlock(data));
    } else {
      const prev = prevById.get(b.id);
      if (prev && changed(prev, b)) {
        const { data } = await api.patch(`/tasks/${b.taskId}/`, taskPayload(b));
        result.push(mapTaskToBlock(data));
      } else {
        result.push(b);
      }
    }
  });

  await Promise.all([...deletes, ...ops]);
  entry.blocks = result.map((b) => ({ ...b }));
  cache.set(key, entry);
  return result;
}
