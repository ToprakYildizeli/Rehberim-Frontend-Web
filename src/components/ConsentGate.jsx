import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Button, Modal, Spinner } from './ui';
import LegalText from './LegalText';
import { acceptConsent, getLegalDocument } from '../api/legal';
import { getMe } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import s from './consentGate.module.css';

/**
 * Onayı eksik kullanıcıya hukuki metinleri gösteren kapı (KVKK, 16 Eyl 2026).
 *
 * Sunucu her `<User>` objesinde `pending_consents` döndürüyor; burada yalnız o
 * listeye bakılıyor. Karar sunucuda olmalı çünkü metnin sürümü yükselince eski
 * onay kendiliğinden eksik sayılmalı — istemci kendi kopyasını tutsaydı metin
 * değiştiğinde kullanıcı hiçbir şey görmeden devam ederdi.
 *
 * **Kapatılabilir.** Zorlayıcı bir duvar değil: kullanıcı canlıda ve kayıt
 * akışında bu alanı göndermeyen istemcilerden gelmiş olabilir; uygulamayı
 * kilitlemek, onayı olmayan mevcut rehberi kendi verisinden koparmak olurdu.
 * Kapatınca oturum boyunca bir daha açılmıyor, Ayarlar → Hesap'tan
 * tamamlanabiliyor. Kayıtta onay zorunlu hâle geldiğinde
 * (bkz. `docs/kvkk.md` §5) bu kapı yalnız eski kullanıcılar için kalacak.
 *
 * "Oturum boyunca" kararı `sessionStorage`da, state'te DEĞİL: bu bileşen
 * ağacın yeniden kurulmasıyla sıfırlanabiliyor ve o olduğunda kullanıcı aynı
 * metni her sayfa geçişinde yeniden görüyordu (1 Ekim 2026). Kararın ömrü
 * sekmenin ömrü olmalı, bileşenin değil.
 */
const ERTELEME_ANAHTARI = 'consentGateErtelendi';

/** "Sonra" kararını okur/yazar. `sessionStorage` gizli modda ve kota dolduğunda
 *  fırlatabiliyor; kapı bundan dolayı hiç açılmamalı ya da hiç kapanmamalı
 *  değil, bu yüzden iki yön de sessizce yutuluyor. */
function okuErtelendi() {
  try {
    return sessionStorage.getItem(ERTELEME_ANAHTARI) === '1';
  } catch {
    return false;
  }
}

function yazErtelendi() {
  try {
    sessionStorage.setItem(ERTELEME_ANAHTARI, '1');
  } catch { /* gizli mod / kota */ }
}

export default function ConsentGate() {
  const { user, updateUser } = useAuth();
  const pending = user?.pending_consents ?? [];
  const [dismissed, setDismissed] = useState(okuErtelendi);
  const [index, setIndex] = useState(0);
  const [doc, setDoc] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const current = pending[index] ?? null;
  const open = !dismissed && pending.length > 0;

  useEffect(() => {
    if (!open || !current) return undefined;
    let alive = true;
    setDoc(null);
    getLegalDocument(current.kind)
      .then((data) => alive && setDoc(data))
      .catch(() => alive && setError('Metin yüklenemedi.'));
    return () => { alive = false; };
  }, [open, current]);

  async function accept() {
    if (!current) return;
    setBusy(true);
    setError(null);
    try {
      await acceptConsent(current.kind);
      if (index + 1 < pending.length) {
        // Sıradaki metne geç; oturum objesi en sonda bir kez tazelenir.
        setIndex(index + 1);
      } else {
        const { data } = await getMe(localStorage.getItem('access'));
        updateUser(data);
        setIndex(0);
        // Sunucu hâlâ eksik diyorsa kapı kapanmaz; onay verilmişken kullanıcıyı
        // aynı metinde döngüye sokmamak için erteleme yazılıyor. (Tam olarak bu
        // oldu: `missing_for()` eski sürüm satırı yüzünden onayı görmüyordu.)
        if ((data?.pending_consents ?? []).length > 0) {
          yazErtelendi();
          setDismissed(true);
        }
      }
    } catch {
      setError('Onay kaydedilemedi.');
    } finally {
      setBusy(false);
    }
  }

  function ertele() {
    yazErtelendi();
    setDismissed(true);
  }

  if (!open) return null;

  return (
    <Modal open onClose={ertele} width={720}>
      <h3 className={s.title}>
        <ShieldCheck size={18} />
        {current?.label}
        {current?.version ? ` · sürüm ${current.version}` : ''}
      </h3>
      <p className={s.lead}>
        Kişisel verilerinizin nasıl işlendiğini okuyup onaylamanız gerekiyor.
        {pending.length > 1 ? ` (${index + 1}/${pending.length})` : ''}
      </p>
      {doc === null ? (
        <div className={s.loading}><Spinner /></div>
      ) : (
        <LegalText body={doc.body} className={s.body} />
      )}
      {error && <p className={s.error}>{error}</p>}
      <div className={s.actions}>
        <Button variant="ghost" onClick={ertele}>
          Sonra
        </Button>
        <Button onClick={accept} disabled={busy || doc === null}>
          {busy ? <Spinner size={14} /> : null} Okudum, onaylıyorum
        </Button>
      </div>
    </Modal>
  );
}
