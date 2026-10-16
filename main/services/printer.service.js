const { BrowserWindow } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');

async function getPrinters(event) {
  return event.sender.getPrintersAsync();
}

// Windows always registers virtual printers (Print to PDF, XPS, Fax, OneNote)
// even when the thermal printer is the only device actually connected, so the
// printer list is never a single entry and its order is not meaningful.
const VIRTUAL_PRINTER = /microsoft print to pdf|microsoft xps|^fax$|onenote|adobe pdf|pdfcreator|cutepdf|pdf24|print to file|snagit|foxit/i;

function isVirtual(printer) {
  return VIRTUAL_PRINTER.test(printer.name) || VIRTUAL_PRINTER.test(printer.displayName || '');
}

// Electron's PrinterInfo no longer carries `isDefault` -- the field was dropped
// from the structure, so the old `printers.find(p => p.isDefault)` was always
// undefined and the code fell through to `printers[0]`, i.e. whichever virtual
// printer the spooler happened to list first. Chromium accepts that name, reports
// the job as printed, and nothing comes out of the thermal printer.
//
// An empty deviceName targets the Windows default, but that is not dependable
// either: "Let Windows manage my default printer" reassigns it to the last-used
// device. So select the one physical printer directly and only fall back to the
// system default when the choice is genuinely ambiguous.
function resolveDeviceName(printers, requestedName) {
  if (requestedName) {
    const match = printers.find(
      p => p.name === requestedName || p.displayName === requestedName
    );
    if (match) return match.name;
    console.warn(`[print-bill] printer "${requestedName}" not found; falling back to auto-detect`);
  }

  const physical = printers.filter(p => !isVirtual(p));
  if (physical.length === 1) return physical[0].name;

  if (physical.length === 0) {
    console.warn('[print-bill] no physical printer found; using system default');
  } else {
    console.warn(
      `[print-bill] ${physical.length} physical printers found (${physical.map(p => p.name).join(', ')});` +
      ' using system default. Set BILL_PRINTER_NAME in .env to pin one.'
    );
  }
  return '';
}

// The slip is 68mm wide and grows with the bill: a long order would otherwise
// spill onto a second slip. 100mm stays the minimum, so short bills print
// exactly as they did on the fixed slip.
const BILL_PAGE = {
  widthMm: 68,
  minHeightMm: 100,
  // Bottom allowance so rounding never pushes the last line onto a new page
  slackMm: 3,
};

const PX_PER_MM = 96 / 25.4;

async function measureBillHeightMm(webContents) {
  // Measure the bill itself: the document is at least as tall as the hidden
  // print window, which would make every slip the window's height.
  const px = await webContents.executeJavaScript(
    "Math.ceil((document.querySelector('.bill') || document.body).getBoundingClientRect().bottom + window.scrollY)"
  );
  const contentMm = Math.ceil((Number(px) || 0) / PX_PER_MM) + BILL_PAGE.slackMm;
  return Math.max(BILL_PAGE.minHeightMm, contentMm);
}

// The bill's own @page rule names the 100mm minimum; restate it at the measured
// length so Chromium's CSS page size and the driver's page size agree.
async function setBillPageHeight(webContents, heightMm) {
  await webContents.executeJavaScript(`(() => {
    const style = document.createElement('style');
    style.textContent = '@page { size: ${BILL_PAGE.widthMm}mm ${heightMm}mm; margin: 0; }';
    document.head.appendChild(style);
  })()`);
}

async function printBill(event, htmlContent, copies = 1, printerName = '') {
  const printers = await event.sender.getPrintersAsync();

  if (!printers.length) {
    throw new Error('No printers are installed on this machine');
  }

  const deviceName = resolveDeviceName(printers, printerName || process.env.BILL_PRINTER_NAME || '');
  console.log(
    '[print-bill] available:', printers.map(p => p.name).join(', '),
    '| using:', deviceName || 'system default'
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

        const heightMm = await measureBillHeightMm(printWindow.webContents);
        await setBillPageHeight(printWindow.webContents, heightMm);

        console.log('[print-bill] sending to printer:', deviceName || 'system default', `| ${heightMm}mm slip`);

        // Use the callback form — Electron calls it even in builds where the return
        // is void. The callback is the only reliable signal that the job was submitted.
        printWindow.webContents.print(
          {
            silent: true,
            printBackground: true,
            deviceName,
            copies: Math.max(1, parseInt(copies) || 1),
            pageSize: { width: BILL_PAGE.widthMm * 1000, height: heightMm * 1000 },
            margins: { marginType: 'none' },
          },
          (success, failureReason) => {
            console.log('[print-bill] callback success:', success, failureReason || '');
            try { fs.unlinkSync(tmpFile); } catch (_) {}
            // Keep the window alive so the OS can fully spool before it closes
            setTimeout(() => { try { printWindow.close(); } catch (_) {} }, 3000);
            if (success) {
              resolve({ success: true, printer: deviceName || 'system default' });
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
