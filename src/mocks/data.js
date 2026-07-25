/* Fixtures transcribed from the product walkthrough recording.
   Shapes mirror what the Django API is expected to return, so swapping a
   resource module in src/api/ over to a real endpoint is a one-file change. */

export const SUBJECTS = [
  { id: 'matematik', name: 'Matematik', color: 'var(--subj-matematik)' },
  { id: 'turkce', name: 'Türkçe', color: 'var(--subj-turkce)' },
  { id: 'fizik', name: 'Fizik', color: 'var(--subj-fizik)' },
  { id: 'geometri', name: 'Geometri', color: 'var(--subj-geometri)' },
  { id: 'kimya', name: 'Kimya', color: 'var(--subj-kimya)' },
  { id: 'biyoloji', name: 'Biyoloji', color: 'var(--subj-biyoloji)' },
  { id: 'genel', name: 'Genel Çalışma', color: 'var(--subj-genel)' },
];

export const SUBJECT_MAP = Object.fromEntries(SUBJECTS.map((x) => [x.id, x]));

export const STUDY_TYPES = [
  { id: 'soru', name: 'Soru Çözümü' },
  { id: 'konu', name: 'Konu Anlatımı' },
  { id: 'tekrar', name: 'Tekrar' },
  { id: 'deneme', name: 'Deneme' },
];

export const DAYS = [
  { id: 'pzt', short: 'Pzt', name: 'Pazartesi' },
  { id: 'sal', short: 'Sal', name: 'Salı' },
  { id: 'car', short: 'Çar', name: 'Çarşamba' },
  { id: 'per', short: 'Per', name: 'Perşembe' },
  { id: 'cum', short: 'Cum', name: 'Cuma' },
  { id: 'cmt', short: 'Cmt', name: 'Cumartesi' },
  { id: 'paz', short: 'Paz', name: 'Pazar' },
];

/** Timetable rows: 07:00 → 22:00 as seen in the recording. */
export const HOURS = Array.from({ length: 16 }, (_, i) => i + 7);

export const students = [
  {
    id: 1, name: 'Ahmet Yılmaz', grade: '11-A', color: '#3b5bdb',
    lastNet: 42.5, compliance: 87, completion: 74, trend: 'up',
    lastMeeting: '22 Haz 2026', nextMeeting: '29 Haz 2026, 14:00',
    examHistory: [{ label: 'D1', net: 33 }, { label: 'D2', net: 36 }, { label: 'D3', net: 33 }, { label: 'D4', net: 40 }, { label: 'D5', net: 42.5 }],
    subjects: { matematik: 68, turkce: 74, fizik: 61, kimya: 55 },
  },
  {
    id: 2, name: 'Zeynep Kaya', grade: '12-B', color: '#3b5bdb',
    lastNet: 56.75, compliance: 94, completion: 88, trend: 'up',
    lastMeeting: '20 Haz 2026', nextMeeting: '30 Haz 2026, 11:00',
    examHistory: [{ label: 'D1', net: 44 }, { label: 'D2', net: 47 }, { label: 'D3', net: 51 }, { label: 'D4', net: 54 }, { label: 'D5', net: 56.75 }],
    subjects: { matematik: 82, turkce: 90, fizik: 76, kimya: 71 },
  },
  {
    id: 3, name: 'Mehmet Demir', grade: '11-C', color: '#f59e0b',
    lastNet: 31.25, compliance: 62, completion: 51, trend: 'down',
    lastMeeting: '18 Haz 2026', nextMeeting: '29 Haz 2026, 15:30',
    examHistory: [{ label: 'D1', net: 38 }, { label: 'D2', net: 36 }, { label: 'D3', net: 35 }, { label: 'D4', net: 33 }, { label: 'D5', net: 31.25 }],
    subjects: { matematik: 44, turkce: 58, fizik: 39, kimya: 35 },
  },
  {
    id: 4, name: 'Elif Aydın', grade: '12-A', color: '#3b5bdb',
    lastNet: 52, compliance: 91, completion: 80, trend: 'up',
    lastMeeting: '21 Haz 2026', nextMeeting: '01 Tem 2026, 10:00',
    examHistory: [{ label: 'D1', net: 41 }, { label: 'D2', net: 44 }, { label: 'D3', net: 47 }, { label: 'D4', net: 50 }, { label: 'D5', net: 52 }],
    subjects: { matematik: 78, turkce: 85, fizik: 72, kimya: 68 },
  },
  {
    id: 5, name: 'Can Özkan', grade: '11-B', color: '#f59e0b',
    lastNet: 38.5, compliance: 78, completion: 64, trend: 'flat',
    lastMeeting: '19 Haz 2026', nextMeeting: '02 Tem 2026, 16:00',
    examHistory: [{ label: 'D1', net: 37 }, { label: 'D2', net: 38 }, { label: 'D3', net: 38 }, { label: 'D4', net: 39 }, { label: 'D5', net: 38.5 }],
    subjects: { matematik: 60, turkce: 66, fizik: 55, kimya: 52 },
  },
  {
    id: 6, name: 'Selin Arslan', grade: '12-C', color: '#3b5bdb',
    lastNet: 61.25, compliance: 96, completion: 92, trend: 'up',
    lastMeeting: '23 Haz 2026', nextMeeting: '30 Haz 2026, 09:00',
    examHistory: [{ label: 'D1', net: 50 }, { label: 'D2', net: 53 }, { label: 'D3', net: 56 }, { label: 'D4', net: 59 }, { label: 'D5', net: 61.25 }],
    subjects: { matematik: 90, turkce: 94, fizik: 86, kimya: 82 },
  },
  {
    id: 7, name: 'Burak Çelik', grade: '11-A', color: '#ef4444',
    lastNet: 28, compliance: 55, completion: 42, trend: 'down',
    lastMeeting: '15 Haz 2026', nextMeeting: '29 Haz 2026, 17:00',
    examHistory: [{ label: 'D1', net: 36 }, { label: 'D2', net: 34 }, { label: 'D3', net: 32 }, { label: 'D4', net: 30 }, { label: 'D5', net: 28 }],
    subjects: { matematik: 40, turkce: 65, fizik: 32, kimya: 42 },
  },
  {
    id: 8, name: 'Deniz Yıldız', grade: '12-B', color: '#3b5bdb',
    lastNet: 47.25, compliance: 83, completion: 76, trend: 'up',
    lastMeeting: '22 Haz 2026', nextMeeting: '03 Tem 2026, 13:00',
    examHistory: [{ label: 'D1', net: 39 }, { label: 'D2', net: 41 }, { label: 'D3', net: 44 }, { label: 'D4', net: 46 }, { label: 'D5', net: 47.25 }],
    subjects: { matematik: 71, turkce: 79, fizik: 66, kimya: 63 },
  },
];

export const CLASS_AVERAGE = 43.4;

/** Net comparison chart series, keyed by the time filter. */
export const netComparison = {
  'son-deneme': [
    { studentId: 1, net: 37.9 }, { studentId: 2, net: 52.8 }, { studentId: 3, net: 35.5 },
    { studentId: 4, net: 48.8 }, { studentId: 5, net: 38.1 }, { studentId: 6, net: 58.3 },
    { studentId: 7, net: 31 }, { studentId: 8, net: 43.4 },
  ],
  'son-1-ay': [
    { studentId: 1, net: 40.2 }, { studentId: 2, net: 54.1 }, { studentId: 3, net: 33.8 },
    { studentId: 4, net: 50.3 }, { studentId: 5, net: 38.4 }, { studentId: 6, net: 59.6 },
    { studentId: 7, net: 29.7 }, { studentId: 8, net: 45.1 },
  ],
  'son-3-ay': [
    { studentId: 1, net: 42.5 }, { studentId: 2, net: 56.75 }, { studentId: 3, net: 31.25 },
    { studentId: 4, net: 52 }, { studentId: 5, net: 38.5 }, { studentId: 6, net: 61.25 },
    { studentId: 7, net: 28 }, { studentId: 8, net: 47.25 },
  ],
};

export const pendingActions = [
  { id: 1, icon: 'file', text: '3 öğrencinin haftalık programı henüz atanmadı', cta: 'Program Ata' },
  { id: 2, icon: 'calendar', text: '2 toplantı talebi onay bekliyor', cta: 'İncele' },
  { id: 3, icon: 'chart', text: "Zeynep'in deneme analizi hazır", cta: 'Görüntüle' },
];

export const redAlerts = [
  { id: 1, studentId: 7, tone: 'danger', reason: '3 gündür giriş yapmadı' },
  { id: 2, studentId: 3, tone: 'danger', reason: 'Net 4 puan düştü' },
  { id: 3, studentId: 5, tone: 'warning', reason: 'Program uyumu %78 e gerdedi' },
];

export const activityFeed = [
  { id: 1, studentId: 1, tone: 'success', text: 'Logaritma görevini tamamladı', time: '10 dk önce' },
  { id: 2, studentId: 2, tone: 'accent', text: 'TYT denemesini bitirdi — 56.75 net', time: '32 dk önce' },
  { id: 3, studentId: 4, tone: 'violet', text: 'Türkçe Paragraf 40 soru çözdü', time: '1 saat önce' },
  { id: 4, studentId: 5, tone: 'warning', text: '"Yapıldı" olarak işaretledi: Kimya tekrarı', time: '2 saat önce' },
  { id: 5, studentId: 6, tone: 'success', text: 'Günlük tüm görevlerini tamamladı', time: '3 saat önce' },
];

export const aiInsights = [
  {
    id: 1, studentId: 3, tag: 'Kritik', tone: 'danger',
    body: 'Son 3 haftada genel uyum oranı %62 ye düştü. Matematik ve kimya görevlerinde ciddi aksama var. Motivasyon görüşmesi önerilir.',
    cta: 'Acil toplantı planla',
  },
  {
    id: 2, studentId: 7, tag: 'Kritik', tone: 'danger',
    body: 'Haftalık görev tamamlanma oranı %55 ile en düşük seviyede. Ders programı yoğunluğu gözden geçirilmeli.',
    cta: 'Program yoğunluğunu gözden geçir',
  },
  {
    id: 3, studentId: 6, tag: 'Başarılı', tone: 'success',
    body: 'Tüm alanlarda mükemmel performans! %96 uyum oranıyla dönemin net trendi en yüksek öğrencisi.',
    cta: 'Tebrik mesajı gönder',
  },
  {
    id: 4, studentId: 5, tag: 'Bilgi', tone: 'accent',
    body: 'Türkçe de güçlü performans gösteriyor (%85). Ancak sayısal branşlarında destek gerekiyor.',
    cta: 'Fen bilimleri odaklı plan kur',
  },
];

export const appointments = [
  { id: 1, date: '2026-06-26', time: '10:00', studentId: 2, category: 'Görüşme', note: 'Deneme değerlendirme' },
  { id: 2, date: '2026-06-27', time: '13:00', studentId: 5, category: 'Toplantı', note: 'Veli görüşmesi' },
  { id: 3, date: '2026-06-29', time: '14:00', studentId: 1, category: 'Toplantı', note: 'Haftalık değerlendirme' },
  { id: 4, date: '2026-06-29', time: '15:30', studentId: 3, category: 'Toplantı', note: 'Motivasyon görüşmesi' },
  { id: 5, date: '2026-06-30', time: '09:00', studentId: 6, category: 'Görüşme', note: 'Hedef planlama' },
];

/** Weekly timetable. `day` matches DAYS[].id, `start` is the hour, `duration` in hours. */
export const generalSchedule = [
  { id: 'g1', day: 'pzt', start: 9, duration: 2, subject: 'matematik', type: 'konu', topic: 'Türev' },
  { id: 'g2', day: 'pzt', start: 14, duration: 1, subject: 'turkce', type: 'soru', topic: 'Paragraf' },
  { id: 'g3', day: 'sal', start: 9, duration: 2, subject: 'fizik', type: 'konu', topic: 'Optik' },
  { id: 'g4', day: 'sal', start: 16, duration: 1, subject: 'kimya', type: 'tekrar', topic: 'Asit-Baz' },
  { id: 'g5', day: 'car', start: 10, duration: 2, subject: 'matematik', type: 'soru', topic: 'İntegral' },
  { id: 'g6', day: 'car', start: 13, duration: 1, subject: 'geometri', type: 'soru', topic: 'Çember' },
  { id: 'g7', day: 'car', start: 15, duration: 1, subject: 'biyoloji', type: 'konu', topic: 'Hücre' },
  { id: 'g8', day: 'per', start: 9, duration: 2, subject: 'turkce', type: 'konu', topic: 'Ses Bilgisi' },
  { id: 'g9', day: 'per', start: 11, duration: 1, subject: 'fizik', type: 'soru', topic: 'Kuvvet' },
  { id: 'g10', day: 'cum', start: 10, duration: 3, subject: 'genel', type: 'deneme', topic: 'TYT Deneme' },
  { id: 'g11', day: 'cum', start: 15, duration: 2, subject: 'matematik', type: 'tekrar', topic: 'Limit' },
  { id: 'g12', day: 'cmt', start: 14, duration: 2, subject: 'genel', type: 'tekrar', topic: 'Eksik Konular' },
  { id: 'g13', day: 'paz', start: 9, duration: 1, subject: 'turkce', type: 'soru', topic: 'Genel Tekrar' },
];

export const studentLibraries = {
  6: ['3D Matematik', 'Geometri Konu Anlatımı', 'Kimya AYT', 'Biyoloji Konu Anlatımı'],
  1: ['Palme Fizik', 'Limit Yayınları TYT', 'Türkçe Paragraf Seti'],
  3: ['Temel Matematik Soru Bankası', 'Kimya Föy'],
};

export const curriculumNeeds = [
  { subject: 'matematik', remaining: 4 },
  { subject: 'fizik', remaining: 2 },
  { subject: 'kimya', remaining: 3 },
];
