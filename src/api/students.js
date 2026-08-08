/* Öğrenci listesi gerçek backend'e bağlı (GET /api/students/, yalnızca rehber).
   Backend yalnızca kimlik alanlarını döndürür; net/uyum/tamamlanma gibi metrikler
   henüz backend'de üretilmiyor, bu yüzden yer tutucu (null/boş) veriliyor.
   getNetComparison (Panel) hâlâ mock — ayrı bir iş. */
import api from './client';
import { netComparison, CLASS_AVERAGE, students as mockStudents } from '../mocks/data';
import { delay } from './mockDelay';
import { colorFor } from '../components/ui/avatarUtils';

/** Backend öğrenci kaydını ekranların beklediği şekle çevirir.
    Metrik alanları backend'de yok → null/boş (UI "—" gösterir). */
function adaptStudent(s) {
  return {
    id: s.id,
    name: s.full_name,
    grade: s.grade_display,
    study_field: s.study_field,
    color: colorFor(s.full_name),
    lastNet: null,
    compliance: null,
    completion: null,
    trend: null,
    lastMeeting: null,
    nextMeeting: null,
    examHistory: [],
    subjects: {},
  };
}

export async function listStudents() {
  const { data } = await api.get('/students/');
  return data.map(adaptStudent);
}

export async function getStudent(id) {
  const list = await listStudents();
  return list.find((x) => x.id === Number(id)) ?? null;
}

// TODO: backend'de öğrenci-özet / net karşılaştırma ucu yok; Panel şimdilik mock.
export async function getNetComparison(range = 'son-deneme') {
  await delay();
  return {
    range,
    classAverage: CLASS_AVERAGE,
    items: (netComparison[range] ?? []).map((row) => ({
      ...row,
      student: mockStudents.find((x) => x.id === row.studentId),
    })),
  };
}
