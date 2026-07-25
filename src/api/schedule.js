import { generalSchedule, studentLibraries, curriculumNeeds } from '../mocks/data';
import { delay } from './mockDelay';

// Per-scope schedules ('genel' or a student id), mutable for the session.
const store = new Map([['genel', [...generalSchedule]]]);

const scopeKey = (studentId) => (studentId ? String(studentId) : 'genel');

export async function getSchedule(studentId) {
  await delay();
  const key = scopeKey(studentId);
  if (!store.has(key)) {
    // A student without a saved schedule starts from the general template.
    store.set(key, generalSchedule.map((b) => ({ ...b, id: `${key}-${b.id}` })));
  }
  return store.get(key);
}

export async function saveSchedule(studentId, blocks) {
  await delay(60);
  store.set(scopeKey(studentId), blocks);
  return blocks;
}

export async function getStudentLibrary(studentId) {
  await delay();
  return studentLibraries[studentId] ?? [];
}

export async function getCurriculumNeeds() {
  await delay();
  return curriculumNeeds;
}
