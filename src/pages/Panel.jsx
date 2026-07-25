import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, CalendarCheck, BarChart3, ChevronRight,
  Sparkles, ArrowRight, Eye, SlidersHorizontal,
} from 'lucide-react';
import {
  Card, CardHeader, Button, Avatar, Badge, ProgressBar, PillGroup, Spinner,
} from '../components/ui';
import StudentModal from '../components/dashboard/StudentModal';
import { trendMeta } from '../components/dashboard/trend';
import { getNetComparison, listStudents } from '../api/students';
import {
  getPendingActions, getRedAlerts, getActivityFeed, getAiInsights,
} from '../api/dashboard';
import s from './Panel.module.css';

const RANGES = [
  { value: 'son-deneme', label: 'Son Deneme' },
  { value: 'son-1-ay', label: 'Son 1 Ay' },
  { value: 'son-3-ay', label: 'Son 3 Ay' },
];

const ACTION_ICONS = { file: FileText, calendar: CalendarCheck, chart: BarChart3 };

/** At or above the class average reads as healthy; well below it is a red flag. */
function barColor(net, average) {
  if (net >= average) return 'var(--subj-matematik)';
  if (net < average * 0.8) return 'var(--danger)';
  return 'var(--warning)';
}

export default function Panel() {
  const navigate = useNavigate();
  const [range, setRange] = useState('son-deneme');
  const [comparison, setComparison] = useState(null);
  const [students, setStudents] = useState([]);
  const [actions, setActions] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [feed, setFeed] = useState([]);
  const [insights, setInsights] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let alive = true;
    Promise.all([
      listStudents(), getPendingActions(), getRedAlerts(), getActivityFeed(), getAiInsights(),
    ]).then(([st, ac, al, fd, ai]) => {
      if (!alive) return;
      setStudents(st);
      setActions(ac);
      setAlerts(al);
      setFeed(fd);
      setInsights(ai);
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    setComparison(null);
    getNetComparison(range).then((d) => { if (alive) setComparison(d); });
    return () => { alive = false; };
  }, [range]);

  // Headroom above the tallest bar so value labels never clip.
  const chartMax = useMemo(() => {
    if (!comparison) return 100;
    return Math.max(...comparison.items.map((i) => i.net), comparison.classAverage) * 1.15;
  }, [comparison]);

  return (
    <div className={s.page}>
      {/* ── Net Kıyaslama ── */}
      <Card>
        <div className={s.chartHead}>
          <div>
            <h2 style={{ fontSize: '0.98rem', fontWeight: 700, margin: 0 }}>Net Kıyaslama</h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '3px 0 0' }}>
              Öğrencilerinizin son deneme netleri — sınıf ortalamasıyla karşılaştırmalı
            </p>
          </div>
          <div className={s.chartControls}>
            <PillGroup options={RANGES} value={range} onChange={setRange} />
            <span className={s.benchmarkKey}>
              <span className={s.benchmarkDash} />
              Sınıf Ort. {comparison?.classAverage ?? '—'} net
            </span>
          </div>
        </div>

        {!comparison ? (
          <div style={{ height: 240, display: 'grid', placeItems: 'center' }}>
            <Spinner size={22} />
          </div>
        ) : (
          <div className={s.chart}>
            <div
              className={s.benchmarkLine}
              style={{ bottom: `${(comparison.classAverage / chartMax) * 100}%` }}
            >
              <span className={s.benchmarkLabel}>Ort. {comparison.classAverage}</span>
            </div>

            {comparison.items.map((item) => (
              <button
                key={item.studentId}
                type="button"
                className={s.bar}
                onClick={() => setSelected(item.student)}
                title={`${item.student.name} — ${item.net} net`}
              >
                <span className={s.barCol}>
                  <span className={s.barValue}>{item.net}</span>
                  <span
                    className={s.barFill}
                    style={{
                      height: `${(item.net / chartMax) * 100}%`,
                      background: barColor(item.net, comparison.classAverage),
                    }}
                  />
                </span>
                <Avatar name={item.student.name} color={item.student.color} size="xs" />
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* ── Üç widget ── */}
      <div className={s.widgetRow}>
        <Card>
          <CardHeader
            title="Aksiyon Bekleyenler"
            actions={<span className={s.countBadge}>{actions.length}</span>}
          />
          <div className={s.actionList}>
            {actions.map((a) => {
              const Icon = ACTION_ICONS[a.icon] ?? FileText;
              return (
                <div className={s.actionItem} key={a.id}>
                  <span className={s.actionIcon}><Icon size={15} /></span>
                  <span className={s.actionText}>{a.text}</span>
                  <Button variant="soft" size="sm">{a.cta}</Button>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Kırmızı Alarm"
            actions={<span className={`${s.countBadge} ${s.countDanger}`}>{alerts.length}</span>}
          />
          <div className={s.alertList}>
            {alerts.map((a) => (
              <button
                key={a.id}
                type="button"
                className={`${s.alertRow} ${a.tone === 'warning' ? s.alertWarning : s.alertDanger}`}
                onClick={() => setSelected(a.student)}
              >
                <Avatar name={a.student.name} color={a.student.color} size="sm" />
                <span className={s.alertBody}>
                  <span className={s.alertName}>{a.student.name}</span>
                  <p className={s.alertReason}>{a.reason}</p>
                </span>
                <span className={s.alertChevron}><ChevronRight size={16} /></span>
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Hızlı Akış"
            actions={<span className={s.liveBadge}><span className={s.liveDot} /> Canlı</span>}
          />
          <div className={s.feedList}>
            {feed.map((f) => (
              <div className={s.feedItem} key={f.id}>
                <span className={s.feedDot} style={{ background: `var(--${f.tone})` }} />
                <div>
                  <p className={s.feedName}>{f.student.name}</p>
                  <p className={s.feedText}>{f.text}</p>
                  <p className={s.feedTime}>{f.time}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Öğrenci listesi + AI ── */}
      <div className={s.bottomRow}>
        <Card>
          <CardHeader
            title="Öğrenci Listesi"
            actions={
              <Button variant="ghost" size="sm" onClick={() => navigate('/ogrenciler')}>
                <SlidersHorizontal size={13} /> Filtrele
              </Button>
            }
          />
          <div className={s.tableScroll}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Öğrenci</th>
                  <th>Sınıf</th>
                  <th>Haftalık Uyum</th>
                  <th>Son Deneme</th>
                  <th>Trend</th>
                  <th aria-label="İşlem" />
                </tr>
              </thead>
              <tbody>
                {students.map((st) => {
                  const t = trendMeta(st.trend);
                  return (
                    <tr key={st.id} onClick={() => setSelected(st)}>
                      <td>
                        <span className={s.cellStudent}>
                          <Avatar name={st.name} color={st.color} size="sm" />
                          <span className={s.cellName}>{st.name}</span>
                        </span>
                      </td>
                      <td><Badge>{st.grade}</Badge></td>
                      <td>
                        <span className={s.cellCompliance}>
                          <ProgressBar
                            value={st.compliance}
                            color={
                              st.compliance >= 80 ? 'var(--success)'
                                : st.compliance >= 60 ? 'var(--warning)'
                                : 'var(--danger)'
                            }
                          />
                          <span className={s.compliancePct}>%{st.compliance}</span>
                        </span>
                      </td>
                      <td>{st.lastNet} net</td>
                      <td><Badge tone={t.tone}><t.Icon size={12} /></Badge></td>
                      <td><span className={s.eyeBtn}><Eye size={15} /></span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <div className={s.aiHead}>
            <span className={s.aiMark}><Sparkles size={16} /></span>
            <div>
              <h3 className={s.aiTitle}>AI Asistanı</h3>
              <p className={s.aiSub}>Haftalık öğrenci analiz raporları</p>
            </div>
          </div>
          <div className={s.aiList}>
            {insights.map((ins) => (
              <button
                key={ins.id}
                type="button"
                className={`${s.aiCard} ${
                  ins.tone === 'danger' ? s.aiCardDanger
                    : ins.tone === 'success' ? s.aiCardSuccess
                    : s.aiCardAccent
                }`}
                onClick={() => setSelected(ins.student)}
              >
                <span className={s.aiCardHead}>
                  <Avatar name={ins.student.name} color={ins.student.color} size="xs" />
                  <span className={s.aiCardName}>{ins.student.name}</span>
                  <Badge tone={ins.tone}>{ins.tag}</Badge>
                </span>
                <p className={s.aiCardBody}>{ins.body}</p>
                <span className={s.aiCardCta}>{ins.cta} <ArrowRight size={12} /></span>
              </button>
            ))}
          </div>
        </Card>
      </div>

      <StudentModal
        student={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
        onModifySchedule={(st) => navigate(`/ders-programi?ogrenci=${st.id}`)}
      />
    </div>
  );
}
