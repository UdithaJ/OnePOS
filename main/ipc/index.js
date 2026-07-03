const registerPrinterIPC = require('./printer.ipc');

function registerIPCHandlers() {
  registerPrinterIPC();
}

module.exports = registerIPCHandlers;
