import { studentLibraries, curriculumNeeds } from '../mocks/data';
import { delay } from './mockDelay';
import { getStudentProgram, persistStudentSchedule } from './programs';

// "Genel Program" modu backend'siz → oturum-içi mock store. Öğrenciye özel mod
// gerçek /api/programs/'a bağlanır (programs.js).
const store = new Map();

export async function getSchedule(scope) {
  // scope bir öğrenci id ise gerçek program; değilse (genel) mock.
  if (scope) return getStudentProgram(scope);
  await delay();
  if (!store.has('genel')) store.set('genel', []);
  return store.get('genel');
}

export async function saveSchedule(scope, blocks) {
  if (scope) return persistStudentSchedule(scope, blocks);
  await delay(60);
  store.set('genel', blocks);
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
