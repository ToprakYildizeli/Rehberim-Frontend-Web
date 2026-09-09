/* Rehber panosu — TAMAMEN gerçek veriden türetilir (mock yok). Rehberin kendi
   öğrencilerinin verilerini (öğrenci, program+görev, deneme+net, konu ilerlemesi,
   takvim) tek seferde çekip client-side toplar. Backend'e aggregate uç gerekmez. */
import api from './client';
import { listStudents } from './students';
import { seriesColor } from '../components/ui/avatarUtils';
import { listAppointments } from './appointments';
import { listSubjects } from './catalog';
import { getPreferences } from './preferences';

const pad2 = (n) => String(n).padStart(2, '0');
const isoOf = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const todayIso = () => isoOf(new Date());
const round1 = (n) => Math.round(n * 10) / 10;

/* "Deneme Ort." kıyası — TYT'de tek ölçek; AYT'de ölçek **alana** bağlıdır.
 *
 * Listeler `subject_label`'a bakar. Net ders bazında da bölüm bazında da
 * girilebiliyor (exam-contract v1.3), ikisi aynı denemede bulunamıyor.
 * Matematik'te bölümün etiketi dersinkiyle aynı ("TYT Matematik" — ayrım
 * `name`'de: ders "Matematik", bölüm "TYT Matematik"), o yüzden tek giriş
 * ikisini de yakalıyor. Sosyal ve Fen'de bölüm etiketi ayrı, eklenmesi
 * gerekti — yoksa bölüm bazında girilmiş deneme bu kıyasta 0 görünürdü. */
const TYT_DIM_GROUPS = [
  { key: 'total', label: 'Toplam', subs: null, max: 120 },
  { key: 'tr', label: 'Türkçe', subs: ['TYT Türkçe'], max: 40 },
  { key: 'sos', label: 'Sosyal', subs: ['TYT Tarih', 'TYT Coğrafya', 'TYT Felsefe', 'TYT Din Kültürü ve Ahlak Bilgisi', 'TYT Sosyal'], max: 20 },
  { key: 'mat', label: 'Matematik', subs: ['TYT Matematik', 'TYT Geometri'], max: 40 },
  { key: 'fen', label: 'Fen', subs: ['TYT Fizik', 'TYT Kimya', 'TYT Biyoloji', 'TYT Fen'], max: 20 },
];

/** AYT ders grupları — hangi derslerin hangi başlık altında toplandığı.
 *  Maksimum netler burada YAZILI DEĞİL; alana göre `/api/subjects/`ten gelen
 *  `question_count` toplanarak hesaplanır (bkz. aytGroupsFor). */
const AYT_DIM_GROUPS = [
  { key: 'edb', label: 'Edebiyat', subs: ['AYT Türk Dili ve Edebiyatı'] },
  { key: 'tar', label: 'Tarih', subs: ['AYT Tarih-1', 'AYT Tarih-2'] },
  { key: 'cog', label: 'Coğrafya', subs: ['AYT Coğrafya-1', 'AYT Coğrafya-2'] },
  { key: 'fel', label: 'Felsefe', subs: ['AYT Felsefe'] },
  { key: 'din', label: 'Din Kültürü', subs: ['AYT Din Kültürü ve Ahlak Bilgisi'] },
  { key: 'mat', label: 'Matematik', subs: ['AYT Matematik', 'AYT Geometri'] },
  { key: 'fiz', label: 'Fizik', subs: ['AYT Fizik'] },
  { key: 'kim', label: 'Kimya', subs: ['AYT Kimya'] },
  { key: 'biy', label: 'Biyoloji', subs: ['AYT Biyoloji'] },
];

/** Alanların gösterim sırası ve adları (backend `Student.StudyField`). */
export const AYT_FIELDS = [
  { value: 'say', label: 'Sayısal' },
  { value: 'ea', label: 'Eşit Ağırlık' },
  { value: 'soz', label: 'Sözel' },
];

/** Alan → o alanın AYT dersleri. Backend'deki `Student.AYT_FIELD_SUBJECTS`in
 *  birebir aynısı; o eşleme genel bir uçtan yayınlanmadığı (yalnızca öğrenci
 *  bazlı `/api/subjects/?student=&scope=field` var) için burada yansıtılıyor.
 *  Ders adları katalogla aynı yazılmalı. */
const AYT_FIELD_SUBJECTS = {
  say: ['AYT Matematik', 'AYT Geometri', 'AYT Fizik', 'AYT Kimya', 'AYT Biyoloji'],
  ea: ['AYT Matematik', 'AYT Geometri', 'AYT Türk Dili ve Edebiyatı', 'AYT Tarih-1', 'AYT Coğrafya-1'],
  soz: ['AYT Türk Dili ve Edebiyatı', 'AYT Tarih-1', 'AYT Coğrafya-1', 'AYT Tarih-2',
    'AYT Coğrafya-2', 'AYT Felsefe', 'AYT Din Kültürü ve Ahlak Bilgisi'],
};

/** Bir alanın AYT grupları: gruplar o alanın derslerine kırpılır, maksimum net
 *  katalogdaki soru sayılarından toplanır. Böylece EA'da "Tarih" yalnız Tarih-1
 *  (10 net) olur, Sözel'de Tarih-1+2 (21 net) olur — ve "Toplam" her alanda 80'i
 *  aşamaz. Eskiden tek bir 80'lik ölçek kullanıldığı için AYT'de 90/80 gibi
 *  imkânsız değerler çıkabiliyordu. */
function aytGroupsFor(field, maxByLabel) {
  const own = AYT_FIELD_SUBJECTS[field];
  if (!own) return null;
  const sum = (labels) => labels.reduce((a, l) => a + (maxByLabel[l] || 0), 0);
  const groups = AYT_DIM_GROUPS
    .map((g) => ({ ...g, subs: g.subs.filter((l) => own.includes(l)) }))
    .filter((g) => g.subs.length)
    .map((g) => ({ ...g, max: sum(g.subs) }));
  return [{ key: 'total', label: 'Toplam', subs: own, max: sum(own) }, ...groups];
}

/** Bir öğrencinin bir net boyutundaki (tür + ders grubu) denemeler-arası ortalaması. */
function dimAvg(exams, type, subs) {
  const exs = exams.filter((e) => e.exam_type === type);
  if (!exs.length) return null;
  if (!subs) {
    const totals = exs.map((e) => e.total_net);
    return round1(totals.reduce((a, x) => a + x, 0) / totals.length);
  }

  /* O boyuta ait hiçbir ders girilmemiş denemeyi **ortalamaya katma**.
     Önceden 0 sayılıyordu; "girilmedi" ile "sıfır çekti" aynı şey değil ve
     ortalamayı haksız yere aşağı çekiyordu. Bölüm bazında girilen denemelerle
     birlikte bu daha da görünür oldu: AYT'de tek bir "AYT Fen" neti,
     Fizik/Kimya/Biyoloji boyutlarını sıfırlıyordu. */
  const vals = exs
    .map((e) => (e.subject_nets || []).filter((n) => subs.includes(n.subject_label)))
    .filter((nets) => nets.length > 0)
    .map((nets) => round1(nets.reduce((a, n) => a + n.net, 0)));

  if (!vals.length) return null;
  return round1(vals.reduce((a, x) => a + x, 0) / vals.length);
}

/** Panoyu besleyen tüm türetilmiş veriyi döndürür. */
export async function getDashboard() {
  const [students, appts, programsRes, examsRes, tpRes, subjects, meRes, topicsRes, prefs]
    = await Promise.all([
    listStudents(),
    listAppointments(),
    api.get('/programs/'),
    api.get('/exams/'),
    api.get('/topic-progress/'),
    listSubjects(),          // maksimum netler katalogtaki soru sayılarından gelir
    api.get('/auth/me/'),    // net grafiğinin ekseni rehberin katılma gününden başlar
    // Konu puanının PAYDASI: öğrencinin müfredatındaki tüm konular. Yalnız
    // kayıtlı konulara bakmak, sadece iyi bildiği konuları işaretleyen
    // öğrenciyi tepeye çıkarıyordu (bkz. aşağıda `avgLevel`).
    api.get('/topics/'),
    getPreferences(),        // hangi uyarı kartı görünecek + eşikleri (D3)
  ]);
  // Ders etiketi → sınavdaki soru sayısı (= o dersten çıkarılabilecek en yüksek net).
  const maxByLabel = Object.fromEntries(subjects.map((x) => [x.label, x.questionCount]));
  const aytGroupsByField = Object.fromEntries(
    AYT_FIELDS.map((f) => [f.value, aytGroupsFor(f.value, maxByLabel)])
  );
  const topics = topicsRes.data || [];
  const subjectCategory = Object.fromEntries(subjects.map((x) => [x.id, x.category]));

  /* Öğrencinin müfredatına düşen konular — öğrenci sayfasındaki (`OgrenciDetay`)
     kümenin aynısı: sınav öğrencisinde tüm TYT+AYT dersleri ve 'eski' müfredat,
     diğerlerinde okul dersleri ve öğrencinin sınıf/müfredatı. İki ekran aynı
     paydayı kullanmazsa aynı öğrenci için iki farklı "konu puanı" çıkıyor. */
  const curriculumTopicIds = (student) => {
    const cats = student.isExam ? ['tyt', 'ayt'] : ['okul'];
    return topics
      .filter((t) => {
        if (!cats.includes(subjectCategory[t.subject])) return false;
        return student.isExam
          ? t.curriculum === 'eski'
          : t.grade === student.gradeCode && t.curriculum === student.curriculum;
      })
      .map((t) => t.id);
  };

  const programs = programsRes.data || [];
  const exams = examsRes.data || [];
  const tps = tpRes.data || [];
  const today = todayIso();
  // Rehberin hesabı ne zaman açıldı? Net grafiğinin ekseni buradan başlar.
  const joinedDate = meRes.data?.joined_date || null;

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

    /* Konu puanı: müfredattaki TÜM konuların ortalaması, **kaydı olmayan konu 1
       sayılır**. Öğrenci sayfasındaki `subjectStats` ile birebir aynı kural.
       Önce yalnız kayıtlı satırların ortalaması alınıyordu; sadece iyi bildiği
       birkaç konuyu işaretleyen öğrenci panelde 4.4/5 görünüyor, kendi
       sayfasında 2.x çıkıyordu. */
    const topicIds = curriculumTopicIds(s);
    const levelByTopic = new Map(b.tps.map((t) => [t.topic, t.level]));
    const levels = topicIds.map((id) => levelByTopic.get(id) ?? 1);
    const avgLevel = levels.length
      ? round1(levels.reduce((a, x) => a + x, 0) / levels.length)
      : null;
    const weakCount = levels.filter((l) => l <= 2).length;

    // Haftalık saat YALNIZ çalışma + deneme bloklarını sayar. Dış meşguliyet
    // (okul, dershane, antrenman, doktor) programda yer kaplar ama çalışma değildir
    // — backend bunu `counts_as_study` ile söyler.
    // Pencere 7 günden farklı olabildiği için ("Salıdan Cumaya 4 gün") her programın
    // toplamı haftalık hıza çevriliyor, yoksa kısa programlı öğrenci az çalışıyor görünür.
    const weekHours = b.programs.map((p) => {
      const mins = (p.tasks || [])
        .filter((t) => t.counts_as_study !== false)
        .reduce((a, t) => a + (t.duration_minutes || 0), 0);
      return (mins / 60) * (7 / (p.day_count || 7));
    });
    const weeklyHours = weekHours.length ? round1(weekHours.reduce((a, x) => a + x, 0) / weekHours.length) : 0;

    // Pencere artık 7 gün olmak zorunda değil — bitişi sunucudan gelen `end_date` söyler.
    const current = b.programs.find((p) => p.start_date <= today && today <= p.end_date);
    const hasCurrentProgram = !!current;
    // İleri tarihli program da "planlanmış" sayılır (bkz. `needProgram`).
    const hasUpcomingProgram = b.programs.some((p) => p.start_date > today);
    // Uyum yüzdesi sunucuda **süre** üzerinden hesaplanır (B2) — burada görev
    // sayısıyla tekrar hesaplanmaz ki panel ile öğrenci sayfası aynı sayıyı göstersin.
    const compliance = current ? (current.compliance?.percent ?? 0) : null;

    // TYT herkes için aynı ölçek. AYT'de ölçek alana göre değişir ve her öğrencinin
    // **üç alanda da** neti hesaplanır — seçilen alan "kimin listeleneceğini" değil,
    // "hangi ölçekle bakılacağını" belirler. Sayısalcının 40 mat + 30 fen neti
    // Sayısal ölçeğinde 70, EA ölçeğinde 40'tır; ikisi de anlamlı ve kıyaslanabilir.
    const netDims = {};
    TYT_DIM_GROUPS.forEach((g) => { netDims[`tyt_${g.key}`] = dimAvg(b.exams, 'tyt', g.subs); });
    Object.entries(aytGroupsByField).forEach(([field, groups]) => {
      (groups || []).forEach((g) => {
        netDims[`ayt_${field}_${g.key}`] = dimAvg(b.exams, 'ayt', g.subs);
      });
    });

    return {
      ...s,
      examCount: b.exams.length,
      lastNet, avgNet, netDelta, trend,
      avgLevel, weakCount,
      weeklyHours,
      hasCurrentProgram, hasUpcomingProgram, compliance,
      netDims,
      lastExamDate: exSorted[0]?.exam_date ?? null,
    };
  });

  const enrById = Object.fromEntries(enriched.map((e) => [e.id, e]));

  /* Öğrenci-bazlı net serisi (çok çizgili grafik).
   *
   * Eksen **tarih**tir, deneme sırası değil. Önce her öğrencinin denemeleri
   * 1, 2, 3... diye sıralanıp "D1, D2" diye etiketleniyordu; bir öğrencinin
   * D2'si başka bir öğrencinin D2'siyle aynı deneme değildi ve aynı hizada
   * görünüyordu. Aynı gün girilen iki deneme artık gerçekten aynı hizada.
   *
   * Aralık: **rehberin katıldığı günden bugüne**. Sabit bir başlangıç (1 Eylül
   * gibi) ağustosta kaydolan rehberin ilk haftalarını grafikten düşürüyordu.
   * Daha eski tarihli bir deneme varsa (geçmişe dönük girilmiş olabilir) eksen
   * ona kadar geriye uzar — girilen hiçbir deneme grafikten düşmemeli. */
  const seriesFor = (type) => students
    .map((s, index) => {
      const exs = bucket[s.id].exams
        .filter((e) => e.exam_type === type && e.exam_date <= today)
        .sort((a, c) => (a.exam_date < c.exam_date ? -1 : 1));
      return exs.length ? {
        id: s.id,
        name: enrById[s.id].name,
        // Grafik rengi avatar renginden ayrı: sekiz renkli avatar paleti altmış
        // öğrencide çizgileri ayırt edilemez yapıyordu (bkz. `seriesColor`).
        color: seriesColor(index),
        points: exs.map((e) => ({
          date: e.exam_date,
          label: (e.name || '').replace(/^(TYT|AYT)\s+/, ''),
          net: e.total_net,
        })),
      } : null;
    })
    .filter(Boolean);
  const tytSeries = seriesFor('tyt');
  const aytSeries = seriesFor('ayt');
  const earliestExam = [...tytSeries, ...aytSeries]
    .flatMap((se) => se.points.map((p) => p.date))
    .reduce((a, d) => (a == null || d < a ? d : a), null);
  // Eksenin başı: katılma günü ile en eski denemenin ERKEN olanı.
  const axisStart = [joinedDate, earliestExam].filter(Boolean).sort()[0] || today;
  const netSeries = {
    tyt: tytSeries,
    ayt: aytSeries,
    range: { start: axisStart, end: today },
  };

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
  /* "Program Gerekenler": bugünü kapsayan programı OLMAYAN **ve** ileriye
     dönük planlanmış programı da bulunmayan öğrenciler. Önce yalnız bugüne
     bakılıyordu; rehber kasım için program hazırladığında öğrenci yine
     "program gerekiyor" listesinde kalıyordu. */
  const needProgram = enriched.filter((e) => !e.hasCurrentProgram && !e.hasUpcomingProgram);
  // Program uyumu — bu hafta programlı herkes, düşükten yükseğe sıralı (%)
  const complianceRanked = enriched
    .filter((e) => e.hasCurrentProgram && e.compliance != null)
    .sort((a, b) => a.compliance - b.compliance);

  // Net değişimi: son denemenin (aynı tür) öncekine göre farkı; en çok düşen başta.
  // Tercih açıksa yalnız düşenler kalır (yükselenler bir uyarı değil).
  const netChanges = enriched
    .filter((e) => e.netDelta != null)
    .filter((e) => !prefs.net_change_drops_only || e.netDelta < 0)
    .sort((a, b) => a.netDelta - b.netDelta);

  // Konu takibi — konu ilerlemesi olan herkes, ortalama seviye yüksekten düşüğe
  const konuRanked = enriched
    .filter((e) => e.avgLevel != null)
    .sort((a, b) => b.avgLevel - a.avgLevel);

  return {
    students: enriched, enrById, upcoming, kpis, needProgram,
    complianceRanked, netChanges, konuRanked, netSeries, prefs,
    netDimGroups: {
      tyt: TYT_DIM_GROUPS.map(({ key, label, max }) => ({ key, label, max })),
      // AYT'de grup listesi ve maksimumlar alana göre değişir.
      ayt: Object.fromEntries(
        AYT_FIELDS.map((f) => [
          f.value,
          (aytGroupsByField[f.value] || []).map(({ key, label, max }) => ({ key, label, max })),
        ])
      ),
    },
  };
}
