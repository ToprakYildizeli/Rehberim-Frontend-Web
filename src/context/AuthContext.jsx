import { createContext, useContext, useState, useCallback } from 'react';
import { logout as apiLogout } from '../api/auth';
import { clearPreferencesCache } from '../api/preferences';
import { clearDashboardCache } from '../api/dashboard';

const AuthContext = createContext(null);

const OTURUM_ANAHTARLARI = ['access', 'refresh', 'user'];

/** localStorage'daki oturumu siler. Bozuk bir kaydı temizlemek için de kullanılır. */
function oturumuSil() {
  try {
    OTURUM_ANAHTARLARI.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* gizli mod / kota — okuma zaten başarısız olacak, akış bozulmasın */
  }
}

/** `localStorage.getItem` ama `"undefined"`/`"null"` metinlerini yok sayar.
 *
 *  `localStorage.setItem(k, undefined)` değeri **`"undefined"` METNİ** olarak
 *  yazar. O metin truthy olduğu için `!!accessToken` "girişli" diyor, `JSON.parse`
 *  ise üstünde patlıyordu. İkisini de burada kesiyoruz. */
function oku(anahtar) {
  try {
    const v = localStorage.getItem(anahtar);
    return v === null || v === 'undefined' || v === 'null' ? null : v;
  } catch {
    return null;
  }
}

/** Saklanan kullanıcıyı okur; kayıt bozuksa oturumu temizleyip `null` döner.
 *
 *  ⚠️ **Bu fonksiyon patlamamalı.** Çağrıldığı yer `AuthProvider`ın `useState`
 *  başlatıcısı, yani ağacın en tepesi — eklediğimiz hata sınırlarının bile
 *  ÜSTÜ. Buradan fırlayan bir istisna uygulamayı bembeyaz bir sayfaya çeviriyor
 *  ve localStorage elle temizlenene kadar her açılışta yeniden patlıyor:
 *  kullanıcı için kalıcı bir arıza. (20 Eylül 2026'da tam olarak bu oldu —
 *  `JSON Parse error: Unexpected identifier "undefined"`.)
 *
 *  Bu yüzden bozuk kayıt bir hata değil, temizlenecek bir çöp sayılıyor:
 *  kullanıcı yalnızca giriş ekranına döner. */
function saklananKullanici() {
  const raw = oku('user');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    oturumuSil();
    return null;
  }
}

export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(() => oku('access'));
  // Refresh token bilerek state'te TUTULMUYOR: `client.js` onu yenileme sırasında
  // localStorage'da güncelliyor, buradaki bir kopya anında bayatlar. Tek kaynak
  // localStorage; ihtiyaç duyan yer oradan okur.
  const [user, setUser] = useState(saklananKullanici);

  const saveSession = useCallback((access, refresh, userData) => {
    // Eksik gövdeyle çağrılırsa HİÇBİR ŞEY yazma. Yoksa `String(undefined)`
    // localStorage'a `"undefined"` metnini yazıyor, o metin truthy olduğu için
    // kullanıcı "girişli" sayılıp panele alınıyor ve bir sonraki açılış
    // kırılıyordu. Kayıt/doğrulama uçları token'sız gövde de dönebiliyor
    // (`email_verification_required`), yani bu gerçekten olan bir durum.
    if (!access || !refresh || !userData) {
      console.error(
        'saveSession eksik gövdeyle çağrıldı; oturum yazılmadı.',
        { access: !!access, refresh: !!refresh, user: !!userData },
      );
      return false;
    }
    setAccessToken(access);
    setUser(userData);
    localStorage.setItem('access', access);
    localStorage.setItem('refresh', refresh);
    localStorage.setItem('user', JSON.stringify(userData));
    return true;
  }, []);

  /** Oturumu bozmadan yalnızca kullanıcı objesini tazeler (profil kaydedince). */
  const updateUser = useCallback((userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  }, []);

  const clearSession = useCallback(async () => {
    // Token'lar localStorage'dan okunuyor, state'ten DEĞİL: `client.js` 401
    // sonrası yenilemede localStorage'ı güncelliyor ama bu provider'ın state'i
    // haberdar olmuyor. State'ten okunsaydı çıkışta rotasyonla geçersizleşmiş
    // eski token gönderilir, istek sessizce düşer ve kullanıcının GERÇEK refresh
    // token'ı kara listeye hiç alınmazdı — ömrü (7 gün) boyunca geçerli kalırdı.
    const refresh = oku('refresh');
    const access = oku('access');
    if (refresh && access) {
      try { await apiLogout(refresh, access); } catch (_) {}
    }
    setAccessToken(null);
    setUser(null);
    oturumuSil();
    // Tercihler modül düzeyinde önbellekleniyor; temizlenmezse aynı sekmede giriş
    // yapan ikinci rehber öncekinin ayarlarını görürdü.
    clearPreferencesCache();
    clearDashboardCache();   // sonraki kullanıcı öncekinin panosunu görmesin
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, accessToken, saveSession, updateUser, clearSession, isLoggedIn: !!accessToken }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
