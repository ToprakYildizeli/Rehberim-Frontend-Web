/** Hesap silme sayfasının uygulamaya göre değişen içeriği.
 *
 *  **Neden uygulama başına ayrı adres:** Google Play'in silme adresi her
 *  uygulamanın kendi Data safety formuna yazılıyor ve incelemeci sayfada
 *  **o uygulamanın adını** görmek istiyor. Tek bir genel sayfa "bu adres
 *  hangi uygulamaya ait" sorusunu açık bırakırdı.
 *
 *  Yeni bir uygulama çıktığında buraya bir blok eklemek yeterli; sayfanın
 *  kendisi (`HesapSilme.jsx`) değişmiyor.
 *
 *  Alanlar Google Data safety formundaki başlıklarla hizalı tutuldu:
 *  toplanan veri türleri, silinenler, silinmeyip saklananlar ve süreleri.
 *  Formda yazan ile sayfada yazan **birbirini tutmalı**; tutmazsa yayın
 *  sonrası kaldırma sebebi.
 */

/** Mağazalarda görünen geliştirici adı. Sayfada da aynısı yazmalı. */
export const GELISTIRICI = 'Rehberim Apps';

/** Yedeklerin saklama süresi — `Rehberim-Backend/docs/kvkk.md` §3. */
export const YEDEK_GUN = 30;

/** Hiçbir istemcide toplanmayan veri türleri.
 *
 *  Data safety formunda "toplanmıyor" işaretlenecek kalemler. Doğrulandı
 *  (29 Eyl 2026): iki uygulamanın da bağımlılık listesinde konum, analitik,
 *  reklam ya da görsel seçici paketi yok; profil fotoğrafı yükleme arayüzü
 *  hiçbir mobil ekranda bulunmuyor. */
export const TOPLANMAYAN = [
  'Konum bilgisi',
  'Profil fotoğrafı veya herhangi bir görsel',
  'Rehber / kişi listesi',
  'Reklam kimliği ve izleme verisi',
  'Ödeme bilgisi',
];

const ORTAK_SAKLANAN = [
  `Sistem yedeklerindeki kopyalar en fazla ${YEDEK_GUN} gün içinde döngüyle birlikte düşer.`,
];

export const UYGULAMALAR = {
  ogrenci: {
    slug: 'ogrenci',
    ad: 'Rehberim Öğrenci',
    platform: 'Android ve iOS',
    kimIcin: 'Öğrenci hesapları',
    toplanan: [
      'Ad, soyad, kullanıcı adı ve e-posta adresi',
      'Haftalık çalışma programı ve görevler',
      'Deneme sonuçları, netler ve ders kırılımı',
      'Konu ilerlemesi ve kazanım seviyeleri',
      'Kitaplık kayıtları ve hedefler',
      'Takvim etkinlikleri',
      'KVKK onay kayıtları',
    ],
    silinen: [
      'Hesabınız, kullanıcı adınız ve giriş bilgileriniz',
      'Ad, soyad ve e-posta adresiniz',
      'Haftalık programlarınız ve tüm görevleriniz',
      'Deneme sonuçlarınız ve netleriniz',
      'Konu ilerlemeniz',
      'Kitaplığınız ve hedefleriniz',
      'Takvim etkinlikleriniz',
      'KVKK onay kayıtlarınız',
    ],
    etkilenmeyen: [
      'Rehber öğretmeninizin hesabı — yalnızca aranızdaki bağ kopar.',
    ],
    saklanan: ORTAK_SAKLANAN,
  },

  veli: {
    slug: 'veli',
    ad: 'Rehberim Veli',
    platform: 'Android ve iOS',
    kimIcin: 'Veli hesapları',
    toplanan: [
      'Ad, soyad, kullanıcı adı ve e-posta adresi',
      'Bağlı olduğunuz öğrenci bilgisi',
      'KVKK onay kayıtları (çocuğunuz için verdiğiniz veli onayı dâhil)',
    ],
    silinen: [
      'Hesabınız, kullanıcı adınız ve giriş bilgileriniz',
      'Ad, soyad ve e-posta adresiniz',
      'KVKK onay kayıtlarınız',
    ],
    etkilenmeyen: [
      'Çocuğunuzun hesabı ve tüm verileri — yalnızca sizinle olan bağ kopar.',
      'Çocuğunuzun rehber öğretmeniyle ilişkisi.',
    ],
    saklanan: [
      ...ORTAK_SAKLANAN,
      'Daha önce kullanılmış veli davet kodu kaydı 90 gün saklanır; '
        + 'kod tek kullanımlıktır ve kimlik bilgisi taşımaz.',
    ],
  },
};

/** Adres çubuğundaki değerden uygulama seçer. Bilinmeyen değer → null. */
export function uygulamaBul(slug) {
  return UYGULAMALAR[slug] ?? null;
}
