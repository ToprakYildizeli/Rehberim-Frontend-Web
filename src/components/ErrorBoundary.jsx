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
 *  **Sıfırlamanın iki yolu var, ikisi farklı şeyler için:**
 *
 *  - `key={location.pathname}`: React bileşeni söküp yeniden kurar. Sınır
 *    yalnızca değişen parçayı (`<Outlet />`) sarıyorsa doğru yol — hem hata
 *    durumu gider hem sayfa taze kurulur.
 *  - `resetKey={location.pathname}`: sınır **ayakta kalır**, yalnız hata durumu
 *    temizlenir. Sınır gezinmede değişmemesi gereken bir ağacı sarıyorsa
 *    (panel katmanı, sağlayıcılar) bunu kullan; `key` verilirse o ağaç her
 *    gezinmede sökülüp yeniden kurulur ve içindeki tüm state sıfırlanır.
 *    1 Ekim 2026'daki arıza buydu: `App`teki dış sınır `<Routes>`un tamamını
 *    `key` ile sarıyordu, KVKK onay kapısı her sayfa geçişinde yeniden
 *    kuruluyor ve "Sonra" kararı kayboluyordu.
 */
export default class ErrorBoundary extends Component {
  state = { hata: null, resetKey: undefined };

  static getDerivedStateFromError(hata) {
    return { hata };
  }

  /** `resetKey` değiştiyse hata durumunu bırak — çocukları SÖKMEDEN.
   *
   *  Son görülen anahtar state'te tutuluyor; karşılaştırma burada yapılınca
   *  sıfırlama render sırasında olur. `componentDidUpdate` + `setState` de
   *  işi görürdü ama fazladan bir render turu açardı.
   *
   *  Hata yakalandığı turda da çalışır: `getDerivedStateFromError` state'i
   *  yazar, sonra burası aynı `resetKey` ile çağrılır ve `null` döner — yani
   *  yeni yakalanmış hatayı silmez. */
  static getDerivedStateFromProps(props, state) {
    if (props.resetKey !== state.resetKey) {
      return { hata: null, resetKey: props.resetKey };
    }
    return null;
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
