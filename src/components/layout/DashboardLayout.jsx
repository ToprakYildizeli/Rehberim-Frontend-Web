import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Calendar, CalendarDays, Settings,
  GraduationCap, Bell, PanelLeftClose, PanelLeftOpen, Menu,
  User as UserIcon, Presentation,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useRole } from '../../context/useRole';
import { Avatar, SearchInput, ThemeToggle, EmptyState } from '../ui';
import s from './layout.module.css';

const NAV = [
  { to: '/panel', label: 'Panel', icon: LayoutDashboard },
  { to: '/ogrenciler', label: 'Öğrenciler', icon: Users },
  { to: '/takvim', label: 'Takvim', icon: Calendar },
  { to: '/ders-programi', label: 'Ders Programı', icon: CalendarDays },
  { to: '/ayarlar', label: 'Ayarlar', icon: Settings },
];

const TITLES = {
  '/panel': 'Panel',
  '/ogrenciler': 'Öğrenciler',
  '/takvim': 'Takvim',
  '/ders-programi': 'Ders Programı Planlayıcı',
  '/ayarlar': 'Ayarlar',
};

function RoleSwitcher() {
  const { role, setRole } = useRole();
  return (
    <div className={s.switcherBar}>
      <div className={s.switcher} role="tablist" aria-label="Görünüm">
        <button
          type="button"
          role="tab"
          aria-selected={role === 'ogrenci'}
          className={`${s.switcherBtn} ${role === 'ogrenci' ? s.switcherActive : ''}`}
          onClick={() => setRole('ogrenci')}
        >
          <UserIcon size={14} /> Öğrenci
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={role === 'ogretmen'}
          className={`${s.switcherBtn} ${role === 'ogretmen' ? s.switcherActive : ''}`}
          onClick={() => setRole('ogretmen')}
        >
          <Presentation size={14} /> Öğretmen
        </button>
      </div>
      <ThemeToggle />
    </div>
  );
}

export default function DashboardLayout() {
  const location = useLocation();
  const { user } = useAuth();
  const { role } = useRole();
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('sidebarCollapsed') === '1'
  );
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', collapsed ? '1' : '0');
  }, [collapsed]);

  // Close the mobile drawer on navigation.
  useEffect(() => setMobileOpen(false), [location.pathname]);

  const title = TITLES[location.pathname] ?? 'Panel';
  const displayName =
    [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.username || 'Öğretmen';

  return (
    <div className={s.shell}>
      <RoleSwitcher />

      <div
        className={`${s.scrim} ${mobileOpen ? s.scrimOpen : ''}`}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      <div className={s.body}>
      <aside
        className={[
          s.sidebar,
          collapsed ? s.sidebarCollapsed : '',
          mobileOpen ? s.sidebarOpen : '',
        ].join(' ')}
      >
        <NavLink to="/panel" className={s.brand}>
          <span className={s.brandMark}>
            <GraduationCap size={17} color="#fff" />
          </span>
          {!collapsed && 'Rehberlik'}
        </NavLink>

        <nav className={s.nav}>
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                `${s.navItem} ${isActive ? s.navItemActive : ''}`
              }
            >
              <span className={s.navIcon}>
                <Icon size={17} />
              </span>
              {!collapsed && label}
            </NavLink>
          ))}
        </nav>

        <button
          type="button"
          className={s.collapseBtn}
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Menüyü genişlet' : 'Menüyü daralt'}
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          {!collapsed && 'Daralt'}
        </button>
      </aside>

      <div className={s.main}>
        <header className={s.topbar}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <button
              type="button"
              className={`${s.iconBtn} ${s.mobileToggle}`}
              onClick={() => setMobileOpen(true)}
              aria-label="Menüyü aç"
            >
              <Menu size={18} />
            </button>
            <h1 className={s.pageTitle}>{title}</h1>
          </div>

          <div className={s.topbarRight}>
            <SearchInput className={s.topSearch} placeholder="Öğrenci ara..." aria-label="Öğrenci ara" />
            <button type="button" className={s.iconBtn} aria-label="Bildirimler">
              <Bell size={18} />
              <span className={s.badgeDot}>3</span>
            </button>
            <button type="button" className={s.profileBtn} aria-label={displayName}>
              <Avatar name={displayName} size="sm" color="var(--violet)" />
            </button>
          </div>
        </header>

        <main className={s.canvas}>
          {role === 'ogrenci' ? (
            <EmptyState
              icon={<UserIcon size={22} />}
              title="Öğrenci görünümü yakında"
              text="Öğrenciler şimdilik mobil uygulamayı kullanıyor. Web arayüzü hazırlanıyor — Öğretmen görünümüne dönmek için yukarıdaki anahtarı kullanın."
            />
          ) : (
            <Outlet />
          )}
        </main>
      </div>
      </div>
    </div>
  );
}
