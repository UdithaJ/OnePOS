const { BrowserWindow } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');

async function getPrinters(event) {
  return event.sender.getPrintersAsync();
}

async function printBill(event, htmlContent, copies = 1) {
  const printers = await event.sender.getPrintersAsync();
  const printer = printers.find(p => p.isDefault) || printers[0];
  console.log('[print-bill] printers:', printers.length, '| using:', printer?.name || 'system default');

  // Write HTML to a temp file so Chromium loads it via a single clean navigation.
  // The about:blank + executeJavaScript(document.write) approach causes a second
  // internal navigation, meaning print() fires before the content is rendered.
  const tmpFile = path.join(os.tmpdir(), `onepos-bill-${Date.now()}.html`);
  fs.writeFileSync(tmpFile, htmlContent, 'utf8');

  return new Promise((resolve, reject) => {
    const printWindow = new BrowserWindow({
      show: false,
      width: 800,
      height: 600,
      webPreferences: { contextIsolation: true },
    });

    printWindow.loadURL(`file://${tmpFile}`);

    printWindow.webContents.once('did-finish-load', async () => {
      try {
        // Allow CSS layout to complete before printing
        await new Promise(r => setTimeout(r, 500));

        console.log('[print-bill] sending to printer:', printer?.name || 'system default');

        // Use the callback form — Electron calls it even in builds where the return
        // is void. The callback is the only reliable signal that the job was submitted.
        printWindow.webContents.print(
          {
            silent: true,
            printBackground: true,
            deviceName: printer?.name || '',
            copies: Math.max(1, parseInt(copies) || 1),
          },
          (success, failureReason) => {
            console.log('[print-bill] callback success:', success, failureReason || '');
            try { fs.unlinkSync(tmpFile); } catch (_) {}
            // Keep the window alive so the OS can fully spool before it closes
            setTimeout(() => { try { printWindow.close(); } catch (_) {} }, 3000);
            if (success) {
              resolve({ success: true, printer: printer?.name || 'default' });
            } else {
              reject(new Error(failureReason || 'Print failed'));
            }
          }
        );
      } catch (e) {
        console.error('[print-bill] error:', e);
        try { fs.unlinkSync(tmpFile); } catch (_) {}
        try { printWindow.close(); } catch (_) {}
        reject(e);
      }
    });

    printWindow.webContents.on('did-fail-load', (_e, _code, desc) => {
      console.error('[print-bill] load failed:', desc);
      try { fs.unlinkSync(tmpFile); } catch (_) {}
      try { printWindow.close(); } catch (_) {}
      reject(new Error('Failed to load bill: ' + desc));
    });
  });
}

module.exports = { getPrinters, printBill };
