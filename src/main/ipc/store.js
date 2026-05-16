const { ipcMain } = require('electron');
const Store = require('electron-store');

const store = new Store({
  name: 'config',
  defaults: {
    server_url: '',
    device_token: '',
    device_code: '',
    device_nama: '',
    outlet_nama: '',
    last_sync_at: null,
  },
});

function registerStoreIpc() {
  ipcMain.handle('store:get', (_e, key) => store.get(key));
  ipcMain.handle('store:set', (_e, key, value) => {
    store.set(key, value);
    return true;
  });
  ipcMain.handle('store:delete', (_e, key) => {
    store.delete(key);
    return true;
  });
  ipcMain.handle('store:all', () => store.store);
}

module.exports = { registerStoreIpc, store };
