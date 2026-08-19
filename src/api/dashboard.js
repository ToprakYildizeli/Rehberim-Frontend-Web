/* Rehber panosu — TAMAMEN gerçek veriden türetilir (mock yok). Rehberin kendi
   öğrencilerinin verilerini (öğrenci, program+görev, deneme+net, konu ilerlemesi,
   takvim) tek seferde çekip client-side toplar. Backend'e aggregate uç gerekmez. */
import api from './client';
import { listStudents } from './students';
import { listAppointments } from './appointments';

const pad2 = (n) => String(n).padStart(2, '0');
const isoOf = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const todayIso = () => isoOf(new Date());
const round1 = (n) => Math.round(n * 10) / 10;

// "Deneme Ort." kıyası — sınav (TYT/AYT) + o sınava göre ders grubu.
const NET_DIM_GROUPS = {
  tyt: [
    { key: 'total', label: 'Toplam', subs: null, max: 120 },
    { key: 'tr', label: 'Türkçe', subs: ['TYT Türkçe'], max: 40 },
    { key: 'sos', label: 'Sosyal', subs: ['TYT Tarih', 'TYT Coğrafya', 'TYT Felsefe', 'TYT Din Kültürü ve Ahlak Bilgisi'], max: 20 },
    { key: 'mat', label: 'Matematik', subs: ['TYT Matematik', 'TYT Geometri'], max: 40 },
    { key: 'fen', label: 'Fen', subs: ['TYT Fizik', 'TYT Kimya', 'TYT Biyoloji'], max: 20 },
  ],
  ayt: [
    { key: 'total', label: 'Toplam', subs: null, max: 80 },
    { key: 'edb', label: 'Edebiyat', subs: ['AYT Türk Dili ve Edebiyatı'], max: 24 },
    { key: 'tar', label: 'Tarih', subs: ['AYT Tarih-1', 'AYT Tarih-2'], max: 21 },
    { key: 'cog', label: 'Coğrafya', subs: ['AYT Coğrafya-1', 'AYT Coğrafya-2'], max: 17 },
    { key: 'fel', label: 'Felsefe', subs: ['AYT Felsefe'], max: 12 },
    { key: 'mat', label: 'Matematik', subs: ['AYT Matematik', 'AYT Geometri'], max: 40 },
    { key: 'fiz', label: 'Fizik', subs: ['AYT Fizik'], max: 14 },
    { key: 'kim', label: 'Kimya', subs: ['AYT Kimya'], max: 13 },
    { key: 'biy', label: 'Biyoloji', subs: ['AYT Biyoloji'], max: 13 },
  ],
};

/** Bir öğrencinin bir net boyutundaki (tür + ders grubu) denemeler-arası ortalaması. */
function dimAvg(exams, type, subs) {
  const exs = exams.filter((e) => e.exam_type === type);
  if (!exs.length) return null;
  const vals = exs.map((e) => (subs
    ? round1((e.subject_nets || []).filter((n) => subs.includes(n.subject_label)).reduce((a, n) => a + n.net, 0))
    : e.total_net));
  return round1(vals.reduce((a, x) => a + x, 0) / vals.length);
}

/** start_date (YYYY-MM-DD) + 6 gün = programın son günü. */
function endDateOf(startIso) {
  const [y, m, d] = startIso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + 6);
  return isoOf(dt);
}

/** Panoyu besleyen tüm türetilmiş veriyi döndürür. */
export async function getDashboard() {
  const [students, appts, programsRes, examsRes, tpRes] = await Promise.all([
    listStudents(),
    listAppointments(),
    api.get('/programs/'),
    api.get('/exams/'),
    api.get('/topic-progress/'),
  ]);
  const programs = programsRes.data || [];
  const exams = examsRes.data || [];
  const tps = tpRes.data || [];
  const today = todayIso();

  // Öğrenci başına verileri grupla
  const bucket = {};
  students.forEach((s) => { bucket[s.id] = { exams: [], programs: [], tps: [] }; });
  exams.forEach((e) => { bucket[e.student]?.exams.push(e); });
  programs.forEach((p) => { bucket[p.student]?.programs.push(p); });
  tps.forEach((t) => { bucket[t.student]?.tps.push(t); });

  const enriched = students.map((s) => {
    const b = bucket[s.id];
    const exSorted = b.exams.slice().sort((a, c) => (a.exam_date < c.exam_date ? 1 : -1));
    // Trend AYNI sınav türü içinde (TYT↔AYT kıyaslamak anlamsız).
    const lastEx = exSorted[0] || null;
    const prevSame = exSorted.slice(1).find((e) => e.exam_type === lastEx?.exam_type) || null;
    const lastNet = lastEx?.total_net ?? null;
    const prevNet = prevSame?.total_net ?? null;
    // Deneme ort. yalnız TYT (herkes girer, ortak 120'lik ölçek → kıyaslanabilir)
    const tytEx = b.exams.filter((e) => e.exam_type === 'tyt');
    const avgNet = tytEx.length ? round1(tytEx.reduce((a, e) => a + e.total_net, 0) / tytEx.length) : null;
    const netDelta = (lastNet != null && prevNet != null) ? round1(lastNet - prevNet) : null;
    const trend = netDelta == null ? null : netDelta > 0 ? 'up' : netDelta < 0 ? 'down' : 'flat';

    const avgLevel = b.tps.length ? round1(b.tps.reduce((a, t) => a + t.level, 0) / b.tps.length) : null;
    const weakCount = b.tps.filter((t) => t.level <= 2).length;

    const weekHours = b.programs.map((p) => (p.tasks || []).reduce((a, t) => a + (t.duration_minutes || 0), 0) / 60);
    const weeklyHours = weekHours.length ? round1(weekHours.reduce((a, x) => a + x, 0) / weekHours.length) : 0;

    const current = b.programs.find((p) => p.start_date <= today && today <= endDateOf(p.start_date));
    const hasCurrentProgram = !!current;
    let compliance = null;
    if (current && current.tasks?.length) {
      compliance = Math.round(current.tasks.filter((t) => t.is_completed).length / current.tasks.length * 100);
    } else if (current) {
      compliance = 0;
    }

    const netDims = {};
    Object.entries(NET_DIM_GROUPS).forEach(([type, groups]) => {
      groups.forEach((g) => { netDims[`${type}_${g.key}`] = dimAvg(b.exams, type, g.subs); });
    });

    return {
      ...s,
      examCount: b.exams.length,
      lastNet, avgNet, netDelta, trend,
      avgLevel, weakCount,
      weeklyHours,
      hasCurrentProgram, compliance,
      netDims,
      lastExamDate: exSorted[0]?.exam_date ?? null,
    };
  });

  const enrById = Object.fromEntries(enriched.map((e) => [e.id, e]));

  // Öğrenci-bazlı net serisi (çok çizgili grafik) — tür başına, tarihe göre sıralı
  const seriesFor = (type) => students
    .map((s) => {
      const exs = bucket[s.id].exams
        .filter((e) => e.exam_type === type)
        .sort((a, c) => (a.exam_date < c.exam_date ? -1 : 1));
      return exs.length ? {
        id: s.id, name: enrById[s.id].name, color: enrById[s.id].color,
        points: exs.map((e, i) => ({ x: i, label: e.name.replace(/^(TYT|AYT)\s+/, ''), net: e.total_net })),
      } : null;
    })
    .filter(Boolean);
  const netSeries = { tyt: seriesFor('tyt'), ayt: seriesFor('ayt') };

  // Yaklaşan görüşmeler (bugünden itibaren)
  const upcoming = appts
    .filter((a) => a.date >= today)
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));

  // KPI'lar
  const withProgram = enriched.filter((e) => e.hasCurrentProgram).length;
  const netted = enriched.filter((e) => e.avgNet != null);
  const kpis = {
    count: enriched.length,
    withProgram,
    withoutProgram: enriched.length - withProgram,
    upcoming: upcoming.length,
    avgNet: netted.length ? round1(netted.reduce((a, e) => a + e.avgNet, 0) / netted.length) : null,
  };

  // Aksiyon listeleri
  const needProgram = enriched.filter((e) => !e.hasCurrentProgram);
  // Program uyumu — bu hafta programlı herkes, düşükten yükseğe sıralı (%)
  const complianceRanked = enriched
    .filter((e) => e.hasCurrentProgram && e.compliance != null)
    .sort((a, b) => a.compliance - b.compliance);

  // Net değişimi: herkes — son denemenin (aynı tür) öncekine göre farkı; en çok düşen başta
  const netChanges = enriched
    .filter((e) => e.netDelta != null)
    .sort((a, b) => a.netDelta - b.netDelta);

  // Konu takibi — konu ilerlemesi olan herkes, ortalama seviye yüksekten düşüğe
  const konuRanked = enriched
    .filter((e) => e.avgLevel != null)
    .sort((a, b) => b.avgLevel - a.avgLevel);

  return {
    students: enriched, enrById, upcoming, kpis, needProgram,
    complianceRanked, netChanges, konuRanked, netSeries,
    netDimGroups: {
      tyt: NET_DIM_GROUPS.tyt.map(({ key, label, max }) => ({ key, label, max })),
      ayt: NET_DIM_GROUPS.ayt.map(({ key, label, max }) => ({ key, label, max })),
    },
  };
}
