import type { Language } from "./shared";
const turkish: Record<string, string> = {
  "Paused torrents": "Duraklatılanlar",
  "Default external player": "Varsayılan harici oynatıcı",
  "Choose Player…": "Oynatıcı Seç…",
  Applications: "Uygulamalar",
  "Select an application": "Bir uygulama seçin",
  "Player not found. Choose a player in Settings.":
    "Oynatıcı bulunamadı. Ayarlardan bir oynatıcı seçin.",
  "Transfer limits": "Aktarım limitleri",
  "Download limit": "İndirme limiti",
  "Upload limit": "Yükleme limiti",
  "0 = unlimited. Applies immediately to all torrents.":
    "0 = sınırsız. Tüm torrentlere hemen uygulanır.",
  Apply: "Uygula",
  Unlimited: "Sınırsız",
  Limits: "Limitler",
  "Invalid speed limit": "Geçersiz hız limiti",
  "Magnet links": "Magnet bağlantıları",
  "StreamTorrent handles magnet links.":
    "Magnet bağlantıları StreamTorrent ile açılıyor.",
  "Open website magnet links with StreamTorrent.":
    "Sitelerdeki magnet bağlantılarını StreamTorrent ile açın.",
  "Use StreamTorrent": "StreamTorrent’i Kullan",
  "Could not register magnet links. Run the packaged application.":
    "Magnet bağlantıları kaydedilemedi. Paketlenmiş uygulamayı çalıştırın.",
  "Remove Torrent": "Sil",
  "Delete Torrent and Files": "İndirilen Dosyalarla Birlikte Sil",
  "Remove this torrent from the library?":
    "Bu torrent kütüphaneden kaldırılsın mı?",
  "Delete this torrent and its downloaded files?":
    "Torrent ve indirilen dosyaları silinsin mi?",
  "Downloaded files and saved torrent data will be permanently deleted.":
    "İndirilen dosyalar ve kayıtlı torrent verileri kalıcı olarak silinecek.",
  "Downloaded files will be kept.": "İndirilen dosyalar korunacak.",
  "Pause Torrent": "Torrenti Duraklat",
  "Video thumbnail": "Video önizlemesi",
  min: "dk",
  Buffer: "Arabellek",
  Seeds: "Kaynaklar",
  "Connected peers with the complete torrent":
    "Torrentin tamamına sahip bağlı eşler",
  "Estimated from verified bytes and average video bitrate; not the player’s playback clock.":
    "Doğrulanmış veri ve ortalama video hızından tahmin edilir; oynatıcının gerçek izleme zamanı değildir.",
  "All Torrents": "Tüm Torrentler",
  Downloading: "İndiriliyor",
  Streaming: "Aktarılıyor",
  Completed: "Tamamlananlar",
  LIBRARY: "KÜTÜPHANE",
  Settings: "Ayarlar",
  "Active Torrents": "Aktif Torrent",
  "Search torrents": "Torrent ara",
  "Add Magnet": "Magnet Ekle",
  "Add Torrent": "Torrent Ekle",
  Peers: "Eşler",
  Connected: "Bağlı",
  "Connecting…": "Bağlanıyor…",
  "Dismiss error": "Hatayı kapat",
  "No matching torrents": "Eşleşen torrent yok",
  "Your library starts here": "Kütüphaneniz burada başlıyor",
  "Try another search or library filter.":
    "Başka bir arama veya kütüphane filtresi deneyin.",
  "Add a magnet link or .torrent file. Start watching while it downloads.":
    "Magnet bağlantısı veya .torrent dosyası ekleyin. İndirme sürerken izlemeye başlayın.",
  "Add your first torrent": "İlk torrentinizi ekleyin",
  "Playback unlocks when the initial video buffer is ready, independently of download percentage.":
    "Oynatma, indirme yüzdesinden bağımsız olarak başlangıç video arabelleği hazır olduğunda açılır.",
  "Add Magnet Link": "Magnet Bağlantısı Ekle",
  "Close dialog": "Pencereyi kapat",
  "Magnet link": "Magnet bağlantısı",
  "Paste magnet link...": "Magnet bağlantısını yapıştırın...",
  Cancel: "İptal",
  "Adding…": "Ekleniyor…",
  Language: "Dil",
  "Default save path": "Varsayılan kayıt konumu",
  "Open Folder": "Klasörü Aç",
  "Choose Folder…": "Klasör Seç…",
  "Applies to new torrents. Existing downloads keep their current folder.":
    "Yeni torrentlere uygulanır. Mevcut indirmeler şu anki klasörlerinde kalır.",
  "External players": "Harici oynatıcılar",
  "Install VLC or IINA as a macOS application. mpv also supports a Homebrew installation. Select a player from the torrent’s ••• menu.":
    "VLC veya IINA’yı macOS uygulaması olarak kurun. mpv için Homebrew kurulumu da desteklenir. Oynatıcıyı torrentin ••• menüsünden seçin.",
  "Buffer measurement": "Arabellek ölçümü",
  "Verified contiguous bytes from the latest HTTP request, or the start of the video. This is not the player’s playback buffer.":
    "Son HTTP isteğinden veya videonun başlangıcından itibaren kesintisiz doğrulanmış veridir. Oynatıcının kendi arabelleğini göstermez.",
  Error: "Hata",
  Paused: "Duraklatıldı",
  Metadata: "Üst veri",
  "Ready to Play": "Oynatmaya Hazır",
  "No Peers": "Eş Yok",
  Buffering: "Arabellek Doluyor",
  Download: "İndirme",
  Downloaded: "İndirilen",
  "Download progress": "İndirme ilerlemesi",
  ETA: "Kalan",
  Done: "Tamamlandı",
  "Torrent paused": "Torrent duraklatıldı",
  "Ready to play": "Oynatmaya hazır",
  "No supported video in this torrent": "Bu torrentte desteklenen video yok",
  "Preparing video…": "Video hazırlanıyor…",
  "Playback can continue while downloading":
    "İndirme sürerken oynatma devam edebilir",
  "Initial video data is available": "Başlangıç video verisi hazır",
  "Resume to continue downloading": "İndirmeyi sürdürmek için devam edin",
  "Video buffer is separate from total download progress":
    "Video arabelleği toplam indirme ilerlemesinden ayrıdır",
  "At last stream request": "Son aktarım isteğinde",
  "Initial buffer": "Başlangıç arabelleği",
  "Open in VLC": "VLC’de Aç",
  Pause: "Duraklat",
  Resume: "Devam Et",
  "Copy Stream URL": "Yayın Adresini Kopyala",
  "Copy Magnet Link": "Magnet Bağlantısını Kopyala",
  "Reveal in Finder": "Finder’da Göster",
  "Open Download Folder": "İndirme Klasörünü Aç",
  Delete: "Sil",
  "Deletes downloaded files and torrent data permanently.":
    "İndirilen dosyaları ve torrent verilerini kalıcı olarak siler.",
  "Video file": "Video dosyası",
  "More actions": "Diğer işlemler",
  "external player": "harici oynatıcı",
  "Serving to": "Aktarılıyor:",
  "Open in": "Şununla Aç:",
  "Fetching torrent metadata…": "Torrent üst verisi alınıyor…",
  "Paused torrent": "Duraklatılmış torrent",
  "Paste a valid magnet link": "Geçerli bir magnet bağlantısı yapıştırın",
  "Magnet link is too long": "Magnet bağlantısı çok uzun",
  "A BitTorrent v1 magnet link (btih) is required":
    "BitTorrent v1 (btih) magnet bağlantısı gerekli",
  "Torrent no longer exists": "Torrent artık mevcut değil",
  "Select a video file": "Bir video dosyası seçin",
  "Wait for the initial video buffer":
    "Başlangıç video arabelleğinin dolmasını bekleyin",
  "No video available": "Video bulunamadı",
  "Resume torrent and wait for metadata":
    "Torrenti devam ettirin ve üst verinin gelmesini bekleyin",
  "Invalid magnet": "Geçersiz magnet bağlantısı",
  "Torrent metadata exceeds 10 MB": "Torrent üst verisi 10 MB sınırını aşıyor",
  "Torrent files": "Torrent dosyaları",
  "Choose download folder": "İndirme klasörü seçin",
  "Invalid language": "Geçersiz dil",
  "Deletion in progress": "Silme işlemi sürüyor",
  "Cannot delete a file used by another torrent":
    "Başka bir torrentin kullandığı dosya silinemez",
  "Unsafe download file path": "Güvenli olmayan indirme dosyası yolu",
  "Symbolic links in download folders cannot be deleted automatically":
    "İndirme klasörlerindeki sembolik bağlantılar otomatik olarak silinemez",
  "Open the desktop app to connect to the torrent engine.":
    "Torrent motoruna bağlanmak için masaüstü uygulamasını açın.",
  "About StreamTorrent": "StreamTorrent Hakkında",
  "Hide StreamTorrent": "StreamTorrent’i Gizle",
  "Quit StreamTorrent": "StreamTorrent’ten Çık",
  Edit: "Düzen",
  Undo: "Geri Al",
  Redo: "Yinele",
  Cut: "Kes",
  Copy: "Kopyala",
  Paste: "Yapıştır",
  "Select All": "Tümünü Seç",
  View: "Görünüm",
  Reload: "Yenile",
  "Toggle Full Screen": "Tam Ekranı Değiştir",
  Window: "Pencere",
  Minimize: "Simge Durumuna Küçült",
  Zoom: "Yakınlaştır",
};
export function translate(language: Language, text: string): string {
  return language === "tr" ? (turkish[text] ?? text) : text;
}
export function translateError(language: Language, value: string): string {
  const clean = value
    .replace(/^Error: /, "")
    .replace(/^Error invoking remote method '[^']+': Error: /, "");
  const translated = translate(language, clean);
  if (translated !== clean || language === "en") return translated;
  const player = /^(VLC|IINA|mpv) could not be opened\./.exec(clean);
  if (player)
    return `${player[1]} açılamadı. Oynatıcının kurulu olduğunu kontrol edin.`;
  return clean;
}
