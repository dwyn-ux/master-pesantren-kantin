const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('node:path');

const isDev = !!process.env.VITE_DEV_SERVER_URL;

// Setup IPC handlers (database, sync, etc)
const { registerDbIpc }   = require('./ipc/db');
const { registerSyncIpc } = require('./ipc/sync');
const { registerStoreIpc } = require('./ipc/store');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: 'Pesantren Kantin',
    autoHideMenuBar: !isDev,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  // Block menu di production
  if (!isDev) {
    Menu.setApplicationMenu(null);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  registerDbIpc();
  registerStoreIpc();
  registerSyncIpc();

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
