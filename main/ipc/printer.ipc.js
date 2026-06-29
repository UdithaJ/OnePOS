const { ipcMain } = require('electron');
const printerService = require('../services/printer.service');

function registerPrinterIPC() {
  ipcMain.handle('get-printers', printerService.getPrinters);
  ipcMain.handle('print-bill', printerService.printBill);
}

module.exports = registerPrinterIPC;
