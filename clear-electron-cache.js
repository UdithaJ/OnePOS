// Script to clear Electron cache, localStorage, and electron-store data
const fs = require('fs');
const path = require('path');
const os = require('os');
const ElectronStore = require('electron-store').default;

function clearElectronStore() {
  try {
    const store = new ElectronStore({ projectName: 'OnePOS' });
    store.delete('user'); // Explicitly remove logged-in user data
    store.clear();
    console.log('Cleared electron-store data and user info');
  } catch (e) {
    console.warn('Could not clear electron-store:', e);
  }
}

function main() {
  clearElectronStore();
  // Also clear user from localStorage if running in browser context
  try {
    const localStoragePath = path.join(os.homedir(), 'AppData', 'Local', 'OnePOS', 'Local Storage');
    if (fs.existsSync(localStoragePath)) {
      fs.rmSync(localStoragePath, { recursive: true, force: true });
      console.log('Deleted Local Storage:', localStoragePath);
    }
  } catch (e) {
    console.warn('Could not clear localStorage:', e);
  }
  console.log('Electron cache, localStorage, and user data cleared.');
}

main();
