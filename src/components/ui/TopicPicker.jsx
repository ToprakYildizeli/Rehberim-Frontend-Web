import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import s from './TopicPicker.module.css';

/* İki düzeyli konu seçici.
 *
 * Katalog 22 Ekim 2026'da iki düzeye çıktı: "Problemler" tek başına da
 * seçilebiliyor, altındaki "Yaş Problemleri" de. Rehberin isteği buydu
 * ("hem problemler olsun hem ayrı olsun"), yani alt konular şemsiyenin
 * YERİNE geçmiyor — ikisi de seçilebilir olmalı.
 *
 * Yerleşik `<select>` bunu çizemiyor: menüyü işletim sistemi çiziyor ve
 * içine hover ile açılan bir alt menü konulamıyor. `<optgroup>` de olmuyor,
 * çünkü optgroup etiketi seçilemez ve şemsiye seçeneği kaybolurdu.
 *
 * Seçilen değer konunun **adı**dır, id'si değil: `Task.title` düz metin.
 */

/** Alt menünün genişliği. Konum hesabı buna dayandığı için genişlik CSS'te
 *  DEĞİL burada: ikisi ayrışırsa sola açılan menü panele bitişik durmaz,
 *  aradaki fark kadar boşluk ya da örtüşme oluşur. */
const SUBMENU_W = 220;

/** Seçilen alt konunun saklanacak/gösterilecek adı: "Problemler (Yaş)".
 *
 *  Alt konu adları tek başına anlamsız olabiliyor — "Yaş", "Alan", "Hareket"
 *  hangi konunun altı olduğunu söylemiyor. Değer `Task.title` olarak düz
 *  metin saklandığı için nitelemeyi SEÇİM anında yapmak, üç istemcinin de
 *  katalogla eşleştirme yapmasından basit ve sağlam. */
function secimAdi(ad, ustAd) {
  return ustAd ? `${ustAd} (${ad})` : ad;
}

export default function TopicPicker({
  value = '',
  onChange,
  topics = [],
  placeholder = 'Konu seçin (opsiyonel)',
  emptyLabel = 'Konu yok',
  /* Seçimi temizleyen ilk satır. Yerleşik `<select>`te bunu boş `<option>`
     yapıyordu; özel panelde karşılığı olmazsa rehber seçtiği konuyu geri
     alamazdı. Aramada gizlenir, orada aranan şey bir konudur. */
  clearLabel = 'Konu yok',
  disabled = false,
  id,
  className,
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [submenu, setSubmenu] = useState(null);  // { id, top, left }
  const wrapRef = useRef(null);
  const panelRef = useRef(null);
  const listRef = useRef(null);
  const kapatmaZamani = useRef(null);

  const kapat = useCallback(() => {
    setOpen(false);
    setFilter('');
    setSubmenu(null);
  }, []);

  // Dışarı tıklama ve Escape paneli kapatır.
  useEffect(() => {
    if (!open) return undefined;
    const tiklama = (e) => {
      // Alt menü `fixed` ve panelin DIŞINDA duruyor; onu da kendimizden say.
      if (e.target.closest?.(`.${s.submenu}`)) return;
      if (!wrapRef.current?.contains(e.target)) kapat();
    };
    document.addEventListener('mousedown', tiklama);
    return () => document.removeEventListener('mousedown', tiklama);
  }, [open, kapat]);

  // Panel içi kaydırmada alt menü satırdan kopardı; kapatmak en dürüstü.
  useEffect(() => {
    if (!submenu) return undefined;
    const kaydirma = () => setSubmenu(null);
    const liste = listRef.current;
    liste?.addEventListener('scroll', kaydirma);
    window.addEventListener('scroll', kaydirma, true);
    return () => {
      liste?.removeEventListener('scroll', kaydirma);
      window.removeEventListener('scroll', kaydirma, true);
    };
  }, [submenu]);

  useEffect(() => () => clearTimeout(kapatmaZamani.current), []);

  const arama = filter.trim().toLocaleLowerCase('tr-TR');
  const esler = useCallback(
    (ad) => ad.toLocaleLowerCase('tr-TR').includes(arama),
    [arama],
  );

  /* Arama varken hiyerarşi düzleşiyor: eşleşen şemsiyeler ve eşleşen alt
     konular tek listede. Süzgeçliyken hover alt menüsü açmak, aradığın şeyi
     bir adım daha uzağa koyardı. */
  const satirlar = useMemo(() => {
    if (!arama) return topics.map((t) => ({ konu: t, cocuk: false }));
    const out = [];
    for (const t of topics) {
      const cocuklar = (t.children || []).filter((c) => esler(c.name));
      if (esler(t.name)) out.push({ konu: t, cocuk: false });
      for (const c of cocuklar) out.push({ konu: c, cocuk: true, ust: t.name });
    }
    return out;
  }, [topics, arama, esler]);

  function sec(ad) {
    onChange?.(ad);
    kapat();
  }

  function altMenuyuAc(satirEl, konuId) {
    if (!satirEl) return;
    const r = satirEl.getBoundingClientRect();
    /* Yatayda SATIRA değil PANELE göre hizalanıyor: iki liste bitişik dursun,
       aralarında panelin iç boşluğu kadar bir açıklık kalmasın. 1px örtüşme
       iki kenarlığı tek çizgide birleştiriyor. */
    const panel = panelRef.current?.getBoundingClientRect();
    const sol = (panel?.left ?? r.left) - SUBMENU_W + 1;
    const sag = (panel?.right ?? r.right) - 1;
    // Varsayılan SOL; solda yer yoksa sağa düşer.
    const sagda = sol < 8;
    setSubmenu({
      id: konuId,
      // Dikeyde satıra hizalı kalıyor ki hangi şemsiyeye ait olduğu okunsun.
      top: Math.max(8, Math.min(r.top, window.innerHeight - 290)),
      left: sagda ? sag : sol,
      sagda,
    });
  }

  const acikKonu = submenu ? topics.find((t) => t.id === submenu.id) : null;

  function tusa(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (submenu) setSubmenu(null);
      else kapat();
    }
  }

  return (
    <div className={[s.wrap, className].filter(Boolean).join(' ')} ref={wrapRef}>
      <button
        type="button"
        id={id}
        className={s.trigger}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? kapat() : setOpen(true))}
      >
        <span className={[s.triggerText, value ? '' : s.placeholder].filter(Boolean).join(' ')}>
          {value || placeholder}
        </span>
        <ChevronDown size={15} className={s.chevron} />
      </button>

      {open && (
        <div className={s.panel} ref={panelRef} onKeyDown={tusa}>
          <div className={s.search}>
            {/* Yerleşik `<select>`in yazarak bulma davranışı kayboluyordu;
                bir dersin kataloğu kolayca elli satırı geçiyor. */}
            <input
              type="search"
              className={s.searchInput}
              placeholder="Konu ara"
              value={filter}
              onChange={(e) => { setFilter(e.target.value); setSubmenu(null); }}
              autoFocus
            />
          </div>

          <ul className={s.list} ref={listRef} role="listbox">
            {!arama && clearLabel && (
              <li className={s.row}>
                <button
                  type="button"
                  role="option"
                  aria-selected={!value}
                  data-selected={!value}
                  className={s.option}
                  onMouseEnter={() => setSubmenu(null)}
                  onClick={() => sec('')}
                >
                  {clearLabel}
                </button>
              </li>
            )}
            {satirlar.length === 0 && <li className={s.empty}>{emptyLabel}</li>}

            {satirlar.map(({ konu, cocuk, ust }) => {
              const cocuklu = !cocuk && (konu.children || []).length > 0;
              const acik = submenu?.id === konu.id;
              return (
                <li
                  key={konu.id}
                  className={s.row}
                  onMouseEnter={(e) => {
                    clearTimeout(kapatmaZamani.current);
                    if (cocuklu) altMenuyuAc(e.currentTarget, konu.id);
                    else setSubmenu(null);
                  }}
                  onMouseLeave={() => {
                    // Fareyle çapraz gidiş alt menüye varana dek kapanmasın.
                    clearTimeout(kapatmaZamani.current);
                    kapatmaZamani.current = setTimeout(() => setSubmenu(null), 180);
                  }}
                >
                  <button
                    type="button"
                    role="option"
                    aria-selected={secimAdi(konu.name, cocuk ? ust : null) === value}
                    data-selected={secimAdi(konu.name, cocuk ? ust : null) === value}
                    /* Alt menü açıkken şemsiye vurgulu kalsın: fare alt
                       listeye geçtiğinde hangi başlığa ait olduğu kaybolmasın. */
                    data-active={acik || undefined}
                    className={[s.option, cocuk ? s.child : '', cocuklu ? s.umbrella : '']
                      .filter(Boolean).join(' ')}
                    onClick={() => sec(secimAdi(konu.name, cocuk ? ust : null))}
                  >
                    {konu.name}
                  </button>

                  {cocuklu && (
                    <button
                      type="button"
                      className={s.expander}
                      data-open={acik}
                      aria-label={`${konu.name} alt konuları`}
                      aria-expanded={acik}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (acik) setSubmenu(null);
                        else altMenuyuAc(e.currentTarget.closest('li'), konu.id);
                      }}
                    >
                      {acik && submenu?.sagda
                        ? <ChevronRight size={15} />
                        : <ChevronLeft size={15} />}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {open && submenu && acikKonu && (
        <ul
          className={s.submenu}
          /* Panele bakan köşeler düzleşsin: iki liste tek yüzey gibi okunsun. */
          data-side={submenu.sagda ? 'sag' : 'sol'}
          style={{ top: submenu.top, left: submenu.left, width: SUBMENU_W }}
          onMouseEnter={() => clearTimeout(kapatmaZamani.current)}
          onMouseLeave={() => setSubmenu(null)}
        >
          {acikKonu.children.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                role="option"
                aria-selected={secimAdi(c.name, acikKonu.name) === value}
                data-selected={secimAdi(c.name, acikKonu.name) === value}
                className={s.option}
                onClick={() => sec(secimAdi(c.name, acikKonu.name))}
              >
                {c.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
