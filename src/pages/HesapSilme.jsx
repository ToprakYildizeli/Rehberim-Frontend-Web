import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ThemeToggle } from '../components/ui';
import { Logo } from '../components/ui/Logo';
import { useAuth } from '../context/AuthContext';
import {
  verifyCredentials,
  fetchDeleteImpact,
  deleteAccount,
} from '../api/accountDeletion';
import styles from './HesapSilme.module.css';

/* Herkese açık hesap silme sayfası — `/hesap-silme`.
 *
 * **Neden var:** Google Play, hesap açtıran bir uygulamanın hesabı yalnız
 * uygulama içinden değil, **uygulamayı silmiş biri için de** bir web
 * adresinden sildirmesini şart koşuyor; adres Play Console'da Data safety
 * formuna yazılıyor. Apple'ın 5.1.1(v) kuralı yalnız uygulama içi silmeyi
 * istiyor, o da üç istemcide mevcut.
 *
 * **Neden tek sayfa üç uygulamaya yetiyor:** `/auth/delete-account/` rehber,
 * öğrenci ve veli rollerinin üçünü de tanıyor. Öğrenci ve veli listelerinin
 * Play kaydına da bu aynı adres yazılabiliyor.
 *
 * ⚠️ **Sayfa oturum AÇMIYOR.** Alınan token bileşenin state'inde kalıyor,
 * localStorage'a yazılmıyor (bkz. `api/accountDeletion.js`). Öğrenci hesabıyla
 * buraya giren biri rehber paneline düşmemeli.
 *
 * ⚠️ Açıklama metni **giriş yapılmadan da** görünür durumda. Mağaza
 * incelemecisinin hesabı olmayacak; sayfa ona da neyin silindiğini anlatmalı,
 * yoksa "bu adres bir şey yapmıyor" diye geri döner.
 */

const ADIM = { KIMLIK: 'kimlik', ONAY: 'onay', BITTI: 'bitti' };

const ROL_ADI = {
  counselor: 'Rehber',
  student: 'Öğrenci',
  parent: 'Veli',
};

function sayi(v) {
  if (typeof v === 'number') return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Sunucunun rol bazlı etki özetini iki listeye çevirir.
 *
 * Ayrım önemli: rehber ve velide **bağ kopuyor**, öğrenci verisi duruyor.
 * Tek listede toplanırsa kullanıcı çocuğunun/öğrencisinin verisini de
 * sileceğini sanıp haklı olarak vazgeçer. */
function etkiyiAyir(ozet) {
  const silinecek = [];
  const korunacak = [];

  if (ozet.role === 'counselor') {
    const ogrenci = sayi(ozet.students_unlinked);
    const basarim = sayi(ozet.achievements_deleted);
    const takvim = sayi(ozet.calendar_events_deleted);
    const davet = sayi(ozet.parent_invites_deleted);

    if (basarim > 0) silinecek.push(`${basarim} başarım tanımı`);
    if (takvim > 0) silinecek.push(`${takvim} takvim etkinliği`);
    if (davet > 0) silinecek.push(`${davet} veli daveti`);
    if (ogrenci > 0) {
      korunacak.push(
        `${ogrenci} öğrencinizin hesabı, programları, denemeleri ve ` +
          'kitaplığı — yalnızca sizinle olan bağları kopar',
      );
    }
  } else if (ozet.role === 'student') {
    const program = sayi(ozet.programs_deleted);
    const deneme = sayi(ozet.exams_deleted);
    const kitap = sayi(ozet.books_deleted);
    const hedef = sayi(ozet.goals_deleted);

    if (program > 0) silinecek.push(`${program} haftalık program`);
    if (deneme > 0) silinecek.push(`${deneme} deneme sonucu`);
    if (kitap > 0) silinecek.push(`${kitap} kitap kaydı`);
    if (hedef > 0) silinecek.push(`${hedef} hedef`);
    silinecek.push('konu ilerlemeniz ve takvim etkinlikleriniz');
  } else if (ozet.role === 'parent') {
    const cocuk = sayi(ozet.students_unlinked);
    if (cocuk > 0) {
      korunacak.push(
        cocuk === 1
          ? 'Bağlı olduğunuz çocuğun hesabı ve tüm verileri — yalnızca ' +
            'sizinle olan bağı kopar'
          : `Bağlı olduğunuz ${cocuk} çocuğun hesapları ve tüm verileri — ` +
            'yalnızca sizinle olan bağları kopar',
      );
    }
  }

  return { silinecek, korunacak };
}

/** Sunucudan gelen hatayı okunur tek cümleye indirir. */
function hataMesaji(err, varsayilan) {
  const durum = err.response?.status;
  const veri = err.response?.data;
  if (durum === 429) {
    return 'Çok fazla deneme yaptınız. Bir süre bekleyip tekrar deneyin.';
  }
  if (durum === 401) {
    return 'Kullanıcı adı veya şifre hatalı.';
  }
  if (!err.response) {
    return 'Sunucuya ulaşılamadı. Bağlantınızı kontrol edip tekrar deneyin.';
  }
  return (
    veri?.password?.[0] ||
    veri?.detail ||
    veri?.non_field_errors?.[0] ||
    varsayilan
  );
}

export default function HesapSilme() {
  const { user, isLoggedIn, clearSession } = useAuth();

  const [adim, setAdim] = useState(ADIM.KIMLIK);
  const [form, setForm] = useState({ username: '', password: '' });
  const [oturum, setOturum] = useState(null); // { access, user } — sadece state
  const [ozet, setOzet] = useState(null);
  const [anladim, setAnladim] = useState(false);
  const [hata, setHata] = useState('');
  const [bekliyor, setBekliyor] = useState(false);

  useEffect(() => {
    const onceki = document.title;
    document.title = 'Hesap silme · Rehberim';
    return () => { document.title = onceki; };
  }, []);

  const degistir = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setHata('');
  };

  async function kimlikGonder(e) {
    e.preventDefault();
    setHata('');
    setBekliyor(true);
    try {
      const kimlik = await verifyCredentials(form.username, form.password);
      const etki = await fetchDeleteImpact(kimlik.access);
      setOturum(kimlik);
      setOzet(etki);
      setAdim(ADIM.ONAY);
    } catch (err) {
      setHata(hataMesaji(err, 'Giriş yapılamadı. Bilgilerinizi kontrol edin.'));
    } finally {
      setBekliyor(false);
    }
  }

  async function silmeyiOnayla() {
    setHata('');
    setBekliyor(true);
    try {
      await deleteAccount(oturum.access, form.password);

      // Aynı tarayıcıda silinen hesabın oturumu açıksa artık ölü; temizle.
      // Başka bir hesabın oturumuna dokunmuyoruz — buraya girerken kendi
      // oturumumuzu hiç açmadık.
      if (isLoggedIn && user?.username === oturum.user?.username) {
        await clearSession();
      }

      // Şifre state'te duruyordu; işi bitti.
      setForm({ username: '', password: '' });
      setOturum(null);
      setAdim(ADIM.BITTI);
    } catch (err) {
      setHata(hataMesaji(err, 'Hesap silinemedi. Lütfen tekrar deneyin.'));
    } finally {
      setBekliyor(false);
    }
  }

  function vazgec() {
    setForm({ username: '', password: '' });
    setOturum(null);
    setOzet(null);
    setAnladim(false);
    setHata('');
    setAdim(ADIM.KIMLIK);
  }

  return (
    <div className={styles.page}>
      <ThemeToggle floating />

      <div className={styles.card}>
        <Link to="/" className={styles.logo} aria-label="Rehberim ana sayfa">
          <Logo height={29} />
        </Link>

        {adim === ADIM.KIMLIK && (
          <>
            <h1 className={styles.heading}>Hesabınızı silin</h1>
            <p className={styles.sub}>
              Rehberim hesabınızı ve ona bağlı verileri kalıcı olarak
              silebilirsiniz. Rehber, öğrenci ve veli hesaplarının hepsi bu
              sayfadan silinebilir — uygulamayı telefonunuzdan kaldırmış
              olsanız bile.
            </p>

            {/* İncelemecinin hesabı olmayacak: ne silindiği giriş yapılmadan
                da okunabilmeli. */}
            <div className={styles.notice}>
              <h2 className={styles.noticeTitle}>Silme neyi kapsar?</h2>
              <ul className={styles.noticeList}>
                <li>
                  Hesabınız, giriş bilgileriniz ve profil bilgileriniz
                  sunucudan kalıcı olarak kaldırılır.
                </li>
                <li>
                  Hesabınıza bağlı veriler (program, deneme sonuçları, konu
                  ilerlemesi, kitaplık, hedefler, takvim) rolünüze göre silinir.
                  Onaydan önce tam listeyi göstereceğiz.
                </li>
                <li>
                  <strong>Veli ve rehber hesaplarında</strong> öğrencinin
                  hesabına dokunulmaz; yalnızca aranızdaki bağ kopar.
                </li>
                <li>
                  İşlem <strong>geri alınamaz</strong> ve silinen veri geri
                  getirilemez.
                </li>
              </ul>
              <p className={styles.noticeFoot}>
                Silme isteğiniz anında işlenir. Düzenli alınan sistem
                yedeklerindeki kopyalar, yedek saklama süresi dolduğunda
                kendiliğinden düşer. Ayrıntılar KVKK Aydınlatma Metni'nde yer
                alır.
              </p>
            </div>

            <form onSubmit={kimlikGonder} className={styles.form} noValidate>
              <label className={styles.label}>
                Kullanıcı adı
                <input
                  className={styles.input}
                  name="username"
                  value={form.username}
                  onChange={degistir}
                  autoComplete="username"
                  required
                />
              </label>

              <label className={styles.label}>
                Şifre
                <input
                  className={styles.input}
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={degistir}
                  autoComplete="current-password"
                  required
                />
              </label>

              {hata && <p className={styles.error}>{hata}</p>}

              <button
                className={styles.btnPrimary}
                type="submit"
                disabled={bekliyor}
              >
                {bekliyor ? 'Doğrulanıyor…' : 'Devam et'}
              </button>
            </form>

            <p className={styles.footer}>
              Şifrenizi hatırlamıyor musunuz?{' '}
              <Link to="/sifremi-unuttum" className={styles.link}>
                Sıfırlayın
              </Link>
              . Giriş yapamıyorsanız{' '}
              <a href="mailto:destek@rehberim.app" className={styles.link}>
                destek@rehberim.app
              </a>{' '}
              adresine yazın; kimliğinizi doğrulayıp hesabınızı bizim adımıza
              silelim.
            </p>
          </>
        )}

        {adim === ADIM.ONAY && ozet && (
          <>
            <h1 className={styles.heading}>Silmeyi onaylayın</h1>
            <p className={styles.sub}>
              <strong>
                {oturum?.user?.first_name} {oturum?.user?.last_name}
              </strong>{' '}
              · @{oturum?.user?.username}
              {ROL_ADI[ozet.role] && (
                <span className={styles.rolRozet}>{ROL_ADI[ozet.role]}</span>
              )}
            </p>

            {(() => {
              const { silinecek, korunacak } = etkiyiAyir(ozet);
              return (
                <>
                  <div className={styles.tehlike}>
                    <h2 className={styles.tehlikeTitle}>
                      Kalıcı olarak silinecek
                    </h2>
                    <ul className={styles.tehlikeList}>
                      <li>Hesabınız ve giriş bilgileriniz</li>
                      {silinecek.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </div>

                  {korunacak.length > 0 && (
                    <div className={styles.guvende}>
                      <h2 className={styles.guvendeTitle}>Etkilenmeyecek</h2>
                      <ul className={styles.guvendeList}>
                        {korunacak.map((s) => (
                          <li key={s}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              );
            })()}

            <label className={styles.onayKutusu}>
              <input
                type="checkbox"
                checked={anladim}
                onChange={(e) => setAnladim(e.target.checked)}
              />
              <span>
                Hesabımın ve yukarıdaki verilerin kalıcı olarak silineceğini,
                bu işlemin geri alınamayacağını anlıyorum.
              </span>
            </label>

            {hata && <p className={styles.error}>{hata}</p>}

            <div className={styles.butonlar}>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={vazgec}
                disabled={bekliyor}
              >
                Vazgeç
              </button>
              <button
                type="button"
                className={styles.btnDanger}
                onClick={silmeyiOnayla}
                disabled={!anladim || bekliyor}
              >
                {bekliyor ? 'Siliniyor…' : 'Hesabımı kalıcı olarak sil'}
              </button>
            </div>
          </>
        )}

        {adim === ADIM.BITTI && (
          <>
            <div className={styles.basariIkon} aria-hidden="true">
              <svg
                width="30"
                height="30"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h1 className={styles.heading}>Hesabınız silindi</h1>
            <p className={styles.sub}>
              Hesabınız ve ona bağlı veriler sunucudan kalıcı olarak kaldırıldı.
              İşlemin tamamlandığını bildiren bir e-posta gönderdik. Uygulamayı
              telefonunuzda hâlâ kuruluysa artık kaldırabilirsiniz.
            </p>
            <Link to="/" className={styles.btnPrimaryLink}>
              Ana sayfaya dön
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
