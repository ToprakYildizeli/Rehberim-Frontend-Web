import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import { ThemeProvider } from './context/ThemeContext';
import { RoleProvider } from './context/RoleProvider';
import DashboardLayout from './components/layout/DashboardLayout';
import Welcome from './pages/Welcome';
import Login from './pages/Login';
import Register from './pages/Register';
import SifremiUnuttum from './pages/SifremiUnuttum';
import SifreSifirla from './pages/SifreSifirla';
import HesapSilme from './pages/HesapSilme';
import Gizlilik from './pages/Gizlilik';
import Panel from './pages/Panel';
import Ogrenciler from './pages/Ogrenciler';
import OgrenciDetay from './pages/OgrenciDetay';
import Takvim from './pages/Takvim';
import DersProgrami from './pages/DersProgrami';
import Ayarlar from './pages/Ayarlar';

function ProtectedRoute({ children }) {
  const { isLoggedIn } = useAuth();
  return isLoggedIn ? children : <Navigate to="/giris" replace />;
}

function GuestRoute({ children }) {
  const { isLoggedIn } = useAuth();
  return isLoggedIn ? <Navigate to="/panel" replace /> : children;
}

/** Dış hata sınırı — panel katmanının kapsamadığı yerler için.
 *
 *  `DashboardLayout` kendi içinde zaten bir sınır taşıyor; oradaki bir hata
 *  kenar çubuğunu ayakta bırakıyor. Ama **misafir sayfaları** (giriş, kayıt,
 *  şifre sıfırlama) o katmanın dışında: orada patlayan bir render beyaz sayfa
 *  demek ve kullanıcı giriş bile yapamaz. Bu sınır o boşluğu kapatıyor, aynı
 *  zamanda katmanın kendisinin patlaması için son durak.
 *
 *  Sıfırlama `key` ile DEĞİL `resetKey` ile yapılıyor. `key` verilirse yol
 *  değişince React bu sınırın altındaki HER ŞEYİ söküp yeniden kurar — burada
 *  altındaki şey `<Routes>`un tamamı, yani panel katmanı da. 1 Ekim 2026'da
 *  görülen sonuç: KVKK onay kapısı her sayfa geçişinde sıfırdan kuruluyor,
 *  "Sonra" denmiş olması unutuluyor ve metin tekrar tekrar açılıyordu.
 *  `resetKey` sınırı ayakta bırakıp yalnız hata durumunu temizliyor; patlayan
 *  sayfanın kendisi `DashboardLayout` içindeki sınırda `key` ile zaten
 *  yenileniyor.
 *
 *  `useLocation` çağrıldığı için `BrowserRouter`ın içinde yaşamak zorunda, bu
 *  yüzden ayrı bir bileşen.
 */
function RouteBoundary({ children }) {
  const location = useLocation();
  return <ErrorBoundary resetKey={location.pathname}>{children}</ErrorBoundary>;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RoleProvider>
          <BrowserRouter>
            <RouteBoundary>
            <Routes>
              <Route path="/" element={<GuestRoute><Welcome /></GuestRoute>} />
              <Route path="/giris" element={<GuestRoute><Login /></GuestRoute>} />
              <Route path="/kayit" element={<GuestRoute><Register /></GuestRoute>} />
              <Route path="/sifremi-unuttum" element={<GuestRoute><SifremiUnuttum /></GuestRoute>} />
              {/* E-postadaki bağlantının açtığı sayfa; uid ve token oradan gelir. */}
              <Route path="/sifre-sifirla/:uid/:token" element={<GuestRoute><SifreSifirla /></GuestRoute>} />

              {/* Hesap silme — Google Play'in Data safety formuna yazılan adres.
                  `GuestRoute` İÇİNDE DEĞİL, bilerek: bu sayfa üç rolün de (rehber,
                  öğrenci, veli) hesabını siliyor ve kendi girişini kendi yapıyor.
                  GuestRoute'a alınsaydı tarayıcıda açık bir rehber oturumu olan
                  kullanıcı panele fırlatılır, adres de mağazaya verilemezdi.
                  Sıra da önemli: aşağıdaki `path="*"` her bilinmeyen yolu `/`'a
                  çeviriyor, bu satır ondan sonra gelse sayfa hiç açılmazdı. */}
              {/* Her uygulamanın kendi adresi var: Play'de silme adresi her
                  uygulamanın Data safety formuna ayrı yazılıyor ve incelemeci
                  sayfada o uygulamanın adını görmek istiyor.
                    /hesap-silme/ogrenci · /hesap-silme/veli
                  Yalın /hesap-silme uygulama seçtiriyor. */}
              <Route path="/hesap-silme" element={<HesapSilme />} />
              <Route path="/hesap-silme/:uygulama" element={<HesapSilme />} />

              {/* Gizlilik politikası — mağaza kaydına yazılan adres. Silme
                  sayfasıyla aynı kurallar: `GuestRoute` yok (girişli kullanıcı
                  da okuyabilmeli) ve `path="*"` yakalayıcısından önce. */}
              <Route path="/gizlilik" element={<Gizlilik />} />

              <Route
                element={
                  <ProtectedRoute>
                    <DashboardLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/panel" element={<Panel />} />
                <Route path="/ogrenciler" element={<Ogrenciler />} />
                <Route path="/ogrenciler/:id" element={<OgrenciDetay />} />
                <Route path="/takvim" element={<Takvim />} />
                <Route path="/ders-programi" element={<DersProgrami />} />
                <Route path="/ayarlar" element={<Ayarlar />} />
              </Route>

              <Route path="/dashboard" element={<Navigate to="/panel" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            </RouteBoundary>
          </BrowserRouter>
        </RoleProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
