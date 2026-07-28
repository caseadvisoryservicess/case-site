/**
 * Геоаналитика локации: что находится вокруг объекта.
 *
 * Источник - собственная геобаза CASE (admin/data/geo), собранная из 2ГИС и
 * OpenStreetMap: бизнес-центры, медицинские учреждения, аптеки, заведения
 * общепита, махаллинские комитеты и сетка населения по Ташкенту.
 *
 * Модуль ничего не выдумывает: он только считает расстояния и складывает
 * объекты, которые уже есть в базе. Всё, что уходит на лендинг, должно
 * сопровождаться подписью с источником и датой сбора - у части записей
 * стоит пометка needs_review, и делать вид, что это перепись, нельзя.
 *
 * Использование:
 *   const { analyze } = require('./geo');
 *   const res = analyze({ lat: 41.33, lng: 69.28, radii: [500, 1000, 2000] });
 */
'use strict';
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'data', 'geo');

// какой файл какими полями описывает объект: [широта, долгота, имя, адрес]
const SOURCES = [
  { file: 'bc.json',          cat: 'bc',       keys: ['lat', 'lng', 'name', 'address'] },
  { file: 'medicine.json',    cat: 'med',      keys: ['la', 'ln', 'n', 'a'], subKey: 't' },
  { file: 'pharmacies.json',  cat: 'pharmacy', keys: ['la', 'ln', 'n', 'a'] },
  { file: 'restaurants.json', cat: 'food',     keys: ['la', 'ln', 'n', 'a'] },
  { file: 'cafes.json',       cat: 'food',     keys: ['la', 'ln', 'n', 'a'] },
  { file: 'mahallas.json',    cat: 'mahalla',  keys: ['la', 'ln', 'n', 'a'] }
];

let CACHE = null;

function readItems(file) {
  const p = path.join(DIR, file);
  if (!fs.existsSync(p)) return [];
  const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (Array.isArray(raw)) return raw;
  // некоторые выгрузки завёрнуты в объект: берём первый массив внутри
  for (const v of Object.values(raw)) if (Array.isArray(v)) return v;
  return [];
}

function loadAll() {
  if (CACHE) return CACHE;
  const points = [];
  for (const src of SOURCES) {
    for (const x of readItems(src.file)) {
      const lat = Number(x[src.keys[0]]);
      const lng = Number(x[src.keys[1]]);
      if (!lat || !lng) continue;
      points.push({
        cat: src.cat,
        sub: src.subKey ? (x[src.subKey] || '') : '',
        name: String(x[src.keys[2]] || '').trim(),
        addr: String(x[src.keys[3]] || '').trim(),
        lat, lng
      });
    }
  }
  // сетка населения: отдельный csv, единица измерения в источнике не
  // подтверждена, поэтому наружу отдаём только как «ориентировочно»
  const grid = [];
  const gp = path.join(DIR, 'population_grid.csv');
  if (fs.existsSync(gp)) {
    const lines = fs.readFileSync(gp, 'utf8').split(/\r?\n/);
    const head = lines[0].replace(/^﻿/, '').split(',');
    const iLat = head.indexOf('latitude'), iLng = head.indexOf('longitude'), iVal = head.indexOf('population_value');
    for (let i = 1; i < lines.length; i++) {
      const c = lines[i].split(',');
      const lat = Number(c[iLat]), lng = Number(c[iLng]), val = Number(c[iVal]);
      if (lat && lng && val) grid.push({ lat, lng, val });
    }
  }
  CACHE = { points, grid };
  return CACHE;
}

// расстояние по большому кругу, метры
function distance(aLat, aLng, bLat, bLng) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * Считает окружение точки.
 * @param {{lat:number,lng:number,radii?:number[],nearest?:number,exclude?:number}} opts
 *   exclude - радиус в метрах, внутри которого объекты считаем самим объектом
 *   (нужно, когда наш адрес уже есть в базе и не должен попасть в конкуренты)
 */
function analyze(opts) {
  const { lat, lng } = opts;
  const radii = opts.radii || [500, 1000, 2000];
  const nearestN = opts.nearest || 5;
  const exclude = opts.exclude || 0;
  const { points, grid } = loadAll();

  const withDist = [];
  for (const p of points) {
    const d = distance(lat, lng, p.lat, p.lng);
    if (d <= exclude) continue;
    if (d <= Math.max(...radii)) withDist.push({ ...p, d: Math.round(d) });
  }
  withDist.sort((a, b) => a.d - b.d);

  const counts = {};
  for (const r of radii) {
    counts[r] = {};
    for (const p of withDist) {
      if (p.d > r) continue;
      counts[r][p.cat] = (counts[r][p.cat] || 0) + 1;
      if (p.cat === 'med' && p.sub) {
        counts[r]['med:' + p.sub] = (counts[r]['med:' + p.sub] || 0) + 1;
      }
    }
  }

  const nearest = {};
  for (const cat of ['bc', 'med', 'pharmacy', 'food', 'mahalla']) {
    nearest[cat] = withDist.filter((p) => p.cat === cat && p.name).slice(0, nearestN);
  }

  // население: сумма ячеек сетки, попавших в радиус
  const population = {};
  for (const r of radii) {
    let sum = 0;
    for (const g of grid) if (distance(lat, lng, g.lat, g.lng) <= r) sum += g.val;
    population[r] = Math.round(sum);
  }

  return { lat, lng, radii, counts, nearest, population, total: withDist.length, points: withDist };
}

module.exports = { analyze, distance, loadAll };
