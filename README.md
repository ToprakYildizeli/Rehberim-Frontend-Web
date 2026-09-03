# Rehberim — Rehber Web Arayüzü

Rehberin (koç/danışman) kullandığı web uygulaması. React + Vite. Backend'e
`/api/` üzerinden bağlanır; tek başına anlamlı değildir, önce backend çalışmalıdır.

> Web **yalnızca rehber** içindir. Öğrenci ve veli mobil uygulamalarını kullanır
> (Flutter, ayrı repo: [`Rehberim-Frontend`](https://github.com/YunusCelik21/Rehberim-Frontend)).

## Repo'lar

| Repo | İçerik | Sahip |
|---|---|---|
| [`Rehberim-Backend`](https://github.com/ToprakYildizeli/Rehberim-Backend) | Django 6 + DRF, tüm uçlar | Toprak |
| **`Rehberim-Frontend-Web`** (bu repo) | Rehber web arayüzü (React) | Toprak |
| [`Rehberim-Frontend`](https://github.com/YunusCelik21/Rehberim-Frontend) | Öğrenci + veli mobil (Flutter) | Yunus |

Bu repo 3 Eylül 2026'da `Rehberim-Frontend/rehberim_koc` klasöründen ayrıldı;
geçmişi `git subtree split` ile taşındığı için `git log` ve `git blame` çalışır.

## Çalıştırma

Node 18+ gerekir.

```bash
cp .env.example .env      # VITE_API_BASE_URL hazır gelir
npm install
npm run dev               # → http://localhost:5173/
npm run build             # prod derleme → dist/
npx oxlint src            # lint
```

Backend adresi `.env` içindeki `VITE_API_BASE_URL` ile ayarlanır (varsayılan
`http://127.0.0.1:8000/api`). **Koda gömülü adres yok.**

Backend'in CORS listesinde `localhost:5173` ve `localhost:3000` var; başka bir
portta çalıştırırsan backend `settings.py`'daki `CORS_ALLOWED_ORIGINS`'e eklemen
gerekir.

## Ekranlar

| Rota | Ne yapar |
|---|---|
| `/panel` | Özet kutuları, net grafiği, uyarı kartları, kıyaslama — hepsi gerçek veriden türetilir. Hangi bölümün görüneceği Ayarlar'dan seçilir |
| `/ogrenciler` | Öğrenci listesi + rehberin **davet kodu** (öğrenci bununla bağlanır) |
| `/ogrenciler/:id` | Öğrenci detayı — Kitaplar · Denemeler · Ders Programı (geçmiş dahil) · Konu Takibi · Başarımlar |
| `/ders-programi` | Haftalık program tahtası: sürükle-bırak bloklar, şablon kaydetme, öğrenciye atama, **rutin** |
| `/takvim` | Görüşme, veli toplantısı ve sınav takvimi |
| `/ayarlar` | Profil + fotoğraf · rehberlik (öğrenciler, veli davetleri, başarımlar, kataloglar) · tercihler · tema · hesap (.ics aktarımı, hesap silme) |

## Yapı

```
src/
├── api/            # backend uçlarına karşılık gelen modüller (client.js = axios + JWT)
├── components/     # ui/ (tasarım sistemi), layout/, dashboard/, settings/
├── context/        # AuthContext (oturum), ThemeContext (tema + palet)
├── pages/          # yukarıdaki ekranlar
└── mocks/data.js   # tahtanın sabitleri (SUBJECTS, DAYS, HOURS) — mock veri DEĞİL
```

**`api/client.js`** her isteğe JWT ekler ve 401'de refresh token ile bir kez yeniden
dener; refresh de geçersizse oturumu kapatıp `/giris`'e atar.

## Kurallar

- **Katalog verisi backend'den gelir.** Ders, konu, çalışma metodu, yayınevi ve
  kitap seçimleri serbest metin değil, ilgili uçtan beslenen listelerdir
  (`/api/subjects/`, `/api/topics/?subject=`, `/api/task-types/`, `/api/publishers/`,
  `/api/books/?student=`). Konu ve yayınevi PDF'leri referanstır — koda gömülmez.
- **Ekranlar birbirine bağlıdır.** Takvimde açılan bir toplantı, Öğrenciler
  kartında "sonraki toplantı" olarak görünmelidir.
- **Uç ya da alan adı değişecekse önce backend'deki sözleşme güncellenir.**
  Bağlanacağın uçların tam listesi: `Rehberim-Backend/docs/api-reference.md`.

## Backend belgeleri

Bu arayüzün bağlandığı her şey backend repo'sunda belgelidir:

| Dosya | İçerik |
|---|---|
| `docs/api-reference.md` | **Tüm uçlar** — URL, rol, sorgu, gövde, yanıtın tam alan listesi |
| `docs/roadmap.md` | Güncel yol haritası ve alınmış kararlar |
| `docs/auth-contract.md` | Giriş, kayıt, profil, şifre, hesap silme, profil fotoğrafı |
| `docs/program-contract.md` | Program, görev, şablon, rutin, onay, uyum |
| `docs/exam-contract.md` · `library-contract.md` · `topics-contract.md` · `goals-calendar-contract.md` · `achievements-contract.md` | İlgili alanlar |
