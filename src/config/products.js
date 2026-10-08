/** LGS (dershane) panelinin adresi.
 *
 *  `api/client.js`'teki desenin aynısı ve aynı gerekçeyle: **Vercel repo'daki
 *  `.env*` dosyalarını derlemeye dahil etmiyor** ve panelinde `VITE_` önekli
 *  değişkeni kaydettirmiyor. Adres bu yüzden kodda duruyor.
 *
 *  Üretim adresi BİLEREK boş. LGS tarafı henüz hiçbir yere dağıtılmadı
 *  (yol haritası Faz 8); adres boşken karşılama sayfasındaki LGS kartı
 *  bağlantısız, "Yakında" rozetiyle çıkıyor. Böylece bu sayfa canlıya
 *  gittiğinde ziyaretçiye kırık bir bağlantı sunulmuyor — LGS yayına
 *  girince tek satır burada değişir.
 *
 *  Yerelde `localhost`, `127.0.0.1` DEĞİL: LGS'nin Vite sunucusu yalnız
 *  `localhost`'a bağlanıyor, `127.0.0.1:5183` bağlantı reddediyor
 *  (8 Ekim 2026'da ölçüldü).
 */
const LOCAL_LGS = 'http://localhost:5183';
const PRODUCTION_LGS = '';

const isLocal = typeof location !== 'undefined'
  && ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);

export const LGS_URL = import.meta.env.VITE_LGS_URL || (isLocal ? LOCAL_LGS : PRODUCTION_LGS);

/** Kart bağlantılı mı çıksın, yoksa "Yakında" mı yazsın. */
export const LGS_READY = Boolean(LGS_URL);
