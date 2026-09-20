import { useState } from 'react';
import { resendVerification, verifyEmail } from '../api/auth';

/**
 * Kayıt sonrası e-posta doğrulama adımı (auth-contract §5.1b).
 *
 * Kayıt artık token döndürmüyor: hesap açılıyor ama kod girilene kadar
 * kullanılamıyor. Kod doğrulanınca sunucu token veriyor ve kullanıcı aynı
 * ekrandan panele giriyor — ayrıca giriş yapması gerekmiyor.
 *
 * `styles` çağıran sayfanın (Kayıt / Giriş) CSS modülü: iki ekranda da yerli
 * görünsün diye kendi stil dosyası yok.
 */
export default function VerifyEmailStep({ username, email, styles, onVerified }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setInfo('');
    try {
      const { data } = await verifyEmail(username, code.trim());
      onVerified(data);
    } catch (err) {
      const data = err.response?.data;
      const first = data && !data.detail
        ? Object.values(data).flat()[0]
        : data?.detail;
      setError(first ?? 'Kod doğrulanamadı. Lütfen tekrar deneyin.');
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setBusy(true);
    setError('');
    try {
      await resendVerification(username);
      setInfo('Yeni kod gönderildi. Gelen kutunuzu kontrol edin.');
      setCode('');
    } catch {
      setError('Kod gönderilemedi. Lütfen biraz sonra tekrar deneyin.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className={styles.form} noValidate>
      <p className={styles.sub}>
        {email ? <><strong>{email}</strong> adresine</> : 'E-posta adresinize'} 6 haneli
        bir doğrulama kodu gönderdik. Kod 15 dakika geçerli.
      </p>
      <label className={styles.label}>
        Doğrulama kodu
        <input
          className={styles.input}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          required
        />
      </label>
      {error && <p className={styles.error}>{error}</p>}
      {info && <p className={styles.sub}>{info}</p>}
      <button className={styles.btnPrimary} type="submit" disabled={busy || code.length < 6}>
        {busy ? 'Doğrulanıyor…' : 'Doğrula ve giriş yap'}
      </button>
      <p className={styles.footer}>
        Kod gelmediyse{' '}
        <button type="button" className={styles.link} onClick={resend} disabled={busy}>
          yeniden gönder
        </button>
        . Spam klasörüne de bakın.
      </p>
    </form>
  );
}
