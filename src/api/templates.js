/* Program şablonları + atama — gerçek backend (/api/program-templates/, /api/programs/assign/).
   Şablon: rehberin isimli, tekrar kullanılabilir genel programı (öğrenci/tarih bağımsız,
   görevler haftanın gününe göre). Atama: bir planı öğrencinin (sıradaki boş) haftasına yazar. */
import api from './client';
import { subjectColor } from './catalog';

// DAY_IDS index = backend weekday (0=Pzt … 6=Paz) — mocks/data.js DAYS ile aynı sıra.
const DAY_IDS = ['pzt', 'sal', 'car', 'per', 'cum', 'cmt', 'paz'];
const pad2 = (n) => String(n).padStart(2, '0');

/** Board bloğu → şablon/atama görevi (gün → weekday, saat/süre, ders/metod/kitap/başlık). */
function blockToTask(b) {
  return {
    subject: b.subject ? Number(b.subject) : null,
    task_type: b.type ? Number(b.type) : null,
    book: b.book ? Number(b.book) : null,
    title: b.topic || '',
    weekday: Math.max(0, DAY_IDS.indexOf(b.day)),
    start_time: `${pad2(Math.floor(b.start))}:00`,
    duration_minutes: Math.round(b.duration * 60),
    order: 0,
  };
}

/** Şablon görevleri → board blokları (şablonu tahtaya yüklerken). */
export function templateToBlocks(tpl) {
  return (tpl.tasks || []).map((t, i) => ({
    id: `tpl${t.id}-${i}`,
    day: DAY_IDS[t.weekday] || 'pzt',
    start: t.start_time ? parseInt(t.start_time.slice(0, 2), 10) : 8,
    duration: (t.duration_minutes || 60) / 60,
    subject: t.subject != null ? String(t.subject) : '',
    subjectLabel: t.subject_label,
    subjectColor: subjectColor(t.subject_label || ''),
    type: t.task_type != null ? String(t.task_type) : '',
    typeName: t.task_type_name,
    topic: t.title || '',
    book: t.book != null ? t.book : null,
    bookLabel: t.book_label || null,
  }));
}

export async function listTemplates() {
  const { data } = await api.get('/program-templates/');
  return data; // [{ id, name, schedule_type, tasks }]
}

export async function createTemplate(name, blocks, scheduleType = 'timed') {
  const { data } = await api.post('/program-templates/', {
    name,
    schedule_type: scheduleType,
    tasks: blocks.map(blockToTask),
  });
  return data;
}

/** Mevcut şablonu (aynı obje) günceller — adı korunur, görevler değişir. */
export async function updateTemplate(id, name, blocks, scheduleType = 'timed') {
  const { data } = await api.patch(`/program-templates/${id}/`, {
    name,
    schedule_type: scheduleType,
    tasks: blocks.map(blockToTask),
  });
  return data;
}

export async function deleteTemplate(id) {
  await api.delete(`/program-templates/${id}/`);
}

/** Board'daki planı öğrenciye atar. startDate verilmezse backend sıradaki boş haftayı seçer. */
export async function assignBoard(studentId, blocks, startDate) {
  const body = { student: Number(studentId), tasks: blocks.map(blockToTask) };
  if (startDate) body.start_date = startDate;
  const { data } = await api.post('/programs/assign/', body);
  return data;
}

/** Kayıtlı şablonu doğrudan öğrenciye atar. */
export async function assignTemplate(templateId, studentId, startDate) {
  const body = { student: Number(studentId), template: templateId };
  if (startDate) body.start_date = startDate;
  const { data } = await api.post('/programs/assign/', body);
  return data;
}
