/* Mock-backed for now. Each function returns the same shape the Django API is
   expected to return, so switching to `api.get(...)` is a per-function change. */
import { students, netComparison, CLASS_AVERAGE } from '../mocks/data';
import { delay } from './mockDelay';

export async function listStudents() {
  await delay();
  return students;
}

export async function getStudent(id) {
  await delay();
  return students.find((x) => x.id === Number(id)) ?? null;
}

export async function getNetComparison(range = 'son-deneme') {
  await delay();
  return {
    range,
    classAverage: CLASS_AVERAGE,
    items: (netComparison[range] ?? []).map((row) => ({
      ...row,
      student: students.find((x) => x.id === row.studentId),
    })),
  };
}
