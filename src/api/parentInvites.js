/* Veli davetleri (Faz D2). Rehber bir öğrencisi için tek kullanımlık kod üretir;
   veli mobilden o kodla KENDİ hesabını açar — rehber velinin şifresini bilmez.

   E3'teki (öğrenci id + rehberin davet kodu) yolun yerini almaz, ona alternatiftir
   ve daha dar yetki verir: kod tek öğrenciye ait, bir kez kullanılır, kullanılmadan
   iptal edilebilir. */
import api from './client';

/** Velinin görebileceği ekranlar (13 Eyl 2026). Hoca her veli için ayrı seçiyor:
 *  "her veli aynı değil" — kimi yalnız denemelerle ilgileniyor, kimine
 *  "uyumu görsün ama programın içini görmesin" deniyor.
 *
 *  Sıra ekrandaki sıradır; `detail` olanlar bir ekranın alt kırılımı ve
 *  bağlı olduğu ekran kapalıyken anlamsız kalmaz (uyum, programdan bağımsız
 *  verilebiliyor — hocanın açık isteği). */
export const PARENT_SCOPES = [
  { key: 'see_exams', label: 'Denemeler' },
  { key: 'see_exam_subject_nets', label: 'Deneme ders kırılımı', detail: true,
    hint: 'Kapalıyken yalnız toplam net görünür.' },
  { key: 'see_programs', label: 'Ders programı içeriği' },
  { key: 'see_compliance', label: 'Haftalık uyum yüzdesi', detail: true,
    hint: 'Programın içini açmadan da verilebilir.' },
  { key: 'see_topics', label: 'Konu takibi' },
  { key: 'see_achievements', label: 'Başarımlar' },
  { key: 'see_study_stats', label: 'Çalışma saatleri' },
  { key: 'see_calendar', label: 'Takvim' },
];

/** Yeni davetin başlangıç izinleri: hepsi açık — eski davranış buydu. */
export const ALL_SCOPES_ON = Object.fromEntries(
  PARENT_SCOPES.map(({ key }) => [key, true])
);

const adapt = (i) => ({
  id: i.id,
  studentId: i.student,
  studentName: i.student_name,
  code: i.code,
  label: i.label,
  createdAt: i.created_at,
  isUsed: i.is_used,
  usedAt: i.used_at,
  usedByName: i.used_by_name,
  scopes: Object.fromEntries(PARENT_SCOPES.map(({ key }) => [key, i[key] !== false])),
});

/** Rehberin davetleri; `studentId` verilirse tek öğrenciye daraltılır.
 *  Kullanılmış davetler de döner — hangi velinin nereden geldiği kaybolmasın. */
export async function listParentInvites(studentId) {
  const { data } = await api.get('/parent-invites/', {
    params: studentId ? { student: studentId } : undefined,
  });
  return data.map(adapt);
}

/** `scopes` verilmezse hepsi açık kabul edilir (sunucu varsayılanı). */
export async function createParentInvite(studentId, label = '', scopes = ALL_SCOPES_ON) {
  const { data } = await api.post('/parent-invites/', {
    student: studentId, label, ...scopes,
  });
  return adapt(data);
}

/** Yalnızca kullanılmamış davet silinebilir; kullanılmışta sunucu 400 döner. */
export async function deleteParentInvite(id) {
  await api.delete(`/parent-invites/${id}/`);
}
