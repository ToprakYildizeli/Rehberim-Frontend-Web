import { useEffect, useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { Card, CardHeader, Button, Field, Select, Spinner } from '../ui';
import { exportCalendarIcs, importCalendarIcs } from '../../api/appointments';
import { listStudents } from '../../api/students';
import s from './settings.module.css';

/**
 * Takvimin `.ics` (iCalendar) olarak dışa/içe aktarımı (D3).
 *
 * Dışa aktarımda dosya `Authorization` başlığı gerektirdiği için düz bir link
 * kullanılamıyor; `exportCalendarIcs` blob'u alıp indirmeyi kendisi tetikliyor.
 *
 * İçe aktarımda **hangi öğrenciye bağlanacağı sorulur**: `.ics` dosyalarında
 * öğrenci kavramı yok, dolayısıyla eşleme yapılamaz. Boş bırakılırsa etkinlikler
 * rehberin kişisel notları olarak gelir (backend'de `student = null`).
 */
export default function CalendarDataSection() {
  const [students, setStudents] = useState(null);
  const [exportStudent, setExportStudent] = useState('');
  const [importStudent, setImportStudent] = useState('');
  const [busy, setBusy] = useState(null);          // 'export' | 'import' | null
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    let alive = true;
    listStudents()
      .then((rows) => alive && setStudents(rows))
      .catch(() => alive && setStudents([]));
    return () => { alive = false; };
  }, []);

  async function download() {
    setBusy('export');
    setError(null);
    setResult(null);
    try {
      await exportCalendarIcs({ student: exportStudent || undefined });
    } catch {
      setError('Takvim indirilemedi. Lütfen tekrar dene.');
    } finally {
      setBusy(null);
    }
  }

  async function upload(event) {
    const file = event.target.files?.[0];
    // Aynı dosyayı arka arkaya seçebilmek için input her denemede sıfırlanır.
    event.target.value = '';
    if (!file) return;
    setBusy('import');
    setError(null);
    setResult(null);
    try {
      setResult(await importCalendarIcs(file, importStudent || null));
    } catch (err) {
      const data = err?.response?.data;
      const first = data && !data.detail ? Object.values(data).flat()[0] : data?.detail;
      setError(first ?? 'Dosya içe aktarılamadı.');
    } finally {
      setBusy(null);
    }
  }

  if (students === null) {
    return <Card><div className={s.loading}><Spinner /></div></Card>;
  }

  const options = (
    <>
      <option value="">Tüm takvim (kişisel notlar dahil)</option>
      {students.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
    </>
  );

  return (
    <Card>
      <CardHeader title="Takvim aktarımı" />

      <div className={s.icsRow}>
        <Field label="Dışa aktarılacak">
          <Select value={exportStudent} onChange={(e) => setExportStudent(e.target.value)}>
            {options}
          </Select>
        </Field>
        <Button variant="soft" onClick={download} disabled={busy !== null}>
          <Download size={14} /> {busy === 'export' ? 'Hazırlanıyor…' : '.ics indir'}
        </Button>
      </div>

      <div className={s.icsRow}>
        <Field label="İçe aktarılanlar şu öğrenciye bağlansın">
          <Select value={importStudent} onChange={(e) => setImportStudent(e.target.value)}>
            <option value="">Kimseye (kişisel not olarak)</option>
            {students.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </Select>
        </Field>
        <Button variant="soft" onClick={() => fileRef.current?.click()} disabled={busy !== null}>
          <Upload size={14} /> {busy === 'import' ? 'Aktarılıyor…' : 'Dosya seç'}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".ics,text/calendar"
          className={s.fileInput}
          onChange={upload}
        />
      </div>

      {result && (
        <p className={s.savedNote}>
          {result.created} etkinlik eklendi
          {result.skipped > 0 && `, ${result.skipped} tanesi zaten vardı (atlandı)`}.
          {result.total === 0 && ' Dosyada okunabilir etkinlik bulunamadı.'}
        </p>
      )}
      {error && <p className={s.error}>{error}</p>}
    </Card>
  );
}
