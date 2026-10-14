/** LGS (dershane) panelinin adresi.
 *
 *  `api/client.js`'teki desenin aynısı ve aynı gerekçeyle: **Vercel repo'daki
 *  `.env*` dosyalarını derlemeye dahil etmiyor** ve panelinde `VITE_` önekli
 *  değişkeni kaydettirmiyor. Adres bu yüzden kodda duruyor.
 *
 *  LGS 14 Ekim 2026'da yayına girdi; adres o gün yazıldı. Daha önce bilerek
 *  boştu ve karşılama sayfasındaki LGS kartı bağlantısız, "Yakında"
 *  rozetiyle çıkıyordu (`LGS_READY` bu değerin dolu olmasına bakıyor) —
 *  ziyaretçiye kırık bağlantı sunulmasın diye.
 *
 *  Yerelde `localhost`, `127.0.0.1` DEĞİL: LGS'nin Vite sunucusu yalnız
 *  `localhost`'a bağlanıyor, `127.0.0.1:5183` bağlantı reddediyor
 *  (8 Ekim 2026'da ölçüldü).
 */
const LOCAL_LGS = 'http://localhost:5183';
const PRODUCTION_LGS = 'https://lgs.rehberim.xyz';

const isLocal = typeof location !== 'undefined'
  && ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);

export const LGS_URL = import.meta.env.VITE_LGS_URL || (isLocal ? LOCAL_LGS : PRODUCTION_LGS);

/** Kart bağlantılı mı çıksın, yoksa "Yakında" mı yazsın. */
export const LGS_READY = Boolean(LGS_URL);
