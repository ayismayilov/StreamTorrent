# StreamTorrent 0.2

macOS Apple Silicon ve Windows 11 x64 için torrent streaming uygulaması. Videoyu indirme tamamlanmadan harici oynatıcıda açar.

## Hazır sürümler

- **Mac ARM:** `release/mac-arm64/StreamTorrent.app`. Eski sürümü ⌘Q ile kapatın, yeni uygulamayı Applications klasörüne kopyalayıp açın. Torrentler ve ayarlar uygulama klasöründen ayrı saklanır.
- **Windows 11 x64:** `release/StreamTorrent-0.2.0-win-x64.zip`. ZIP’in tamamını kalıcı bir klasöre çıkarın ve içindeki `StreamTorrent.exe` dosyasını çalıştırın. EXE’yi diğer dosyalardan ayırmayın. Bu paket taşınabilir sürümdür, kurulum sihirbazı değildir.

Paketler geliştirme sürümüdür; dağıtım imzası/notarization içermez. Windows paketi bu Mac üzerinde üretildi ve dosya/mimari kontrollerinden geçti; Windows üzerinde canlı çalıştırma testi yapılmadı.

## Bu sürümde

- **Ayarlar → Dil:** Türkçe / English anında değişir ve sonraki açılışta korunur.
- **Varsayılan kayıt konumu:** Klasör seçiciyle değiştirilebilir. Yeni torrentlere uygulanır; mevcut torrentlerin klasörü değişmez.
- **Varsayılan harici oynatıcı:** VLC veya seçtiğiniz macOS `.app` / Windows `.exe` uygulaması. Karttaki oynatma düğmesi bu seçimi kullanır.
- **Oynatıcı Seç…:** Torrent menüsünden o video için farklı bir oynatıcı açar. Menüde ayrı IINA/mpv maddeleri bulunmaz; bunlar dosya seçiciden seçilebilir.
- **Sil:** Torrenti kütüphaneden kaldırır, indirilmiş dosyaları korur.
- **İndirilen Dosyalarla Birlikte Sil:** Torrentin dosyalarını ve kayıtlı torrent verisini kalıcı olarak siler. Karttaki Sil düğmesi bu seçeneği kullanır. İki işlemde de neyin silineceği onay penceresinde belirtilir; İptal hiçbir şey silmez.
- Kısa aktarım/buffer satırı; alt sırada indirme ilerlemesi, oynatma/duraklatma/silme, hızlar, eşler, kaynaklar ve kalan süre.
- Video içinden okunabilirse yıl, süre ve başlık; gömülü kapak veya videodan üretilen thumbnail. Yıl dosya adından ya da dosyanın oluşturulma tarihinden tahmin edilmez.
- **Aktarım limitleri:** İndirme ve yükleme için ayrı KiB/s limitleri. `0` sınırsızdır. Hemen uygulanır ve kalıcı saklanır.
- Kenar çubuğunda **Duraklatılanlar**; önceki Streaming kategorisi kaldırıldı.
- Magnet penceresi açılınca metin alanı odaklanır: macOS’ta ⌘V, Windows’ta Ctrl+V ile yapıştırabilirsiniz. Sağ üst X kaldırıldı; İptal veya Escape ile kapatılır.
- Alt bilgilendirme şeridi ve boş kütüphanenin ortasındaki ekleme düğmesi kaldırıldı. Üst araç çubuğundan torrent eklenir.

## Tarayıcıdaki magnet bağlantıları

Paketlenmiş uygulama ilk açılışta `magnet:` bağlantıları için kayıt olmayı dener. Gerekirse **Ayarlar → Magnet bağlantıları → StreamTorrent’i Kullan** düğmesini kullanın. Windows’ta uygulama klasörünü daha sonra taşırsanız tekrar kaydedin.

Chrome’daki bir magnet bağlantısı işletim sistemi üzerinden StreamTorrent’e iletilir. “Bu uygulama açılsın mı?” penceresi Chrome’un kendi onayıdır; daha önce “her zaman izin ver” seçilmişse veya tarayıcı/kurum politikası farklıysa tekrar görünmeyebilir. StreamTorrent bu tarayıcı kararını zorla değiştirmez. Başka torrent istemcileri varsayılan uygulamayı değiştirebilir.

## Buffer ve kaynak bilgisi

Buffer miktarı, seçili videodaki kesintisiz doğrulanmış byte sayısıdır. Oynatıcı HTTP isteği yaparken en son isteğin başlangıcına göredir. Süre okunabiliyorsa ortalama bitrate üzerinden **≈ dakika:saniye** tahmini ve GB miktarı gösterilir; süre okunamıyorsa zaman alanı `—` kalır. Bu değer VLC’nin gerçek oynatma konumu veya dahili arabelleği değildir. Değişken bitrate ve ileri sarma nedeniyle yaklaşık bir göstergedir.

Kaynaklar/Seeds, bağlı eşlerden torrentin tamamına sahip olanların sayısıdır; tüm swarm’daki tahmini tracker seed sayısı değildir. İndirme toplam ilerleme göstergesiyle video başlangıç buffer’ı birbirinden bağımsızdır.

## Silmenin kapsamı

Yalnızca torrent metadata’sında kayıtlı dosyalar kaldırılır. Varsayılan indirme klasörü ve ilgisiz dosyalar korunur; boş torrent alt klasörleri temizlenir. Diskte ayrı bir medya cache klasörü oluşturulmaz. Thumbnail ve probe işlemleri torrent kaldırılınca bellekten bırakılır; kalıcı oturum kaydı da silinir. Silme yarım kalırsa kalıcı silme işareti sonraki açılışta temizliğin tamamlanmasını sağlar; torrent tekrar indirilmeye başlanmaz. Aynı dosyayı kullanan başka bir kayıtlı torrent varsa silme engellenir.

## Geliştirme

Node 22.12+ ve pnpm 11:

```sh
pnpm install --frozen-lockfile
pnpm exec install-electron
pnpm dev
```

Platform medya araçlarını almak için `pnpm prepare:media`; doğrulanan kaynak paketler ve hash’ler `vendor/SOURCES.json` içindedir. WebTorrent motoru Electron main process’inde çalışır; renderer sandbox ve context isolation ile ayrılmıştır. Yerel HTTP sunucusu rastgele port/URL anahtarı kullanarak yalnızca 127.0.0.1’e bağlanır; GET/HEAD ve HTTP Range desteklenir. Medya probe istekleri oynatma istatistiğine dahil edilmez.

```sh
pnpm build
pnpm test
pnpm check:desktop
pnpm check:protocol
pnpm package:mac
pnpm package:win
```

Windows yerel ortamında NSIS kurulum dosyası istenirse `pnpm package:win:installer` komutu ayrıca mevcuttur; Mac üzerindeki NSIS denemesi başarısız olduğundan bu teslimatta Windows ZIP bulunur. Windows native node-datachannel dosyası upstream N-API 8 x64 sürümüyle `after-pack.cjs` tarafından değiştirilir; diğer bağımlılıkların Windows prebuild’leri korunur.

## Doğrulama

- Gerçek yerel torrentten indirme tamamlanmadan byte-range seek ve veri doğruluğu.
- Kalıcı dil/oynatıcı/kayıt klasörü/hız limitleri ve pause/resume.
- Dosyalı/dosyasız silme, iptal, ilgisiz dosyaları koruma, yol ve sembolik bağlantı kontrolleri.
- Gerçek videodan yıl/süre/thumbnail okuma; probe’un oynatma sayılmaması.
- Electron arayüzünde odak, menü sınırları, Türkçe ekranlar, ayarların yeniden açılışta korunması.
- Soğuk açılış magnet argümanı ve açık uygulamaya gelen magnet olayı; aynı torrentin iki kez eklenmemesi.
- Önceki VLC decoder kontrolünde toplam %3,3 indirmede yerel torrent stream’i oynatıldı.

`verification/` gerçek test ekran görüntülerini içerir. Testler kendi geçici indirme/oturum klasörlerini kullanır; kullanıcı torrentleriyle çalışmaz.

## Referanslar

- WebTorrent: https://webtorrent.io/docs
- Electron magnet/deep link yaşam döngüsü: https://www.electronjs.org/docs/latest/tutorial/launch-app-from-url-in-another-app
- FFprobe: https://ffmpeg.org/ffprobe.html

Bileşen ve medya araçlarının kaynak bilgileri `THIRD_PARTY_NOTICES.md` dosyasındadır.

## macOS application icon

The text-free icon source is `assets/icon-1024.png`. Run `pnpm icons:mac` on macOS to regenerate `assets/icon.iconset`, `assets/icon.icns`, and the UI/development Dock PNG. `build.mac.icon` packages the ICNS for Finder and Dock; development Electron sets its Dock icon explicitly. Run `pnpm package:mac` to rebuild the Apple Silicon application.
