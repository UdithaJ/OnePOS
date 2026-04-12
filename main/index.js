// // main/main.js
// const { app, BrowserWindow } = require('electron');
// const path = require('path');

// // Start your Express server
// require('./server'); // this runs server.js

// const createWindow = () => {
//   const win = new BrowserWindow({
//     width: 1000,
//     height: 700,
//     webPreferences: {
//       contextIsolation: true
//     }
//   });

//   win.webContents.openDevTools()

//   // Load Vue dev server in development
//   if (process.env.NODE_ENV === 'development') {
//     win.loadURL('http://localhost:5173'); 
//   } else {
//     // Load built frontend
//     win.loadFile(path.join(__dirname, '../client/dist/index.html'));
//   }
// };

// app.whenReady().then(createWindow);


// main/index.js
import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import Store from 'electron-store';
import path from 'path';
import { fileURLToPath } from 'url';
import './server.js'; // runs your server

const store = new Store();

// __dirname replacement in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    icon: path.join(__dirname, '../build/icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  win.maximize(); // Open window maximized

  win.webContents.openDevTools();

  // Load Vue dev server in development
  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:3000');
  } else {
    // Remove the menu bar
    Menu.setApplicationMenu(null);

    // Load built frontend - use app.getAppPath() for packaged apps
    const distPath = path.join(app.getAppPath(), 'client', 'dist', 'index.html');
    console.log('Loading frontend from:', distPath);
    win.loadFile(distPath);
  }
};

app.whenReady().then(createWindow);

ipcMain.handle('store-get', (event, key) => store.get(key));
ipcMain.handle('store-set', (event, key, value) => store.set(key, value));
ipcMain.handle('store-delete', (event, key) => store.delete(key));
