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
 *  `key` olarak yol veriliyor: gezinince React sınırı yeniden kurar ve hata
 *  durumu kendiliğinden temizlenir. `useLocation` çağrıldığı için
 *  `BrowserRouter`ın içinde yaşamak zorunda, bu yüzden ayrı bir bileşen.
 */
function RouteBoundary({ children }) {
  const location = useLocation();
  return <ErrorBoundary key={location.pathname}>{children}</ErrorBoundary>;
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
