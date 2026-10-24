import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { promises as fs } from 'node:fs';
import { Buffer } from 'node:buffer';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

process.env.APP_ROOT = join(__dirname, '..');
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];
const RENDERER_DIST = join(process.env.APP_ROOT, 'dist');

let win: BrowserWindow | null = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1080,
    minHeight: 700,
    show: false,
    backgroundColor: '#fafbf7',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    ...(process.platform === 'darwin' ? { trafficLightPosition: { x: 18, y: 30 } } : {}),
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.once('ready-to-show', () => win?.show());

  if (VITE_DEV_SERVER_URL) {
    void win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    void win.loadFile(join(RENDERER_DIST, 'index.html'));
  }
}

type SaveFilePayload = {
  defaultPath?: string;
  filters?: Electron.FileFilter[];
  data: string;
  encoding: 'base64' | 'utf8';
};

app.whenReady().then(() => {
  createWindow();

  ipcMain.handle('dialog:saveFile', async (_event, payload: SaveFilePayload) => {
    if (!win) return { canceled: true };
    const result = await dialog.showSaveDialog(win, {
      defaultPath: payload.defaultPath,
      filters: payload.filters,
    });
    if (result.canceled || !result.filePath) return { canceled: true };

    const content =
      payload.encoding === 'base64'
        ? Buffer.from(payload.data, 'base64')
        : Buffer.from(payload.data, 'utf8');
    await fs.writeFile(result.filePath, content);
    return { canceled: false, filePath: result.filePath };
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
  win = null;
});
