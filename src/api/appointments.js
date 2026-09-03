/* Takvim gerçek backend'e bağlı (/api/calendar/). Rehber kendi etkinliklerini
   listeler/ekler/siler. Backend alanları (title/description/start_time/student)
   ekranın beklediği mock şekline (category/note/time/studentId) çevrilir.
   Not: backend'de ayrı 'category' alanı yok → kategori `title`'da taşınır. */
import api from './client';
import { colorFor } from '../components/ui/avatarUtils';

/** Backend CalendarEvent → ekranın beklediği randevu şekli. */
function adaptEvent(e) {
  return {
    id: e.id,
    date: e.date,
    time: e.start_time ? e.start_time.slice(0, 5) : '',
    studentId: e.student,
    category: e.title,
    note: e.description ?? '',
    student: e.student
      ? { id: e.student, name: e.student_name, color: colorFor(e.student_name ?? '') }
      : null,
  };
}

export async function listAppointments() {
  const { data } = await api.get('/calendar/');
  return data.map(adaptEvent);
}

export async function createAppointment({ date, time, studentId, category = 'Toplantı', note = '' }) {
  const { data } = await api.post('/calendar/', {
    student: studentId ? Number(studentId) : null,
    title: category,
    description: note,
    date,
    start_time: time ? `${time}:00` : null,
  });
  return adaptEvent(data);
}

export async function deleteAppointment(id) {
  await api.delete(`/calendar/${id}/`);
  return { ok: true };
}

/* --- .ics dışa/içe aktarma (D3) ---------------------------------------------
   Uç `Authorization` başlığı istediği için doğrudan bir `<a href>` ile
   indirilemiyor; dosya axios ile blob olarak çekilip tarayıcıya geçici bir
   object URL üzerinden verilir. */

/** Takvimi .ics olarak indirir. `filters` = { student, from, to } (hepsi opsiyonel). */
export async function exportCalendarIcs(filters = {}) {
  const params = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v != null && v !== '')
  );
  const { data } = await api.get('/calendar/export.ics', { params, responseType: 'blob' });
  const url = URL.createObjectURL(data);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'rehberim-takvim.ics';
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Nesne URL'i hemen bırakılırsa indirme bazı tarayıcılarda yarıda kalıyor.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** .ics dosyasını içe aktarır. `studentId` verilirse tüm etkinlikler ona bağlanır.
 *  Dönen: { total, created, skipped }. */
export async function importCalendarIcs(file, studentId = null) {
  const body = new FormData();
  body.append('file', file);
  if (studentId) body.append('student', String(studentId));
  const { data } = await api.post('/calendar/import-ics/', body, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}
