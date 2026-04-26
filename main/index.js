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
//     win.loadURL('http://localhost:3000'); 
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
import http from 'http';
import './server.js';

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


// Helper to wait for backend to be ready before creating window
function waitForBackendAndCreateWindow() {
  // If server.js exports the app, listen event can be used
  // But since server.js starts listening directly, we can poll the port
  const port = process.env.PORT || 5000;
  const maxAttempts = 20;
  let attempts = 0;
  function check() {
    http.get(`http://localhost:${port}/api/health`, res => {
      if (res.statusCode === 200) {
        createWindow();
      } else {
        retry();
      }
    }).on('error', retry);
  }
  function retry() {
    attempts++;
    if (attempts < maxAttempts) {
      setTimeout(check, 500);
    } else {
      console.error('Backend did not start in time. Loading window anyway.');
      createWindow();
    }
  }
  check();
}

app.whenReady().then(waitForBackendAndCreateWindow);

ipcMain.handle('store-get', (event, key) => store.get(key));
ipcMain.handle('store-set', (event, key, value) => store.set(key, value));
ipcMain.handle('store-delete', (event, key) => store.delete(key));
