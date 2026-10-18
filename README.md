# Velora Flowers

Mobil uyumlu, kurulabilir çiçek mağazası arayüzü ve ayrı yönetim paneli. Ürünler, fiyatlar, stok, siparişler ve onaylı yorumlar Supabase'den gelir; uygulama sahte ürün veya yorum göstermez.

## Supabase bağlantısı

1. Bir Supabase projesi oluşturun.
2. Supabase **SQL Editor**'da `schema.sql` dosyasının tamamını çalıştırın.
3. Supabase **Project Settings → API** sayfasındaki Project URL ve `anon`/publishable key değerlerini `supabase-config.js` içindeki boş alanlara ekleyin. `service_role` anahtarını asla tarayıcıya koymayın.
4. Uygulama üzerinden `/account.html` sayfasında hesap oluşturun ve e-posta doğrulamasını tamamlayın.
5. Bağımsız yönetim sitesi `/Users/besir/velora-admin` klasöründedir; onu mağaza sitesinden ayrı bir URL/hosting hedefine dağıtın. Panel klasöründe `supabase-config.js` oluşturup aynı Supabase URL/anon anahtarını girin. Supabase SQL Editor'da profil tablosundan yalnızca sizin kullanıcı UUID'nizi yönetici yapın:

   ```sql
   update public.profiles set role = 'admin' where id = 'AUTH_USER_UUID';
   ```

   UUID'yi Supabase **Authentication → Users** sayfasından alın.
6. `schema.sql`'deki `place_order` fonksiyonu ürün fiyatlarını veritabanından alır ve sipariş toplamını sunucu tarafında hesaplar. RLS politikaları müşteri siparişlerini ve yönetici işlemlerini ayırır.

## Yerelde açma

ES modülleri ve Supabase istemcisi için bir statik HTTP sunucusu kullanın:

```sh
cd /Users/besir/web
ruby -run -e httpd . -p 8000 -b 127.0.0.1
```

Ardından `http://localhost:8000` adresini açın. `file://` üzerinden açmayın. Proje URL/anahtarı girilmeden ürün listesi ve hesap/sipariş işlemleri etkin olmaz; sahte veri yerine bağlantı uyarısı gösterilir.

## Sayfalar

- `index.html` — mağaza ana sayfası
- `categories.html` — kategori filtreli koleksiyon
- `product.html?id=...` — ürün açıklaması, yorumları ve sepete ekleme
- `cart.html` — sepet ve giriş gerektiren sipariş oluşturma
- `account.html` — kayıt, giriş ve sipariş geçmişi
- `search.html` — ürün adı, açıklama ve kategori araması
- `settings.html` — hesap, görünüm ve bildirim tercihleri

Bağımsız yönetim sitesi için `../velora-admin/README.md` dosyasına bakın.

Uygulama PWA manifesti ve çevrimdışı sayfa kabuğu içerir; güvenli sunucudan açıldığında telefona yüklenebilir. Canlı Supabase verileri çevrimdışı gösterilmez. Bu klasör Git'e gönderilmedi ve yayınlama hesabına bağlanmadı.
