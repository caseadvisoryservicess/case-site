/**
 * Сборка zip-бэкапа папки data/ (проекты, лиды, пользователи).
 * Секретный ключ подписи сессий (.secret) в бэкап не попадает.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { ZipArchive } = require('archiver');

function walkFiles(dir, base, out) {
  base = base || dir;
  out = out || [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walkFiles(full, base, out);
    else out.push({ full, rel: path.relative(base, full) });
  }
  return out;
}

function buildBackupZip(dataDir) {
  return new Promise((resolve, reject) => {
    const zip = new ZipArchive({ zlib: { level: 9 } });
    const chunks = [];
    zip.on('data', (c) => chunks.push(c));
    zip.on('error', reject);
    zip.on('end', () => resolve(Buffer.concat(chunks)));
    for (const f of walkFiles(dataDir)) {
      if (f.rel === '.secret') continue;
      // телеметрия аналитики объёмная и не критичная — в бэкап не включается
      if (f.rel.startsWith('analytics' + path.sep)) continue;
      zip.file(f.full, { name: 'data/' + f.rel.split(path.sep).join('/') });
    }
    zip.finalize();
  });
}

module.exports = { buildBackupZip };
