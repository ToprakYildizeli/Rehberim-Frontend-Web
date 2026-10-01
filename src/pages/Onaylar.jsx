import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, CheckCheck, CircleDashed, Circle, ShieldCheck } from 'lucide-react';
import { Card, Button, Spinner, EmptyState, Badge } from '../components/ui';
import { listPendingApproval, approveTasks } from '../api/programs';
import { blockLabel } from '../api/catalog';
import s from './Onaylar.module.css';

/**
 * Onay ekranı (1 Ekim 2026).
 *
 * Onay artık görev başına veriliyor: rehber öğrenciyle ne zaman görüşüyorsa o
 * zaman onaylıyor, programın bitmesini beklemiyor. Bu ekran "geçmişte
 * onaylamadığım ve bugüne kadar olan her şeyi" tek yerde gösteriyor.
 *
 * **Geniş ve seyrek** olması kullanıcı isteği: ekran sıkışık olmasın. Bu yüzden
 * tablo değil kart dizilimi, öğrenci başına bir sütun bloğu ve gün gün
 * gruplanmış görevler var; dar ekranda tek sütuna iniyor.
 *
 * Görev listesi sunucudan **öğrenci + gün** gruplanmış geliyor
 * (`GET /api/tasks/pending-approval/`); burada öğrenciye göre ikinci bir
 * gruplama yapılıyor çünkü rehber ekrana öğrenci öğrenci bakıyor.
 */
export default function Onaylar() {
  const [groups, setGroups] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);     // işlem gören öğrenci id'si ya da 'all'
  const [selected, setSelected] = useState(() => new Set());

  const load = useCallback(() => {
    setError('');
    return listPendingApproval()
      .then(setGroups)
      .catch(() => setError('Onay bekleyenler yüklenemedi.'));
  }, []);

  useEffect(() => { load(); }, [load]);

  /** Öğrenci başına: { student, studentName, days: [{ date, tasks }], taskCount } */
  const byStudent = useMemo(() => {
    const map = new Map();
    (groups ?? []).forEach((g) => {
      if (!map.has(g.student)) {
        map.set(g.student, {
          student: g.student, studentName: g.studentName, days: [], taskCount: 0,
        });
      }
      const row = map.get(g.student);
      row.days.push({ date: g.date, tasks: g.tasks });
      row.taskCount += g.tasks.length;
    });
    return [...map.values()].sort((a, b) => b.taskCount - a.taskCount);
  }, [groups]);

  const toplam = useMemo(
    () => byStudent.reduce((n, r) => n + r.taskCount, 0),
    [byStudent]
  );

  function toggle(taskId) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId); else next.add(taskId);
      return next;
    });
  }

  /** Bir öğrencinin bütün bekleyenlerini onaylar.
   *  `student` + `until` ile gidiyoruz, görev id listesiyle değil: ekran
   *  açıldıktan sonra eklenen bir görev de kapsama girsin. */
  async function approveStudent(studentId) {
    setBusy(studentId); setError('');
    try {
      await approveTasks({ student: studentId });
      setSelected(new Set());
      await load();
    } catch {
      setError('Onaylanamadı. Tekrar deneyin.');
    } finally {
      setBusy(null);
    }
  }

  async function approveSelected() {
    if (!selected.size) return;
    setBusy('all'); setError('');
    try {
      await approveTasks({ tasks: [...selected] });
      setSelected(new Set());
      await load();
    } catch {
      setError('Onaylanamadı. Tekrar deneyin.');
    } finally {
      setBusy(null);
    }
  }

  if (groups === null) {
    return <Card><div className={s.center}><Spinner /></div></Card>;
  }

  if (!byStudent.length) {
    return (
      <Card>
        <EmptyState
          icon={<ShieldCheck size={22} />}
          title="Onay bekleyen görev yok"
          text="Bugüne kadarki bütün görevleri onayladınız. İleri tarihli görevler burada görünmez; onay yapılmış işin teyididir."
        />
      </Card>
    );
  }

  return (
    <div className={s.page}>
      <div className={s.topBar}>
        <div className={s.summary}>
          <span className={s.summaryCount}>{toplam}</span>
          <span className={s.summaryLabel}>
            görev onay bekliyor · {byStudent.length} öğrenci
          </span>
        </div>
        <div className={s.topActions}>
          {error && <span className={s.error}>{error}</span>}
          <Button
            variant="soft"
            disabled={!selected.size || busy !== null}
            onClick={approveSelected}
          >
            <Check size={15} /> Seçilenleri onayla{selected.size ? ` (${selected.size})` : ''}
          </Button>
        </div>
      </div>

      <div className={s.columns}>
        {byStudent.map((row) => (
          <Card key={row.student} className={s.studentCard}>
            <header className={s.studentHead}>
              <div>
                <Link to={`/ogrenciler/${row.student}`} className={s.studentName}>
                  {row.studentName}
                </Link>
                <span className={s.studentMeta}>{row.taskCount} görev</span>
              </div>
              <Button
                size="sm"
                disabled={busy !== null}
                onClick={() => approveStudent(row.student)}
              >
                {busy === row.student
                  ? <Spinner size={14} />
                  : <><CheckCheck size={15} /> Hepsini onayla</>}
              </Button>
            </header>

            {row.days.map((day) => (
              <section className={s.day} key={day.date}>
                <h4 className={s.dayTitle}>{gunBasligi(day.date)}</h4>
                <ul className={s.taskList}>
                  {day.tasks.map((task) => (
                    <li key={task.id}>
                      <label className={s.task}>
                        <input
                          type="checkbox"
                          className={s.check}
                          checked={selected.has(task.id)}
                          onChange={() => toggle(task.id)}
                        />
                        <span className={s.taskBody}>
                          <span className={s.taskHead}>
                            <span className={s.taskLabel}>{blockLabel(task)}</span>
                            <DurumRozeti completion={task.completion} />
                          </span>
                          {task.title && <span className={s.taskTopic}>{task.title}</span>}
                          <span className={s.taskMeta}>
                            {[task.typeName, task.durationMin ? `${task.durationMin} dk` : null]
                              .filter(Boolean).join(' · ')}
                          </span>
                          {task.note && <span className={s.taskNote}>{task.note}</span>}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </Card>
        ))}
      </div>
    </div>
  );
}

/** Öğrencinin ne dediği — onay kararının asıl girdisi, bu yüzden rozet. */
function DurumRozeti({ completion }) {
  if (completion === 'done') {
    return <Badge tone="success"><Check size={11} /> Yaptım</Badge>;
  }
  if (completion === 'half') {
    return <Badge tone="warning"><CircleDashed size={11} /> Yarım</Badge>;
  }
  return <Badge tone="neutral"><Circle size={11} /> Yapılmadı</Badge>;
}

const AYLAR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz',
  'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const GUNLER = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

/** "12 Eyl Cuma". Tarih string'i ISO; `new Date(iso)` UTC okur, bu yüzden
 *  parçalara ayırıp yerel tarih kuruyoruz — bir gün kayması olmasın. */
function gunBasligi(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${d} ${AYLAR[m - 1]} ${GUNLER[date.getDay()]}`;
}
