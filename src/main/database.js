const { app } = require('electron');
const Database = require('better-sqlite3');
const path = require('node:path');
const fs = require('node:fs');

let db = null;

function initDatabase() {
  if (db) return db;

  const userData = app.getPath('userData');
  const dbDir = path.join(userData, 'data');
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

  const dbPath = path.join(dbDir, 'kantin.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  runMigrations();
  return db;
}

function runMigrations() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS santri (
      id INTEGER PRIMARY KEY,
      nis TEXT,
      nik TEXT,
      nama TEXT NOT NULL,
      kelas TEXT,
      jenis_kelamin TEXT,
      fingerprint_id TEXT,
      rfid_uid TEXT,
      saldo INTEGER DEFAULT 0,
      tipe_limit TEXT,
      nominal_limit INTEGER,
      synced_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_santri_nis ON santri(nis);
    CREATE INDEX IF NOT EXISTS idx_santri_rfid ON santri(rfid_uid);
    CREATE INDEX IF NOT EXISTS idx_santri_fp ON santri(fingerprint_id);
    CREATE INDEX IF NOT EXISTS idx_santri_nama ON santri(nama);

    CREATE TABLE IF NOT EXISTS produk (
      id INTEGER PRIMARY KEY,
      nama TEXT NOT NULL,
      harga INTEGER NOT NULL,
      stok INTEGER DEFAULT 0,
      barcode TEXT,
      is_aktif INTEGER DEFAULT 1,
      synced_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_produk_nama ON produk(nama);
    CREATE INDEX IF NOT EXISTS idx_produk_barcode ON produk(barcode);

    CREATE TABLE IF NOT EXISTS transaksi (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_uuid TEXT UNIQUE NOT NULL,
      santri_id INTEGER,
      santri_nama TEXT,
      santri_nis TEXT,
      total INTEGER NOT NULL,
      metode_bayar TEXT NOT NULL DEFAULT 'saldo',
      transaksi_at TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      sync_status TEXT DEFAULT 'pending',
      sync_error TEXT,
      synced_at TEXT,
      transaksi_kasir_id INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_transaksi_status ON transaksi(sync_status);
    CREATE INDEX IF NOT EXISTS idx_transaksi_uuid ON transaksi(client_uuid);
    CREATE INDEX IF NOT EXISTS idx_transaksi_at ON transaksi(transaksi_at);

    CREATE TABLE IF NOT EXISTS transaksi_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaksi_id INTEGER NOT NULL,
      produk_id INTEGER NOT NULL,
      nama TEXT NOT NULL,
      qty INTEGER NOT NULL,
      harga INTEGER NOT NULL,
      subtotal INTEGER NOT NULL,
      FOREIGN KEY (transaksi_id) REFERENCES transaksi(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_items_transaksi ON transaksi_items(transaksi_id);

    CREATE TABLE IF NOT EXISTS sync_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      arah TEXT NOT NULL,
      jenis TEXT NOT NULL,
      jumlah INTEGER DEFAULT 0,
      status TEXT NOT NULL,
      message TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function getDb() {
  if (!db) initDatabase();
  return db;
}

module.exports = { initDatabase, getDb };
