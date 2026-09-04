import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { confirmPasswordReset } from '../api/auth';
import { ThemeToggle } from '../components/ui';
import { Logo } from '../components/ui/Logo';
import styles from './Auth.module.css';

/** E-postadaki bağlantının açtığı sayfa: /sifre-sifirla/:uid/:token
 *
 *  Bu sayfayı öğrenci ve veli de kullanıyor — mobil uygulamalarda ayrı bir
 *  sıfırlama ekranı yok, bağlantı telefonun tarayıcısında açılıyor
 *  (karar: 4 Eylül 2026). Bu yüzden metinler role özel değil.
 */
export default function SifreSifirla() {
  const { uid, token } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState({ password: '', repeat: '' });
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (form.password !== form.repeat) {
      setError('Şifreler birbirini tutmuyor.');
      return;
    }

    setLoading(true);
    try {
      await confirmPasswordReset(uid, token, form.password);
      setDone(true);
      // Sunucu token çifti dönmüyor: otomatik giriş yok, girişe yolluyoruz.
      setTimeout(() => navigate('/giris'), 2500);
    } catch (err) {
      const data = err.response?.data;
      if (err.response?.status === 429) {
        setError('Çok fazla deneme yaptınız. Bir süre bekleyip tekrar deneyin.');
      } else {
        setError(
          data?.uid?.[0] ||
          data?.new_password?.[0] ||
          data?.detail ||
          'Şifre güncellenemedi. Tekrar deneyin.'
        );
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <ThemeToggle floating />

      <div className={styles.card}>
        <Link to="/" className={styles.logo} aria-label="Rehberim ana sayfa">
          <Logo height={29} />
        </Link>

        {done ? (
          <>
            <h1 className={styles.heading}>Şifreniz güncellendi</h1>
            <p className={styles.sub}>
              Yeni şifrenizle giriş yapabilirsiniz. Diğer cihazlardaki oturumlarınız
              güvenlik için kapatıldı. Giriş ekranına yönlendiriliyorsunuz…
            </p>
            <Link to="/giris" className={styles.btnPrimary} style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
              Girişe git
            </Link>
          </>
        ) : (
          <>
            <h1 className={styles.heading}>Yeni şifre belirleyin</h1>
            <p className={styles.sub}>
              Şifreniz en az 8 karakter olmalı ve yalnızca rakamlardan oluşmamalı.
            </p>

            <form onSubmit={handleSubmit} className={styles.form} noValidate>
              <label className={styles.label}>
                Yeni şifre
                <input
                  className={styles.input}
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  autoComplete="new-password"
                  required
                />
              </label>

              <label className={styles.label}>
                Yeni şifre (tekrar)
                <input
                  className={styles.input}
                  type="password"
                  name="repeat"
                  value={form.repeat}
                  onChange={handleChange}
                  autoComplete="new-password"
                  required
                />
              </label>

              {error && <p className={styles.error}>{error}</p>}

              <button className={styles.btnPrimary} type="submit" disabled={loading}>
                {loading ? 'Kaydediliyor…' : 'Şifreyi güncelle'}
              </button>
            </form>

            <p className={styles.footer}>
              Bağlantının süresi dolduysa{' '}
              <Link to="/sifremi-unuttum" className={styles.link}>yeni bir tane isteyin</Link>.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
