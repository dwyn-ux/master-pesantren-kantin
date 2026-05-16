const { ipcMain } = require('electron');
const { getDb } = require('../database');
const { v4: uuidv4 } = require('uuid');

function registerDbIpc() {
  // ── Santri lookup ────────────────────────────────────────
  ipcMain.handle('db:lookup-santri', (_e, params) => {
    const db = getDb();
    if (params.rfid) {
      return db.prepare('SELECT * FROM santri WHERE rfid_uid = ?').get(params.rfid);
    }
    if (params.fingerprint) {
      return db.prepare('SELECT * FROM santri WHERE fingerprint_id = ?').get(params.fingerprint);
    }
    if (params.nis) {
      return db.prepare('SELECT * FROM santri WHERE nis = ?').get(params.nis);
    }
    if (params.q) {
      const stmt = db.prepare(
        `SELECT * FROM santri 
         WHERE nama LIKE ? OR nis LIKE ? OR kelas LIKE ?
         LIMIT 20`
      );
      const q = `%${params.q}%`;
      return stmt.all(q, q, q);
    }
    return null;
  });

  // ── Produk ───────────────────────────────────────────────
  ipcMain.handle('db:list-produk', (_e, params = {}) => {
    const db = getDb();
    let sql = 'SELECT * FROM produk WHERE is_aktif = 1';
    const args = [];
    if (params.q) {
      sql += ' AND (nama LIKE ? OR barcode = ?)';
      args.push(`%${params.q}%`, params.q);
    }
    sql += ' ORDER BY nama LIMIT 100';
    return db.prepare(sql).all(...args);
  });

  ipcMain.handle('db:get-produk', (_e, id) => {
    return getDb().prepare('SELECT * FROM produk WHERE id = ?').get(id);
  });

  // ── Transaksi ────────────────────────────────────────────
  /**
   * Simpan transaksi ke local DB (offline-first).
   * Validasi saldo & kurangi snapshot saldo lokal.
   * Return: { ok: bool, transaksi_id?, error? }
   */
  ipcMain.handle('db:save-transaksi', (_e, payload) => {
    const db = getDb();
    const clientUuid = payload.client_uuid || uuidv4();

    try {
      const result = db.transaction(() => {
        // Validasi saldo kalau bayar pakai saldo
        if (payload.metode_bayar === 'saldo' && payload.santri_id) {
          const santri = db.prepare('SELECT * FROM santri WHERE id = ?').get(payload.santri_id);
          if (!santri) throw new Error('Santri tidak ditemukan di local DB');
          if ((santri.saldo || 0) < payload.total) {
            throw new Error(`Saldo tidak cukup. Saldo: Rp${(santri.saldo || 0).toLocaleString('id-ID')}, Total: Rp${payload.total.toLocaleString('id-ID')}`);
          }

          // Update snapshot saldo lokal (akan di-overwrite saat sync pull berikutnya)
          db.prepare('UPDATE santri SET saldo = saldo - ? WHERE id = ?')
            .run(payload.total, payload.santri_id);
        }

        // Insert header
        const insTrx = db.prepare(`
          INSERT INTO transaksi (client_uuid, santri_id, santri_nama, santri_nis, total, metode_bayar, transaksi_at, sync_status)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
        `).run(
          clientUuid,
          payload.santri_id || null,
          payload.santri_nama || null,
          payload.santri_nis || null,
          payload.total,
          payload.metode_bayar || 'saldo',
          payload.transaksi_at || new Date().toISOString(),
        );

        const transaksiId = insTrx.lastInsertRowid;

        // Insert items + decrement stok lokal
        const insItem = db.prepare(`
          INSERT INTO transaksi_items (transaksi_id, produk_id, nama, qty, harga, subtotal)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        const decStok = db.prepare('UPDATE produk SET stok = stok - ? WHERE id = ?');

        for (const item of payload.items) {
          insItem.run(
            transaksiId,
            item.produk_id,
            item.nama,
            item.qty,
            item.harga,
            item.qty * item.harga,
          );
          decStok.run(item.qty, item.produk_id);
        }

        return transaksiId;
      })();

      return { ok: true, transaksi_id: result, client_uuid: clientUuid };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  // ── Riwayat transaksi ────────────────────────────────────
  ipcMain.handle('db:list-transaksi', (_e, params = {}) => {
    const db = getDb();
    const limit = params.limit || 50;
    const sql = `
      SELECT t.*,
        (SELECT COUNT(*) FROM transaksi_items WHERE transaksi_id = t.id) as item_count
      FROM transaksi t
      ORDER BY t.id DESC
      LIMIT ?
    `;
    return db.prepare(sql).all(limit);
  });

  ipcMain.handle('db:get-transaksi', (_e, id) => {
    const db = getDb();
    const trx = db.prepare('SELECT * FROM transaksi WHERE id = ?').get(id);
    if (!trx) return null;
    trx.items = db.prepare('SELECT * FROM transaksi_items WHERE transaksi_id = ?').all(id);
    return trx;
  });

  // ── Stats ────────────────────────────────────────────────
  ipcMain.handle('db:stats', () => {
    const db = getDb();
    return {
      santri:           db.prepare('SELECT COUNT(*) as c FROM santri').get().c,
      produk:           db.prepare('SELECT COUNT(*) as c FROM produk WHERE is_aktif = 1').get().c,
      transaksi_pending: db.prepare("SELECT COUNT(*) as c FROM transaksi WHERE sync_status = 'pending'").get().c,
      transaksi_today:  db.prepare("SELECT COUNT(*) as c FROM transaksi WHERE date(transaksi_at) = date('now', 'localtime')").get().c,
      omzet_today:      db.prepare("SELECT COALESCE(SUM(total),0) as t FROM transaksi WHERE date(transaksi_at) = date('now', 'localtime')").get().t,
    };
  });

  // ── Seed dummy data (untuk testing offline) ──────────────
  ipcMain.handle('db:seed-dummy', () => {
    const db = getDb();
    const now = new Date().toISOString();

    const santriList = [
      { id: 1, nis: '2024001', nama: 'Ahmad Fauzi', kelas: '7A', jenis_kelamin: 'L', rfid_uid: 'A1B2C3D4', saldo: 50000 },
      { id: 2, nis: '2024002', nama: 'Budi Santoso', kelas: '7A', jenis_kelamin: 'L', rfid_uid: 'A1B2C3D5', saldo: 25000 },
      { id: 3, nis: '2024003', nama: 'Citra Dewi', kelas: '7B', jenis_kelamin: 'P', rfid_uid: 'A1B2C3D6', saldo: 100000 },
      { id: 4, nis: '2024004', nama: 'Dimas Pratama', kelas: '8A', jenis_kelamin: 'L', rfid_uid: 'A1B2C3D7', saldo: 75000 },
      { id: 5, nis: '2024005', nama: 'Eka Putri', kelas: '8B', jenis_kelamin: 'P', rfid_uid: 'A1B2C3D8', saldo: 30000 },
      { id: 6, nis: '2024006', nama: 'Fahmi Hidayat', kelas: '9A', jenis_kelamin: 'L', rfid_uid: 'A1B2C3D9', saldo: 150000 },
      { id: 7, nis: '2024007', nama: 'Gita Sari', kelas: '9B', jenis_kelamin: 'P', rfid_uid: 'A1B2C3DA', saldo: 5000 },
      { id: 8, nis: '2024008', nama: 'Hadi Wijaya', kelas: '7A', jenis_kelamin: 'L', rfid_uid: 'A1B2C3DB', saldo: 80000 },
    ];

    const produkList = [
      { id: 1, nama: 'Nasi Goreng', harga: 12000, stok: 50, barcode: '8991234567001' },
      { id: 2, nama: 'Mie Ayam', harga: 10000, stok: 40, barcode: '8991234567002' },
      { id: 3, nama: 'Soto Ayam', harga: 13000, stok: 30, barcode: '8991234567003' },
      { id: 4, nama: 'Es Teh Manis', harga: 3000, stok: 100, barcode: '8991234567004' },
      { id: 5, nama: 'Es Jeruk', harga: 4000, stok: 80, barcode: '8991234567005' },
      { id: 6, nama: 'Air Mineral', harga: 3000, stok: 200, barcode: '8991234567006' },
      { id: 7, nama: 'Roti Bakar', harga: 8000, stok: 25, barcode: '8991234567007' },
      { id: 8, nama: 'Gorengan (3pcs)', harga: 5000, stok: 60, barcode: '8991234567008' },
      { id: 9, nama: 'Bakso', harga: 12000, stok: 35, barcode: '8991234567009' },
      { id: 10, nama: 'Ayam Geprek', harga: 15000, stok: 20, barcode: '8991234567010' },
      { id: 11, nama: 'Es Krim', harga: 5000, stok: 50, barcode: '8991234567011' },
      { id: 12, nama: 'Snack Chiki', harga: 2500, stok: 100, barcode: '8991234567012' },
    ];

    const upSantri = db.prepare(`
      INSERT INTO santri (id, nis, nama, kelas, jenis_kelamin, rfid_uid, saldo, synced_at)
      VALUES (@id, @nis, @nama, @kelas, @jenis_kelamin, @rfid_uid, @saldo, @synced_at)
      ON CONFLICT(id) DO UPDATE SET
        nis=@nis, nama=@nama, kelas=@kelas, jenis_kelamin=@jenis_kelamin,
        rfid_uid=@rfid_uid, saldo=@saldo, synced_at=@synced_at
    `);
    const upProduk = db.prepare(`
      INSERT INTO produk (id, nama, harga, stok, barcode, is_aktif, synced_at)
      VALUES (@id, @nama, @harga, @stok, @barcode, 1, @synced_at)
      ON CONFLICT(id) DO UPDATE SET
        nama=@nama, harga=@harga, stok=@stok, barcode=@barcode, is_aktif=1, synced_at=@synced_at
    `);

    db.transaction(() => {
      for (const s of santriList) upSantri.run({ ...s, synced_at: now });
      for (const p of produkList) upProduk.run({ ...p, synced_at: now });
    })();

    return { ok: true, santri: santriList.length, produk: produkList.length };
  });
}

module.exports = { registerDbIpc };
