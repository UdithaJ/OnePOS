const { BrowserWindow } = require('electron');

async function getPrinters(event) {
  return event.sender.getPrintersAsync();
}

async function printBill(event, htmlContent) {
  // Resolve printers from the main window — it has a guaranteed print context
  const printers = await event.sender.getPrintersAsync();
  const printer = printers.find(p => p.isDefault) || printers[0];
  console.log('[print-bill] printers:', printers.length, '| using:', printer?.name || 'system default');

  return new Promise((resolve, reject) => {
    const printWindow = new BrowserWindow({
      show: false,
      width: 800,
      height: 600,
      webPreferences: { contextIsolation: true },
    });

    // Load about:blank first, then inject HTML via JS — avoids data-URL length limits
    // and ensures the document is fully writable before printing
    printWindow.loadURL('about:blank');

    printWindow.webContents.once('did-finish-load', async () => {
      try {
        // Write the bill HTML into the blank document
        await printWindow.webContents.executeJavaScript(
          `document.open(); document.write(${JSON.stringify(htmlContent)}); document.close();`
        );

        // Give the browser time to apply CSS and complete layout before printing
        await new Promise(r => setTimeout(r, 500));

        console.log('[print-bill] sending to printer:', printer?.name || 'system default');
        const result = await Promise.resolve(
          printWindow.webContents.print({
            silent: true,
            printBackground: true,
            deviceName: printer?.name || '',
          })
        );
        console.log('[print-bill] print() result:', result);

        // Keep the window alive long enough for the OS to fully spool the job
        setTimeout(() => printWindow.close(), 3000);

        if (result === false) {
          reject(new Error('Print job returned false'));
        } else {
          resolve({ success: true, printer: printer?.name || 'default' });
        }
      } catch (e) {
        console.error('[print-bill] error:', e);
        printWindow.close();
        reject(e);
      }
    });

    printWindow.webContents.on('did-fail-load', (_e, _code, desc) => {
      console.error('[print-bill] load failed:', desc);
      printWindow.close();
      reject(new Error('Failed to load bill: ' + desc));
    });
  });
}

module.exports = { getPrinters, printBill };
