/* Kategorik ramp `index.css`'te tanımlı ve her renk paleti onu yeniden yazıyor;
   burada sabit hex tutmak temayı avatarlarda ve grafik çizgilerinde kilitlerdi.
   Dönen değer bir `var(...)` olduğu için tüketen yer onu CSS'e geçirmeli:
   inline style de, SVG sunum niteliği de (stroke="var(--cat-1)") çalışıyor —
   tarayıcıda ölçüldü. */
const AVATAR_COLORS = [
  'var(--cat-1)', 'var(--cat-2)', 'var(--cat-3)', 'var(--cat-4)',
  'var(--cat-5)', 'var(--cat-6)', 'var(--cat-7)', 'var(--cat-8)',
];

export function initialsOf(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] || '')
    .join('')
    .toLocaleUpperCase('tr-TR');
}

export function colorFor(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

/** Grafikteki çizgi rengi — sıraya göre, **olabildiğince ayrık**.
 *
 *  Avatar paleti (`colorFor`) sekiz renkten oluşuyor ve adı hash'liyor; altmış
 *  öğrencide her rengi yedi-sekiz kişi paylaşıyor ve grafikte hangi çizginin
 *  kime ait olduğu ayırt edilemiyor.
 *
 *  Burada renk **sırayla** üretiliyor ve ton adımı altın açı (137.5°): ardışık
 *  iki öğrenci renk çemberinin iki ucuna düşer, herhangi bir alt küme de iyi
 *  dağılır. Eşit aralıklı bölmek (360/60 = 6°) yan yana iki tonu birbirinden
 *  ayırt edilemez yapardı.
 *
 *  Açıklık üç adımda dönüyor: tonlar yeterince uzaklaşamadığında (çok fazla
 *  öğrenci) koyu/açık farkı ikinci bir ayırt edici oluyor.
 *
 *  ⚠️ Avatar rengiyle aynı değil, olması da gerekmiyor: grafiğin göstergesi
 *  (chip noktası) da bu renci kullanıyor, yani grafik kendi içinde tutarlı.
 */
export function seriesColor(index = 0) {
  const hue = Math.round((index * 137.508) % 360);
  const light = [46, 60, 34][index % 3];
  return `hsl(${hue} 62% ${light}%)`;
}
