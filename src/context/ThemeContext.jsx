import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { PALETTES } from './palettes';

const ThemeContext = createContext(null);

const PALETTE_IDS = PALETTES.map((p) => p.id);
const DEFAULT_PALETTE = 'classic';

/** Kayıtlı değer silinmiş/bozulmuşsa varsayılana düş — geçersiz bir id
 *  `data-palette`'e yazılırsa hiçbir CSS bloğu tutmaz ve tema yarı bozuk görünür. */
function readPalette() {
  const stored = localStorage.getItem('palette');
  return PALETTE_IDS.includes(stored) ? stored : DEFAULT_PALETTE;
}

function readTheme() {
  const stored = localStorage.getItem('theme');
  return stored === 'light' || stored === 'dark' ? stored : 'light';
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(readTheme);
  const [palette, setPaletteState] = useState(readPalette);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-palette', palette);
    localStorage.setItem('palette', palette);
  }, [palette]);

  const toggle = useCallback(() => setTheme((t) => (t === 'light' ? 'dark' : 'light')), []);

  const setPalette = useCallback((id) => {
    if (PALETTE_IDS.includes(id)) setPaletteState(id);
  }, []);

  const value = useMemo(
    () => ({ theme, setTheme, toggle, palette, setPalette, palettes: PALETTES }),
    [theme, toggle, palette, setPalette]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
