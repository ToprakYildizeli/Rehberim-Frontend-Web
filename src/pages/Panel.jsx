import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, CalendarClock, CalendarPlus, TrendingDown, TrendingUp, Minus, Target, ChevronRight,
  ClipboardList, Gauge, BarChart3, LineChart,
} from 'lucide-react';
import {
  Card, CardHeader, Button, Avatar, Badge, ProgressBar, PillGroup, Select, EmptyState, Spinner,
} from '../components/ui';
import { getDashboard, AYT_FIELDS } from '../api/dashboard';
import s from './Panel.module.css';

const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const fmtDay = (iso) => { const [, m, d] = iso.split('-').map(Number); return `${d} ${MONTHS[m - 1]}`; };
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

const METRICS = [
  { value: 'avgNet', label: 'Deneme Ort.', unit: 'net', max: 120 },   // TYT üzerinden
  { value: 'avgLevel', label: 'Konu Puanı', unit: '', max: 5 },
  { value: 'weeklyHours', label: 'Haftalık Saat', unit: 'sa', max: 80 },
];
/** Kıyaslama kohortları: liste kimi kapsasın? (kullanıcı isteği, 13 Eyl 2026)
 *  Altmış öğrencili bir rehberde 9. sınıfla mezunu aynı sırada görmek işe
 *  yaramıyordu — sıralama ancak benzer öğrenciler arasında anlamlı.
 *
 *  Süzgeç listeyi daraltır, **ölçeği değiştirmez**: AYT alanı hâlâ bir ölçek
 *  (bkz. C1), kohort ise kimlerin listeleneceği. */
const COHORTS = [
  { value: 'all', label: 'Tüm öğrenciler', test: () => true },
  { value: 'exam', label: 'Sınava girenler (12 · mezun)', test: (st) => st.isExam },
  { value: 'g9', label: '9. sınıf', test: (st) => st.gradeCode === '9' },
  { value: 'g10', label: '10. sınıf', test: (st) => st.gradeCode === '10' },
  { value: 'g11', label: '11. sınıf', test: (st) => st.gradeCode === '11' },
  { value: 'g12', label: '12. sınıf', test: (st) => st.gradeCode === '12' },
  { value: 'mezun', label: 'Mezun', test: (st) => st.gradeCode === 'mezun' },
  { value: 'say', label: 'Sayısal', test: (st) => st.study_field === 'say' },
  { value: 'ea', label: 'Eşit Ağırlık', test: (st) => st.study_field === 'ea' },
  { value: 'soz', label: 'Sözel', test: (st) => st.study_field === 'soz' },
];

/** Deneme kaynağı (E1): evde tek başına çözülen ile kurum geneli gözetimli
 *  sınav aynı koşulda değil. Tek ortalamada toplamak kıyaslamayı
 *  bulanıklaştırıyordu. */
const EXAM_SOURCES = [
  { value: 'all', label: 'Tümü' },
  { value: 'personal', label: 'Ev' },
  { value: 'institutional', label: 'Kurum' },
];

const NET_TYPES = [{ value: 'tyt', label: 'TYT' }, { value: 'ayt', label: 'AYT' }];

const complianceColor = (c) => (c >= 80 ? 'var(--success)' : c >= 60 ? 'var(--warning)' : 'var(--danger)');
const levelTone = (l) => (l >= 4 ? 'success' : l >= 3 ? 'accent' : l >= 2 ? 'warning' : 'danger');

export default function Panel() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [metric, setMetric] = useState('avgNet');
  const [cohort, setCohort] = useState('all');     // kıyaslama listesinin kapsamı
  const [netSource, setNetSource] = useState('all');  // deneme kaynağı (E1)
  const [netExam, setNetExam] = useState('tyt');   // "Deneme Ort." kıyası: TYT/AYT
  const [netField, setNetField] = useState('say'); // AYT'de kıyaslanan alan
  const [netGroup, setNetGroup] = useState('total'); // ve ders grubu (sınava/alana göre)
  const [netType, setNetType] = useState('tyt');
  /* Grafikte GÖSTERİLEN öğrenciler. Önce "gizlenenler" tutuluyordu ve küme boş
     başlıyordu — yani herkes çizgiliydi. Altmış öğrencili bir rehberde bu
     altmış çizgi demek; grafik okunmuyor, altındaki altmış chip de sığmıyor.
     Artık seçim açık: varsayılan olarak en çok denemesi olan birkaç öğrenci
     gelir, gerisi aranıp eklenir. */
  const [selected, setSelected] = useState(null);   // null = henüz kurulmadı
  const [studentQuery, setStudentQuery] = useState('');

  useEffect(() => {
    let alive = true;
    getDashboard().then((d) => { if (alive) setData(d); }).catch(() => { if (alive) setData({ error: true }); });
    return () => { alive = false; };
  }, []);

  const openStudent = (id) => navigate(`/ogrenciler/${id}`);
  const toggle = (id) => setSelected((prev) => {
    const next = new Set(prev ?? []);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  // Kıyas değeri: "Deneme Ort."ta seçili tür+grup neti; diğer metriklerde alanın kendisi.
  // AYT'de seçilen alan bir SÜZGEÇ değil, ÖLÇEKtir: herkes o alanın ders kümesiyle
  // hesaplanıp listelenir. Sayısalcı, EA ölçeğinde de kendi matematik netiyle görünür.
  const dimKey = netSource + (netExam === 'ayt'
    ? `|ayt_${netField}_${netGroup}`
    : `|tyt_${netGroup}`);
  const metricVal = (st) => (metric === 'avgNet' ? (st.netDims?.[dimKey] ?? null) : st[metric]);
  const ranked = useMemo(() => {
    if (!data?.students) return [];
    const val = (st) => (metric === 'avgNet' ? (st.netDims?.[dimKey] ?? null) : st[metric]);
    const inCohort = COHORTS.find((c) => c.value === cohort)?.test ?? (() => true);
    return data.students
      .filter((st) => inCohort(st) && val(st) != null)
      .sort((a, b) => val(b) - val(a));
  }, [data, metric, dimKey, cohort]);

  if (!data) return <div className={s.center}><Spinner size={24} /></div>;

  const {
    kpis, upcoming, needProgram, complianceRanked, netChanges, konuRanked,
    netSeries, netDimGroups, prefs,
  } = data;
  // Panel'in **her** bölümü rehberin tercihine göre gizlenebilir
  // (Ayarlar → Tercihler → Panel bölümleri). Satır kapsayıcıları, içindeki
  // kartların hepsi kapalıysa hiç çizilmiyor — yoksa boş bir boşluk kalırdı.
  const showActionRow = prefs.show_upcoming || prefs.show_missing_program
    || prefs.show_net_change;
  const showPairRow = prefs.show_compliance || prefs.show_topic_tracking;
  const metricDef = METRICS.find((x) => x.value === metric);
  // AYT'de grup listesi (ve maksimumları) seçili alana bağlı; TYT'de tek liste.
  const groupOpts = (netExam === 'ayt'
    ? netDimGroups?.ayt?.[netField]
    : netDimGroups?.tyt) || [];
  const dimDef = groupOpts.find((d) => d.key === netGroup) || groupOpts[0] || { max: 120 };
  const rankMax = metric === 'avgNet' ? dimDef.max : metricDef.max;
  const rankUnit = metric === 'avgNet' ? 'net' : metricDef.unit;
  const available = netSeries[netType] || [];
  /* Varsayılan seçim: en çok denemesi olan beş öğrenci. Grafiği anlamlı bir
     şeyle açmak, boş açmaktan da altmış çizgiyle açmaktan da iyi. */
  const defaultSelection = new Set(
    [...available]
      .sort((a, b) => b.points.length - a.points.length)
      .slice(0, 5)
      .map((se) => se.id)
  );
  const shown = selected ?? defaultSelection;
  const visible = available.filter((se) => shown.has(se.id));
  const query = studentQuery.trim().toLocaleLowerCase('tr-TR');
  /* Eklenebilecek öğrenciler **yalnız arama yazılınca** listelenir (kullanıcı
     isteği, 13 Eyl 2026): altmış adın kalıcı olarak ekranda durması grafiği
     aşağı itiyordu. Boş aramada liste boş — "hepsini göster" hâli yok. */
  const searchResults = query
    ? available.filter(
      (se) => !shown.has(se.id) && se.name.toLocaleLowerCase('tr-TR').includes(query)
    )
    : [];

  return (
    <div className={s.page}>
      {/* ── KPI şeridi ── */}
      {prefs.show_kpis && (
      <div className={s.kpiRow}>
        <KpiCard icon={<Users size={18} />} value={kpis.count} label="Öğrenci" tone="accent" />
        <KpiCard icon={<CalendarPlus size={18} />} value={kpis.withoutProgram}
          label="Bu hafta programsız" tone={kpis.withoutProgram ? 'danger' : 'success'} />
        <KpiCard icon={<CalendarClock size={18} />} value={kpis.upcoming} label="Yaklaşan görüşme" tone="violet" />
        <KpiCard icon={<Gauge size={18} />} value={kpis.avgNet ?? '—'} label="Ort. net" tone="cyan" />
      </div>
      )}

      {/* ── Öğrenci net grafiği (çok çizgili, seçilebilir) ── */}
      {prefs.show_net_chart && (
      <Card>
        <div className={s.cmpHead}>
          <div>
            <h2 className={s.cmpTitle}><LineChart size={16} /> Öğrenci Net Grafiği</h2>
          </div>
          <PillGroup options={NET_TYPES} value={netType} onChange={setNetType} />
        </div>
        <div className={s.netPicker}>
          <div className={s.netPickerHead}>
            <input
              className={s.netSearch}
              type="search"
              value={studentQuery}
              onChange={(e) => setStudentQuery(e.target.value)}
              placeholder={`Öğrenci ara (${available.length})`}
              aria-label="Grafiğe öğrenci ekle"
            />
            <span className={s.netCount}>{visible.length} / {available.length} seçili</span>
            {visible.length > 0 && (
              <button type="button" className={s.netClear} onClick={() => setSelected(new Set())}>
                Temizle
              </button>
            )}
          </div>

          {/* Seçili olanlar — tıklayınca çıkar. */}
          <div className={s.netChips}>
            {visible.map((se) => (
              <button key={se.id} type="button" className={s.chip} onClick={() => toggle(se.id)}
                title="Grafikten çıkar">
                <span className={s.chipDot} style={{ background: se.color }} />
                {se.name}
                <span className={s.chipX} aria-hidden="true">×</span>
              </button>
            ))}
            {visible.length === 0 && (
              <span className={s.netHint}>Arama kutusuna ad yazıp öğrenci ekleyin.</span>
            )}
          </div>

          {/* Eklenebilecekler — yalnız arama yazılınca, uzunsa kendi içinde kayar. */}
          {query && searchResults.length === 0 && (
            <span className={s.netHint}>“{studentQuery.trim()}” ile eşleşen öğrenci yok.</span>
          )}
          {searchResults.length > 0 && (
            <div className={s.netAddList}>
              {searchResults.slice(0, 60).map((se) => (
                <button key={se.id} type="button" className={`${s.chip} ${s.chipOff}`}
                  onClick={() => toggle(se.id)} title="Grafiğe ekle">
                  <span className={s.chipDot} style={{ background: se.color }} />
                  {se.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <MultiLineChart series={visible} range={netSeries.range} />
      </Card>
      )}

      {/* ── Aksiyon satırı ── */}
      {showActionRow && (
      <div className={s.widgetRow}>
        {prefs.show_upcoming && (
        <Card className={s.wCard}>
          <CardHeader title="Yaklaşan Görüşmeler" actions={<span className={s.countBadge}>{upcoming.length}</span>} />
          {upcoming.length === 0 ? (
            <EmptyState icon={<CalendarClock size={20} />} text="Yaklaşan görüşme yok." />
          ) : (
            <div className={s.list}>
              {upcoming.map((a) => (
                <button key={a.id} type="button" className={s.row}
                  onClick={() => (a.studentId ? openStudent(a.studentId) : navigate('/takvim'))}>
                  <span className={s.dateChip}>
                    <span className={s.dateChipDay}>{a.date === todayIso() ? 'Bugün' : fmtDay(a.date)}</span>
                    <span className={s.dateChipTime}>{a.time || '—'}</span>
                  </span>
                  <span className={s.rowMain}>
                    <span className={s.rowName}>{a.student?.name || 'Kişisel'}</span>
                    <span className={s.rowSub}>{a.category}</span>
                  </span>
                  <ChevronRight size={16} className={s.rowChevron} />
                </button>
              ))}
            </div>
          )}
        </Card>
        )}

        {prefs.show_missing_program && (
        <Card className={s.wCard}>
          <CardHeader title="Program Gerekenler" actions={<span className={`${s.countBadge} ${needProgram.length ? s.countDanger : ''}`}>{needProgram.length}</span>} />
          {needProgram.length === 0 ? (
            <EmptyState icon={<ClipboardList size={20} />} text="Her öğrencinin planlanmış programı var." />
          ) : (
            <div className={s.list}>
              {needProgram.map((st) => (
                <div key={st.id} className={s.row}>
                  <Avatar name={st.name} color={st.color} size="sm" />
                  <span className={s.rowMain}>
                    <span className={s.rowName}>{st.name}</span>
                    <span className={s.rowSub}>{st.grade}</span>
                  </span>
                  <Button variant="soft" size="sm" onClick={() => navigate(`/ders-programi?ogrenci=${st.id}`)}>
                    Program yap
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
        )}

        {prefs.show_net_change && (
        <Card className={s.wCard}>
          <CardHeader title="Net Değişimi (son denemeye göre)" actions={<span className={s.countBadge}>{netChanges.length}</span>} />
          {netChanges.length === 0 ? (
            <EmptyState icon={<TrendingDown size={20} />} text="Karşılaştırılacak deneme yok." />
          ) : (
            <div className={s.list}>
              {netChanges.map((st) => {
                const up = st.netDelta > 0; const flat = st.netDelta === 0;
                const tone = flat ? 'neutral' : up ? 'success' : 'danger';
                const Icon = flat ? Minus : up ? TrendingUp : TrendingDown;
                return (
                  <button key={st.id} type="button" className={s.row} onClick={() => openStudent(st.id)}>
                    <Avatar name={st.name} color={st.color} size="sm" />
                    <span className={s.rowMain}>
                      <span className={s.rowName}>{st.name}</span>
                      <span className={s.rowSub}>{st.lastNet} net (son deneme)</span>
                    </span>
                    <Badge tone={tone}><Icon size={12} /> {up ? '+' : ''}{st.netDelta}</Badge>
                  </button>
                );
              })}
            </div>
          )}
        </Card>
        )}
      </div>
      )}

      {/* ── Uyum (sıralı %) + Konu takibi (ort. seviye) ── */}
      {showPairRow && (
      <div className={s.pairRow}>
        {prefs.show_compliance && (
        <Card className={s.wCard}>
          <CardHeader title="Program Uyumu" actions={<span className={s.countBadge}>{complianceRanked.length}</span>} />
          {complianceRanked.length === 0 ? (
            <EmptyState icon={<Gauge size={20} />} text="Bu hafta programlı öğrenci yok." />
          ) : (
            <div className={s.list}>
              {complianceRanked.map((st) => (
                <button key={st.id} type="button" className={s.row} onClick={() => openStudent(st.id)}>
                  <Avatar name={st.name} color={st.color} size="sm" />
                  <span className={s.rowMain}>
                    <span className={s.rowName}>{st.name}</span>
                    <ProgressBar value={st.compliance} color={complianceColor(st.compliance)} />
                  </span>
                  <span className={s.rowStat}>%{st.compliance}</span>
                </button>
              ))}
            </div>
          )}
        </Card>
        )}

        {prefs.show_topic_tracking && (
        <Card className={s.wCard}>
          <CardHeader title="Konu Takibi — Ortalama Seviye" actions={<span className={s.countBadge}>{konuRanked.length}</span>} />
          {konuRanked.length === 0 ? (
            <EmptyState icon={<Target size={20} />} text="Konu ilerlemesi işaretlenmemiş." />
          ) : (
            <div className={s.list}>
              {konuRanked.map((st) => (
                <button key={st.id} type="button" className={s.row} onClick={() => openStudent(st.id)}>
                  <Avatar name={st.name} color={st.color} size="sm" />
                  <span className={s.rowMain}>
                    <span className={s.rowName}>{st.name}</span>
                    <span className={s.rowSub}>{st.weakCount} zayıf konu</span>
                  </span>
                  <Badge tone={levelTone(st.avgLevel)}>{st.avgLevel} / 5</Badge>
                </button>
              ))}
            </div>
          )}
        </Card>
        )}
      </div>
      )}

      {/* ── Ortalama üzerinden kıyaslama ── */}
      {prefs.show_comparison && (
      <Card>
        <div className={s.cmpHead}>
          <div>
            <h2 className={s.cmpTitle}><BarChart3 size={16} /> Öğrenci Kıyaslama</h2>
          </div>
          <div className={s.cmpControls}>
            {/* Kimler listelensin: sıralama ancak benzer öğrenciler arasında
                anlamlı — 9. sınıfla mezunu yan yana koymak işe yaramıyor. */}
            <Select
              className={s.dimSelect}
              value={cohort}
              onChange={(e) => setCohort(e.target.value)}
              aria-label="Öğrenci kapsamı"
            >
              {COHORTS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </Select>
            <PillGroup options={METRICS} value={metric} onChange={setMetric} />
            {metric === 'avgNet' && (
              <span className={s.netDimCtl}>
                <PillGroup
                  options={NET_TYPES}
                  value={netExam}
                  onChange={(v) => { setNetExam(v); setNetGroup('total'); }}
                />
                {netExam === 'ayt' && (
                  <Select
                    className={s.dimSelect}
                    value={netField}
                    onChange={(e) => { setNetField(e.target.value); setNetGroup('total'); }}
                    aria-label="Alan"
                  >
                    {AYT_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </Select>
                )}
                <Select className={s.dimSelect} value={netGroup} onChange={(e) => setNetGroup(e.target.value)} aria-label="Ders grubu">
                  {groupOpts.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
                </Select>
                {/* Ev denemesi mi kurumsal mı — ölçüt yalnız "Deneme Ort."ta
                    anlamlı, o yüzden burada. */}
                <Select
                  className={s.dimSelect}
                  value={netSource}
                  onChange={(e) => setNetSource(e.target.value)}
                  aria-label="Deneme kaynağı"
                >
                  {EXAM_SOURCES.map((x) => (
                    <option key={x.value} value={x.value}>{x.label}</option>
                  ))}
                </Select>
              </span>
            )}
          </div>
        </div>
        {ranked.length === 0 ? (
          <EmptyState text={cohort === 'all'
            ? 'Bu metrik için veri yok.'
            : 'Seçilen kapsamda bu metrik için veri yok.'} />
        ) : (
          <div className={s.rankList}>
            {ranked.map((st) => (
              <button key={st.id} type="button" className={s.rankRow} onClick={() => openStudent(st.id)}>
                <Avatar name={st.name} color={st.color} size="xs" />
                <span className={s.rankName}>{st.name}</span>
                <span className={s.rankTrack}>
                  <span className={s.rankFill} style={{ width: `${Math.min(100, (metricVal(st) / rankMax) * 100)}%`, background: st.color || 'var(--accent)' }} />
                </span>
                <span className={s.rankValue}>{metricVal(st)} / {rankMax}{rankUnit ? ` ${rankUnit}` : ''}</span>
              </button>
            ))}
          </div>
        )}
      </Card>
      )}
    </div>
  );
}

function KpiCard({ icon, value, label, tone }) {
  return (
    <Card pad={false} className={s.kpiCard}>
      <span className={`${s.kpiIcon} ${s[`kpi_${tone}`]}`}>{icon}</span>
      {/* Sayı ve etiket ikonun YANINDA, altında değil: dikey yığın kutuyu
          130px'e çıkarıp sağını boş bırakıyordu. */}
      <span className={s.kpiText}>
        <span className={s.kpiValue}>{value}</span>
        <span className={s.kpiLabel}>{label}</span>
      </span>
    </Card>
  );
}

const MONTH_SHORT = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz',
  'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

/** `YYYY-MM-DD` → gün sayısı (UTC, saat farkından etkilenmesin). */
const dayNum = (iso) => Date.parse(`${iso}T00:00:00Z`) / 86400000;

/** Eksende gösterilecek ay başları — yalnız aralığın İÇİNE düşenler.
 *
 *  Aralık ayın ortasında başlayabiliyor (ilk deneme 26 Haziran gibi); o ayın
 *  1'i grafiğin solunda kalır ve etiket dışarı taşardı. Başlangıçtan önceki
 *  ay atlanıyor, o ayın adı zaten ilk noktanın hizasında okunuyor. */
function monthTicks(startIso, endIso) {
  const [sy, sm] = startIso.split('-').map(Number);
  const start = dayNum(startIso);
  const end = dayNum(endIso);
  const ticks = [];
  let y = sy; let m = sm;
  for (let i = 0; i < 24; i += 1) {
    const iso = `${y}-${String(m).padStart(2, '0')}-01`;
    const at = dayNum(iso);
    if (at > end) break;
    if (at >= start) ticks.push({ iso, label: MONTH_SHORT[m - 1] });
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return ticks;
}

/** Çok çizgili net grafiği — her öğrenci kendi renginde (SVG, tek eksen).
 *
 *  Yatay eksen **tarih**tir: öğretim yılının 1 Eylül'ünden bugüne. Önce deneme
 *  sırasıydı ("D1, D2") ve bir öğrencinin D2'si başkasının D2'siyle aynı hizada
 *  görünüyordu — oysa farklı günlerde girilmiş farklı denemelerdi. Artık aynı
 *  gün girilen denemeler gerçekten aynı hizada; aralar da gerçek zaman kadar.
 *
 *  Büyük viewBox + non-scaling-stroke → çizgi/nokta ekranda ince ve net kalır. */
function MultiLineChart({ series, range }) {
  if (!series.length) return <EmptyState icon={<LineChart size={20} />} text="Görüntülenecek öğrenci seç." />;
  const W = 760; const H = 300; const padL = 42; const padR = 20; const padT = 18; const padB = 38;

  const x0 = dayNum(range.start);
  const x1 = Math.max(dayNum(range.end), x0 + 1);
  const allNet = series.flatMap((se) => se.points.map((p) => p.net));
  const lo = Math.min(...allNet); const hi = Math.max(...allNet);
  const min = Math.floor(lo - (hi - lo || 4) * 0.15);
  const max = Math.ceil(hi + (hi - lo || 4) * 0.15);
  const xs = (iso) => padL + ((dayNum(iso) - x0) / (x1 - x0)) * (W - padL - padR);
  const ys = (v) => padT + (1 - (v - min) / ((max - min) || 1)) * (H - padT - padB);
  const grids = [min, Math.round((min + max) / 2), max];
  const ticks = monthTicks(range.start, range.end);

  return (
    <svg className={s.trendSvg} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMinYMid meet"
      role="img" aria-label="Öğrenci net grafiği">
      {grids.map((g) => (
        <g key={g}>
          <line x1={padL} y1={ys(g)} x2={W - padR} y2={ys(g)} className={s.grid} vectorEffect="non-scaling-stroke" />
          <text x={padL - 8} y={ys(g) + 4} className={s.axisTxt} textAnchor="end">{g}</text>
        </g>
      ))}
      {ticks.map((t) => (
        <text key={t.iso} x={xs(t.iso)} y={H - 12} className={s.axisTxt} textAnchor="middle">{t.label}</text>
      ))}
      {series.map((se) => {
        const line = se.points
          .map((p, i) => `${i ? 'L' : 'M'}${xs(p.date).toFixed(1)},${ys(p.net).toFixed(1)}`)
          .join(' ');
        return (
          <g key={se.id}>
            <path d={line} fill="none" stroke={se.color} strokeWidth="2" strokeLinejoin="round"
              strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            {/* Nokta yalnız gerçekten deneme olan günde çizilir. */}
            {se.points.map((p) => (
              <circle key={`${p.date}-${p.label}`} cx={xs(p.date)} cy={ys(p.net)} r="3.5"
                fill="var(--bg-card)" stroke={se.color} strokeWidth="2"
                vectorEffect="non-scaling-stroke">
                <title>{se.name} — {p.label || 'Deneme'} ({trDate(p.date)}): {p.net} net</title>
              </circle>
            ))}
          </g>
        );
      })}
    </svg>
  );
}

/** `2026-09-08` → `8 Eyl` */
function trDate(iso) {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTH_SHORT[m - 1]}`;
}
