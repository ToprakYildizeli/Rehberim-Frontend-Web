/**
 * Seçilebilir renk paletleri. `id` doğrudan `data-palette` niteliğine yazılır ve
 * `index.css`'teki `[data-theme="..."][data-palette="..."]` bloklarıyla eşleşir —
 * buraya yeni bir palet eklerken CSS'e iki blok (açık + koyu) eklemek gerekir.
 *
 * `swatch` yalnızca Ayarlar'daki önizleme kartı içindir; gerçek renkler CSS'ten
 * gelir, burası tek doğru kaynak DEĞİLDİR. Önizlemede iki ton yeterli: zemin
 * (kartın gövdesi) ve vurgu (seçili durumu anlatan renk).
 */
export const PALETTES = [
  {
    id: 'classic',
    name: 'Klasik',
    hint: 'Şu anki tema — lacivert kenar çubuğu, mavi vurgu',
    swatch: { light: ['#f8f9fb', '#2563eb', '#1e2046'], dark: ['#0d1117', '#3b82f6', '#12142c'] },
  },
  {
    id: 'pastel',
    name: 'Pastel',
    hint: 'Sıcak beyaz zemin, leylak vurgu — yumuşak ve sakin',
    swatch: { light: ['#fbf8f6', '#a17fc4', '#6d5b84'], dark: ['#17141c', '#c4a7e0', '#1d1826'] },
  },
  {
    id: 'soft',
    name: 'Soft',
    hint: 'Düşük kontrast, adaçayı yeşili — göz yormayan',
    swatch: { light: ['#f6f7f3', '#5b8c6e', '#2f4438'], dark: ['#10160f', '#7fb994', '#141d16'] },
  },
  {
    id: 'modern',
    name: 'Modern',
    hint: 'Yüksek kontrast, nötr gri, keskin mor vurgu',
    swatch: { light: ['#ffffff', '#7c3aed', '#09090b'], dark: ['#09090b', '#a78bfa', '#050506'] },
  },
  {
    id: 'okyanus',
    name: 'Okyanus',
    hint: 'Derin deniz mavisi, turkuaz vurgu — serin',
    swatch: { light: ['#f4f8fa', '#0e7490', '#123a4a'], dark: ['#0a1820', '#22d3ee', '#0c1f29'] },
  },
  {
    id: 'gunbatimi',
    name: 'Gün Batımı',
    hint: 'Sıcak kum zemin, mercan vurgu — canlı',
    swatch: { light: ['#fdf7f2', '#d1603d', '#58323a'], dark: ['#1c1310', '#f0845c', '#241419'] },
  },
];
