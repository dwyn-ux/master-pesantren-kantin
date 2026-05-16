import Alpine from 'alpinejs';
import { v4 as uuidv4 } from 'uuid';

window.Alpine = Alpine;

window.app = function () {
  return {
    state: 'splash', // splash | setup | pos
    device: { code: '', outlet: '', nama: '' },

    // Setup form
    setup: { url: '', token: '', loading: false, error: '', success: '' },

    // POS state
    santriQuery: '',
    santriSearchResults: [],
    selectedSantri: null,

    produkQuery: '',
    produkList: [],

    cart: [],
    metode: 'saldo',
    processing: false,

    syncing: false,
    stats: { santri: 0, produk: 0, transaksi_pending: 0, transaksi_today: 0, omzet_today: 0 },

    toast: { show: false, message: '', type: 'info' },

    /* ── Lifecycle ──────────────────────────────── */
    async init() {
      const cfg = await window.api.store.all();
      if (!cfg.server_url || !cfg.device_token) {
        this.state = 'setup';
        return;
      }

      // Verify token
      const v = await window.api.sync.verify({ server_url: cfg.server_url, token: cfg.device_token });
      if (!v.ok) {
        this.state = 'setup';
        this.setup.url = cfg.server_url;
        this.setup.token = cfg.device_token;
        this.setup.error = `Token tidak valid: ${v.error}. Silakan setup ulang.`;
        return;
      }

      // Get device info
      const me = await window.api.sync.me();
      if (me.ok) {
        this.device = {
          code: me.data.device.device_code,
          outlet: me.data.device.outlet.nama,
          nama: me.data.device.nama,
        };
      }

      // Auto-pull data master saat startup
      await this.refreshStats();
      if (this.stats.santri === 0 || this.stats.produk === 0) {
        this.showToast('Memuat data master pertama kali...', 'info');
        await this.syncNow();
      }

      this.state = 'pos';
      await this.loadProduk();

      // Watch search query
      this.$watch('santriQuery', (q) => this.searchSantri(q));

      // Auto-focus santri input
      this.$nextTick(() => this.$refs.santriInput?.focus());

      // Auto-sync setiap 5 menit
      setInterval(() => this.syncNow(true), 5 * 60 * 1000);
    },

    /* ── Setup ──────────────────────────────────── */
    async setupDevice() {
      this.setup.loading = true;
      this.setup.error = '';
      this.setup.success = '';

      const url = this.setup.url.trim().replace(/\/$/, '');
      const token = this.setup.token.trim();

      const v = await window.api.sync.verify({ server_url: url, token });
      if (!v.ok) {
        this.setup.error = v.error;
        this.setup.loading = false;
        return;
      }

      await window.api.store.set('server_url', url);
      await window.api.store.set('device_token', token);
      await window.api.store.set('device_code', v.data.device_code);
      await window.api.store.set('device_nama', v.data.nama);

      this.setup.success = `${v.data.nama} (${v.data.device_code})`;

      setTimeout(() => {
        this.setup.loading = false;
        this.init();
      }, 1500);
    },

    async logout() {
      if (!confirm('Setup ulang device? Anda perlu memasukkan token kembali.')) return;
      await window.api.store.delete('server_url');
      await window.api.store.delete('device_token');
      window.location.reload();
    },

    /* ── Stats ──────────────────────────────────── */
    async refreshStats() {
      this.stats = await window.api.db.stats();
    },

    /* ── Sync ───────────────────────────────────── */
    async syncNow(silent = false) {
      if (this.syncing) return;
      this.syncing = true;

      // Push pending transaksi dulu
      const push = await window.api.sync.push();
      if (push.ok && push.success > 0) {
        if (!silent) this.showToast(`${push.success} transaksi berhasil disinkronkan`, 'success');
      }

      // Pull master
      const pull = await window.api.sync.pull();
      if (pull.ok) {
        if (!silent) this.showToast(`Sync OK: ${pull.meta.santri} santri, ${pull.meta.produk} produk`, 'success');
        await this.loadProduk();
      } else {
        if (!silent) this.showToast(`Sync gagal: ${pull.error}`, 'error');
      }

      await this.refreshStats();

      // Refresh saldo santri yang sedang dipilih
      if (this.selectedSantri) {
        const r = await window.api.sync.refreshSaldo(this.selectedSantri.id);
        if (r.ok && r.saldo !== null) {
          this.selectedSantri.saldo = r.saldo;
        }
      }

      this.syncing = false;
    },

    /* ── Santri search ──────────────────────────── */
    async searchSantri(q) {
      if (!q || q.length < 2) {
        this.santriSearchResults = [];
        return;
      }

      // Coba RFID dulu (kalau panjang ~8-12 karakter hex)
      if (/^[0-9A-F]{6,16}$/i.test(q)) {
        const byRfid = await window.api.db.lookupSantri({ rfid: q });
        if (byRfid) {
          this.selectSantri(byRfid);
          return;
        }
      }

      // Search by NIS / nama
      const results = await window.api.db.lookupSantri({ q });
      if (Array.isArray(results)) {
        this.santriSearchResults = results;
      } else if (results) {
        this.santriSearchResults = [results];
      }
    },

    onSantriEnter() {
      // Kalau ada hasil pertama, pilih dia
      if (this.santriSearchResults.length === 1) {
        this.selectSantri(this.santriSearchResults[0]);
      } else if (this.santriSearchResults.length === 0) {
        this.showToast('Santri tidak ditemukan', 'error');
      }
    },

    async selectSantri(s) {
      this.selectedSantri = s;
      this.santriQuery = s.nama;
      this.santriSearchResults = [];

      // Refresh saldo real-time kalau online
      const r = await window.api.sync.refreshSaldo(s.id);
      if (r.ok && r.saldo !== null) {
        this.selectedSantri.saldo = r.saldo;
      }

      this.$nextTick(() => this.$refs.produkInput?.focus());
    },

    clearSantri() {
      this.selectedSantri = null;
      this.santriQuery = '';
      this.santriSearchResults = [];
    },

    /* ── Produk ─────────────────────────────────── */
    async loadProduk() {
      this.produkList = await window.api.db.listProduk({ q: this.produkQuery });
    },

    /* ── Cart ───────────────────────────────────── */
    addToCart(p) {
      const existing = this.cart.find((i) => i.produk_id === p.id);
      if (existing) {
        existing.qty++;
      } else {
        this.cart.push({
          produk_id: p.id,
          nama: p.nama,
          harga: p.harga,
          qty: 1,
        });
      }
    },

    removeItem(idx) {
      this.cart.splice(idx, 1);
    },

    changeQty(idx, delta) {
      this.cart[idx].qty = Math.max(1, this.cart[idx].qty + delta);
    },

    enforceQty(idx) {
      if (!this.cart[idx].qty || this.cart[idx].qty < 1) this.cart[idx].qty = 1;
    },

    clearCart() {
      this.cart = [];
    },

    get cartTotal() {
      return this.cart.reduce((s, i) => s + i.harga * i.qty, 0);
    },

    /* ── Checkout ───────────────────────────────── */
    async checkout() {
      if (this.processing) return;
      if (this.cart.length === 0) return;
      if (this.metode === 'saldo' && !this.selectedSantri) {
        this.showToast('Pilih santri dulu untuk pembayaran saldo', 'error');
        return;
      }

      if (this.metode === 'saldo' && this.selectedSantri.saldo < this.cartTotal) {
        if (!confirm(`Saldo santri tidak cukup (Rp ${this.selectedSantri.saldo.toLocaleString('id-ID')}). Lanjutkan dengan metode tunai?`)) return;
        this.metode = 'tunai';
      }

      this.processing = true;

      const payload = {
        client_uuid: uuidv4(),
        santri_id: this.metode === 'saldo' ? this.selectedSantri?.id : null,
        santri_nama: this.metode === 'saldo' ? this.selectedSantri?.nama : null,
        santri_nis: this.metode === 'saldo' ? this.selectedSantri?.nis : null,
        total: this.cartTotal,
        metode_bayar: this.metode,
        transaksi_at: new Date().toISOString(),
        items: this.cart.map((i) => ({
          produk_id: i.produk_id,
          nama: i.nama,
          qty: i.qty,
          harga: i.harga,
        })),
      };

      const r = await window.api.db.saveTransaksi(payload);
      if (!r.ok) {
        this.showToast(`Gagal: ${r.error}`, 'error');
        this.processing = false;
        return;
      }

      this.showToast(`Transaksi berhasil! Total Rp ${this.cartTotal.toLocaleString('id-ID')}`, 'success');

      // Reset
      this.cart = [];
      this.clearSantri();
      await this.loadProduk();
      await this.refreshStats();

      // Auto-push ke server di background (non-blocking)
      window.api.sync.push().then((res) => {
        if (res.ok && res.success > 0) {
          this.refreshStats();
        }
      });

      this.processing = false;
      this.$nextTick(() => this.$refs.santriInput?.focus());
    },

    /* ── Keyboard shortcut ──────────────────────── */
    handleShortcut(e) {
      if (e.key === 'F1') {
        e.preventDefault();
        this.$refs.santriInput?.focus();
        this.$refs.santriInput?.select();
      } else if (e.key === 'F2') {
        e.preventDefault();
        this.$refs.produkInput?.focus();
        this.$refs.produkInput?.select();
      } else if (e.key === 'F12') {
        e.preventDefault();
        this.checkout();
      } else if (e.key === 'Escape') {
        this.clearSantri();
      }
    },

    /* ── Toast ──────────────────────────────────── */
    showToast(message, type = 'info') {
      this.toast = { show: true, message, type };
      setTimeout(() => {
        this.toast.show = false;
      }, 3500);
    },
  };
};

Alpine.start();
