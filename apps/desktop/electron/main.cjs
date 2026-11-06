const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function receiptHtml(receipt) {
  if (!receipt || !Array.isArray(receipt.lines) || receipt.lines.length > 100) {
    throw new Error('Recibo inválido');
  }

  const currency = /^[A-Z]{3}$/.test(receipt.currency ?? '') ? receipt.currency : 'BOB';
  const money = (value) => {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) throw new Error('Importe inválido');
    return new Intl.NumberFormat('es-BO', { style: 'currency', currency }).format(amount);
  };
  const lines = receipt.lines.map((line) => `
    <tr><td>${escapeHtml(line.description)}</td>
    <td>${escapeHtml(line.quantity)}</td><td>${money(line.total)}</td></tr>`).join('');

  return `<!doctype html><html lang="es"><meta charset="utf-8"><title>Recibo</title>
  <style>body{font:14px Arial,sans-serif;width:72mm;margin:0 auto;padding:8mm;color:#111}
  h1,p{text-align:center;margin:4px 0}table{width:100%;border-collapse:collapse;margin:16px 0}
  td{padding:5px 0;border-bottom:1px solid #ddd}td:last-child{text-align:right}
  .total{font-weight:bold;font-size:18px;text-align:right}</style>
  <h1>${escapeHtml(receipt.businessName)}</h1><p>${escapeHtml(receipt.branchName)}</p>
  <p>Recibo ${escapeHtml(receipt.receiptNumber)}</p><p>${escapeHtml(receipt.issuedAt)}</p>
  <table>${lines}</table><p class="total">Total: ${money(receipt.total)}</p></html>`;
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) window.loadURL(devUrl);
  else window.loadFile(path.join(__dirname, '../dist/index.html'));
}

function createReceiptWindow(html) {
  const window = new BrowserWindow({
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  return window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`).then(() => window);
}

ipcMain.handle('receipt:pdf', async (_event, receipt) => {
  const window = await createReceiptWindow(receiptHtml(receipt));
  try {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Guardar recibo PDF',
      defaultPath: `recibo-${Date.now()}.pdf`,
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    });
    if (canceled || !filePath) return { canceled: true };
    const pdf = await window.webContents.printToPDF({ printBackground: true });
    await fs.writeFile(filePath, pdf);
    return { canceled: false, filePath };
  } finally {
    window.destroy();
  }
});

ipcMain.handle('receipt:print', async (_event, receipt) => {
  const window = await createReceiptWindow(receiptHtml(receipt));
  return new Promise((resolve, reject) => {
    window.webContents.print({ silent: false }, (success, reason) => {
      window.destroy();
      if (success) resolve(true);
      else reject(new Error(reason || 'No se pudo imprimir el recibo'));
    });
  });
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
