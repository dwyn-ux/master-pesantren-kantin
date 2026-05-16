const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Settings store
  store: {
    get:    (key) => ipcRenderer.invoke('store:get', key),
    set:    (key, value) => ipcRenderer.invoke('store:set', key, value),
    delete: (key) => ipcRenderer.invoke('store:delete', key),
    all:    () => ipcRenderer.invoke('store:all'),
  },

  // Local DB
  db: {
    lookupSantri:  (params) => ipcRenderer.invoke('db:lookup-santri', params),
    listProduk:    (params) => ipcRenderer.invoke('db:list-produk', params),
    getProduk:     (id) => ipcRenderer.invoke('db:get-produk', id),
    saveTransaksi: (payload) => ipcRenderer.invoke('db:save-transaksi', payload),
    listTransaksi: (params) => ipcRenderer.invoke('db:list-transaksi', params),
    getTransaksi:  (id) => ipcRenderer.invoke('db:get-transaksi', id),
    stats:         () => ipcRenderer.invoke('db:stats'),
    seedDummy:     () => ipcRenderer.invoke('db:seed-dummy'),
  },

  // Sync ke server
  sync: {
    verify:             (params) => ipcRenderer.invoke('sync:verify', params),
    me:                 () => ipcRenderer.invoke('sync:me'),
    pull:               (opts) => ipcRenderer.invoke('sync:pull', opts),
    refreshSaldo:       (id) => ipcRenderer.invoke('sync:refresh-saldo', id),
    push:               () => ipcRenderer.invoke('sync:push'),
    lookupSantriOnline: (params) => ipcRenderer.invoke('sync:lookup-santri-online', params),
  },
});
