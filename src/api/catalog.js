/* Referans katalogları — gerçek backend'den (serbest metin/hardcoded yerine).
   Ders Programı bloklarının ders/metod/konu seçimlerini besler. */
import api from './client';

/** Blok türleri (backend `Task.kind`). Dış bloklar çalışma saatine sayılmaz. */
export const BLOCK_KINDS = [
  { value: 'study', label: 'Çalışma' },
  { value: 'external', label: 'Dış' },
  { value: 'exam', label: 'Deneme' },
];

/** Genel deneme kapsamı (backend `Task.exam_scope`) — ders seçilmeden. */
export const EXAM_SCOPES = [
  { value: 'tyt', label: 'Genel TYT' },
  { value: 'ayt', label: 'Genel AYT' },
];

const EXAM_SCOPE_LABEL = Object.fromEntries(EXAM_SCOPES.map((x) => [x.value, x.label]));

/** Blokta gösterilecek ad: dış blokta başlık, genel denemede kapsam, yoksa ders. */
export function blockLabel(b) {
  if (b.kind === 'external') return b.topic || 'Dış meşguliyet';
  /* Branş denemesi dersin önünde: "Paragraf Denemesi" rehberin bloğa verdiği
     addır ve "TYT Türkçe"den daha çok şey söyler. Sunucudaki `Task.label`
     sıralaması da böyle. */
  if (b.examTypeName) return b.examTypeName;
  if (b.examScope) return EXAM_SCOPE_LABEL[b.examScope] || 'Genel Deneme';
  return b.subjectLabel || '—';
}

/** Blok rengi: dış bloklar nötr, genel denemeler mor, çalışma blokları dersin rengi. */
export function blockColor(b) {
  if (b.kind === 'external') return 'var(--text-muted)';
  /* Dersi olmayan denemeler mor: genel kapsam ve özel tür. Özel denemenin
     ("Paragraf Denemesi") dersi yok, rengi dersten türetilemiyor. */
  if (b.examScope || b.examTypeName) return 'var(--violet)';
  return subjectColor(b.subjectLabel || '');
}

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
export async function listSubjects(params) {
  const { data } = await api.get('/subjects/', params ? { params } : undefined);
  return data.map((x, sira) => ({
    /* Sunucunun döndürdüğü SIRA anlamlıdır: `Subject.display_order` ile
       TYT (Türkçe · Sosyal · Matematik · Fen) sonra AYT (Edebiyat · Sosyal ·
       Matematik · Fen) dizilimi orada tutuluyor ve üç istemci de aynı
       dizilimi görsün diye istemciler listeyi yeniden SIRALAMAMALI.
       Dizinin kendisi her yere taşınmadığı için sırayı burada bir alana
       sabitliyoruz; sıralama gereken yerler `order` ile karşılaştırır. */
    order: sira,
    id: x.id,
    name: x.name,
    label: x.label,        // "TYT Matematik" gibi gösterim etiketi
    category: x.category,
    questionCount: x.question_count ?? 0,   // sınavdaki soru sayısı (maks. net)
    // Sınav bölümü bilgisi (api-reference → GET /api/subjects/). `sectionKey`
    // bölümü bileşenlerine bağlar; deneme kırılımı bununla gruplanıyor.
    isSection: Boolean(x.is_section),
    sectionKey: x.section_key || '',
    color: subjectColor(x.label || x.name),
  }));
}

/** Öğrencinin **alanına düşen** dersler: tüm TYT + alanının AYT dersleri.
 *  Ders satırlı tahtanın varsayılan satırlarını açmak için — kısıt değil, başlangıç
 *  kümesi; kullanıcı satır ekleyip çıkarabilir. Alan→AYT eşlemesi backend'de. */
export async function listFieldSubjects(studentId) {
  return listSubjects(studentId ? { student: studentId, scope: 'field' } : { scope: 'field' });
}

/** GET /api/task-types/ → [{ id, name }] (çalışma metodları). */
export async function listTaskTypes() {
  const { data } = await api.get('/task-types/');
  return data.map((x) => ({ id: x.id, name: x.name }));
}

/** GET /api/exam-types/ → [{ id, name }] (branş denemeleri).
 *
 *  Deneme bloğunun TÜRÜ: "Paragraf Denemesi", "Üçgenler Denemesi". Bölüm
 *  denemeleri ("Sosyal-1", "Fen Bilimleri") buraya girmez — onlar `Subject`
 *  satırı (`isSection`) ve deneme bloğunun DERS listesinde çıkar. */
export async function listExamTypes() {
  const { data } = await api.get('/exam-types/');
  return data.map((x) => ({ id: x.id, name: x.name }));
}

/** GET /api/publishers/ → [{ id, name }] (kitap eklerken dropdown). */
export async function listPublishers() {
  const { data } = await api.get('/publishers/');
  return data.map((x) => ({ id: x.id, name: x.name }));
}

/* Katalog yönetimi. İkisi de REHBERE AİTTİR (4 Eylül 2026): eklenen kayıt yalnız
   o rehberin ve öğrencilerinin listesine düşer, başka rehberi etkilemez. Rehber
   kendi kaydını düzeltip silebilir; başkasınınkine erişmeye çalışırsa 404 alır.
   Sunucu yakın-tekrarları Türkçe farkında (İ→i, I→ı) harf duyarsız
   karşılaştırmayla reddeder — kıyas rehberin kendi listesi içinde yapılır. */

export async function createTaskType(name) {
  const { data } = await api.post('/task-types/', { name });
  return { id: data.id, name: data.name };
}

export async function createExamType(name) {
  const { data } = await api.post('/exam-types/', { name });
  return { id: data.id, name: data.name };
}

export async function createPublisher(name) {
  const { data } = await api.post('/publishers/', { name });
  return { id: data.id, name: data.name };
}

export async function renameTaskType(id, name) {
  const { data } = await api.patch(`/task-types/${id}/`, { name });
  return { id: data.id, name: data.name };
}

export async function renameExamType(id, name) {
  const { data } = await api.patch(`/exam-types/${id}/`, { name });
  return { id: data.id, name: data.name };
}

export async function renamePublisher(id, name) {
  const { data } = await api.patch(`/publishers/${id}/`, { name });
  return { id: data.id, name: data.name };
}

/** Silmek görevleri bozmaz: `Task.task_type` SET_NULL, o bloklar metodsuz kalır
 *  ama silinmez. Yayınevinde ise hiçbir kitap etkilenmez — `Book.publisher` bir
 *  ilişki değil, yayınevinin adını tutan bir metin alanı. */
export async function deleteTaskType(id) {
  await api.delete(`/task-types/${id}/`);
}

export async function deletePublisher(id) {
  await api.delete(`/publishers/${id}/`);
}

/** Silmek deneme bloklarını bozmaz: `Task.exam_type` SET_NULL, blok branş
 *  bilgisini yitirir ama silinmez. */
export async function deleteExamType(id) {
  await api.delete(`/exam-types/${id}/`);
}

/** GET /api/topics/?subject=<id>[&grade=&curriculum=&student=] → konu kataloğu.
 *  Konu Takibi grade/curriculum geçip sıralı tam objeyi kullanır; Ders Programı
 *  `student` geçer ve müfredatı sunucuya türettirir.
 *
 *  **`student` geçmek önemli** (26 Eki 2026): müfredat verilmezse backend
 *  rehbere iki müfredatı birden döndürüyor; 11. sınıfın tahtasında maarif
 *  temalarının yanında eski müfredatın konuları da listeleniyordu. Öğrenciyi
 *  söyleyince sunucu sınıfından türetiyor (12/mezun→eski, 9/10/11→maarif) ve
 *  sınav derslerini (konuları yalnız `eski`de) süzgeçten muaf tutuyor.
 *
 *  **Katalog iki düzeyli** (topics-contract v1.3): uç yalnız üst düzey konuları
 *  satır olarak döndürür, alt konular her satırın `children` alanında gelir.
 *  Burada ağaç olduğu gibi korunuyor; listeye çevirmek isteyen
 *  `flattenTopics` kullanır. */
export async function listTopics(subjectId, { grade, curriculum, student, book } = {}) {
  if (!subjectId) return [];
  const params = { subject: subjectId };
  if (grade) params.grade = grade;
  if (curriculum) params.curriculum = curriculum;
  if (student) params.student = student;
  /* `book`: o kitaba eklenebilecek konular — kitabın dersi + öğrencinin
     müfredatı, sınıf sınırı olmadan. Uç diğer süzgeçleri yok sayıyor. */
  if (book) params.book = book;
  const { data } = await api.get('/topics/', { params });
  return data.map((x) => ({
    id: x.id,
    name: x.name,
    grade: x.grade,
    order: x.order,
    children: (x.children || []).map((c) => ({
      id: c.id,
      name: c.name,
      order: c.order,
      /* Alt konu dersi/sınıfı taşımıyor (uç göndermiyor, gerekmiyor):
         sunucu alt konuyu üstüyle aynı ders/sınıf/müfredatta olmaya
         zorluyor, yani şemsiyeninkiyle aynı. */
      grade: x.grade,
    })),
  }));
}

/** İki düzeyli kataloğu tek listeye indirir; `depth` 0 = şemsiye, 1 = alt konu.
 *
 *  Şemsiye listede KALIR — rehber "bütün problemler" diyebilmeli; alt konu da
 *  ayrı seçilebilmeli. Rehberin isteği tam olarak buydu ("hem problemler olsun
 *  hem ayrı olsun"), o yüzden `<optgroup>` kullanılmıyor: optgroup etiketi
 *  seçilemez ve şemsiye seçeneği kaybolurdu. */
export function flattenTopics(topics = []) {
  const out = [];
  for (const t of topics) {
    out.push({ ...t, depth: 0 });
    for (const c of t.children || []) {
      out.push({ ...c, depth: 1, parentId: t.id, parentName: t.name });
    }
  }
  return out;
}


/** GET /api/block-durations/ → rehberin süre hafızası.
 *
 *  Hafıza **rehber özelinde**dir: bir kombinasyona bir öğrencide 20 dk denildiyse
 *  başka öğrencide de 20 dk varsayılan gelir. Anahtar (ders, metod, konu) üçlüsü —
 *  "Matematik denemesi 1 saat" demek "Matematik soru çözümü 1 saat" demek değildir.
 *  Yazma ucu yoktur; hafıza blok kaydedilirken backend'de kendiliğinden güncellenir.
 *
 *  Dönen değer, doğrudan aranabilen bir Map: `durationKey(...)` → dakika. */
export async function loadDurationMemory() {
  const { data } = await api.get('/block-durations/');
  return new Map(
    (data || []).map((x) => [durationKey(x.subject, x.task_type, x.topic), x.duration_minutes]),
  );
}

/** Süre hafızası anahtarı. Boş konu geçerli bir anahtardır (konusuz blok da bir
 *  kombinasyondur); id'ler string'e çevrilir çünkü form alanları string tutar. */
export function durationKey(subject, taskType, topic) {
  return `${subject ?? ''}|${taskType ?? ''}|${(topic || '').trim()}`;
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
