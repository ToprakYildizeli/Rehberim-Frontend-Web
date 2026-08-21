import { delay } from './mockDelay';
import { getStudentProgram, persistStudentSchedule } from './programs';

// Öğrenci seçilmeden hazırlanan "genel" tahta bir taslaktır: oturum içinde tutulur,
// kalıcılığı şablon olarak kaydedilerek sağlanır (api/templates.js). Öğrenciye özel
// mod gerçek /api/programs/'a bağlanır (programs.js).
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
