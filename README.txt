# Master Pesantren Kantin - Panduan Penggunaan

## 1. INSTALASI

### Windows
1. Jalankan file installer: `Master Pesantren Kantin Setup 1.0.0.exe`
2. Ikuti wizard instalasi (default settings OK)
3. Aplikasi akan terinstal di Start Menu dan Desktop

### Development (untuk developer)
```bash
npm install
npm run rebuild
npm run dev
```

## 2. SETUP AWAL

Saat pertama kali buka aplikasi:

### Step 1: Koneksi ke Server
- **URL Server**: Masukkan alamat server Laravel
  Contoh: `http://192.168.1.10:8000` atau `https://pondok.example.id`
- **Token Device**: Dapatkan dari admin Laravel di menu **Device Kantin Offline**

### Step 2: Verifikasi
- Klik **Hubungkan**
- Jika sukses, akan muncul nama device dan outlet
- Aplikasi akan auto-sync data master (santri & produk)

## 3. CARA PAKAI

### 3.1. Identifikasi Santri
**3 cara:**
1. **Scan RFID**: Tap kartu RFID di reader
2. **Fingerprint**: Scan sidik jari (jika tersedia)
3. **Manual**: Ketik NIS atau nama di input santri

**Shortcut**: Tekan **F1** untuk fokus ke input santri

### 3.2. Pilih Produk
1. Ketik nama produk atau scan barcode
2. Klik produk yang muncul di grid
3. Produk akan masuk ke keranjang

**Shortcut**: Tekan **F2** untuk fokus ke search produk

### 3.3. Atur Jumlah
- **+/-**: Klik tombol +/- di item keranjang
- **Manual**: Ketik jumlah di input qty
- **Hapus**: Klik ❌ di item

### 3.4. Checkout
1. Pilih metode bayar:
   - **Saldo**: Potong dari saldo santri
   - **Tunai**: Bayar dengan uang cash
2. Klik **BAYAR (F12)**

**Shortcut**: Tekan **F12** untuk checkout

## 4. KEYBOARD SHORTCUTS

| Tombol | Fungsi |
|--------|--------|
| **F1** | Fokus ke input santri |
| **F2** | Fokus ke search produk |
| **F12** | Checkout / Bayar |
| **Esc** | Clear santri yang dipilih |
| **Enter** (di input santri) | Pilih santri pertama dari hasil pencarian |

## 5. SYNC DATA

### Auto-sync
- Aplikasi auto-sync setiap **5 menit**
- Transaksi pending akan dikirim ke server
- Data master (santri, produk) akan di-update

### Manual sync
- Klik tombol **Sync** di header
- Status sync: ✅ hijau = sukses, ❌ merah = gagal

## 6. TROUBLESHOOTING

### 6.1. Token tidak valid
- Cek token belum expired di admin Laravel
- Regenerate token jika perlu
- Pastikan URL server benar

### 6.2. Sync gagal
- Cek koneksi internet
- Pastikan server Laravel running
- Cek firewall/network

### 6.3. Aplikasi crash
- Restart aplikasi
- Jika masih error, jalankan `npm run rebuild`

## 7. LOKASI FILE

### Windows
- **Config**: `%APPDATA%\master-pesantren-kantin\config.json`
- **Database**: `%APPDATA%\master-pesantren-kantin\data\kantin.db`
- **Logs**: Tersimpan di tabel `sync_log` dalam database

### Backup database
1. Tutup aplikasi
2. Copy file `kantin.db`
3. Simpan di lokasi aman

## 8. FITUR OFFLINE

✅ **Transaksi offline**: Tetap bisa jualan tanpa internet  
✅ **Data lokal**: Santri & produk tersimpan di SQLite  
✅ **Auto-retry**: Transaksi pending akan dikirim saat online  
✅ **Idempotent**: Tidak ada transaksi double  

## 9. KONTAK SUPPORT

- **Developer**: Fahmi
- **Issues**: https://github.com/dwyn-ux/master-pesantren-kantin/issues
- **Update**: Pull dari GitHub untuk versi terbaru

## 10. UPDATE APLIKASI

### Versi baru
1. Backup database (`kantin.db`)
2. Uninstall versi lama
3. Install versi baru
4. Restore database (jika perlu)

### Development update
```bash
git pull origin main
npm install
npm run rebuild
npm run build
```

---

**Catatan Penting:**
- Jangan hapus file `kantin.db` (berisi semua transaksi)
- Backup database secara berkala
- Pastikan token device selalu valid
- Test koneksi sebelum operasional

Aplikasi siap digunakan untuk operasional kantin pesantren!