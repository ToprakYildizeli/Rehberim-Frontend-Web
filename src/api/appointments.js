import { appointments as seed, students } from '../mocks/data';
import { delay } from './mockDelay';

// Mutable module-level copy so added events survive navigation within a session.
let items = [...seed];
let nextId = Math.max(...seed.map((x) => x.id)) + 1;

const hydrate = (row) => ({
  ...row,
  student: students.find((x) => x.id === row.studentId),
});

export async function listAppointments() {
  await delay();
  return items.map(hydrate);
}

export async function createAppointment({ date, time, studentId, category = 'Toplantı', note = '' }) {
  await delay();
  const row = { id: nextId, date, time, studentId: Number(studentId), category, note };
  nextId += 1;
  items = [...items, row];
  return hydrate(row);
}

export async function deleteAppointment(id) {
  await delay();
  items = items.filter((x) => x.id !== id);
  return { ok: true };
}
