import './style.css';
import logo from './logo.png';
import mammoth from 'mammoth/mammoth.browser.min.js';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.js?url';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fold = s => s.replace(/[\u00C0-\u024F]/g, c => c.normalize('NFD')[0]).toLowerCase();
const fsize = b => b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(1) + ' KB' : (b / 1048576).toFixed(1) + ' MB';
const MAXHITS = 2000, MAX_ITEMS = 40, MAX_STORE = 30 * 1048576;
const KINDS = { docx: 'WORD', xlsx: 'EXCEL', xls: 'EXCEL', csv: 'EXCEL', pptx: 'POWERPOINT', pdf: 'PDF', txt: 'TXT' };
const ICON = { WORD: 'W', EXCEL: 'X', POWERPOINT: 'P', PDF: 'PDF', TXT: 'TXT' };
const TAG = 'All-in-One Document Reader';
document.querySelectorAll('.logoimg').forEach(i => { i.src = logo; });
$('#ab-ver').textContent = __APP_VERSION__;
$('#ab-build').textContent = __APP_BUILD__;

const state = { kind: null, view: 'home', pdf: null, sheets: null, zoom: 1 };
let query = '', hits = [], cur = -1, stoken = 0, ttimer;

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(ttimer); ttimer = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ---------- Tema ---------- */
const root = document.documentElement;
const isDark = () => root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
function paintTheme() {
  $('#theme').textContent = isDark() ? '☀' : '☾';
  if (Capacitor.isNativePlatform()) {
    StatusBar.setBackgroundColor({ color: isDark() ? '#101c31' : '#ffffff' }).catch(() => {});
    StatusBar.setStyle({ style: isDark() ? Style.Dark : Style.Light }).catch(() => {});
  }
}
try { const s = localStorage.getItem('lector-tema'); if (s) root.dataset.theme = s; } catch (e) {}
paintTheme();
$('#theme').onclick = () => {
  const n = isDark() ? 'light' : 'dark'; root.dataset.theme = n;
  try { localStorage.setItem('lector-tema', n); } catch (e) {}
  paintTheme();
};

/* ---------- Vistas ---------- */
function showView(v) {
  state.view = v;
  ['home', 'doc', 'hist', 'about'].forEach(n => $('#v-' + n).classList.toggle('on', n === v));
  $('#n-read').classList.toggle('on', v === 'home' || v === 'doc');
  $('#n-hist').classList.toggle('on', v === 'hist');
  $('#n-about').classList.toggle('on', v === 'about');
  $('#views').scrollTop = 0;
  if (v === 'hist') renderHist();
  if (v === 'home') renderRecent();
}
$('#n-read').onclick = () => showView(state.kind ? 'doc' : 'home');
$('#n-hist').onclick = () => showView('hist');
$('#n-about').onclick = () => showView('about');
$('#seeall').onclick = () => showView('hist');
$('#close').onclick = closeDoc;

function closeDoc() {
  closeSearch(); stoken++;
  if (state.pdf && state.pdf.obs) state.pdf.obs.disconnect();
  state.pdf = null; state.sheets = null; state.kind = null;
  $('#out').innerHTML = ''; $('#tools').innerHTML = '';
  $('#fname').textContent = TAG;
  showView('home');
}

/* ---------- Historial (metadatos en localStorage, archivos en IndexedDB) ---------- */
const loadH = () => { try { return JSON.parse(localStorage.getItem('lector-hist') || '[]'); } catch (e) { return []; } };
const saveH = h => { try { localStorage.setItem('lector-hist', JSON.stringify(h)); } catch (e) {} };
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('lector-db', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('blobs');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function blobOp(mode, fn) {
  const d = await idb();
  return new Promise((res, rej) => {
    const t = d.transaction('blobs', mode); const rq = fn(t.objectStore('blobs'));
    t.oncomplete = () => res(rq && rq.result); t.onerror = t.onabort = () => rej(t.error);
  });
}
async function addHistory(f, kind, buf, id) {
  id = id || [f.name, f.size, f.lastModified].join('|');
  const h = loadH().filter(e => e.id !== id);
  let saved = buf.byteLength <= MAX_STORE;
  if (saved) { try { await blobOp('readwrite', s => s.put(new Blob([buf]), id)); } catch (e) { saved = false; } }
  h.unshift({ id, name: f.name, kind, size: f.size, t: Date.now(), saved });
  const drop = h.splice(MAX_ITEMS);
  saveH(h);
  for (const e of drop) { try { await blobOp('readwrite', s => s.delete(e.id)); } catch (x) {} }
}
function ago(t) {
  const m = Math.floor((Date.now() - t) / 60000);
  if (m < 1) return 'ahora'; if (m < 60) return 'hace ' + m + ' min';
  const h = Math.floor(m / 60); if (h < 24) return 'hace ' + h + ' h';
  const d = Math.floor(h / 24); if (d < 7) return 'hace ' + d + ' d';
  return new Date(t).toLocaleDateString('es');
}
function listHtml(items) {
  return items.map(e => `<div class="item" role="button" tabindex="0" data-id="${esc(e.id)}">
    <div class="ico k-${e.kind}">${ICON[e.kind]}</div>
    <div class="t"><b>${esc(e.name)}</b><small>${fsize(e.size)}, ${ago(e.t)}</small></div>
    <button class="del" data-del="${esc(e.id)}" aria-label="Quitar del historial">✕</button></div>`).join('');
}
function renderRecent() {
  const h = loadH().slice(0, 3);
  $('#recent-wrap').hidden = !h.length;
  $('#recent').innerHTML = listHtml(h);
}
function renderHist() {
  const q = fold($('#hq').value.trim());
  const all = loadH(), h = all.filter(e => !q || fold(e.name).includes(q));
  $('#clearh').hidden = !all.length;
  $('#hlist').innerHTML = h.length ? listHtml(h)
    : `<div class="empty">${all.length ? 'Ningún archivo coincide con tu búsqueda.' : 'Aún no has abierto archivos. Los que abras aparecerán aquí para volver a abrirlos.'}</div>`;
}
async function reopen(id) {
  const e = loadH().find(x => x.id === id); if (!e) return;
  let blob = null;
  try { blob = await blobOp('readonly', s => s.get(id)); } catch (x) {}
  if (!blob) { toast('Este archivo era muy grande para guardarse. Ábrelo de nuevo desde Elegir archivo.'); return; }
  openFile(new File([blob], e.name, { type: blob.type }), id);
}
function histClick(ev) {
  const del = ev.target.closest('[data-del]');
  if (del) {
    ev.stopPropagation(); const id = del.dataset.del;
    saveH(loadH().filter(e => e.id !== id)); blobOp('readwrite', s => s.delete(id)).catch(() => {});
    renderHist(); renderRecent(); return;
  }
  const it = ev.target.closest('.item'); if (it) reopen(it.dataset.id);
}
$('#hlist').onclick = histClick; $('#recent').onclick = histClick;
$('#hq').oninput = renderHist;
$('#clearh').onclick = () => {
  if (!confirm('¿Borrar todo el historial? También se eliminan las copias guardadas.')) return;
  saveH([]); blobOp('readwrite', s => s.clear()).catch(() => {}); renderHist();
};

/* ---------- Abrir archivos ---------- */
$('#file').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) openFile(f); };

async function openFile(f, id) {
  const ext = f.name.split('.').pop().toLowerCase(), kind = KINDS[ext];
  if (!kind) { toast('Formato no compatible. Usa .docx, .xlsx, .pptx, .pdf o .txt (los .doc y .ppt antiguos hay que guardarlos como .docx y .pptx).'); return; }
  closeSearch(); stoken++;
  if (state.pdf && state.pdf.obs) state.pdf.obs.disconnect();
  state.pdf = null; state.sheets = null; state.kind = kind;
  $('#out').innerHTML = ''; resetZoom();
  $('#tools').innerHTML = '<button class="icon" id="zo" aria-label="Alejar">−</button> <button class="icon" id="zi" aria-label="Acercar">+</button>';
  $('#sq').value = ''; query = '';
  $('#badge').textContent = kind; $('#meta').textContent = fsize(f.size);
  $('#fname').textContent = f.name;
  $('#load').hidden = false; $('#loadtxt').textContent = 'Abriendo ' + f.name + '…';
  showView('doc');
  try {
    const buf = await f.arrayBuffer();
    await ({ WORD: docx, EXCEL: sheets, POWERPOINT: pptx, PDF: pdf, TXT: txt })[kind](buf);
    $('#load').hidden = true;
    addHistory(f, kind, buf, id).catch(() => {});
  } catch (e) {
    console.error(e); $('#load').hidden = true;
    $('#out').innerHTML = '<div class="err">No se pudo abrir el archivo: ' + esc(e.message || e) + '</div>';
  }
}

/* ---------- Word ---------- */
async function docx(buf) {
  const r = await mammoth.convertToHtml({ arrayBuffer: buf });
  $('#out').innerHTML = '<article class="doc">' + (r.value || '<p>El documento está vacío.</p>') + '</article>'
    + (r.messages.length ? '<p class="note">Algunos elementos de formato avanzado pueden no mostrarse.</p>' : '');
}

/* ---------- TXT ---------- */
async function txt(buf) {
  const text = new TextDecoder('utf-8').decode(buf);
  $('#out').innerHTML = '<article class="doc"><pre>' + esc(text || 'El archivo está vacío.') + '</pre></article>';
}

/* ---------- Excel ---------- */
async function sheets(buf) {
  const wb = XLSX.read(buf, { type: 'array' });
  const rows = {}, MAX = 1000;
  wb.SheetNames.forEach(n => { rows[n] = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '', raw: false }); });
  const S = state.sheets = { rows, current: wb.SheetNames[0], names: wb.SheetNames, MAX };
  $('#meta').textContent += ', ' + wb.SheetNames.length + (wb.SheetNames.length === 1 ? ' hoja' : ' hojas');
  $('#out').innerHTML = '<div class="tabs" id="tabs"></div><div id="grid"></div><p class="note" id="gnote"></p>';
  wb.SheetNames.forEach(n => {
    const b = document.createElement('button'); b.className = 'tab'; b.dataset.name = n; b.textContent = n;
    b.onclick = () => drawSheet(n); $('#tabs').appendChild(b);
  });
  drawSheet(S.current);
}
const colName = n => { let s = ''; n++; while (n > 0) { s = String.fromCharCode(65 + (n - 1) % 26) + s; n = Math.floor((n - 1) / 26); } return s; };
function drawSheet(name) {
  const S = state.sheets; S.current = name;
  const all = S.rows[name], view = all.slice(0, S.MAX), w = Math.max(1, ...view.map(r => r.length));
  let h = '<div class="sheet"><table><thead><tr><th></th>';
  for (let c = 0; c < w; c++) h += '<th>' + colName(c) + '</th>';
  h += '</tr></thead><tbody>';
  view.forEach((r, i) => { h += '<tr><th>' + (i + 1) + '</th>'; for (let c = 0; c < w; c++) h += '<td>' + esc(r[c] ?? '') + '</td>'; h += '</tr>'; });
  $('#grid').innerHTML = h + '</tbody></table></div>';
  $('#gnote').textContent = all.length > S.MAX ? 'Se muestran las primeras ' + S.MAX + ' filas de ' + all.length + '.' : all.length + ' filas.';
  document.querySelectorAll('#tabs .tab').forEach(b => b.classList.toggle('on', b.dataset.name === name));
  if (query) applyDom();
}
function sheetBadges() {
  const S = state.sheets, fq = fold(query), counts = {};
  S.names.forEach(n => {
    let k = 0;
    if (fq) for (const r of S.rows[n].slice(0, S.MAX)) for (const v of r) if (v !== '' && fold(String(v)).includes(fq)) k++;
    counts[n] = k;
  });
  document.querySelectorAll('#tabs .tab').forEach(b => {
    const n = b.dataset.name; b.innerHTML = esc(n) + (counts[n] ? '<i>' + counts[n] + '</i>' : '');
  });
  if (fq && !counts[S.current]) { const alt = S.names.find(n => counts[n]); if (alt) drawSheet(alt); }
}

/* ---------- PowerPoint ---------- */
async function pptx(buf) {
  const zip = await JSZip.loadAsync(buf);
  const names = Object.keys(zip.files).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => parseInt(a.match(/(\d+)\.xml/)[1]) - parseInt(b.match(/(\d+)\.xml/)[1]));
  if (!names.length) throw new Error('No se encontraron diapositivas.');
  const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
  let html = '';
  for (let i = 0; i < names.length; i++) {
    const xml = new DOMParser().parseFromString(await zip.file(names[i]).async('string'), 'application/xml');
    let title = '', body = [];
    xml.querySelectorAll('sp').forEach(sp => {
      const ph = sp.querySelector('ph'), type = ph ? ph.getAttribute('type') : '';
      const paras = [...sp.getElementsByTagNameNS(A, 'p')]
        .map(p => [...p.getElementsByTagNameNS(A, 't')].map(t => t.textContent).join('')).filter(t => t.trim());
      if (!paras.length) return;
      if ((type === 'title' || type === 'ctrTitle') && !title) title = paras.join(' ');
      else if (!['sldNum', 'ftr', 'dt'].includes(type)) body.push(...paras);
    });
    html += '<div class="slide">' + (title ? '<h2>' + esc(title) + '</h2>' : '') + '<div class="body">'
      + body.map(t => '<p>' + esc(t) + '</p>').join('') + '</div><span class="n">' + (i + 1) + ' / ' + names.length + '</span></div>';
  }
  $('#meta').textContent += ', ' + names.length + (names.length === 1 ? ' diapositiva' : ' diapositivas');
  $('#out').innerHTML = '<div class="slides">' + html + '</div><p class="note">Se muestra el texto de cada diapositiva; las imágenes y los diseños complejos no se reproducen.</p>';
}

/* ---------- PDF ---------- */
async function pdf(buf) {
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  const P = state.pdf = { doc, pages: [], vps: [], txt: {}, zoom: 1, obs: null };
  for (let n = 1; n <= doc.numPages; n++) { const pg = await doc.getPage(n); P.pages.push(pg); P.vps.push(pg.getViewport({ scale: 1 })); }
  $('#meta').textContent += ', ' + doc.numPages + (doc.numPages === 1 ? ' página' : ' páginas');
  layoutPdf();
}
function layoutPdf() {
  const P = state.pdf; if (!P) return;
  if (P.obs) P.obs.disconnect();
  $('#out').innerHTML = '<div class="pages" id="pages"></div>';
  const box = $('#pages'); P.baseW = Math.max(260, $('#out').clientWidth); const W = P.baseW * P.zoom;
  P.obs = new IntersectionObserver(es => es.forEach(e => {
    const n = +e.target.dataset.n;
    if (e.isIntersecting) drawPage(n);
    else { const c = e.target.querySelector('canvas'); if (c) { c.remove(); delete e.target.dataset.z; } }
  }), { root: $('#views'), rootMargin: '700px 0px' });
  P.vps.forEach((vp, i) => {
    const d = document.createElement('div'); d.className = 'pw'; d.dataset.n = i + 1;
    d.style.width = W + 'px'; d.style.aspectRatio = vp.width + ' / ' + vp.height;
    box.appendChild(d); P.obs.observe(d);
  });
  if (query) pdfSearch();
}
async function drawPage(n) {
  const P = state.pdf; if (!P) return;
  const d = document.querySelector('#pages .pw[data-n="' + n + '"]');
  if (!d || d.dataset.z === String(P.zoom) || d.dataset.busy) return;
  d.dataset.busy = 1;
  const zNow = P.zoom, vp = P.vps[n - 1], dpr = Math.min(devicePixelRatio || 1, 2);
  const sc = Math.min(d.clientWidth * dpr / vp.width, 4096 / vp.width);
  const v = P.pages[n - 1].getViewport({ scale: sc });
  const c = document.createElement('canvas'); c.width = v.width; c.height = v.height;
  try {
    await P.pages[n - 1].render({ canvasContext: c.getContext('2d'), viewport: v }).promise;
    if (d.isConnected) { const old = d.querySelector('canvas'); if (old) old.remove(); d.prepend(c); d.dataset.z = zNow; }
  } catch (e) {}
  delete d.dataset.busy;
  if (state.pdf === P && P.zoom !== zNow && d.isConnected) drawPage(n);
}
async function pageItems(n) {
  const P = state.pdf; if (P.txt[n]) return P.txt[n];
  const tc = await P.pages[n - 1].getTextContent(), vp = P.vps[n - 1];
  return P.txt[n] = tc.items.filter(i => i.str && i.str.trim()).map(i => {
    const t = i.transform, h = i.height || Math.hypot(t[2], t[3]);
    const r = vp.convertToViewportRectangle([t[4], t[5], t[4] + i.width, t[5] + h]);
    return { str: i.str, x: Math.min(r[0], r[2]), y: Math.min(r[1], r[3]), w: Math.abs(r[2] - r[0]), h: Math.abs(r[3] - r[1]) };
  });
}
async function pdfSearch() {
  const P = state.pdf; if (!P) return;
  const my = ++stoken;
  document.querySelectorAll('#pages .hit').forEach(e => e.remove());
  hits = []; cur = -1; updateCount();
  if (!query) return;
  const fq = fold(query); $('#scount').textContent = '…';
  for (let n = 1; n <= P.doc.numPages && hits.length < MAXHITS; n++) {
    const items = await pageItems(n); if (my !== stoken) return;
    const wrap = document.querySelector('#pages .pw[data-n="' + n + '"]'), vp = P.vps[n - 1];
    if (!wrap) return;
    for (const it of items) {
      const f = fold(it.str); let i = f.indexOf(fq);
      while (i >= 0 && hits.length < MAXHITS) {
        const d = document.createElement('div'); d.className = 'hit';
        const L = it.x + it.w * i / it.str.length, W = it.w * fq.length / it.str.length;
        d.style.cssText = 'left:' + (L / vp.width * 100) + '%;top:' + (it.y / vp.height * 100) + '%;width:' + (W / vp.width * 100) + '%;height:' + (it.h / vp.height * 100) + '%';
        wrap.appendChild(d); hits.push(d); i = f.indexOf(fq, i + fq.length);
      }
    }
    if (hits.length && cur < 0) go(0); else updateCount();
  }
  if (my === stoken) updateCount();
}

/* ---------- Buscador de palabras ---------- */
function markText(rootEl, q) {
  const out = [], nodes = [];
  const w = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, {
    acceptNode: n => n.parentElement && !n.parentElement.closest('mark.hit,script,style') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
  });
  while (w.nextNode()) nodes.push(w.currentNode);
  for (const n of nodes) {
    const t = n.nodeValue, f = fold(t); let i = f.indexOf(q);
    if (i < 0) continue;
    const frag = document.createDocumentFragment(); let last = 0;
    while (i >= 0 && out.length < MAXHITS) {
      frag.append(t.slice(last, i));
      const m = document.createElement('mark'); m.className = 'hit'; m.textContent = t.slice(i, i + q.length);
      frag.append(m); out.push(m); last = i + q.length; i = f.indexOf(q, last);
    }
    frag.append(t.slice(last)); n.replaceWith(frag);
    if (out.length >= MAXHITS) break;
  }
  return out;
}
function clearMarks(rootEl) {
  rootEl.querySelectorAll('mark.hit').forEach(m => { const p = m.parentNode; m.replaceWith(document.createTextNode(m.textContent)); p.normalize(); });
}
function applyDom() {
  const rootEl = $('#out'); clearMarks(rootEl); hits = []; cur = -1;
  if (query) { hits = markText(rootEl, fold(query)); if (hits.length) go(0); }
  updateCount();
}
function go(i) {
  if (!hits.length) return;
  if (hits[cur]) hits[cur].classList.remove('cur');
  cur = (i + hits.length) % hits.length;
  const el = hits[cur]; el.classList.add('cur');
  el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
  updateCount();
}
function updateCount() {
  const c = $('#scount');
  c.textContent = hits.length ? (cur + 1) + '/' + hits.length + (hits.length >= MAXHITS ? '+' : '') : (query ? '0' : '');
  $('#sprev').disabled = $('#snext').disabled = hits.length < 2;
}
function runSearch(q) {
  query = q.trim(); stoken++;
  if (state.kind === 'PDF') { pdfSearch(); return; }
  if (state.kind === 'EXCEL' && state.sheets) sheetBadges();
  applyDom();
}
function closeSearch() {
  $('#sbar').hidden = true; query = ''; stoken++; hits = []; cur = -1;
  const o = $('#out');
  clearMarks(o); document.querySelectorAll('#pages .hit').forEach(e => e.remove());
  if (state.kind === 'EXCEL' && state.sheets) sheetBadges();
  updateCount();
}
let stimer;
$('#sq').oninput = e => { clearTimeout(stimer); stimer = setTimeout(() => runSearch(e.target.value), 250); };
$('#sq').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); if (hits.length) go(cur + 1); else runSearch($('#sq').value); } };
$('#snext').onclick = () => go(cur + 1);
$('#sprev').onclick = () => go(cur - 1);
$('#sbtn').onclick = () => {
  if ($('#sbar').hidden) { $('#sbar').hidden = false; $('#sq').focus(); }
  else { closeSearch(); $('#sq').value = ''; }
};

/* ---------- Botón atrás de Android ---------- */
try {
  CapApp.addListener('backButton', () => {
    if (!$('#sbar').hidden) { closeSearch(); $('#sq').value = ''; return; }
    if (state.view === 'hist' || state.view === 'about') { showView(state.kind ? 'doc' : 'home'); return; }
    if (state.view === 'doc') { closeDoc(); return; }
    CapApp.exitApp();
  });
} catch (e) {}

/* ---------- Zoom con los dedos (pellizcar) y botones + / − ---------- */
const MINZ = .5, MAXZ = 4;
const curZoom = () => state.kind === 'PDF' && state.pdf ? state.pdf.zoom : state.zoom;
function resetZoom() {
  state.zoom = 1;
  const o = $('#out'); o.style.transform = ''; o.style.width = ''; o.style.removeProperty('--zx');
}
function setPdfZoom(z, fx, fy) {
  const P = state.pdf, pg = $('#pages'); if (!P || !pg) return;
  const ratio = z / P.zoom, r = pg.getBoundingClientRect(), sc = $('#views');
  const cx = fx - r.left, cy = fy - r.top;
  pg.querySelectorAll('.pw').forEach(b => { b.style.width = (P.baseW * z) + 'px'; });
  P.zoom = z;
  sc.scrollTop += cy * (ratio - 1);
  pg.scrollLeft = (pg.scrollLeft + cx) * ratio - cx;
}
function refreshPdf() {
  document.querySelectorAll('#pages .pw').forEach(b => {
    delete b.dataset.z;
    const r = b.getBoundingClientRect();
    if (r.bottom > -800 && r.top < innerHeight + 800) drawPage(+b.dataset.n);
  });
}
function setZoom(z, fx, fy) {
  z = Math.min(MAXZ, Math.max(MINZ, z));
  if (!state.kind) return;
  if (state.kind === 'PDF') { setPdfZoom(z, fx, fy); return; }
  const z0 = state.zoom, ratio = z / z0, o = $('#out');
  state.zoom = z;
  if (state.kind === 'EXCEL') {
    const sc = document.querySelector('#grid .sheet'), r = sc && sc.getBoundingClientRect();
    o.style.setProperty('--zx', z);
    if (sc) {
      const px = fx - r.left, py = fy - r.top;
      sc.scrollLeft = (sc.scrollLeft + px) * ratio - px; sc.scrollTop = (sc.scrollTop + py) * ratio - py;
    }
    return;
  }
  const r = o.getBoundingClientRect(), cx = (fx - r.left) / z0, cy = (fy - r.top) / z0;
  o.style.transformOrigin = '0 0';
  o.style.transform = z === 1 ? '' : 'scale(' + z + ')';
  o.style.width = z === 1 ? '' : (100 / z) + '%';
  const r2 = o.getBoundingClientRect(), sc = $('#views');
  sc.scrollTop += (r2.top + cy * z) - fy; sc.scrollLeft += (r2.left + cx * z) - fx;
}
$('#tools').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  setZoom(curZoom() * (b.id === 'zi' ? 1.25 : 1 / 1.25), innerWidth / 2, innerHeight / 2);
  if (state.kind === 'PDF') refreshPdf();
});
let pin = null, praf = 0;
const tdist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
function endPinch() { if (!pin) return; pin = null; if (state.kind === 'PDF') refreshPdf(); }
const viewsEl = $('#views');
viewsEl.addEventListener('touchstart', e => {
  if (state.view === 'doc' && state.kind && e.touches.length === 2) pin = { d: tdist(e.touches), z: curZoom(), zz: curZoom(), fx: 0, fy: 0 };
  else if (pin && e.touches.length !== 2) endPinch();
}, { passive: true });
viewsEl.addEventListener('touchmove', e => {
  if (!pin || e.touches.length !== 2) return;
  if (e.cancelable) e.preventDefault();
  const t = e.touches;
  pin.fx = (t[0].clientX + t[1].clientX) / 2; pin.fy = (t[0].clientY + t[1].clientY) / 2;
  pin.zz = pin.z * tdist(t) / pin.d;
  if (!praf) praf = requestAnimationFrame(() => { praf = 0; if (pin) setZoom(pin.zz, pin.fx, pin.fy); });
}, { passive: false });
viewsEl.addEventListener('touchend', e => { if (pin && e.touches.length < 2) endPinch(); });
viewsEl.addEventListener('touchcancel', endPinch);

/* ---------- Archivos recibidos desde "Abrir con" de otras apps ---------- */
const Incoming = registerPlugin('IncomingFile');
async function checkIncoming() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const r = await Incoming.getPending();
    if (r.error) { toast('No se pudo abrir el archivo recibido.'); return; }
    if (!r.path) return;
    let blob;
    try {
      const res = await fetch(Capacitor.convertFileSrc(r.path));
      if (!res.ok) throw new Error('fetch');
      blob = await res.blob();
    } catch (e) {
      const b = await Incoming.readBase64({ path: r.path });
      const bin = atob(b.data), u = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      blob = new Blob([u]);
    }
    openFile(new File([blob], r.name, { lastModified: 0 }));
  } catch (e) { console.error(e); toast('No se pudo abrir el archivo recibido.'); }
}
try { Incoming.addListener('fileOpened', checkIncoming); } catch (e) {}
checkIncoming();

renderRecent();
