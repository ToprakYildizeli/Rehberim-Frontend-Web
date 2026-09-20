import { createContext, useContext, useState, useCallback } from 'react';
import { logout as apiLogout } from '../api/auth';
import { clearPreferencesCache } from '../api/preferences';
import { clearDashboardCache } from '../api/dashboard';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem('access'));
  // Refresh token bilerek state'te TUTULMUYOR: `client.js` onu yenileme sırasında
  // localStorage'da güncelliyor, buradaki bir kopya anında bayatlar. Tek kaynak
  // localStorage; ihtiyaç duyan yer oradan okur.
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });

  const saveSession = useCallback((access, refresh, userData) => {
    setAccessToken(access);
    setUser(userData);
    localStorage.setItem('access', access);
    localStorage.setItem('refresh', refresh);
    localStorage.setItem('user', JSON.stringify(userData));
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
    const refresh = localStorage.getItem('refresh');
    const access = localStorage.getItem('access');
    if (refresh && access) {
      try { await apiLogout(refresh, access); } catch (_) {}
    }
    setAccessToken(null);
    setUser(null);
    localStorage.removeItem('access');
    localStorage.removeItem('refresh');
    localStorage.removeItem('user');
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
