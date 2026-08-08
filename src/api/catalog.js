/* Referans katalogları — gerçek backend'den (serbest metin/hardcoded yerine).
   Ders Programı bloklarının ders/metod/konu seçimlerini besler. */
import api from './client';

/** Ders adından programdaki blok rengini üretir (mevcut --subj-* CSS değişkenleri). */
export function subjectColor(name = '') {
  const n = name.toLocaleLowerCase('tr-TR');
  if (n.includes('matemat')) return 'var(--subj-matematik)';
  if (n.includes('türkçe') || n.includes('edebiyat') || n.includes('türk dili')) return 'var(--subj-turkce)';
  if (n.includes('fizik')) return 'var(--subj-fizik)';
  if (n.includes('kimya')) return 'var(--subj-kimya)';
  if (n.includes('biyoloji')) return 'var(--subj-biyoloji)';
  if (n.includes('geometri')) return 'var(--subj-geometri)';
  return 'var(--subj-genel)';
}

/** GET /api/subjects/ → [{ id, name, label, category, color }] (33 gerçek ders). */
export async function listSubjects() {
  const { data } = await api.get('/subjects/');
  return data.map((x) => ({
    id: x.id,
    name: x.name,
    label: x.label,        // "TYT Matematik" gibi gösterim etiketi
    category: x.category,
    color: subjectColor(x.label || x.name),
  }));
}

/** GET /api/task-types/ → [{ id, name }] (çalışma metodları). */
export async function listTaskTypes() {
  const { data } = await api.get('/task-types/');
  return data.map((x) => ({ id: x.id, name: x.name }));
}

/** GET /api/topics/?subject=<id> → seçilen dersin konu kataloğu [{ id, name }]. */
export async function listTopics(subjectId) {
  if (!subjectId) return [];
  const { data } = await api.get('/topics/', { params: { subject: subjectId } });
  return data.map((x) => ({ id: x.id, name: x.name }));
}

/** GET /api/books/?student=<id> → öğrencinin kütüphanesi. Ders Programı'nda
 *  doğrudan sürüklenip blok yapılabilir kitaplar (kaynak = kitap). */
export async function listBooks(studentId) {
  if (!studentId) return [];
  const { data } = await api.get('/books/', { params: { student: studentId } });
  return data.map((b) => ({
    id: b.id,
    kind: b.kind,                       // 'ders' | 'okuma'
    label: b.label,                     // "TYT Matematik 345 Yay. Soru Bankası" / okuma başlığı
    subject: b.subject != null ? String(b.subject) : '',
    subjectLabel: b.subject_label,      // "TYT Matematik" (okuma kitabında null)
    bookFormat: b.book_format,          // 'soru_bankasi' | 'konu_anlatimi' | 'paragraf' | 'deneme'
    color: subjectColor(b.subject_label || b.label),
  }));
}
