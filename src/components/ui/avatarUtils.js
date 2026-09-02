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
