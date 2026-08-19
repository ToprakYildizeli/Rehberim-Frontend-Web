import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, CalendarDays } from 'lucide-react';
import {
  Card, Avatar, Badge, SearchInput, EmptyState, Spinner,
} from '../components/ui';
import { trendMeta } from '../components/dashboard/trend';
import { listStudents } from '../api/students';
import { listAppointments } from '../api/appointments';
import s from './Ogrenciler.module.css';

const MONTHS_SHORT = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const pad2 = (n) => String(n).padStart(2, '0');
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
const fmtMeeting = (a) => { const [y, m, d] = a.date.split('-').map(Number); return `${d} ${MONTHS_SHORT[m - 1]} ${y}, ${a.time}`; };

export default function Ogrenciler() {
  const [students, setStudents] = useState(null);
  const [query, setQuery] = useState('');

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
            <StudentRow key={st.id} student={st} />
          ))}
        </div>
      )}
    </div>
  );
}

function StudentRow({ student }) {
  const navigate = useNavigate();
  const t = trendMeta(student.trend);

  return (
    <Card className={s.card}>
      <button
        type="button"
        className={s.head}
        onClick={() => navigate(`/ogrenciler/${student.id}`)}
      >
        <Avatar name={student.name} color={student.color} size="md" />
        <span className={s.headText}>
          <span className={s.name}>{student.name}</span>
          <p className={s.grade}>{student.grade}</p>
        </span>
        {student.nextMeeting && (
          <span className={s.nextMeeting}>
            <CalendarDays size={13} /> {student.nextMeeting}
          </span>
        )}
        <span className={s.netPill}>{student.lastNet != null ? `${student.lastNet} net` : '—'}</span>
        <Badge tone={t.tone}><t.Icon size={12} /></Badge>
        <span className={s.chevron}>
          <ChevronRight size={18} />
        </span>
      </button>
    </Card>
  );
}
