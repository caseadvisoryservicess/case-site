/**
 * Пайплайн изображений лендинга: адаптивные варианты + WebP.
 *
 * Для каждого JPEG/PNG создаются уменьшенные копии (1280 и 640 по длинной
 * стороне) и WebP-версии всех размеров:
 *   photo.jpg -> photo.jpg (<=1920), photo-1280.jpg, photo-640.jpg,
 *                photo.webp, photo-1280.webp, photo-640.webp
 *
 * WebP кодируется через @jsquash/webp (WASM — работает на shared-хостинге,
 * где нативные модули не собираются). Если WASM недоступен, варианты
 * остаются только в JPEG — шаблон это учитывает (пишет <picture> только
 * для реально существующих файлов).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { Jimp, JimpMime } = require('jimp');

const SIZES = [1280, 640];
const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 80;
const WEBP_QUALITY = 78;

let webpEncode = null; // ленивая инициализация WASM-кодека
async function getWebpEncoder() {
  if (webpEncode !== null) return webpEncode;
  try {
    const enc = await import('@jsquash/webp/encode.js');
    const wasmPath = require.resolve('@jsquash/webp/package.json')
      .replace(/package\.json$/, 'codec/enc/webp_enc_simd.wasm');
    const wasm = await WebAssembly.compile(fs.readFileSync(wasmPath));
    await enc.init(wasm);
    webpEncode = enc.default;
  } catch (e) {
    console.error('WebP-кодек недоступен, изображения останутся в JPEG:', e.message);
    webpEncode = false;
  }
  return webpEncode;
}

async function saveWebp(img, outPath) {
  const encode = await getWebpEncoder();
  if (!encode) return false;
  const buf = await encode(
    { data: new Uint8ClampedArray(img.bitmap.data), width: img.bitmap.width, height: img.bitmap.height },
    { quality: WEBP_QUALITY }
  );
  fs.writeFileSync(outPath, Buffer.from(buf));
  return true;
}

function variantPath(filePath, size, ext) {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath, path.extname(filePath));
  return path.join(dir, size ? `${base}-${size}${ext}` : `${base}${ext}`);
}

/**
 * Создаёт все варианты для одного файла. Возвращает {width, height} исходника
 * (после ограничения 1920px) — шаблон подставляет их в атрибуты <img>.
 * Ошибки не роняют вызывающего: без вариантов страница просто отдаёт оригинал.
 */
async function makeVariants(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext !== '.jpg' && ext !== '.jpeg' && ext !== '.png') return null;
  try {
    const img = await Jimp.read(filePath);
    if (img.bitmap.width > MAX_DIMENSION || img.bitmap.height > MAX_DIMENSION) {
      img.scaleToFit({ w: MAX_DIMENSION, h: MAX_DIMENSION });
      const buf = ext === '.png'
        ? await img.getBuffer(JimpMime.png)
        : await img.getBuffer(JimpMime.jpeg, { quality: JPEG_QUALITY });
      fs.writeFileSync(filePath, buf);
    }
    await saveWebp(img, variantPath(filePath, 0, '.webp'));
    for (const size of SIZES) {
      if (img.bitmap.width <= size && img.bitmap.height <= size) continue;
      const v = img.clone().scaleToFit({ w: size, h: size });
      const jbuf = ext === '.png'
        ? await v.getBuffer(JimpMime.png)
        : await v.getBuffer(JimpMime.jpeg, { quality: JPEG_QUALITY });
      fs.writeFileSync(variantPath(filePath, size, ext), jbuf);
      await saveWebp(v, variantPath(filePath, size, '.webp'));
    }
    return { width: img.bitmap.width, height: img.bitmap.height };
  } catch (e) {
    console.error('Варианты изображения не созданы (' + path.basename(filePath) + '):', e.message);
    return null;
  }
}

/** Все имена файлов-вариантов, существующих рядом с исходником (для копирования в assets/). */
function listVariantFiles(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const out = [];
  for (const size of [0, ...SIZES]) {
    for (const e of [ext, '.webp']) {
      const p = variantPath(filePath, size, e);
      if (p !== filePath && fs.existsSync(p)) out.push(path.basename(p));
    }
  }
  return out;
}

module.exports = { makeVariants, listVariantFiles, SIZES };
