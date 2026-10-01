import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, Check, CheckCheck, ChevronLeft, ChevronRight,
  Circle, CircleDashed, ShieldCheck,
} from 'lucide-react';
import {
  Card, Avatar, Button, Spinner, EmptyState, SearchInput, LoadError,
} from '../components/ui';
import { listStudents } from '../api/students';
import {
  listPendingApproval, listTasksInRange, approveTasks, unapproveTasks,
  addDays, today,
} from '../api/programs';
import { blockLabel, blockColor } from '../api/catalog';
import s from './Onaylar.module.css';

/**
 * Onay ekranı — iki kademe (1 Ekim 2026).
 *
 * **1. Öğrenci ızgarası.** Öğrenciler ekranındaki gibi kare kartlar. Onay
 * bekleyenler **üstte** ve çevrelerinde bir vurgu var; bekleyeni olmayanlar
 * altta, sönük. Rehber ekrana baktığında "kime gitmem lazım" sorusunun cevabı
 * ilk bakışta görünsün diye.
 *
 * **2. Haftalık görünüm.** Bir öğrenciye tıklayınca haftanın yedi günü yan
 * yana açılıyor — planlayıcıdaki gün sütunlu tahtayla aynı mantık. Hafta
 * Pazartesi-Pazar: uyumun ölçüldüğü birim bu (kontrat v5.0), onay da aynı
 * çerçevede verilsin.
 *
 * Görevler tarihe göre çekiliyor (`GET /api/tasks/`), programa göre değil:
 * pencereler üst üste binebildiği için bir günün görevleri birden çok
 * programdan gelebiliyor.
 */
export default function Onaylar() {
  const [selected, setSelected] = useState(null);   // seçili öğrenci ya da null
  return selected
    ? <HaftaGorunumu student={selected} onBack={() => setSelected(null)} />
    : <OgrenciIzgarasi onPick={setSelected} />;
}

/* ---------------- 1) Öğrenci ızgarası ---------------- */

function OgrenciIzgarasi({ onPick }) {
  const [rows, setRows] = useState(null);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let alive = true;
    setFailed(false);
    setRows(null);
    /* Bekleyen listesi yalnız **bekleyeni olan** öğrencileri taşıyor; ızgarada
       hepsi görünsün diye öğrenci listesiyle birleştiriliyor. */
    Promise.all([listStudents(), listPendingApproval()])
      .then(([students, pending]) => {
        if (!alive) return;
        const sayac = new Map();
        pending.forEach((g) => {
          sayac.set(g.student, (sayac.get(g.student) ?? 0) + g.tasks.length);
        });
        setRows(students.map((st) => ({ ...st, pending: sayac.get(st.id) ?? 0 })));
      })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [reloadKey]);

  const { bekleyen, temiz, toplam } = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    const list = (rows ?? []).filter(
      (r) => !q || r.name.toLocaleLowerCase('tr').includes(q)
    );
    return {
      // Çok bekleyen üstte: rehberin önce bakması gereken öğrenci o.
      bekleyen: list.filter((r) => r.pending > 0).sort((a, b) => b.pending - a.pending),
      temiz: list.filter((r) => r.pending === 0)
        .sort((a, b) => a.name.localeCompare(b.name, 'tr')),
      toplam: (rows ?? []).reduce((n, r) => n + r.pending, 0),
    };
  }, [rows, query]);

  if (failed) return <LoadError onRetry={() => setReloadKey((k) => k + 1)} />;
  if (rows === null) return <Card><div className={s.center}><Spinner /></div></Card>;

  return (
    <div className={s.page}>
      <div className={s.topBar}>
        <div className={s.summary}>
          <span className={s.summaryCount}>{toplam}</span>
          <span className={s.summaryLabel}>
            görev onay bekliyor · {bekleyen.length} öğrenci
          </span>
        </div>
        <SearchInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Öğrenci ara…"
          aria-label="Öğrenci ara"
        />
      </div>

      {bekleyen.length === 0 && (
        <Card>
          <EmptyState
            icon={<ShieldCheck size={22} />}
            title="Onay bekleyen görev yok"
            text="Bugüne kadarki bütün görevleri onayladınız. İleri tarihli görevler burada görünmez; onay yapılmış işin teyididir."
          />
        </Card>
      )}

      {bekleyen.length > 0 && (
        <section>
          <h3 className={s.sectionTitle}>Onay bekleyenler</h3>
          <div className={s.grid}>
            {bekleyen.map((st) => (
              <OgrenciKarti key={st.id} student={st} onPick={onPick} />
            ))}
          </div>
        </section>
      )}

      {temiz.length > 0 && (
        <section>
          <h3 className={s.sectionTitle}>
            Bekleyeni olmayanlar <span className={s.sectionNote}>({temiz.length})</span>
          </h3>
          <div className={s.grid}>
            {temiz.map((st) => (
              <OgrenciKarti key={st.id} student={st} onPick={onPick} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function OgrenciKarti({ student, onPick }) {
  const bekliyor = student.pending > 0;
  return (
    <Card pad={false} className={`${s.card} ${bekliyor ? s.cardPending : s.cardClear}`}>
      <button
        type="button"
        className={s.cardBtn}
        onClick={() => onPick(student)}
        aria-label={`${student.name} — ${bekliyor ? `${student.pending} görev onay bekliyor` : 'onay bekleyen görev yok'}`}
      >
        <Avatar name={student.name} color={student.color} size="md" />
        <span className={s.name}>{student.name}</span>
        <span className={s.grade}>{student.grade}</span>
        {bekliyor
          ? <span className={s.pendingPill}>{student.pending} görev bekliyor</span>
          : <span className={s.clearPill}><Check size={12} /> Güncel</span>}
      </button>
    </Card>
  );
}

/* ---------------- 2) Haftalık görünüm ---------------- */

const GUN_KISA = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const AYLAR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz',
  'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

/** Verilen ISO günün içinde bulunduğu haftanın Pazartesi'si. */
function haftaBasi(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const gun = new Date(y, m - 1, d).getDay();      // 0 = Pazar
  return addDays(iso, -((gun + 6) % 7));
}

const gunEtiketi = (iso) => {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${AYLAR[m - 1]}`;
};

function HaftaGorunumu({ student, onBack }) {
  const [week, setWeek] = useState(() => haftaBasi(today()));
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setFailed(false);
    setData(null);
    return listTasksInRange(student.id, { from: week, to: addDays(week, 6) })
      .then(setData)
      .catch(() => setFailed(true));
  }, [student.id, week]);

  useEffect(() => { load(); }, [load]);

  const gunler = useMemo(() => {
    const byDate = new Map();
    (data?.tasks ?? []).forEach((t) => {
      if (!byDate.has(t.date)) byDate.set(t.date, []);
      byDate.get(t.date).push(t);
    });
    return Array.from({ length: 7 }, (_, i) => {
      const iso = addDays(week, i);
      return { iso, short: GUN_KISA[i], label: gunEtiketi(iso), tasks: byDate.get(iso) ?? [] };
    });
  }, [data, week]);

  const bekleyen = useMemo(
    () => (data?.tasks ?? []).filter((t) => !t.isApproved),
    [data]
  );
  const bugun = today();

  /** Tek bir görevin onayını çevirir — tahtadaki tamamlama döngüsüyle aynı
   *  mantık: öğeye tıkla, durumu değişsin, sunucu doğrulasın. */
  async function toggle(task) {
    setBusy(true); setError('');
    try {
      const govde = { tasks: [task.id] };
      if (task.isApproved) await unapproveTasks(govde);
      else await approveTasks(govde);
      await load();
    } catch {
      setError('İşlem kaydedilemedi.');
    } finally {
      setBusy(false);
    }
  }

  /** Haftanın **bugüne kadarki** bekleyenlerini onaylar.
   *  İleri tarihli görev onaylanmaz: onay yapılmış işin teyididir. */
  async function approveWeek() {
    const hedef = bekleyen.filter((t) => t.date <= bugun).map((t) => t.id);
    if (!hedef.length) return;
    setBusy(true); setError('');
    try {
      await approveTasks({ tasks: hedef });
      await load();
    } catch {
      setError('Onaylanamadı. Tekrar deneyin.');
    } finally {
      setBusy(false);
    }
  }

  const onaylanabilir = bekleyen.filter((t) => t.date <= bugun).length;

  return (
    <div className={s.page}>
      <div className={s.weekBar}>
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft size={15} /> Öğrenciler
        </Button>
        <div className={s.weekWho}>
          <Avatar name={student.name} color={student.color} size="sm" />
          <span className={s.weekName}>{student.name}</span>
        </div>
        <div className={s.weekNav}>
          <Button variant="soft" size="sm" onClick={() => setWeek(addDays(week, -7))}>
            <ChevronLeft size={15} />
          </Button>
          <span className={s.weekRange}>
            {gunEtiketi(week)} – {gunEtiketi(addDays(week, 6))}
          </span>
          <Button variant="soft" size="sm" onClick={() => setWeek(addDays(week, 7))}>
            <ChevronRight size={15} />
          </Button>
        </div>
        <div className={s.weekActions}>
          {error && <span className={s.error}>{error}</span>}
          <Button disabled={busy || !onaylanabilir} onClick={approveWeek}>
            <CheckCheck size={15} /> Bugüne kadarkini onayla
            {onaylanabilir ? ` (${onaylanabilir})` : ''}
          </Button>
        </div>
      </div>

      {failed && <LoadError onRetry={load} />}
      {!failed && data === null && <Card><div className={s.center}><Spinner /></div></Card>}

      {!failed && data !== null && (
        <div className={s.week}>
          {gunler.map((g) => (
            <div
              key={g.iso}
              className={`${s.day} ${g.iso === bugun ? s.dayToday : ''}`}
            >
              <span className={s.dayHead}>
                {g.short}
                <span className={s.dayDate}>{g.label}</span>
              </span>
              {g.tasks.length === 0
                ? <span className={s.dayEmpty}>—</span>
                : g.tasks.map((t) => (
                  <GorevKutusu key={t.id} task={t} busy={busy} onToggle={toggle} />
                ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const DURUM = {
  done: { Icon: Check, label: 'Yaptım', cls: 'done' },
  half: { Icon: CircleDashed, label: 'Yarım', cls: 'half' },
  none: { Icon: Circle, label: 'Yapılmadı', cls: 'none' },
};

function GorevKutusu({ task, busy, onToggle }) {
  const d = DURUM[task.completion] ?? DURUM.none;
  const label = blockLabel(task);
  return (
    <button
      type="button"
      className={`${s.task} ${task.isApproved ? s.taskApproved : ''}`}
      style={{ borderLeftColor: blockColor(task) }}
      disabled={busy}
      onClick={() => onToggle(task)}
      title={task.isApproved ? 'Onaylı — tıkla, onayı geri al' : 'Tıkla, onayla'}
    >
      <span className={s.taskHead}>
        <span className={s.taskLabel}>{label}</span>
        {task.isApproved && <ShieldCheck size={13} className={s.taskSeal} />}
      </span>
      {task.title && <span className={s.taskTopic}>{task.title}</span>}
      <span className={s.taskMeta}>
        <span className={`${s.state} ${s[d.cls]}`}><d.Icon size={11} /> {d.label}</span>
        {[task.typeName, task.durationMin ? `${task.durationMin} dk` : null]
          .filter(Boolean).join(' · ')}
      </span>
      {task.note && <span className={s.taskNote}>{task.note}</span>}
    </button>
  );
}
