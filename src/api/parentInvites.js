/* Veli davetleri (Faz D2). Rehber bir öğrencisi için tek kullanımlık kod üretir;
   veli mobilden o kodla KENDİ hesabını açar — rehber velinin şifresini bilmez.

   E3'teki (öğrenci id + rehberin davet kodu) yolun yerini almaz, ona alternatiftir
   ve daha dar yetki verir: kod tek öğrenciye ait, bir kez kullanılır, kullanılmadan
   iptal edilebilir. */
import api from './client';

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
});

/** Rehberin davetleri; `studentId` verilirse tek öğrenciye daraltılır.
 *  Kullanılmış davetler de döner — hangi velinin nereden geldiği kaybolmasın. */
export async function listParentInvites(studentId) {
  const { data } = await api.get('/parent-invites/', {
    params: studentId ? { student: studentId } : undefined,
  });
  return data.map(adapt);
}

export async function createParentInvite(studentId, label = '') {
  const { data } = await api.post('/parent-invites/', { student: studentId, label });
  return adapt(data);
}

/** Yalnızca kullanılmamış davet silinebilir; kullanılmışta sunucu 400 döner. */
export async function deleteParentInvite(id) {
  await api.delete(`/parent-invites/${id}/`);
}
