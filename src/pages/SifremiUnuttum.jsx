import { useState } from 'react';
import { Link } from 'react-router-dom';
import { requestPasswordReset } from '../api/auth';
import { ThemeToggle } from '../components/ui';
import { Logo } from '../components/ui/Logo';
import styles from './Auth.module.css';

export default function SifremiUnuttum() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (err) {
      const data = err.response?.data;
      if (err.response?.status === 429) {
        setError('Çok fazla deneme yaptınız. Bir süre bekleyip tekrar deneyin.');
      } else {
        setError(data?.email?.[0] || data?.detail || 'İstek gönderilemedi. Tekrar deneyin.');
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

        {/* Sunucu, e-posta kayıtlı olsun olmasın aynı yanıtı veriyor (hesap
            sayımını engellemek için). Ekran da bu yüzden "bulunamadı" demiyor. */}
        {sent ? (
          <>
            <h1 className={styles.heading}>Bağlantı gönderildi</h1>
            <p className={styles.sub}>
              <strong>{email}</strong> adresi bir hesaba kayıtlıysa şifre sıfırlama
              bağlantısı gönderildi. Gelen kutunuzu ve gereksiz posta klasörünü
              kontrol edin. Bağlantı bir gün geçerlidir.
            </p>
            <Link to="/giris" className={styles.btnPrimary} style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
              Girişe dön
            </Link>
          </>
        ) : (
          <>
            <h1 className={styles.heading}>Şifremi unuttum</h1>
            <p className={styles.sub}>
              Hesabınızın e-posta adresini girin; sıfırlama bağlantısını oraya yollayalım.
            </p>

            <form onSubmit={handleSubmit} className={styles.form} noValidate>
              <label className={styles.label}>
                E-posta
                <input
                  className={styles.input}
                  type="email"
                  name="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </label>

              {error && <p className={styles.error}>{error}</p>}

              <button className={styles.btnPrimary} type="submit" disabled={loading}>
                {loading ? 'Gönderiliyor…' : 'Sıfırlama bağlantısı gönder'}
              </button>
            </form>

            <p className={styles.footer}>
              Hatırladınız mı? <Link to="/giris" className={styles.link}>Giriş yapın</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
