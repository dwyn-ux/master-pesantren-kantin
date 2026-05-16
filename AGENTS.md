# Master Pesantren Kantin - Development Guide

## Project Status
✅ **Development Environment**: Ready  
✅ **Dependencies**: Installed  
✅ **Native Module**: better-sqlite3 rebuilt for Electron  
✅ **Build System**: Working  
✅ **Production Build**: Created (81.4 MB installer)

## Commands

### Development
```bash
npm run dev          # Run Vite + Electron dev server
npm run dev:vite     # Run Vite dev server only (http://localhost:5173)
npm run dev:electron # Run Electron only (requires Vite running)
```

### Build & Production
```bash
npm run build        # Build production installer (.exe)
npm run build:dir    # Build unpacked directory (for testing)
npm run rebuild      # Rebuild native modules (better-sqlite3)
```

### Dependencies
```bash
npm install          # Install dependencies
npm run postinstall  # Install app deps (auto-run after npm install)
```

## Architecture

### Tech Stack
- **Frontend**: Vite + Alpine.js + Tailwind CSS v4
- **Backend**: Electron + Node.js
- **Database**: better-sqlite3 (local SQLite)
- **State Management**: electron-store (config), Alpine.js (UI)
- **Sync**: Axios + Laravel API

### File Structure
```
src/
├── main/           # Electron main process
│   ├── index.js    # Entry point
│   ├── database.js # SQLite init & migrations
│   └── ipc/        # IPC handlers
│       ├── db.js   # Database operations
│       ├── sync.js # API sync operations
│       └── store.js # Config storage
├── preload/        # Context bridge
│   └── index.js    # Exposed API to renderer
└── renderer/       # Frontend
    ├── index.html  # Main UI
    ├── css/app.css # Tailwind styles
    └── js/main.js  # Alpine.js logic
```

## Setup Instructions

### First Time Setup
1. Install Node.js 20+
2. Run `npm install`
3. Run `npm run rebuild` (for better-sqlite3)
4. Run `npm run dev`

### Production Deployment
1. Run `npm run build`
2. Installer: `release/Master Pesantren Kantin Setup 1.0.0.exe`
3. Install on Windows 10/11

### Device Configuration
1. Get device token from Laravel admin: **Device Kantin Offline**
2. Enter server URL and token in setup screen
3. App will auto-sync master data (santri, produk)

## Testing

### Manual Testing Checklist
- [ ] Setup screen works (URL + token validation)
- [ ] Santri lookup (RFID, NIS, nama)
- [ ] Produk search & cart
- [ ] Checkout (saldo & tunai)
- [ ] Sync operations (pull/push)
- [ ] Keyboard shortcuts (F1, F2, F12, Esc)

### Keyboard Shortcuts
- **F1**: Focus santri input
- **F2**: Focus produk search
- **F12**: Checkout
- **Esc**: Clear selected santri

## Troubleshooting

### Common Issues

1. **Native module error (better-sqlite3)**
   ```bash
   npm run rebuild
   ```

2. **Electron-store ESM error**
   - Use electron-store@8 (CommonJS)
   - Fixed in `src/main/ipc/store.js`

3. **Build fails**
   - Check Node.js version (20+)
   - Run `npm run rebuild` first
   - Ensure internet connection for electron downloads

4. **Sync errors**
   - Verify server URL accessible
   - Check device token not revoked
   - Check firewall/network

### Logs
- **SQLite DB**: `%APPDATA%\master-pesantren-kantin\data\kantin.db`
- **Config**: `%APPDATA%\master-pesantren-kantin\config.json`
- **Sync logs**: Stored in `sync_log` table

## API Integration

### Required Laravel Endpoints
All endpoints under `/api/kantin` with `Authorization: Bearer <token>`

1. `GET /auth/verify` - Token validation
2. `GET /auth/me` - Device info
3. `GET /sync/pull` - Master data (santri, produk)
4. `GET /sync/saldo?ids=...` - Real-time saldo
5. `POST /sync/push` - Transaksi batch

### Sync Strategy
- **Offline-first**: All transactions saved locally
- **Idempotent**: UUID prevents duplicates
- **Auto-retry**: Failed syncs retry automatically
- **Background sync**: Every 5 minutes

## Performance Notes

### Bundle Size
- Frontend: 52.3 KB JS + 19.2 KB CSS
- Installer: 81.4 MB (includes Electron runtime)

### Database Optimization
- SQLite WAL mode enabled
- Indexes on lookup fields (RFID, NIS, nama)
- Foreign keys enabled

### Memory Usage
- ~150-200 MB typical (Electron + SQLite)
- Auto-cleanup of old sync logs recommended

## Security

### Data Protection
- Local SQLite encrypted at rest (OS-level)
- No plaintext secrets in code
- Token stored in electron-store (encrypted)

### Network Security
- HTTPS recommended for production
- Token-based authentication
- Request timeout: 30 seconds

## Maintenance

### Regular Tasks
1. Monitor sync logs for failures
2. Update santri/produk data via Laravel admin
3. Backup SQLite database periodically
4. Update Electron version (security patches)

### Database Maintenance
```sql
-- Clean old sync logs (keep 30 days)
DELETE FROM sync_log WHERE created_at < date('now', '-30 days');

-- Vacuum database
VACUUM;
```

## License & Support
- Private use for Pondok Pesantren Ash-Shiddiq
- Contact: Fahmi (developer)
- Issues: https://github.com/anomalyco/opencode/issues