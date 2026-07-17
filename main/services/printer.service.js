const { BrowserWindow } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');

async function getPrinters(event) {
  return event.sender.getPrintersAsync();
}

async function printBill(event, htmlContent, copies = 1, printerName = '') {
  const printers = await event.sender.getPrintersAsync();

  // Selection priority:
  //  1. The printer the operator explicitly saved for this workstation (matched
  //     by exact then case-insensitive name).
  //  2. Otherwise defer to the OS default by leaving deviceName empty.
  // We deliberately do NOT fall back to printers[0]/isDefault: on Windows,
  // Electron's isDefault flag is unreliable and printers[0] can resolve to a
  // virtual device such as "Microsoft Print to PDF", sending the bill there
  // instead of the real default printer.
  let printer = null;
  if (printerName) {
    printer =
      printers.find(p => p.name === printerName) ||
      printers.find(p => p.name.toLowerCase() === printerName.toLowerCase());
  }
  const deviceName = printer ? printer.name : '';
  console.log(
    '[print-bill] printers:', printers.length,
    '| requested:', printerName || '(none)',
    '| using:', deviceName || 'OS default'
  );

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

        console.log('[print-bill] sending to printer:', deviceName || 'OS default');

        // Use the callback form — Electron calls it even in builds where the return
        // is void. The callback is the only reliable signal that the job was submitted.
        printWindow.webContents.print(
          {
            silent: true,
            printBackground: true,
            deviceName,
            copies: Math.max(1, parseInt(copies) || 1),
          },
          (success, failureReason) => {
            console.log('[print-bill] callback success:', success, failureReason || '');
            try { fs.unlinkSync(tmpFile); } catch (_) {}
            // Keep the window alive so the OS can fully spool before it closes
            setTimeout(() => { try { printWindow.close(); } catch (_) {} }, 3000);
            if (success) {
              resolve({ success: true, printer: deviceName || 'OS default' });
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
