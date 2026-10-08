import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ThemeToggle } from '../components/ui';
import { Logo } from '../components/ui/Logo';
import { registerCounselor } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import { LGS_URL, LGS_READY } from '../config/products';
import styles from './Welcome.module.css';

/* Tanıtım sayfası. Uygulamanın içinde açıklama metni yok (kullanıcı kararı);
   ürünü anlatan her şey burada toplanıyor. Kayıt formu da bu sayfada: rehber
   ayrı bir sayfaya gitmeden hesabını açabilsin diye. `/kayit` rotası da duruyor,
   ikisi de aynı ucu (`POST /api/auth/register/counselor/`) kullanıyor.

   İKİ ÜRÜN (8 Ekim 2026): Rehberim artık YKS ve LGS olarak ikiye ayrıldı.
   Sayfanın girişi ürün seçtiriyor; altındaki bölümler iki dala ayrılıyor:
   `#yks` (lise/YKS — rehber paneli + öğrenci/veli mobil) ve `#lgs`
   (ortaokul/LGS — dershane paneli). Kayıt formu YKS dalında kalıyor; LGS'nin
   kaydı kendi uygulamasında. LGS paneli AYRI bir uygulama ve ayrı bir
   backend — buradan yalnız bağlantı veriliyor, adresi `config/products.js`
   belirliyor. */

function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

function FeatureCard({ icon, color, title, desc }) {
  return (
    <div className={styles.featureCard}>
      <div className={styles.featureIcon} style={{ background: `${color}18`, color }}>
        {icon}
      </div>
      <h3 className={styles.featureTitle}>{title}</h3>
      <p className={styles.featureDesc}>{desc}</p>
    </div>
  );
}

function Step({ n, title, desc }) {
  return (
    <div className={styles.step}>
      <div className={styles.stepNum}>{n}</div>
      <h3 className={styles.stepTitle}>{title}</h3>
      <p className={styles.stepDesc}>{desc}</p>
    </div>
  );
}

/** Ekran görüntüsü gelene kadar duran yer tutucu. `label` neyin geleceğini söyler. */
function MediaSlot({ label, tall = false }) {
  return (
    <div className={`${styles.mediaSlot} ${tall ? styles.mediaSlotTall : ''}`} aria-hidden="true">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="M21 15l-5-5L5 21" />
      </svg>
      <span>{label}</span>
    </div>
  );
}

function DashboardPreview() {
  const students = [
    { init: 'A', name: 'Ali Korkmaz', grade: '12. Sınıf · Say', pct: 87, color: '#3b82f6' },
    { init: 'S', name: 'Selin Yıldız', grade: '12. Sınıf · EA', pct: 62, color: '#8b5cf6' },
    { init: 'M', name: 'Arda Mert', grade: '11. Sınıf', pct: 78, color: '#10b981' },
  ];
  const exams = [
    { subject: 'Matematik', net: 28.5, pct: 71, color: '#3b82f6' },
    { subject: 'Türkçe', net: 31.0, pct: 78, color: '#8b5cf6' },
    { subject: 'Fen', net: 14.5, pct: 48, color: '#10b981' },
  ];

  return (
    <div className={styles.preview}>
      <div className={styles.previewBar}>
        <div className={styles.previewDots}>
          <span style={{ background: '#ff5f57' }} />
          <span style={{ background: '#ffbd2e' }} />
          <span style={{ background: '#28c840' }} />
        </div>
        <span className={styles.previewBarTitle}>Rehberim · Panel</span>
      </div>

      <div className={styles.previewBody}>
        <div className={styles.previewGreet}>
          <div>
            <p className={styles.previewGreetName}>Merhaba, Hoca! 👋</p>
            <p className={styles.previewGreetSub}>3 aktif öğrenci · Bu hafta 2 toplantı</p>
          </div>
          <div className={styles.previewMonth}>Tem 2026</div>
        </div>

        <p className={styles.previewSectionLabel}>Öğrencilerim</p>

        {students.map(s => (
          <div key={s.name} className={styles.previewStudent}>
            <div className={styles.previewAvatar} style={{ background: s.color }}>
              {s.init}
            </div>
            <div className={styles.previewStudentInfo}>
              <div className={styles.previewStudentHeader}>
                <span className={styles.previewStudentName}>{s.name}</span>
                <span className={styles.previewStudentPct} style={{ color: s.color }}>{s.pct}%</span>
              </div>
              <div className={styles.previewProgressBg}>
                <div className={styles.previewProgressFill} style={{ width: `${s.pct}%`, background: s.color }} />
              </div>
              <span className={styles.previewStudentGrade}>{s.grade}</span>
            </div>
          </div>
        ))}

        <div className={styles.previewDivider} />

        <p className={styles.previewSectionLabel}>Son TYT Sonucu</p>

        {exams.map(e => (
          <div key={e.subject} className={styles.previewExam}>
            <span className={styles.previewExamSubject}>{e.subject}</span>
            <div className={styles.previewExamBarBg}>
              <div className={styles.previewExamBarFill} style={{ width: `${e.pct}%`, background: e.color }} />
            </div>
            <span className={styles.previewExamNet}>{e.net}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Dershane panelinin küçük önizlemesi — YKS önizlemesiyle aynı kabuk
 *  sınıflarını kullanıyor, yalnız gövdesi LGS işine ait (sınıf, haftalık soru
 *  ödevi, deneme neti). */
function DershanePreview() {
  const classes = [
    { name: '8-A', students: 24, done: 86, color: '#2563eb' },
    { name: '8-B', students: 22, done: 61, color: '#7c3aed' },
    { name: '7-A', students: 26, done: 74, color: '#059669' },
  ];
  const nets = [
    { subject: 'Matematik', net: 17.5, pct: 88 },
    { subject: 'Türkçe', net: 15.0, pct: 75 },
    { subject: 'Fen Bilimleri', net: 16.25, pct: 81 },
  ];

  return (
    <div className={styles.preview}>
      <div className={styles.previewBar}>
        <div className={styles.previewDots}>
          <span style={{ background: '#ff5f57' }} />
          <span style={{ background: '#ffbd2e' }} />
          <span style={{ background: '#28c840' }} />
        </div>
        <span className={styles.previewBarTitle}>Rehberim · Dershane</span>
      </div>

      <div className={styles.previewBody}>
        <div className={styles.previewGreet}>
          <div>
            <p className={styles.previewGreetName}>Simetri Dershanesi</p>
            <p className={styles.previewGreetSub}>9 sınıf · Bu hafta 8 ödev açık</p>
          </div>
          <div className={styles.previewMonth}>Hafta 6</div>
        </div>

        <p className={styles.previewSectionLabel}>Sınıflar · ödev tamamlama</p>

        {classes.map((c) => (
          <div key={c.name} className={styles.previewStudent}>
            <div className={styles.previewAvatar} style={{ background: c.color }}>
              {c.name.split('-')[1]}
            </div>
            <div className={styles.previewStudentInfo}>
              <div className={styles.previewStudentHeader}>
                <span className={styles.previewStudentName}>{c.name}</span>
                <span className={styles.previewStudentPct} style={{ color: c.color }}>{c.done}%</span>
              </div>
              <div className={styles.previewProgressBg}>
                <div className={styles.previewProgressFill} style={{ width: `${c.done}%`, background: c.color }} />
              </div>
              <span className={styles.previewStudentGrade}>{c.students} öğrenci</span>
            </div>
          </div>
        ))}

        <div className={styles.previewDivider} />

        <p className={styles.previewSectionLabel}>Son Deneme · sınıf ortalaması</p>

        {nets.map((n) => (
          <div key={n.subject} className={styles.previewExam}>
            <span className={styles.previewExamSubject}>{n.subject}</span>
            <div className={styles.previewExamBarBg}>
              <div className={styles.previewExamBarFill} style={{ width: `${n.pct}%`, background: '#2563eb' }} />
            </div>
            <span className={styles.previewExamNet}>{n.net}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Girişteki ürün kartı. `href` dış adres (LGS paneli), `to` iç rota, `anchor`
 * aynı sayfadaki bölüm. `soon` verilirse kart bağlantısız çıkar — LGS daha
 * dağıtılmadığı için gereken durum.
 */
function ProductCard({ tag, title, desc, items, accent, anchor, action, soon }) {
  return (
    <div className={styles.productCard} style={{ '--card-accent': accent }}>
      <div className={styles.productHead}>
        <span className={styles.productTag}>{tag}</span>
        {soon && <span className={styles.productSoon}>Yakında</span>}
      </div>
      <h3 className={styles.productTitle}>{title}</h3>
      <p className={styles.productDesc}>{desc}</p>
      <ul className={styles.productList}>
        {items.map((it) => <li key={it}>{it}</li>)}
      </ul>
      <div className={styles.productCta}>
        {action}
        <a href={anchor} className={styles.productMore}>Ayrıntılar</a>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── Kayıt formu ─── */

const EMPTY = {
  first_name: '', last_name: '', username: '', email: '', password: '', password2: '',
};

/**
 * Rehber hesabı açma formu. `/kayit` sayfasının aynı işi yapan gömülü hâli.
 * Başarılı olunca sunucu token çifti + kullanıcıyı döndürüyor; oturum açılıp
 * doğrudan panele giriliyor — kayıttan sonra bir de giriş yaptırmak gereksiz.
 */
function SignupForm() {
  const navigate = useNavigate();
  const { saveSession } = useAuth();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [globalError, setGlobalError] = useState('');
  const [loading, setLoading] = useState(false);

  const change = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((p) => ({ ...p, [name]: undefined }));
    setGlobalError('');
  };

  async function submit(e) {
    e.preventDefault();
    setErrors({});
    setGlobalError('');
    if (form.password !== form.password2) {
      setErrors({ password2: ['Şifreler eşleşmiyor.'] });
      return;
    }
    setLoading(true);
    try {
      const { data } = await registerCounselor({
        username: form.username,
        email: form.email,
        password: form.password,
        first_name: form.first_name,
        last_name: form.last_name,
        // Sürüm gönderilmiyor; sunucu yürürlükteki sürümü yazıyor.
        consents: ['aydinlatma', 'acik_riza'],
      });

      /* Kayıt TOKEN DÖNDÜRMÜYOR: hesap açılıyor ama e-postaya giden kod
         girilene kadar kullanılamıyor (auth-contract §5.1b). Bu dal eklendiğinde
         `/kayit` sayfasına doğrulama adımı konmuş ama buradaki form atlanmıştı;
         `saveSession` koşulsuz çağrıldığı için token'sız gövdeden localStorage'a
         `"undefined"` metni yazılıyor, kullanıcı panele alınıyor ve bir sonraki
         açılışta uygulama bembeyaz bir sayfaya dönüyordu.

         Doğrulama adımı `/kayit` sayfasında duruyor ve oradaki stillere bağlı
         (bu sayfanın CSS modülünde `form`/`label`/`error` sınıfları yok), bu
         yüzden adımı kopyalamak yerine oraya yönlendiriyoruz. */
      if (data.email_verification_required) {
        navigate('/kayit', {
          replace: true,
          state: { verify: { username: data.username, email: data.email } },
        });
        return;
      }

      saveSession(data.access, data.refresh, data.user);
      navigate('/panel');
    } catch (err) {
      if (err.response?.status === 400) setErrors(err.response.data);
      else setGlobalError('Kayıt başarısız. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  }

  const err = (name) => (errors[name] ? <span className={styles.fieldError}>{errors[name][0]}</span> : null);

  return (
    <form className={styles.signupForm} onSubmit={submit} noValidate>
      <div className={styles.signupRow}>
        <label className={styles.field}>
          Ad
          <input className={styles.input} name="first_name" value={form.first_name}
                 onChange={change} autoComplete="given-name" required />
          {err('first_name')}
        </label>
        <label className={styles.field}>
          Soyad
          <input className={styles.input} name="last_name" value={form.last_name}
                 onChange={change} autoComplete="family-name" required />
          {err('last_name')}
        </label>
      </div>

      <div className={styles.signupRow}>
        <label className={styles.field}>
          Kullanıcı adı
          <input className={styles.input} name="username" value={form.username}
                 onChange={change} autoComplete="username" required />
          {err('username')}
        </label>
        <label className={styles.field}>
          E-posta
          <input className={styles.input} type="email" name="email" value={form.email}
                 onChange={change} autoComplete="email" required />
          {err('email')}
        </label>
      </div>

      <div className={styles.signupRow}>
        <label className={styles.field}>
          Şifre
          <input className={styles.input} type="password" name="password" value={form.password}
                 onChange={change} autoComplete="new-password" required />
          {err('password')}
        </label>
        <label className={styles.field}>
          Şifre (tekrar)
          <input className={styles.input} type="password" name="password2" value={form.password2}
                 onChange={change} autoComplete="new-password" required />
          {err('password2')}
        </label>
      </div>

      {globalError && <p className={styles.formError}>{globalError}</p>}

      <button className={styles.btnPrimary} type="submit" disabled={loading}>
        {loading ? 'Hesap oluşturuluyor…' : 'Hesabı Oluştur'}
        {!loading && <ArrowIcon />}
      </button>

      <p className={styles.signupFoot}>
        Zaten hesabınız var mı? <Link to="/giris" className={styles.link}>Giriş yapın</Link>
      </p>
    </form>
  );
}

/* ───────────────────────────────────────────────────────────────── İçerik ─── */

const FAQ = [
  {
    q: 'Rehberim tam olarak ne yapıyor?',
    a: `İki ürün var. YKS tarafı, bir rehber öğretmenin öğrenci takibi için
        kullandığı her şeyi topluyor: haftalık ders programı, deneme sonuçları
        ve netler, konu bazlı kazanım takibi, kitaplık, hedefler ve görüşme
        takvimi. Rehber web'den yönetiyor; öğrenci ve veli mobil uygulamadan
        kendi tarafını görüyor. LGS tarafı ise dershaneler için: sınıf/şube,
        haftalık soru bazlı ödev, deneme sonuçları, ders programı ve veli
        toplantısı. Aşağıdaki soruların çoğu YKS tarafını anlatıyor; LGS'ye
        özel olanlar ayrıca işaretli.`,
  },
  {
    q: 'Öğrencim bana nasıl bağlanıyor?',
    a: `Hesabınız açılınca size özel, değişmeyen bir davet kodu üretiliyor.
        Öğrenci mobil uygulamadan kendi hesabını açıp bu kodu giriyor ve
        listenize düşüyor. Şifresini siz görmüyorsunuz.`,
  },
  {
    q: 'Veli de görebiliyor mu?',
    a: `Evet, ama sınırlı ve salt-okunur. Veli; denemeleri (ders kırılımıyla),
        onayladığınız programları ve uyum yüzdesini, konu takibini, haftalık
        çalışma saatini ve takvimi görüyor. Kitaplık ve hedefler veliye kapalı.
        Veliyi siz davet ediyorsunuz; davet kodu tek kullanımlık ve tek öğrenciye ait.`,
  },
  {
    q: 'Programı öğrenci değiştirebiliyor mu?',
    a: `Hafta açıkken evet — öğrenci görevlerini tamamlayabilir ve düzenleyebilir.
        Hafta bitip siz programı onayladıktan sonra program mühürleniyor:
        öğrenci artık yazamıyor, siz yazabiliyorsunuz. Onaylanmamış bir program
        veliye hiç gösterilmiyor.`,
  },
  {
    q: 'Program uyumu nasıl hesaplanıyor?',
    a: `Görev sayısı değil süre üzerinden: tamamlanan dakika / planlanan dakika.
        Okul, antrenman gibi dış meşguliyetler paydaya girmiyor; denemeler
        giriyor. Saati olmayan programlarda görev sayısına düşülüyor.`,
  },
  {
    q: 'Ücretli mi?',
    a: `Şu an bir ücretlendirme yok; hesap açmak ve kullanmak ücretsiz.
        Kredi kartı istemiyoruz.`,
  },
  {
    q: 'LGS · Dershane tarafı YKS\'den nasıl farklı?',
    a: `Çalışma birimi öğrenci değil sınıf. Öğretmen sınıflarını açıyor,
        öğrencilerini elle ekliyor (öğrencinin hesabı yok), haftalık soru
        hedefini sınıfa veriyor ve deneme sonuçlarını ızgaradan giriyor.
        Veli, öğretmenin verdiği davet koduyla kendi hesabını açıp yalnızca
        izliyor. YKS'deki program tahtası, kitaplık ve kazanım takibi LGS'de
        yok; onların yerine sınıf bazlı ödev ve deneme analizi var.`,
  },
  {
    q: 'LGS · Dershanem nasıl hesap açıyor?',
    a: `Kurum hesabı paket seçimiyle açılıyor: hangi özelliklerin açık olacağı
        (ödev, deneme, ders programı, veli toplantısı) kuruma göre
        belirleniyor. Bu yüzden kendi kendine kayıt yok — bize yazın, kurumu
        tanımlayıp ilk öğretmen hesabını birlikte açıyoruz. Sonrasında
        öğretmen kendi hesabını yönetiyor.`,
  },
  {
    q: 'Verilerim ne oluyor?',
    a: `Öğrenci verisi öğrenciye ait. Hesabınızı silerseniz öğrencileriniz
        silinmiyor, yalnızca sizinle bağları kopuyor; programları, denemeleri ve
        kitaplıkları kendilerinde kalıyor. Silmeden önce neyin gideceğinin
        özetini gösteriyoruz.`,
  },
];

const ROLES = [
  {
    title: 'Rehber',
    tag: 'Web',
    color: '#2563eb',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
      </svg>
    ),
    items: [
      'Sürükle-bırak haftalık program tahtası',
      'Şablon kaydet, öğrenciye ata, rutine bağla',
      'Deneme sonuçlarını ve konu kazanımlarını gir',
      'Panelde uyum, net ve konu ilerlemesini karşılaştır',
      'Görüşme takvimi, veli daveti, başarım tanımları',
    ],
  },
  {
    title: 'Öğrenci',
    tag: 'Mobil',
    color: '#7c3aed',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 10L12 5 2 10l10 5 10-5z" /><path d="M6 12v5c0 1 2.7 2.5 6 2.5s6-1.5 6-2.5v-5" />
      </svg>
    ),
    items: [
      'Bugünün görevleri, tamamladıkça işaretle',
      'Deneme sonuçlarını gir, net ve trendini gör',
      'Konu ilerlemesini 1–5 seviyede takip et',
      'Kitaplık ve kişisel hedefler',
      'Kazandığın başarımlar',
    ],
  },
  {
    title: 'Veli',
    tag: 'Mobil',
    color: '#059669',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
    items: [
      'Deneme sonuçları, ders ders kırılımıyla',
      'Onaylanmış haftalık programlar ve uyum yüzdesi',
      'Haftalık çalışma saati',
      'Konu takip listesi ve görüşme takvimi',
      'Salt-okunur — hiçbir şeyi değiştiremez',
    ],
  },
];

export default function Welcome() {
  return (
    <div className={styles.page}>

      {/* ── Navbar ── */}
      <nav className={styles.nav}>
        <div className={styles.navInner}>
          <Logo height={31} className={styles.brand} />
          <div className={styles.navLinks}>
            <a href="#yks" className={styles.navSection}>YKS</a>
            <a href="#lgs" className={styles.navSection}>LGS</a>
            <a href="#sss" className={styles.navSection}>SSS</a>
            <a href="#iletisim" className={styles.navSection}>İletişim</a>
          </div>
          <div className={styles.navRight}>
            <ThemeToggle />
            <Link to="/giris" className={styles.navLink}>Giriş Yap</Link>
            <a href="#kayit" className={styles.navCta}>Ücretsiz Başlayın</a>
          </div>
        </div>
      </nav>

      {/* ── Hero — hangi ürün? ──
           Ziyaretçi ilk burada seçiyor; iki kart da sayfanın kendi dalına
           (`#yks` / `#lgs`) ya da doğrudan ilgili uygulamaya gidiyor. */}
      <section className={styles.hero}>
        <div className={styles.heroPick}>
          <div className={styles.badge}>
            <span className={styles.badgePulse} />
            İki sınav · tek platform
          </div>
          <h1 className={styles.heroTitle}>
            Öğrenci takibi,<br />
            <span className={styles.heroHighlight}>tek ekrandan</span>.
          </h1>
          <p className={styles.heroSubtitle}>
            Rehberim iki ürün: liseler ve YKS için rehber paneli, ortaokullar ve
            LGS için dershane paneli. Aynı mantık, aynı arayüz — ayrı veri.
          </p>

          <div className={styles.productGrid}>
            <ProductCard
              tag="YKS · Lise"
              accent="#2563eb"
              title="Rehber Paneli"
              desc="Tek tek öğrenci takibi yapan rehber öğretmenler için. Öğrenci ve veli kendi mobil uygulamasından bağlanır."
              items={[
                'Sürükle-bırak haftalık program',
                'TYT/AYT deneme netleri ve trend',
                'Konu kazanımları, kitaplık, takvim',
              ]}
              anchor="#yks"
              action={
                <a href="#kayit" className={styles.btnPrimary}>
                  Ücretsiz Başlayın <ArrowIcon />
                </a>
              }
            />
            <ProductCard
              tag="LGS · Ortaokul"
              accent="#7c3aed"
              title="Dershane Paneli"
              desc="Sınıf mevcuduyla çalışan dershaneler için. Öğretmen sınıfını, ödevini ve denemesini buradan yönetir."
              items={[
                'Sınıf/şube ve haftalık soru bazlı ödev',
                'Deneme sonuçları, karne PDF içe aktarma',
                'Ders programı ve veli toplantısı',
              ]}
              anchor="#lgs"
              soon={!LGS_READY}
              action={LGS_READY ? (
                <a href={LGS_URL} className={styles.btnPrimary}>
                  Dershane Paneli <ArrowIcon />
                </a>
              ) : (
                <span className={styles.btnDisabled}>Panel yakında</span>
              )}
            />
          </div>

          <p className={styles.heroNote}>Kredi kartı gerekmez · Kurulum yok, tarayıcıdan çalışır</p>
        </div>
      </section>

      {/* ── YKS dalı ── */}
      <section className={styles.branch} id="yks">
        <div className={styles.heroInner}>
          <div className={styles.heroText}>
            <div className={styles.sectionTag}>YKS · Lise</div>
            <h2 className={styles.branchTitle}>Öğrencilerinizi tek ekrandan takip edin.</h2>
            <p className={styles.heroSubtitle}>
              Haftalık program hazırlayın, deneme netlerini ve konu kazanımlarını
              girin, kimin ne kadar uyduğunu görün. Öğrenci ve veli kendi
              uygulamasından aynı veriyi izler.
            </p>
            <div className={styles.heroCta}>
              <a href="#kayit" className={styles.btnPrimary}>
                Ücretsiz Başlayın <ArrowIcon />
              </a>
              <Link to="/giris" className={styles.btnGhost}>Giriş Yap</Link>
            </div>
          </div>
          <div className={styles.heroVisual}>
            <div className={styles.previewGlow} />
            <DashboardPreview />
          </div>
        </div>
      </section>

      {/* ── Özellikler ── */}
      <section className={styles.features} id="ozellikler">
        <div className={styles.sectionInner}>
          <div className={styles.sectionTag}>YKS · Özellikler</div>
          <h2 className={styles.sectionTitle}>Rehberin işini yapan altı ekran</h2>
          <p className={styles.sectionSub}>
            Program, deneme, kazanım, kitaplık, takvim ve başarım — hepsi birbirine bağlı.
          </p>
          <div className={styles.featureGrid}>
            <FeatureCard
              color="#2563eb"
              title="Haftalık Program"
              desc="Sürükle-bırak tahtada blok oluşturun. Şablon kaydedin, öğrenciye atayın, rutine bağlayın. Hafta bitince onaylayın."
              icon={
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              }
            />
            <FeatureCard
              color="#7c3aed"
              title="Deneme Takibi"
              desc="Doğru/yanlış girin, net kendiliğinden hesaplansın. TYT ve AYT ayrı ayrı, ders kırılımıyla ve trend grafiğiyle."
              icon={
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
                </svg>
              }
            />
            <FeatureCard
              color="#059669"
              title="Konu Kazanımları"
              desc="Müfredat konularını 1–5 seviyede işaretleyin. Zayıf konular listede öne çıksın, program da ona göre kurulsun."
              icon={
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              }
            />
            <FeatureCard
              color="#dc2626"
              title="Kitaplık"
              desc="Öğrencinin kaynak kitapları, yayınevleriyle birlikte. Kitap içi konular ve tamamlanma oranı takip edilir."
              icon={
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
                </svg>
              }
            />
            <FeatureCard
              color="#ea580c"
              title="Takvim"
              desc="Görüşme, veli toplantısı ve sınav takvimi. Dilerseniz .ics olarak dışa aktarın ya da mevcut takviminizi içe alın."
              icon={
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
              }
            />
            <FeatureCard
              color="#0891b2"
              title="Başarımlar"
              desc="Net, konu tamamlama ve program uyumu üzerinden hedefler koyun. Öğrenci kazandıkça listesi dolsun."
              icon={
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="6" /><path d="M15.5 13.5L17 22l-5-3-5 3 1.5-8.5" />
                </svg>
              }
            />
          </div>
        </div>
      </section>

      {/* ── Nasıl çalışır ── */}
      <section className={styles.howItWorks}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionTag}>YKS · Nasıl Çalışır</div>
          <h2 className={styles.sectionTitle}>3 adımda başlayın</h2>
          <div className={styles.steps}>
            <Step
              n="01"
              title="Hesap oluşturun"
              desc="Aşağıdaki formu doldurun. Kurulum ya da kredi kartı gerekmez, tarayıcıdan çalışır."
            />
            <div className={styles.stepConnector} />
            <Step
              n="02"
              title="Öğrenci ekleyin"
              desc="Size özel davet kodunu paylaşın. Öğrenci mobil uygulamadan kodu girer ve listenize düşer."
            />
            <div className={styles.stepConnector} />
            <Step
              n="03"
              title="Takibe başlayın"
              desc="Program kurun, deneme ve kazanım girin. Veliyi davet edin, o da ilerlemeyi izlesin."
            />
          </div>
        </div>
      </section>

      {/* ── Kimler kullanır ── */}
      <section className={styles.roles} id="roller">
        <div className={styles.sectionInner}>
          <div className={styles.sectionTag}>YKS · Kimler Kullanır</div>
          <h2 className={styles.sectionTitle}>Üç taraf, tek veri</h2>
          <p className={styles.sectionSub}>
            Rehber web tarayıcısından, öğrenci ve veli mobil uygulamadan bağlanır.
            Herkes aynı veriyi kendi yetkisi kadar görür.
          </p>
          <div className={styles.rolesGrid}>
            {ROLES.map((r) => (
              <div key={r.title} className={styles.roleCard}>
                <div className={styles.roleHead}>
                  <div className={styles.roleIcon} style={{ background: `${r.color}18`, color: r.color }}>
                    {r.icon}
                  </div>
                  <span className={styles.roleTag} style={{ color: r.color, borderColor: `${r.color}40` }}>
                    {r.tag}
                  </span>
                </div>
                <h3>{r.title}</h3>
                <ul className={styles.roleList}>
                  {r.items.map((it) => <li key={it}>{it}</li>)}
                </ul>
              </div>
            ))}
          </div>

          <div className={styles.mediaRow}>
            <MediaSlot label="Öğrenci uygulaması ekran görüntüsü" />
            <MediaSlot label="Veli uygulaması ekran görüntüsü" />
          </div>
        </div>
      </section>

      {/* ── Kayıt ── */}
      <section className={styles.signup} id="kayit">
        <div className={styles.sectionInner}>
          <div className={styles.signupGrid}>
            <div className={styles.signupIntro}>
              <div className={styles.sectionTag}>YKS · Kayıt</div>
              <h2 className={styles.sectionTitle}>Rehber hesabınızı açın</h2>
              <p className={styles.sectionSub}>
                Hesap yalnızca rehber öğretmenler içindir. Öğrenci ve veli kendi
                hesabını mobil uygulamadan açar, sizin davet kodunuzla bağlanır.
              </p>
              <ul className={styles.checkList}>
                <li>Kurulum yok — tarayıcıdan çalışır</li>
                <li>Kredi kartı istenmez</li>
                <li>Davet kodunuz hesapla birlikte üretilir</li>
                <li>Hesabınızı istediğiniz zaman silebilirsiniz</li>
              </ul>
            </div>
            <div className={styles.signupCard}>
              <SignupForm />
            </div>
          </div>
        </div>
      </section>

      {/* ── LGS dalı ──
           Dershane ürünü AYRI bir uygulama ve ayrı bir backend; burada yalnız
           anlatılıyor ve bağlantı veriliyor. Rol modeli YKS'den farklı:
           öğrencinin hesabı YOK, öğrencileri öğretmen elle ekliyor, veli
           öğretmenin davet koduyla kendi hesabını açıp salt-okur bakıyor. */}
      <section className={styles.branch} id="lgs">
        <div className={styles.heroInner}>
          <div className={styles.heroVisual}>
            <div className={styles.previewGlow} />
            <DershanePreview />
          </div>
          <div className={styles.heroText}>
            <div className={styles.sectionTag}>LGS · Ortaokul</div>
            <h2 className={styles.branchTitle}>Dershanenin sınıfını, ödevini, denemesini tek yerden yönetin.</h2>
            <p className={styles.heroSubtitle}>
              Sınıf mevcuduyla çalışan kurumlar için. Öğretmen sınıflarını açar,
              öğrencilerini elle ekler, haftalık soru hedefini verir ve deneme
              sonuçlarını girer. Veli kendi hesabından yalnızca izler.
            </p>
            <ul className={styles.checkList}>
              <li>Sınıf/şube yönetimi, öğrenciyi öğretmen ekler</li>
              <li>Haftalık soru bazlı ödev, üç durumlu tamamlama</li>
              <li>Deneme sonucu ızgarası ve karne PDF'i içe aktarma</li>
              <li>Ders programı, veli toplantısı, sınıf analizleri</li>
              <li>Öğrencinin hesabı yok — veli davet koduyla bağlanır</li>
            </ul>
            <div className={styles.heroCta}>
              {LGS_READY ? (
                <a href={LGS_URL} className={styles.btnPrimary}>
                  Dershane Paneline Git <ArrowIcon />
                </a>
              ) : (
                <span className={styles.btnDisabled}>Panel yakında</span>
              )}
              <a href="mailto:iletisim@rehberim.xyz?subject=LGS%20dershane%20paneli" className={styles.btnGhost}>
                Kurum olarak başvur
              </a>
            </div>
            <p className={styles.heroNote}>
              Kurum hesapları paket seçimiyle açılıyor — önce bize yazın.
            </p>
          </div>
        </div>
      </section>

      {/* ── SSS ── */}
      <section className={styles.faq} id="sss">
        <div className={styles.sectionInner}>
          <div className={styles.sectionTag}>SSS</div>
          <h2 className={styles.sectionTitle}>Sık sorulan sorular</h2>
          <div className={styles.faqList}>
            {FAQ.map(({ q, a }) => (
              /* Native <details>: klavye ve ekran okuyucu desteği bedava gelir,
                 tek satır JS yazmadan açılıp kapanır. */
              <details key={q} className={styles.faqItem}>
                <summary className={styles.faqQuestion}>
                  {q}
                  <span className={styles.faqChevron} aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </span>
                </summary>
                <p className={styles.faqAnswer}>{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── İletişim ── */}
      <section className={styles.contact} id="iletisim">
        <div className={styles.sectionInner}>
          <div className={styles.sectionTag}>İletişim</div>
          <h2 className={styles.sectionTitle}>Bize ulaşın</h2>
          <p className={styles.sectionSub}>
            Sorunuz, öneriniz ya da bir hata bildiriminiz varsa yazın — okuyup dönüyoruz.
          </p>
          <div className={styles.contactGrid}>
            <a className={styles.contactCard} href="mailto:iletisim@rehberim.xyz">
              <span className={styles.contactIcon}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2" /><path d="M22 6l-10 7L2 6" />
                </svg>
              </span>
              <span className={styles.contactLabel}>E-posta</span>
              <span className={styles.contactValue}>iletisim@rehberim.xyz</span>
            </a>
            <a className={styles.contactCard} href="mailto:destek@rehberim.xyz">
              <span className={styles.contactIcon}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </span>
              <span className={styles.contactLabel}>Destek</span>
              <span className={styles.contactValue}>destek@rehberim.xyz</span>
            </a>
            <div className={styles.contactCard}>
              <span className={styles.contactIcon}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
                </svg>
              </span>
              <span className={styles.contactLabel}>Konum</span>
              <span className={styles.contactValue}>Ankara, Türkiye</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerTop}>
            <Logo height={26} className={styles.footerBrand} />
            {/* Gizlilik ve hesap silme bağlantıları burada durmak zorunda:
                mağazalar politikanın herkese açık ve kolay bulunur olmasını
                istiyor, incelemeci de önce ana sayfanın altına bakıyor. */}
            <div className={styles.footerLinks}>
              <a href="#yks">YKS</a>
              <a href="#lgs">LGS</a>
              <a href="#sss">SSS</a>
              <a href="#iletisim">İletişim</a>
              <Link to="/gizlilik">Gizlilik ve KVKK</Link>
              <Link to="/hesap-silme">Hesap silme</Link>
              <Link to="/giris">Giriş Yap</Link>
            </div>
          </div>
          <span className={styles.footerCopy}>© 2026 Rehberim. Tüm hakları saklıdır.</span>
        </div>
      </footer>

    </div>
  );
}
