import { Component } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Card, EmptyState, Button } from './ui';

/** Render sırasında patlayan bir ekranı yakalar ve beyaz sayfayı engeller.
 *
 *  React 19'da render sırasındaki bir istisna **tüm ağacı söker**: kullanıcı
 *  bomboş beyaz bir sayfa görür, konsola bakmadan ne olduğunu anlaması imkânsız.
 *  Beklenmedik bir API yanıtı (dizi yerine `null`, eksik bir alan) bunun için
 *  yeterli ve en büyük ekranlarda (`DersProgrami` 2400+ satır) tek bir `.map()`
 *  bunu tetikleyebiliyor.
 *
 *  **Sınıf bileşeni olması zorunlu:** `getDerivedStateFromError` ve
 *  `componentDidCatch`ın hook karşılığı yok.
 *
 *  Sınır, `DashboardLayout`un İÇİNE konuyor: bir sayfa patladığında kenar çubuğu
 *  ve üst çubuk ayakta kalır, kullanıcı başka bir sayfaya geçerek kurtulabilir.
 *  Kökte olsaydı tek çıkış yolu sayfayı yenilemek olurdu.
 *
 *  **Sıfırlama `key` ile:** çağıran taraf `key={location.pathname}` veriyor, yani
 *  yol değişince React bu bileşeni söküp yeniden kuruyor ve hata durumu
 *  kendiliğinden gidiyor. Sıfırlamayı `componentDidUpdate` içinde `setState` ile
 *  yapmak da mümkündü ama o fazladan bir render turu demek; `key` React'in bu iş
 *  için olan yolu. Aksi hâlde bir kez patlayan sınır, gezinmeye rağmen hata
 *  ekranında kalırdı.
 */
export default class ErrorBoundary extends Component {
  state = { hata: null };

  static getDerivedStateFromError(hata) {
    return { hata };
  }

  componentDidCatch(hata, info) {
    // Konsol şimdilik tek kayıt yeri; Sentry'nin tarayıcı tarafı henüz kurulmadı.
    console.error('Ekran açılamadı:', hata, info?.componentStack);
  }

  render() {
    if (!this.state.hata) return this.props.children;

    return (
      <Card>
        <EmptyState
          icon={<AlertTriangle size={22} />}
          title="Bu ekran açılamadı"
          text="Beklenmeyen bir hata oldu. Sayfayı yenilemek çoğu zaman yeterli oluyor; sürerse bize Ayarlar'dan bildirin."
          action={
            <Button onClick={() => window.location.reload()}>
              Sayfayı yenile
            </Button>
          }
        />
      </Card>
    );
  }
}
