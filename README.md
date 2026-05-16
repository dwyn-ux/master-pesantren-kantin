# Master Pesantren Kantin

Aplikasi kantin offline untuk pondok pesantren — desktop app companion untuk **Master Pesantren App**. Dibuat dengan Electron + Vite + Alpine.js + Tailwind + better-sqlite3.

## Arsitektur

```
┌─────────────────────────────────────────────────┐
│  Electron Desktop App (Windows .exe)            │
│  ┌───────────────────────────────────────────┐  │
│  │  Renderer (Vite + Alpine.js + Tailwind)   │  │
│  │   - POS UI dengan keyboard shortcut       │  │
│  └────────────┬──────────────────────────────┘  │
│               │ IPC                              │
│  ┌────────────▼──────────────────────────────┐  │
│  │  Main Process (Node.js)                    │  │
│  │   - SQLite local (better-sqlite3)          │  │
│  │   - electron-store (config & token)        │  │
│  │   - Sync engine (axios → Laravel API)      │  │
│  └────────────┬──────────────────────────────┘  │
└───────────────┼──────────────────────────────────┘
                │ HTTPS
                ▼
┌─────────────────────────────────────────────────┐
│  Server Master Pesantren App (Laravel)          │
│  /api/kantin/* endpoints                         │
└─────────────────────────────────────────────────┘
```

## Fitur

- ✅ Offline-first: SQLite lokal, transaksi tetap jalan tanpa internet
- ✅ Idempotent sync: setiap transaksi punya UUID, ga akan double saat retry
- ✅ Auto-pull master data setiap 5 menit (santri, saldo, produk)
- ✅ 3 cara identifikasi santri: RFID, fingerprint, search NIS/nama
- ✅ Keyboard shortcut: F1 (santri), F2 (produk), F12 (bayar), Esc (reset)
- ✅ Validasi saldo lokal + refresh real-time saat scan kartu
- ✅ Limit transaksi harian/mingguan (di-respect dari config santri)
- ✅ Decrement stok lokal otomatis

## Prasyarat

| Komponen | Versi |
|---|---|
| Node.js | 20+ |
| Windows | 10/11 (untuk build .exe) |
| Server Master Pesantren App | running & accessible |

## Setup Development

```bash
# Install dependency
npm install

# Rebuild native module untuk Electron
npm run rebuild

# Run dev (Vite + Electron)
npm run dev
```

Saat pertama buka app, akan muncul setup screen. Isi:
- **URL Server**: alamat server Laravel master-pesantren-app (mis. `http://192.168.1.10:8000`)
- **Token Device**: dapat dari admin di menu **Device Kantin Offline** → Daftarkan device → copy token

## Build Installer Windows

```bash
npm run build
```

Hasil installer ada di `release/Master Pesantren Kantin Setup x.x.x.exe`.

## Keyboard Shortcuts

| Tombol | Aksi |
|---|---|
| `F1` | Fokus ke input santri |
| `F2` | Fokus ke search produk |
| `F12` | Checkout / Bayar |
| `Esc` | Clear santri yang dipilih |
| `Enter` (di input santri) | Pilih santri pertama dari hasil pencarian |

## API Endpoints (server Laravel)

Semua di prefix `/api/kantin`, butuh header `Authorization: Bearer <device_token>`:

- `GET /auth/verify` — cek token valid
- `GET /auth/me` — info device + outlet
- `GET /santri/lookup?rfid=...` — lookup real-time
- `GET /sync/pull` — pull master data
- `GET /sync/saldo?ids=1,2,3` — refresh saldo
- `POST /sync/push` — kirim batch transaksi (idempotent via client_uuid)

## Struktur Folder

```
src/
├── main/                  # Electron main process
│   ├── index.js           # Entry point
│   ├── database.js        # SQLite init + migration
│   └── ipc/
│       ├── db.js          # IPC: lookup, transaksi, stats
│       ├── sync.js        # IPC: pull, push, verify, me
│       └── store.js       # IPC: electron-store (config)
├── preload/
│   └── index.js           # contextBridge API
└── renderer/              # Frontend
    ├── index.html         # UI
    ├── css/app.css        # Tailwind
    └── js/main.js         # Alpine.js logic
```

## Troubleshooting

**Native module error (better-sqlite3):**
```bash
npm run rebuild
```

**Token tidak valid:**
- Pastikan token belum di-revoke oleh admin
- Cek URL server bisa diakses dari komputer kasir (firewall, network)
- Buka admin pesantren-app → menu Device Kantin → Regenerate token

**Sync gagal:**
- Cek koneksi internet kantin
- Cek log sync di admin: menu Device Kantin → klik icon log per device
- App akan auto-retry, transaksi tetap tersimpan di local DB

## License

Private. Untuk Pondok Pesantren Ash-Shiddiq dan client-client master-pesantren-app.
