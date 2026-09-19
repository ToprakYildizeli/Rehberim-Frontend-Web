import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import s from './StudentPicker.module.css';

/** Türkçe harfleri ve büyük/küçük farkını yok sayarak karşılaştırma anahtarı:
 *  "Şükrü" "sukru" yazılınca da bulunsun. */
function fold(text) {
  return String(text ?? '')
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

const label = (st) => (st ? `${st.name}${st.grade ? ` · ${st.grade}` : ''}` : '');

/**
 * Aramalı öğrenci seçici (19 Eyl 2026).
 *
 * Native `<select>` otuz öğrencide kaydırarak aramaya dönüşüyordu. Kutuya ad
 * yazılır, eşleşenler altta listelenir; ok tuşları + Enter ya da tıklama ile
 * seçilir. Kapalıyken seçili öğrencinin adını gösterir.
 */
export default function StudentPicker({
  students, value, onChange, placeholder = 'Öğrenci ara…', disabled, className, ariaLabel,
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const listId = useId();

  const selected = students.find((st) => String(st.id) === String(value));
  const matches = useMemo(() => {
    const q = fold(query.trim());
    if (!q) return students;
    return students.filter((st) => fold(`${st.name} ${st.grade ?? ''}`).includes(q));
  }, [students, query]);

  useEffect(() => { setActive(0); }, [query, open]);

  // Klavyeyle gezilen satır görünür kalsın.
  useEffect(() => {
    if (!open) return;
    listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  function pick(st) {
    onChange(String(st.id));
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      setActive((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' || e.keyCode === 13) {
      if (open && matches[active]) {
        e.preventDefault();
        pick(matches[active]);
      }
    } else if (e.key === 'Escape') {
      if (open) {
        // Modal'ın Escape'i pencereyi kapatmasın; önce yalnız liste kapansın.
        e.stopPropagation();
        e.nativeEvent.stopImmediatePropagation?.();
        setOpen(false);
        setQuery('');
      }
    }
  }

  return (
    <div className={`${s.wrap} ${className ?? ''}`}>
      <span className={s.icon}>{open ? <Search size={14} /> : null}</span>
      <input
        ref={inputRef}
        className={`${s.input} ${open ? s.inputOpen : ''}`}
        value={open ? query : label(selected)}
        placeholder={open ? (label(selected) || placeholder) : (students.length ? placeholder : 'Henüz öğrenciniz yok')}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => { setOpen(false); setQuery(''); }}
        onKeyDown={onKeyDown}
        disabled={disabled || students.length === 0}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        autoComplete="off"
        spellCheck={false}
      />
      <ChevronDown size={15} className={s.chevron} aria-hidden />
      {open && (
        <ul className={s.list} id={listId} role="listbox" ref={listRef}>
          {matches.length === 0 ? (
            <li className={s.empty}>Eşleşen öğrenci yok</li>
          ) : matches.map((st, i) => (
            <li
              key={st.id}
              role="option"
              aria-selected={String(st.id) === String(value)}
              className={`${s.option} ${i === active ? s.optionActive : ''} ${String(st.id) === String(value) ? s.optionSelected : ''}`}
              // mousedown: input'un blur'u listeyi kapatmadan önce seçilsin.
              onMouseDown={(e) => { e.preventDefault(); pick(st); }}
              onMouseEnter={() => setActive(i)}
            >
              <span className={s.name}>{st.name}</span>
              {st.grade && <span className={s.grade}>{st.grade}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
