import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Clock, CalendarDays } from 'lucide-react';
import {
  Card, Avatar, Badge, SearchInput, ProgressRing, EmptyState, Spinner,
} from '../components/ui';
import { trendMeta } from '../components/dashboard/trend';
import { listStudents } from '../api/students';
import { listAppointments } from '../api/appointments';
import { getSchedule } from '../api/schedule';
import { DAYS } from '../mocks/data';
import s from './Ogrenciler.module.css';

const MONTHS_SHORT = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const pad2 = (n) => String(n).padStart(2, '0');
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
const fmtMeeting = (a) => { const [y, m, d] = a.date.split('-').map(Number); return `${d} ${MONTHS_SHORT[m - 1]} ${y}, ${a.time}`; };

export default function Ogrenciler() {
  const [students, setStudents] = useState(null);
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    let alive = true;
    // Öğrencileri çek + takvimden her öğrencinin son/sonraki toplantısını türet.
    Promise.all([listStudents(), listAppointments()]).then(([sts, appts]) => {
      if (!alive) return;
      const today = todayIso();
      const byStudent = {};
      appts.forEach((a) => {
        if (!a.studentId) return;
        (byStudent[a.studentId] ||= []).push(a);
      });
      const enriched = sts.map((st) => {
        const evs = (byStudent[st.id] || []).slice()
          .sort((x, y) => `${x.date}${x.time}`.localeCompare(`${y.date}${y.time}`));
        const future = evs.filter((e) => e.date >= today);
        const past = evs.filter((e) => e.date < today);
        return {
          ...st,
          nextMeeting: future[0] ? fmtMeeting(future[0]) : null,
          lastMeeting: past.length ? fmtMeeting(past[past.length - 1]) : null,
        };
      });
      setStudents(enriched);
    });
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    if (!students) return [];
    const q = query.trim().toLocaleLowerCase('tr-TR');
    if (!q) return students;
    return students.filter(
      (st) =>
        st.name.toLocaleLowerCase('tr-TR').includes(q) ||
        st.grade.toLocaleLowerCase('tr-TR').includes(q)
    );
  }, [students, query]);

  if (!students) {
    return <div style={{ display: 'grid', placeItems: 'center', padding: 60 }}><Spinner size={24} /></div>;
  }

  return (
    <div className={s.page}>
      <SearchInput
        className={s.toolbar}
        placeholder="Öğrenci ara..."
        aria-label="Öğrenci ara"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            title="Öğrenci bulunamadı"
            text={`"${query}" aramasıyla eşleşen öğrenci yok.`}
          />
        </Card>
      ) : (
        <div className={s.list}>
          {filtered.map((st) => (
            <StudentRow
              key={st.id}
              student={st}
              open={openId === st.id}
              onToggle={() => setOpenId((id) => (id === st.id ? null : st.id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StudentRow({ student, open, onToggle }) {
  const t = trendMeta(student.trend);
  const [schedule, setSchedule] = useState(null);

  // Only fetch the weekly program once the card is actually expanded.
  useEffect(() => {
    if (!open || schedule) return undefined;
    let alive = true;
    getSchedule(student.id).then((d) => { if (alive) setSchedule(d); });
    return () => { alive = false; };
  }, [open, schedule, student.id]);

  const hasExams = student.examHistory.length > 0;
  const maxNet = hasExams ? Math.max(...student.examHistory.map((e) => e.net)) : 0;
  const hasRings = student.completion != null || student.compliance != null;

  return (
    <Card className={s.card}>
      <button
        type="button"
        className={s.head}
        onClick={onToggle}
        aria-expanded={open}
      >
        <Avatar name={student.name} color={student.color} size="md" />
        <span className={s.headText}>
          <span className={s.name}>{student.name}</span>
          <p className={s.grade}>{student.grade}</p>
        </span>
        <span className={s.netPill}>{student.lastNet != null ? `${student.lastNet} net` : '—'}</span>
        <Badge tone={t.tone}><t.Icon size={12} /></Badge>
        <span className={`${s.chevron} ${open ? s.chevronOpen : ''}`}>
          <ChevronRight size={18} />
        </span>
      </button>

      {open && (
        <div className={s.body}>
          {hasRings && (
            <div className={s.rings}>
              <ProgressRing
                value={student.completion}
                label="Konu Tamamlama"
                color="var(--subj-matematik)"
              />
              <ProgressRing
                value={student.compliance}
                label="Programa Uyum"
                color="var(--success)"
              />
            </div>
          )}

          <div className={s.meetings}>
            <div className={s.meeting}>
              <span className={s.meetingIcon}><Clock size={16} /></span>
              <div>
                <p className={s.meetingLabel}>Son toplantı</p>
                <p className={s.meetingValue}>{student.lastMeeting ?? '—'}</p>
              </div>
            </div>
            <div className={s.meeting}>
              <span className={s.meetingIcon}><CalendarDays size={16} /></span>
              <div>
                <p className={s.meetingLabel}>Gelecek toplantı</p>
                <p className={s.meetingValue}>{student.nextMeeting ?? '—'}</p>
              </div>
            </div>
          </div>

          <div>
            <h4 className={s.sectionLabel}>Son 5 Deneme Neti</h4>
            {!hasExams ? (
              <p className={s.dayEmpty}>Henüz deneme verisi yok.</p>
            ) : (
            <div className={s.miniChart}>
              {student.examHistory.map((e) => (
                <div className={s.miniBar} key={e.label}>
                  <span
                    className={s.miniFill}
                    style={{ height: `${(e.net / maxNet) * 100}%` }}
                  >
                    <span className={s.miniValue}>{e.net}</span>
                  </span>
                  <span className={s.miniLabel}>{e.label}</span>
                </div>
              ))}
            </div>
            )}
          </div>

          <div>
            <h4 className={s.sectionLabel}>Haftalık Programı</h4>
            {!schedule ? (
              <div style={{ display: 'grid', placeItems: 'center', padding: 24 }}>
                <Spinner />
              </div>
            ) : (
              <div className={s.week}>
                {DAYS.map((day) => {
                  const blocks = schedule
                    .filter((b) => b.day === day.id)
                    .sort((a, b) => a.start - b.start);
                  return (
                    <div className={s.day} key={day.id}>
                      <span className={s.dayName}>{day.short}</span>
                      {blocks.length === 0 ? (
                        <span className={s.dayEmpty}>—</span>
                      ) : (
                        blocks.slice(0, 3).map((b) => (
                          <span
                            className={s.block}
                            key={b.id}
                            style={{ borderLeftColor: b.subjectColor }}
                          >
                            <span className={s.blockSubject}>
                              {b.subjectLabel ?? b.subject}
                            </span>
                            <span className={s.blockTopic}>{b.topic}</span>
                          </span>
                        ))
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
