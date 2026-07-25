import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Moon, Sun } from 'lucide-react';
import { Card, CardHeader, Button, Field, Input } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import s from './Ayarlar.module.css';

export default function Ayarlar() {
  const navigate = useNavigate();
  const { user, clearSession } = useAuth();
  const { theme, toggle } = useTheme();

  const [profile, setProfile] = useState({
    first_name: user?.first_name ?? '',
    last_name: user?.last_name ?? '',
    username: user?.username ?? '',
    email: user?.email ?? '',
  });

  const handleChange = (e) =>
    setProfile((p) => ({ ...p, [e.target.name]: e.target.value }));

  async function handleLogout() {
    await clearSession();
    navigate('/giris', { replace: true });
  }

  return (
    <div className={s.page}>
      <Card>
        <CardHeader title="Profil" subtitle="Hesap bilgileriniz" />
        <div className={s.form}>
          <div className={s.row}>
            <Field label="Ad">
              <Input name="first_name" value={profile.first_name} onChange={handleChange} />
            </Field>
            <Field label="Soyad">
              <Input name="last_name" value={profile.last_name} onChange={handleChange} />
            </Field>
          </div>
          <Field label="Kullanıcı adı">
            <Input name="username" value={profile.username} onChange={handleChange} />
          </Field>
          <Field label="E-posta">
            <Input name="email" type="email" value={profile.email} onChange={handleChange} />
          </Field>

          <p className={s.note}>
            Profil kaydetme backend bağlantısı tamamlandığında etkinleşecek.
          </p>

          <div className={s.actions}>
            <Button disabled>Kaydet</Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Görünüm" subtitle="Arayüz tercihleri" />
        <div className={s.option}>
          <div>
            <p className={s.optionLabel}>Tema</p>
            <p className={s.optionHint}>
              {theme === 'light' ? 'Açık tema kullanılıyor' : 'Koyu tema kullanılıyor'}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={toggle}>
            {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
            {theme === 'light' ? 'Koyu temaya geç' : 'Açık temaya geç'}
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader title="Hesap" />
        <div className={s.option}>
          <div>
            <p className={s.optionLabel}>Oturumu kapat</p>
            <p className={s.optionHint}>Bu cihazdaki oturumunuz sonlandırılır.</p>
          </div>
          <Button variant="danger" size="sm" onClick={handleLogout}>
            <LogOut size={14} /> Çıkış Yap
          </Button>
        </div>
      </Card>
    </div>
  );
}
