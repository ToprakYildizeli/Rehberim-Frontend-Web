import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerCounselor } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import styles from './Auth.module.css';

function MoonIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

const INITIAL = {
  first_name: '',
  last_name: '',
  username: '',
  email: '',
  password: '',
  password2: '',
};

export default function Register() {
  const navigate = useNavigate();
  const { saveSession } = useAuth();
  const { theme, toggle } = useTheme();

  const [form, setForm] = useState(INITIAL);
  const [fieldErrors, setFieldErrors] = useState({});
  const [globalError, setGlobalError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
    setFieldErrors(fe => ({ ...fe, [e.target.name]: undefined }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setGlobalError('');
    setFieldErrors({});

    if (form.password !== form.password2) {
      setFieldErrors({ password2: ['Şifreler eşleşmiyor.'] });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        username: form.username,
        email: form.email,
        password: form.password,
        first_name: form.first_name,
        last_name: form.last_name,
      };
      const { data } = await registerCounselor(payload);
      saveSession(data.access, data.refresh, data.user);
      navigate('/dashboard');
    } catch (err) {
      if (err.response?.status === 400) {
        setFieldErrors(err.response.data);
      } else {
        setGlobalError('Kayıt başarısız. Lütfen tekrar deneyin.');
      }
    } finally {
      setLoading(false);
    }
  }

  function fieldError(name) {
    const msgs = fieldErrors[name];
    return msgs ? <span className={styles.fieldError}>{msgs[0]}</span> : null;
  }

  return (
    <div className={styles.page}>
      <div className={styles.themeFloating}>
        <button className={styles.themeBtn} onClick={toggle} aria-label="Tema değiştir">
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
      </div>

      <div className={styles.card}>
        <Link to="/" className={styles.logo}>Rehberim</Link>
        <h1 className={styles.heading}>Hesap Oluşturun</h1>
        <p className={styles.sub}>Rehber hesabı açmak birkaç saniye sürer.</p>

        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <div className={styles.row}>
            <label className={styles.label}>
              Ad
              <input
                className={styles.input}
                type="text"
                name="first_name"
                value={form.first_name}
                onChange={handleChange}
                required
              />
              {fieldError('first_name')}
            </label>
            <label className={styles.label}>
              Soyad
              <input
                className={styles.input}
                type="text"
                name="last_name"
                value={form.last_name}
                onChange={handleChange}
                required
              />
              {fieldError('last_name')}
            </label>
          </div>

          <label className={styles.label}>
            Kullanıcı adı
            <input
              className={styles.input}
              type="text"
              name="username"
              value={form.username}
              onChange={handleChange}
              autoComplete="username"
              required
            />
            {fieldError('username')}
          </label>

          <label className={styles.label}>
            E-posta
            <input
              className={styles.input}
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              autoComplete="email"
              required
            />
            {fieldError('email')}
          </label>

          <label className={styles.label}>
            Şifre
            <input
              className={styles.input}
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              autoComplete="new-password"
              required
            />
            {fieldError('password')}
          </label>

          <label className={styles.label}>
            Şifre tekrar
            <input
              className={styles.input}
              type="password"
              name="password2"
              value={form.password2}
              onChange={handleChange}
              autoComplete="new-password"
              required
            />
            {fieldError('password2')}
          </label>

          {globalError && <p className={styles.error}>{globalError}</p>}

          <button className={styles.btnPrimary} type="submit" disabled={loading}>
            {loading ? 'Hesap oluşturuluyor…' : 'Hesap Oluştur'}
          </button>
        </form>

        <p className={styles.footer}>
          Zaten hesabınız var mı?{' '}
          <Link to="/giris" className={styles.link}>Giriş yapın</Link>
        </p>
      </div>
    </div>
  );
}
