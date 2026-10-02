/* Couche de stockage :
 * - Si SUPABASE_URL + SUPABASE_SERVICE_KEY sont définis -> Supabase (base + fichiers)  [Render]
 * - Sinon -> fichiers JSON locaux + dossier public/uploads                         [PC local]
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const CONTENT_FILE = path.join(DATA_DIR, 'content.json');
const MSG_FILE = path.join(DATA_DIR, 'messages.json');
const BUCKET = process.env.SUPABASE_BUCKET || 'media';

const useSupabase = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);
let sb = null;
if (useSupabase) {
  const { createClient } = require('@supabase/supabase-js');
  sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
}

const KEYS = { pdf: 'pdfs', photo: 'photos', audio: 'audios', event: 'events' };
const FOLDER = { pdf: 'pdf', photo: 'photos', event: 'photos', audio: 'audios' };

/* ---------- Local ---------- */
function ensureLocal() {
  for (const f of ['pdf', 'photos', 'audios']) fs.mkdirSync(path.join(PUBLIC, 'uploads', f), { recursive: true });
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(CONTENT_FILE)) fs.writeFileSync(CONTENT_FILE, JSON.stringify({ pdfs: [], photos: [], audios: [], events: [] }, null, 2));
  if (!fs.existsSync(MSG_FILE)) fs.writeFileSync(MSG_FILE, '[]');
}
const readJSON = (f, def) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return def; } };
const writeJSON = (f, v) => fs.writeFileSync(f, JSON.stringify(v, null, 2));

function check(res) {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

/* ---------- Fichiers ---------- */
async function saveFile(type, file) {
  if (!file) return { filename: null, originalName: null, url: null, storagePath: null };
  const ext = path.extname(file.originalname).toLowerCase();
  const filename = Date.now() + '-' + crypto.randomBytes(5).toString('hex') + ext;
  const folder = FOLDER[type];
  if (useSupabase) {
    const storagePath = `${folder}/${filename}`;
    check(await sb.storage.from(BUCKET).upload(storagePath, file.buffer, { contentType: file.mimetype, upsert: false }));
    const url = sb.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl;
    return { filename, originalName: file.originalname, url, storagePath };
  }
  fs.writeFileSync(path.join(PUBLIC, 'uploads', folder, filename), file.buffer);
  return { filename, originalName: file.originalname, url: `/uploads/${folder}/${encodeURIComponent(filename)}`, storagePath: null };
}

async function removeFile(type, item) {
  if (!item || !item.filename) return;
  if (useSupabase) {
    const p = item.storagePath || `${FOLDER[type]}/${item.filename}`;
    await sb.storage.from(BUCKET).remove([p]);
    return;
  }
  const fp = path.join(PUBLIC, 'uploads', FOLDER[type], item.filename);
  if (fs.existsSync(fp)) fs.unlinkSync(fp);
}

/* ---------- Contenus (pdf, photos, audios, événements) ---------- */
// Supabase : table "items" (id, type, data jsonb, created_at)
async function getContent() {
  if (useSupabase) {
    const rows = check(await sb.from('items').select('id,type,data,created_at').order('created_at', { ascending: true }));
    const db = { pdfs: [], photos: [], audios: [], events: [] };
    for (const r of rows) if (KEYS[r.type]) db[KEYS[r.type]].push({ ...r.data, id: r.id, createdAt: r.created_at });
    return db;
  }
  return readJSON(CONTENT_FILE, { pdfs: [], photos: [], audios: [], events: [] });
}

async function addItem(type, item) {
  if (!KEYS[type]) throw new Error('Type inconnu.');
  if (useSupabase) {
    const { id, createdAt, ...data } = item;
    check(await sb.from('items').insert({ id, type, data, created_at: createdAt }));
    return item;
  }
  const db = readJSON(CONTENT_FILE, { pdfs: [], photos: [], audios: [], events: [] });
  db[KEYS[type]].push(item);
  writeJSON(CONTENT_FILE, db);
  return item;
}

async function deleteItem(type, id) {
  if (!KEYS[type]) throw new Error('Type inconnu.');
  if (useSupabase) {
    const rows = check(await sb.from('items').select('id,data').eq('id', id).eq('type', type));
    if (!rows.length) return false;
    await removeFile(type, rows[0].data);
    check(await sb.from('items').delete().eq('id', id));
    return true;
  }
  const db = readJSON(CONTENT_FILE, { pdfs: [], photos: [], audios: [], events: [] });
  const list = db[KEYS[type]], i = list.findIndex(x => x.id === id);
  if (i === -1) return false;
  await removeFile(type, list[i]);
  list.splice(i, 1);
  writeJSON(CONTENT_FILE, db);
  return true;
}

/* ---------- Messages du formulaire ---------- */
// Supabase : table "messages" (id, data jsonb, lu bool, created_at)
async function getMessages() {
  if (useSupabase) {
    const rows = check(await sb.from('messages').select('id,data,lu,created_at').order('created_at', { ascending: false }));
    return rows.map(r => ({ ...r.data, id: r.id, lu: r.lu, createdAt: r.created_at }));
  }
  return readJSON(MSG_FILE, []);
}

async function addMessage(msg) {
  if (useSupabase) {
    const { id, lu, createdAt, ...data } = msg;
    check(await sb.from('messages').insert({ id, data, lu, created_at: createdAt }));
    return;
  }
  const msgs = readJSON(MSG_FILE, []);
  msgs.unshift(msg);
  writeJSON(MSG_FILE, msgs);
}

async function setMessageRead(id, lu) {
  if (useSupabase) {
    const rows = check(await sb.from('messages').update({ lu }).eq('id', id).select('id'));
    return rows.length > 0;
  }
  const msgs = readJSON(MSG_FILE, []), m = msgs.find(x => x.id === id);
  if (!m) return false;
  m.lu = lu; writeJSON(MSG_FILE, msgs); return true;
}

async function deleteMessage(id) {
  if (useSupabase) {
    const rows = check(await sb.from('messages').delete().eq('id', id).select('id'));
    return rows.length > 0;
  }
  const msgs = readJSON(MSG_FILE, []), i = msgs.findIndex(x => x.id === id);
  if (i === -1) return false;
  msgs.splice(i, 1); writeJSON(MSG_FILE, msgs); return true;
}

if (!useSupabase) ensureLocal();

module.exports = { useSupabase, PUBLIC, saveFile, getContent, addItem, deleteItem, getMessages, addMessage, setMessageRead, deleteMessage };
