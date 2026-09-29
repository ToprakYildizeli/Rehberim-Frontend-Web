import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ThemeToggle } from '../components/ui';
import { Logo } from '../components/ui/Logo';
import LegalText from '../components/LegalText';
import { fetchPublicLegalDocuments } from '../api/legalPublic';
import styles from './Gizlilik.module.css';

/* Herkese açık gizlilik / KVKK sayfası — `/gizlilik`.
 *
 * **Neden var:** App Store ve Google Play, uygulamanın gizlilik politikasını
 * **tarayıcıda açılan, oturum istemeyen** bir adreste yayınlamasını şart
 * koşuyor; adres mağaza kaydına yazılıyor. Metinler bugüne dek yalnız JSON
 * ucunda ve uygulamaların içinde duruyordu — incelemeciye verilecek bir adres
 * yoktu.
 *
 * **Metin kopyalanmıyor, API'den geliyor.** Tek kaynak backend deposu; üç
 * istemci ve bu sayfa aynı gövdeyi basıyor. Buraya elle bir kopya konsaydı
 * metin güncellendiğinde sessizce eskir ve mağazaya yanlış politika gösterirdik.
 *
 * ⚠️ İstek `publicClient` üzerinden: ortak istemci bayat bir token'ı ekleyip
 * 401 yiyor ve ziyaretçiyi `/giris`e atıyordu (gerekçe o dosyada).
 */

const VARSAYILAN = 'aydinlatma';

export default function Gizlilik() {
  const [params, setParams] = useSearchParams();
  const [belgeler, setBelgeler] = useState(null); // null = yükleniyor
  const [hata, setHata] = useState(false);

  const secili = params.get('metin') || VARSAYILAN;

  useEffect(() => {
    document.title = 'Gizlilik ve KVKK · Rehberim';
  }, []);

  useEffect(() => {
    let canli = true;
    fetchPublicLegalDocuments()
      .then((d) => canli && setBelgeler(d))
      .catch(() => canli && setHata(true));
    return () => { canli = false; };
  }, []);

  const acik = belgeler?.find((b) => b.kind === secili)
    // Adres çubuğuna olmayan bir tür yazılmışsa boş ekran gösterme.
    || belgeler?.find((b) => b.kind === VARSAYILAN)
    || belgeler?.[0];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link to="/" className={styles.logo} aria-label="Rehberim ana sayfa">
            <Logo height={28} />
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className={styles.main}>
        <h1 className={styles.baslik}>Gizlilik ve KVKK</h1>
        <p className={styles.giris}>
          Rehberim'in kişisel verileri nasıl işlediğini anlatan metinler.
          Aynı metinler rehber panelinde ve öğrenci/veli uygulamalarında da
          gösteriliyor; kaynak tektir.
        </p>

        {belgeler && belgeler.length > 1 && (
          <nav className={styles.sekmeler} aria-label="Hukuki metinler">
            {belgeler.map((b) => (
              <button
                key={b.kind}
                type="button"
                className={
                  b.kind === acik?.kind
                    ? `${styles.sekme} ${styles.sekmeAktif}`
                    : styles.sekme
                }
                aria-current={b.kind === acik?.kind ? 'page' : undefined}
                onClick={() => setParams({ metin: b.kind }, { replace: true })}
              >
                {b.label}
              </button>
            ))}
          </nav>
        )}

        {hata && (
          <div className={styles.hata}>
            <p>
              Metinler şu anda yüklenemedi. Lütfen daha sonra tekrar deneyin
              ya da{' '}
              <a href="mailto:destek@rehberim.xyz" className={styles.link}>
                destek@rehberim.xyz
              </a>{' '}
              adresine yazın; metni size doğrudan iletelim.
            </p>
          </div>
        )}

        {!hata && belgeler === null && (
          <p className={styles.yukleniyor}>Metinler yükleniyor…</p>
        )}

        {acik && (
          <article className={styles.belge}>
            <div className={styles.belgeBaslik}>
              <h2 className={styles.belgeAd}>{acik.label}</h2>
              <span className={styles.surum}>Sürüm {acik.version}</span>
            </div>
            <LegalText body={acik.body} />
          </article>
        )}

        <section className={styles.haklar}>
          <h2 className={styles.haklarBaslik}>Verileriniz üzerindeki haklarınız</h2>
          <ul className={styles.haklarListe}>
            <li>
              <strong>Hesabınızı silmek:</strong> uygulama içinden (Profil →
              Hesabı sil) ya da{' '}
              <Link to="/hesap-silme" className={styles.link}>
                hesap silme sayfasından
              </Link>
              . Uygulamayı kaldırmış olsanız da ikinci yol açıktır.
            </li>
            <li>
              <strong>Verilerinizi indirmek:</strong> rehber panelinde
              Ayarlar → KVKK bölümünden.
            </li>
            <li>
              <strong>Açık rızanızı geri almak:</strong> Ayarlar → KVKK.
              Rızayı geri almak hesabı kapatmaz; silme ayrı bir işlemdir.
            </li>
            <li>
              <strong>Başvuru:</strong>{' '}
              <a href="mailto:destek@rehberim.xyz" className={styles.link}>
                destek@rehberim.xyz
              </a>
            </li>
          </ul>
        </section>
      </main>

      <footer className={styles.footer}>
        <Link to="/" className={styles.link}>Ana sayfa</Link>
        <span className={styles.ayrac}>·</span>
        <Link to="/hesap-silme" className={styles.link}>Hesap silme</Link>
        <span className={styles.ayrac}>·</span>
        <a href="mailto:destek@rehberim.xyz" className={styles.link}>Destek</a>
      </footer>
    </div>
  );
}
