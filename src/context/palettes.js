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
    swatch: { light: ['#f8f9fb', '#2563eb', '#1e2046'], dark: ['#0d1117', '#3b82f6', '#12142c'] },
  },
  {
    id: 'pastel',
    name: 'Pastel',
    swatch: { light: ['#fbf8f6', '#a17fc4', '#6d5b84'], dark: ['#17141c', '#c4a7e0', '#1d1826'] },
  },
  {
    id: 'soft',
    name: 'Soft',
    swatch: { light: ['#f6f7f3', '#5b8c6e', '#2f4438'], dark: ['#10160f', '#7fb994', '#141d16'] },
  },
  {
    id: 'modern',
    name: 'Modern',
    swatch: { light: ['#ffffff', '#7c3aed', '#09090b'], dark: ['#09090b', '#a78bfa', '#050506'] },
  },
  {
    id: 'okyanus',
    name: 'Okyanus',
    swatch: { light: ['#f4f8fa', '#0e7490', '#123a4a'], dark: ['#0a1820', '#22d3ee', '#0c1f29'] },
  },
  {
    id: 'gunbatimi',
    name: 'Gün Batımı',
    swatch: { light: ['#fdf7f2', '#d1603d', '#58323a'], dark: ['#1c1310', '#f0845c', '#241419'] },
  },
];
