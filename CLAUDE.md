# CLAUDE.md — Rehberim Rehber Web Arayüzü

Bu repo **yalnızca rehberin web arayüzünü** içerir (React + Vite). Genel çalışma
kurallarım için `~/.claude/CLAUDE.md` geçerlidir; burada bu repo'ya özgü olanlar var.

## Repo sınırları (kritik)

Üç ayrı repo var, **karıştırılmamalı**:

| Repo | İçerik | Sahip |
|---|---|---|
| `Rehberim-Backend` | Django 6 + DRF, tüm uçlar | Toprak |
| **`Rehberim-Frontend-Web`** (burası) | Rehber web arayüzü | Toprak |
| `Rehberim-Frontend` | Öğrenci + veli mobil (Flutter) | Yunus |

- Bu repo 3 Eylül 2026'da `Rehberim-Frontend/rehberim_koc`'tan `git subtree split`
  ile ayrıldı; geçmiş taşındı, `git blame` çalışır.
- **Yunus'un repo'suna dokunma.** Öğrenci/veli arayüzünde bir şey gerekiyorsa
  değişikliği backend'de yap ve `api-reference.md`'ye yaz; arayüzü o düzeltir.
- Push'tan önce doğru klasörde olduğunu `git remote -v` ile doğrula.

## Teknoloji

- React 19 + Vite · saf CSS Modules (`*.module.css`) · `lucide-react` ikonlar
- HTTP: axios (`src/api/client.js`) — JWT ekler, 401'de bir kez refresh dener
- Lint: `npx oxlint src` · Derleme: `npm run build`
- **CSS framework yok, state kütüphanesi yok.** Yeni bağımlılık eklemeden önce sor.

## Mimari kurallar

- **`src/api/` = backend uçlarının aynası.** Her modül bir uç ailesine karşılık
  gelir ve backend şeklini ekranın beklediği şekle burada çevirir; bileşenler ham
  API objesi görmez.
- **Katalog verisi backend'den gelir.** Ders, konu, çalışma türü, yayınevi, kitap:
  serbest metin ya da hardcoded liste değil, uçtan beslenen dropdown. Yeni bir alan
  eklerken önce "bunun backend kataloğu var mı?" diye bak.
- **Ekranlar birbirine bağlı.** Bir yerde girilen veri ilgili başka ekranda da
  görünmeli (takvimdeki toplantı → öğrenci kartında "sonraki toplantı").
- **Tema:** renkler `src/index.css`'teki CSS değişkenlerinden gelir; dört palet ×
  açık/koyu. Bileşende sabit renk yazma, `var(--...)` kullan. Palet yalnız karakter
  token'larını ezer — durum renkleri (başarı/uyarı/hata) ve ders renkleri sabittir.
- **Tasarım sistemi `src/components/ui/index.jsx`.** Yeni bir düğme/kart/alan
  gerekiyorsa önce oraya bak; yenisini yazmadan önce mevcut olanı genişlet.

## Arayüz metinleri

- Kullanıcı kararı (3 Eyl 2026): **"nasıl çalışır" açıklama kutuları yok.**
  Tanıtım ayrı bir tutorial'a bırakıldı. Ekranlarda yalnız işlevsel metin kalır:
  hata mesajları, geri alınamaz işlem uyarıları, dosya biçimi/boyutu gibi girdi
  kısıtları ve boş durum satırları (kuyruğa açıklama ekleme).
- Metinler Türkçe. Türkçe harf tuzağına dikkat: JS'te `/iptal/i` `'İptal'`i
  bulmaz — tam metinle eşleştir.

## Doğrulama

- **Arayüz testini kullanıcı kendisi yapıyor** (isteği, 3 Eyl 2026). Playwright
  ile tarayıcı turu atma, ekran görüntüsü toplama. `npm run build` + `npx oxlint src`
  yeterli; gerisini o söyler.
- Dev sunucusu genelde kullanıcıda zaten açık (`localhost:5173`). Yeni bir tane
  başlatmadan önce portun boş olduğuna bak.

## Git

- Commit mesajlarında **`feat:`/`fix:` gibi ön ek yok** — Türkçe, emir kipinde,
  ne yapıldığını söyleyen tek satır + gerekçeyi anlatan gövde.
- Tek author; `Co-Authored-By` satırı ekleme.
- **Sormadan push etme.** İş bitince commit'te bırak.

## Backend'le sözleşme

Bağlanılan her uç `Rehberim-Backend/docs/api-reference.md`'de belgelidir; alan
adları ve yanıt şekli için orası esastır. Bir uçta değişiklik gerekiyorsa önce
backend'de sözleşme güncellenir, sonra buraya bağlanılır.
