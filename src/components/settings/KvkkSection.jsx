import { useCallback, useEffect, useState } from 'react';
import { Download, FileText, ShieldCheck, Undo2 } from 'lucide-react';
import { Card, CardHeader, Button, Badge, Modal, Spinner } from '../ui';
import LegalText from '../LegalText';
import {
  acceptConsent, downloadMyData, getLegalDocument, listConsents, withdrawConsent,
} from '../../api/legal';
import { useAuth } from '../../context/AuthContext';
import { getMe } from '../../api/auth';
import s from './settings.module.css';

/**
 * KVKK bölümü: metinler, onay durumu ve veri indirme (16 Eylül 2026).
 *
 * Üç işi bir kartta topluyor çünkü kullanıcı açısından tek konu: "verilerim
 * ne durumda". Ayrı kartlara bölünse Hesap sekmesi üç kere aynı şeyi anlatan
 * başlıkla uzardı.
 *
 * **Onay durumu sunucudan geliyor** (`/legal/consents/`), yerelde tutulmuyor:
 * metnin sürümü yükselince eski onay kendiliğinden "eksik" sayılmalı ve bu
 * kararı sunucu veriyor. İstemci kendi kopyasını tutsaydı, metin değiştiğinde
 * kullanıcı hiçbir şey görmeden eski onayla devam ederdi.
 *
 * Onay verildikten sonra `/auth/me/` yeniden çekiliyor: `pending_consents`
 * oturum objesinde duruyor ve giriş kapısı (`ConsentGate`) ona bakıyor.
 */

const KIND_LABELS = {
  aydinlatma: 'Aydınlatma Metni',
  acik_riza: 'Açık Rıza Metni',
  veli_onam: 'Veli Onam Formu',
};

export default function KvkkSection() {
  const { user, updateUser } = useAuth();
  const [state, setState] = useState(null);        // { consents, pending }
  const [busy, setBusy] = useState(null);          // kind | 'export' | null
  const [error, setError] = useState(null);
  const [note, setNote] = useState(null);
  const [reading, setReading] = useState(null);    // açık metin (modal)

  const load = useCallback(() => {
    let alive = true;
    listConsents()
      .then((data) => alive && setState(data))
      .catch(() => alive && setState({ consents: [], pending: [] }));
    return () => { alive = false; };
  }, []);

  useEffect(load, [load]);

  /** Oturumdaki `pending_consents` tazelenir; giriş kapısı ona bakıyor. */
  async function refreshSession() {
    try {
      const { data } = await getMe(localStorage.getItem('access'));
      updateUser(data);
    } catch {
      // Oturum tazelenemediyse kart yine doğru; kapı bir sonraki girişte düzelir.
    }
  }

  async function accept(kind) {
    setBusy(kind);
    setError(null);
    setNote(null);
    try {
      const data = await acceptConsent(kind);
      setState((prev) => ({ ...prev, pending: data.pending }));
      setNote(`${KIND_LABELS[kind]} onaylandı.`);
      load();
      await refreshSession();
    } catch (e) {
      setError(e.response?.data?.kind?.[0] ?? 'Onay kaydedilemedi.');
    } finally {
      setBusy(null);
    }
  }

  async function withdraw() {
    setBusy('acik_riza');
    setError(null);
    setNote(null);
    try {
      await withdrawConsent('acik_riza');
      setNote('Açık rızanız geri alındı. Hesabınız kapatılmadı.');
      load();
      await refreshSession();
    } catch (e) {
      setError(e.response?.data?.kind?.[0] ?? 'Geri alma başarısız.');
    } finally {
      setBusy(null);
    }
  }

  async function exportData() {
    setBusy('export');
    setError(null);
    setNote(null);
    try {
      const filename = await downloadMyData(user?.username);
      setNote(`${filename} indirildi.`);
    } catch (e) {
      setError(e.response?.status === 429
        ? 'Çok sık istendi; bir süre sonra tekrar deneyin.'
        : 'Veriler indirilemedi.');
    } finally {
      setBusy(null);
    }
  }

  async function read(kind) {
    setReading({ kind, loading: true });
    try {
      const doc = await getLegalDocument(kind);
      setReading({ ...doc, loading: false });
    } catch {
      setReading({ kind, error: true, loading: false });
    }
  }

  /** Bir metnin geçerli (yürürlükteki sürüm + geri alınmamış) onayı var mı? */
  function currentConsent(kind) {
    return state?.consents?.find((row) => row.kind === kind && row.is_current) ?? null;
  }

  const kinds = ['aydinlatma', 'acik_riza'];

  return (
    <Card>
      <CardHeader
        title="Kişisel verileriniz"
        subtitle="Aydınlatma metni, açık rıza durumu ve verilerinizin bir kopyası."
      />

      {state === null ? (
        <div className={s.loading}><Spinner /></div>
      ) : (
        <div className={s.rows}>
          {kinds.map((kind) => {
            const consent = currentConsent(kind);
            return (
              <div className={s.row} key={kind}>
                <div className={s.rowMain}>
                  <div className={s.consentTitle}>
                    <span>{KIND_LABELS[kind]}</span>
                    {consent
                      ? <Badge tone="success">Onaylandı</Badge>
                      : <Badge tone="warning">Onay bekliyor</Badge>}
                  </div>
                  <div className={s.rowHint}>
                    {consent
                      ? `Sürüm ${consent.version} · ${new Date(consent.accepted_at)
                        .toLocaleDateString('tr-TR')}`
                      : 'Metni okuyup onaylayabilirsiniz.'}
                  </div>
                </div>
                <div className={s.rowActions}>
                  <Button variant="ghost" onClick={() => read(kind)}>
                    <FileText size={15} /> Oku
                  </Button>
                  {!consent && (
                    <Button
                      onClick={() => accept(kind)}
                      disabled={busy === kind}
                    >
                      {busy === kind ? <Spinner size={14} /> : <ShieldCheck size={15} />}
                      Onayla
                    </Button>
                  )}
                  {/* Aydınlatma geri alınamaz: rıza değil, bilgilendirmedir. */}
                  {consent && kind === 'acik_riza' && (
                    <Button
                      variant="ghost"
                      onClick={withdraw}
                      disabled={busy === kind}
                    >
                      <Undo2 size={15} /> Geri al
                    </Button>
                  )}
                </div>
              </div>
            );
          })}

          <div className={s.row}>
            <div className={s.rowMain}>
              <div className={s.rowTitle}>Verilerimi indir</div>
              <div className={s.rowHint}>
                Hakkınızda işlenen bütün veri tek bir JSON dosyası olarak iner.
              </div>
            </div>
            <div className={s.rowActions}>
              <Button onClick={exportData} disabled={busy === 'export'}>
                {busy === 'export' ? <Spinner size={14} /> : <Download size={15} />}
                İndir
              </Button>
            </div>
          </div>
        </div>
      )}

      {note && <p className={s.savedNote}>{note}</p>}
      {error && <p className={s.error}>{error}</p>}

      <Modal open={reading !== null} onClose={() => setReading(null)} width={720}>
        <h3 className={s.modalTitle}>
          {KIND_LABELS[reading?.kind] ?? 'Metin'}
          {reading?.version ? ` · sürüm ${reading.version}` : ''}
        </h3>
        {reading?.loading && <div className={s.loading}><Spinner /></div>}
        {reading?.error && <p className={s.error}>Metin yüklenemedi.</p>}
        {reading?.body && <LegalText body={reading.body} className={s.legalBody} />}
        <div className={s.modalActions}>
          <Button variant="ghost" onClick={() => setReading(null)}>Kapat</Button>
          {reading?.kind && !currentConsent(reading.kind) && (
            <Button
              onClick={async () => { await accept(reading.kind); setReading(null); }}
            >
              Okudum, onaylıyorum
            </Button>
          )}
        </div>
      </Modal>
    </Card>
  );
}
