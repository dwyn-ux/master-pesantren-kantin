const { ipcMain } = require('electron');
const axios = require('axios');
const { getDb } = require('../database');
const { store } = require('./store');

function getAxios() {
  const baseURL = store.get('server_url');
  const token   = store.get('device_token');

  if (!baseURL || !token) {
    throw new Error('Server URL atau token belum dikonfigurasi.');
  }

  return axios.create({
    baseURL: baseURL.replace(/\/$/, '') + '/api/kantin',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    timeout: 30000,
  });
}

function logSync(arah, jenis, jumlah, status, message = null) {
  getDb().prepare(`
    INSERT INTO sync_log (arah, jenis, jumlah, status, message)
    VALUES (?, ?, ?, ?, ?)
  `).run(arah, jenis, jumlah, status, message);
}

function registerSyncIpc() {
  // ── Verify token (dipanggil saat startup / setup) ────────
  ipcMain.handle('sync:verify', async (_e, params) => {
    const { server_url, token } = params;
    try {
      const r = await axios.get(
        server_url.replace(/\/$/, '') + '/api/kantin/auth/verify',
        {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
          timeout: 10000,
        }
      );
      return { ok: true, data: r.data };
    } catch (err) {
      return {
        ok: false,
        error: err.response?.data?.message || err.message || 'Connection failed',
      };
    }
  });

  // ── Get device info (auth/me) ────────────────────────────
  ipcMain.handle('sync:me', async () => {
    try {
      const api = getAxios();
      const r = await api.get('/auth/me');
      return { ok: true, data: r.data };
    } catch (err) {
      return { ok: false, error: err.response?.data?.message || err.message };
    }
  });

  // ── Pull master data dari server ─────────────────────────
  ipcMain.handle('sync:pull', async (_e, opts = {}) => {
    const db = getDb();
    try {
      const api = getAxios();
      const params = {};
      if (opts.since) params.since = opts.since;

      const r = await api.get('/sync/pull', { params });
      const { santri = [], produk = [], tarif = [] } = r.data.data || {};

      const upSantri = db.prepare(`
        INSERT INTO santri (id, nis, nik, nama, kelas, jenis_kelamin, fingerprint_id, rfid_uid, saldo, tipe_limit, nominal_limit, synced_at)
        VALUES (@id, @nis, @nik, @nama, @kelas, @jenis_kelamin, @fingerprint_id, @rfid_uid, @saldo, @tipe_limit, @nominal_limit, @synced_at)
        ON CONFLICT(id) DO UPDATE SET
          nis=@nis, nik=@nik, nama=@nama, kelas=@kelas, jenis_kelamin=@jenis_kelamin,
          fingerprint_id=@fingerprint_id, rfid_uid=@rfid_uid, saldo=@saldo,
          tipe_limit=@tipe_limit, nominal_limit=@nominal_limit, synced_at=@synced_at
      `);
      const upProduk = db.prepare(`
        INSERT INTO produk (id, nama, harga, stok, barcode, is_aktif, synced_at)
        VALUES (@id, @nama, @harga, @stok, @barcode, @is_aktif, @synced_at)
        ON CONFLICT(id) DO UPDATE SET
          nama=@nama, harga=@harga, stok=@stok, barcode=@barcode, is_aktif=@is_aktif, synced_at=@synced_at
      `);

      const now = new Date().toISOString();

      db.transaction(() => {
        for (const s of santri) {
          upSantri.run({
            id: s.id,
            nis: s.nis || null,
            nik: s.nik || null,
            nama: s.nama,
            kelas: s.kelas || null,
            jenis_kelamin: s.jenis_kelamin || null,
            fingerprint_id: s.fingerprint_id || null,
            rfid_uid: s.rfid_uid || null,
            saldo: s.saldo || 0,
            tipe_limit: s.tipe_limit || null,
            nominal_limit: s.nominal_limit || null,
            synced_at: now,
          });
        }

        for (const p of produk) {
          upProduk.run({
            id: p.id,
            nama: p.nama,
            harga: p.harga,
            stok: p.stok || 0,
            barcode: p.barcode || null,
            is_aktif: p.is_aktif ? 1 : 0,
            synced_at: now,
          });
        }
      })();

      store.set('last_sync_at', now);
      logSync('pull', 'full', santri.length + produk.length, 'success');

      return {
        ok: true,
        meta: {
          santri: santri.length,
          produk: produk.length,
          tarif: tarif.length,
          server_time: r.data.server_time,
        },
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      logSync('pull', 'full', 0, 'failed', msg);
      return { ok: false, error: msg };
    }
  });

  // ── Refresh saldo per santri (lookup real-time saat scan) ─
  ipcMain.handle('sync:refresh-saldo', async (_e, santri_id) => {
    try {
      const api = getAxios();
      const r = await api.get('/sync/saldo', { params: { ids: santri_id } });
      const data = r.data.data?.[0];
      if (data) {
        getDb().prepare('UPDATE santri SET saldo = ? WHERE id = ?').run(data.saldo || 0, santri_id);
      }
      return { ok: true, saldo: data?.saldo ?? null };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  // ── Push transaksi pending ke server ─────────────────────
  ipcMain.handle('sync:push', async () => {
    const db = getDb();

    const pending = db.prepare(`
      SELECT * FROM transaksi WHERE sync_status = 'pending' ORDER BY id LIMIT 50
    `).all();

    if (pending.length === 0) return { ok: true, pushed: 0, message: 'Tidak ada transaksi pending' };

    const payload = pending.map((t) => {
      const items = db.prepare('SELECT * FROM transaksi_items WHERE transaksi_id = ?').all(t.id);
      return {
        client_uuid: t.client_uuid,
        santri_id: t.santri_id,
        total: t.total,
        items: items.map((i) => ({
          produk_id: i.produk_id,
          nama: i.nama,
          qty: i.qty,
          harga: i.harga,
        })),
        metode_bayar: t.metode_bayar,
        transaksi_at: t.transaksi_at,
      };
    });

    try {
      const api = getAxios();
      const r = await api.post('/sync/push', { transaksi: payload });
      const results = r.data.results || [];

      let success = 0, failed = 0;
      const updateOk = db.prepare(`
        UPDATE transaksi SET sync_status = 'synced', synced_at = ?, transaksi_kasir_id = ?, sync_error = NULL
        WHERE client_uuid = ?
      `);
      const updateFail = db.prepare(`
        UPDATE transaksi SET sync_status = 'failed', sync_error = ?
        WHERE client_uuid = ?
      `);
      const now = new Date().toISOString();

      db.transaction(() => {
        for (const res of results) {
          if (res.status === 'success' || res.status === 'duplicate') {
            updateOk.run(now, res.transaksi_kasir_id || null, res.client_uuid);
            success++;
          } else {
            updateFail.run(res.message || 'Unknown error', res.client_uuid);
            failed++;
          }
        }
      })();

      logSync('push', 'transaksi', pending.length, failed === 0 ? 'success' : 'partial');

      return { ok: true, pushed: pending.length, success, failed, results };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      logSync('push', 'transaksi', pending.length, 'failed', msg);
      return { ok: false, error: msg };
    }
  });

  // ── Lookup santri online (fallback, kalau RFID baru) ─────
  ipcMain.handle('sync:lookup-santri-online', async (_e, params) => {
    try {
      const api = getAxios();
      const r = await api.get('/santri/lookup', { params });
      return { ok: true, data: r.data };
    } catch (err) {
      return { ok: false, error: err.response?.data?.message || err.message };
    }
  });
}

module.exports = { registerSyncIpc };
