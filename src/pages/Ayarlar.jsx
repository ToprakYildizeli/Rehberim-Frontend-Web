import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check, Copy, LogOut, Moon, Palette, ShieldCheck, SlidersHorizontal,
  Sun, User, Users,
} from 'lucide-react';
import { Card, CardHeader, Button, Field, Input } from '../components/ui';
import AchievementsSection from '../components/settings/AchievementsSection';
import AvatarSection from '../components/settings/AvatarSection';
import CalendarDataSection from '../components/settings/CalendarDataSection';
import CatalogSection from '../components/settings/CatalogSection';
import DangerZoneSection from '../components/settings/DangerZoneSection';
import PreferencesSection from '../components/settings/PreferencesSection';
import ParentInvitesSection from '../components/settings/ParentInvitesSection';
import StudentsSection from '../components/settings/StudentsSection';
import {
  createPublisher, createTaskType, listPublishers, listTaskTypes,
} from '../api/catalog';
import { changePassword, updateMe } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import s from './Ayarlar.module.css';
import st from '../components/settings/settings.module.css';

/** Sunucuda düzenlenebilir profil alanları (auth-contract §5.4b, v2.1).
 *  `email` ve `username` bilerek yok: ikisi de kilitli. */
const EDITABLE = ['first_name', 'last_name', 'institution'];

/** Sunucunun alan bazlı hata gövdesini ({"alan": ["mesaj"]}) forma çevirir. */
function fieldErrors(data) {
  if (!data || typeof data !== 'object' || data.detail) return null;
  return Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, Array.isArray(v) ? v[0] : String(v)])
  );
}

export default function Ayarlar() {
  const navigate = useNavigate();
  const { user, updateUser, saveSession, clearSession } = useAuth();
  const { theme, toggle, palette, setPalette, palettes } = useTheme();

  const isCounselor = user?.role === 'counselor';
  const inviteCode = user?.profile?.invite_code ?? null;

  // Sekmeler: tek akışta sekiz bölüm kaydırmakla gezilemeyecek kadar uzundu.
  // "Rehberlik" yalnız rehberde var — öğrenci/veli bu ekranı görürse yalnız
  // kendi profilini ve görünümünü yönetir.
  const tabs = useMemo(() => [
    { value: 'profil', label: 'Profil', icon: User, hint: 'Fotoğraf, ad, kurum, şifre' },
    ...(isCounselor
      ? [
        { value: 'rehberlik', label: 'Rehberlik', icon: Users,
          hint: 'Öğrenciler, veliler, başarımlar' },
        { value: 'tercihler', label: 'Tercihler', icon: SlidersHorizontal,
          hint: 'Program varsayılanları, Panel bölümleri' },
      ]
      : []),
    { value: 'gorunum', label: 'Görünüm', icon: Palette, hint: 'Tema ve renkler' },
    { value: 'hesap', label: 'Hesap', icon: ShieldCheck, hint: 'Oturum, veri, silme' },
  ], [isCounselor]);
  const [tab, setTab] = useState('profil');

  // CatalogSection `load`'u bağımlılık olarak izliyor; satır içi ok fonksiyonu
  // her render'da yeni referans üretip sonsuz yeniden yüklemeye yol açardı.
  const loadTaskTypes = useCallback(listTaskTypes, []);
  const loadPublishers = useCallback(listPublishers, []);

  const saved = useMemo(
    () => ({
      first_name: user?.first_name ?? '',
      last_name: user?.last_name ?? '',
      institution: user?.profile?.institution ?? '',
    }),
    [user]
  );

  const [profile, setProfile] = useState(saved);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState(null);          // 'saving' | 'saved' | null
  const [formError, setFormError] = useState(null);

  const isDirty = EDITABLE.some((k) => profile[k] !== saved[k]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfile((p) => ({ ...p, [name]: value }));
    setErrors((p) => ({ ...p, [name]: undefined }));
    setStatus(null);
    setFormError(null);
  };

  async function handleSave() {
    setStatus('saving');
    setErrors({});
    setFormError(null);
    // Yalnızca değişen alanları gönder — uç kısmi güncellemeyi destekliyor.
    const changed = Object.fromEntries(
      EDITABLE.filter((k) => profile[k] !== saved[k]).map((k) => [k, profile[k]])
    );
    try {
      const updated = await updateMe(changed);
      updateUser(updated);
      setProfile({
        first_name: updated.first_name ?? '',
        last_name: updated.last_name ?? '',
        institution: updated.profile?.institution ?? '',
      });
      setStatus('saved');
    } catch (err) {
      setStatus(null);
      const data = err?.response?.data;
      const byField = fieldErrors(data);
      if (byField) setErrors(byField);
      else setFormError(data?.detail ?? 'Profil kaydedilemedi. Lütfen tekrar dene.');
    }
  }

  async function handleLogout() {
    await clearSession();
    navigate('/giris', { replace: true });
  }

  /** Hesap silindikten sonra: JWT durumsuz olduğu için token hâlâ elimizde
   *  duruyor; oturumu istemci temizlemek zorunda (auth-contract §5.4d). */
  async function handleAccountDeleted() {
    await clearSession();
    navigate('/giris', { replace: true });
  }

  const active = tabs.find((x) => x.value === tab) ?? tabs[0];

  return (
    <div className={s.page}>
      {/* Ana kenar çubuğunun yanında ikinci bir raf. Yatay sekmeler içeriği
          640px'lik bir sütuna sıkıştırıyordu; dikey nav ile kalan genişliğin
          tamamı ayarlara kalıyor. */}
      <nav className={s.nav} role="tablist" aria-orientation="vertical"
           aria-label="Ayarlar bölümleri">
        {tabs.map(({ value, label, icon: Icon, hint }) => (
          <button
            key={value}
            role="tab"
            aria-selected={value === tab}
            className={`${s.navItem} ${value === tab ? s.navItemOn : ''}`}
            onClick={() => setTab(value)}
          >
            <Icon size={16} />
            <span className={s.navText}>
              <span className={s.navLabel}>{label}</span>
              <span className={s.navHint}>{hint}</span>
            </span>
          </button>
        ))}
      </nav>

      {/* Hesap sekmesi başlığıyla birlikte daralır: yalnız kartları ortalamak,
          başlığı solda tek başına bırakıp hizasız gösteriyordu. */}
      <div className={`${s.content} ${tab === 'hesap' ? st.narrowContent : ''}`}>
        <header className={s.contentHead}>
          <h2 className={s.contentTitle}>{active.label}</h2>
          <p className={s.contentHint}>{active.hint}</p>
        </header>

      {/* ---------------------------------------------------------- PROFİL */}
      {tab === 'profil' && (
        <>
      {/* Kimlik kartı tam genişlik ve iki sütunlu: solda fotoğraf, sağda alanlar.
          Şifre ile davet kodu altta yan yana durup satırı dolduruyor. */}
      <Card className={s.wide}>
        <CardHeader title="Kimlik bilgileri" subtitle="Fotoğraf, ad, kurum ve giriş bilgileriniz" />
        <div className={st.identity}>
          <AvatarSection user={user} onChange={updateUser} />
          <div className={`${s.form} ${st.identityForm}`}>
          <div className={s.row}>
            <Field label="Ad" error={errors.first_name}>
              <Input name="first_name" value={profile.first_name} onChange={handleChange} />
            </Field>
            <Field label="Soyad" error={errors.last_name}>
              <Input name="last_name" value={profile.last_name} onChange={handleChange} />
            </Field>
          </div>

          {isCounselor && (
            <Field label="Kurum / Okul" error={errors.institution}>
              <Input
                name="institution"
                value={profile.institution}
                onChange={handleChange}
                placeholder="örn. Bilkent Erzurum Koleji"
              />
            </Field>
          )}

          <div className={s.row}>
            <Field label="Kullanıcı adı">
              <Input value={user?.username ?? ''} readOnly disabled />
            </Field>
            <Field label="E-posta">
              <Input value={user?.email ?? ''} readOnly disabled />
            </Field>
          </div>


          {formError && <p className={s.formError}>{formError}</p>}

          <div className={s.actions}>
            <Button onClick={handleSave} disabled={!isDirty || status === 'saving'}>
              {status === 'saving' ? 'Kaydediliyor…' : 'Kaydet'}
            </Button>
            {status === 'saved' && <span className={s.savedHint}>Kaydedildi</span>}
          </div>
          </div>
        </div>
      </Card>

      <PasswordCard onRotated={saveSession} user={user} />

      {isCounselor && inviteCode && <InviteCodeCard code={inviteCode} />}
        </>
      )}

      {tab === 'rehberlik' && isCounselor && (
        <>
          {/* Satır listeleri geniş olunca okunur; kataloglar dar rozet
              kümeleri olduğu için yan yana sığıyor. */}
          <div className={s.wide}><StudentsSection /></div>
          <div className={s.wide}><ParentInvitesSection /></div>
          <div className={s.wide}><AchievementsSection /></div>
          <CatalogSection
            title="Çalışma türleri"
            subtitle="Ders Programı'nda blok açarken seçilen metodlar"
            load={loadTaskTypes}
            create={createTaskType}
            addLabel="Yeni çalışma türü"
          />
          <CatalogSection
            title="Yayınevleri"
            subtitle="Kitaplığa kitap eklenirken seçilen yayınevleri"
            load={loadPublishers}
            create={createPublisher}
            addLabel="Yeni yayınevi"
          />
        </>
      )}

      {/* ---------------------------------------------------- TERCİHLER */}
      {tab === 'tercihler' && isCounselor && <PreferencesSection />}

      {/* ------------------------------------------------------ GÖRÜNÜM */}
      {tab === 'gorunum' && (
      <Card className={s.wide}>
        <CardHeader title="Tema" subtitle="Aydınlık/karanlık ve renk teması" />

        <div className={s.option}>
          <div>
            <p className={s.optionLabel}>Aydınlık / Karanlık</p>
            <p className={s.optionHint}>
              {theme === 'light' ? 'Açık tema kullanılıyor' : 'Koyu tema kullanılıyor'}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={toggle}>
            {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
            {theme === 'light' ? 'Koyu temaya geç' : 'Açık temaya geç'}
          </Button>
        </div>

        <div className={s.paletteBlock}>
          <p className={s.optionLabel}>Renk teması</p>
          <div className={s.paletteGrid} role="radiogroup" aria-label="Renk teması">
            {palettes.map((p) => {
              const [bg, accent, side] = p.swatch[theme];
              const selected = p.id === palette;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={`${s.paletteCard} ${selected ? s.paletteCardOn : ''}`}
                  onClick={() => setPalette(p.id)}
                >
                  <span className={s.swatch} style={{ background: bg }}>
                    <span className={s.swatchSide} style={{ background: side }} />
                    <span className={s.swatchDot} style={{ background: accent }} />
                  </span>
                  <span className={s.paletteName}>
                    {p.name}
                    {selected && <Check size={13} />}
                  </span>
                  <span className={s.paletteHint}>{p.hint}</span>
                </button>
              );
            })}
          </div>
        </div>
      </Card>
      )}

      {/* -------------------------------------------------------- HESAP */}
      {tab === 'hesap' && (
      <>
      <Card>
        <CardHeader title="Oturum" subtitle="Bu cihazdaki oturumunuz" />
        <div className={s.option}>
          <div>
            <p className={s.optionLabel}>Oturumu kapat</p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut size={14} /> Çıkış Yap
          </Button>
        </div>
      </Card>

      {isCounselor && <CalendarDataSection />}

      {/* Hesap silme en altta ve ayrı bir kartta: çıkış yapmakla aynı görsel
          ağırlıkta durmamalı. */}
      <DangerZoneSection onDeleted={handleAccountDeleted} />
      </>
      )}
      </div>
    </div>
  );
}

/* ============================================================ ŞİFRE ==== */

const EMPTY_PW = { current_password: '', new_password: '', repeat: '' };

/**
 * Şifre değiştirme. Sunucu yanıtı taze bir token çifti içeriyor; `onRotated`
 * ile oturuma yazılmazsa kullanıcı şifresini değiştirdikten sonra bir sonraki
 * refresh'te kendi oturumundan düşer.
 */
function PasswordCard({ onRotated, user }) {
  const [form, setForm] = useState(EMPTY_PW);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [status, setStatus] = useState(null);          // 'saving' | 'saved' | null

  const filled = form.current_password && form.new_password && form.repeat;
  const mismatch = form.repeat.length > 0 && form.new_password !== form.repeat;

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((p) => ({ ...p, [name]: undefined }));
    setStatus(null);
    setFormError(null);
  };

  async function submit() {
    if (mismatch) return;
    setStatus('saving');
    setErrors({});
    setFormError(null);
    try {
      const tokens = await changePassword(form.current_password, form.new_password);
      onRotated(tokens.access, tokens.refresh, user);
      setForm(EMPTY_PW);
      setStatus('saved');
    } catch (err) {
      setStatus(null);
      const data = err?.response?.data;
      const byField = fieldErrors(data);
      if (byField) setErrors(byField);
      else setFormError(data?.detail ?? 'Şifre değiştirilemedi. Lütfen tekrar dene.');
    }
  }

  return (
    <Card>
      <CardHeader title="Şifre" subtitle="Giriş şifrenizi değiştirin" />
      <div className={s.form}>
        <Field label="Mevcut şifre" error={errors.current_password}>
          <Input
            name="current_password" type="password" autoComplete="current-password"
            value={form.current_password} onChange={onChange}
          />
        </Field>
        <div className={s.row}>
          <Field label="Yeni şifre" error={errors.new_password}>
            <Input
              name="new_password" type="password" autoComplete="new-password"
              value={form.new_password} onChange={onChange}
            />
          </Field>
          <Field label="Yeni şifre (tekrar)" error={mismatch ? 'Şifreler eşleşmiyor.' : undefined}>
            <Input
              name="repeat" type="password" autoComplete="new-password"
              value={form.repeat} onChange={onChange}
            />
          </Field>
        </div>

        {formError && <p className={s.formError}>{formError}</p>}

        <div className={s.actions}>
          <Button onClick={submit} disabled={!filled || mismatch || status === 'saving'}>
            {status === 'saving' ? 'Değiştiriliyor…' : 'Şifreyi Değiştir'}
          </Button>
          {status === 'saved' && <span className={s.savedHint}>Şifreniz değiştirildi</span>}
        </div>
      </div>
    </Card>
  );
}

/* ======================================================= DAVET KODU ==== */

/** Rehberin davet kodu — öğrenci bununla bağlanır, veli de bu kodu kullanır.
 *  Kod değişmezdir; yenileme düğmesi bilerek yoktur. */
function InviteCodeCard({ code }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);                 // izin yoksa kullanıcı elle seçebilir
    }
  }

  return (
    <Card>
      <CardHeader title="Davet kodu" subtitle="Öğrenci ve veliler bu kodla size bağlanır" />
      <div className={s.option}>
        <code className={s.code}>{code}</code>
        <Button variant="ghost" size="sm" onClick={copy}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Kopyalandı' : 'Kopyala'}
        </Button>
      </div>
    </Card>
  );
}
