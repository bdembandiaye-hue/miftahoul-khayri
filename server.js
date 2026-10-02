require('dotenv').config();
const express = require('express');
const session = require('express-session');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const store = require('./storage');

const app = express();
const PORT = process.env.PORT || 3000;
const PROD = process.env.NODE_ENV === 'production';

/* ---------- Admin ---------- */
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH
  || bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'admin123', 10);
if (PROD && !process.env.ADMIN_PASSWORD && !process.env.ADMIN_PASSWORD_HASH) {
  console.warn('⚠️  ATTENTION : mot de passe admin par défaut (admin123). Définissez ADMIN_PASSWORD sur Render !');
}

app.set('trust proxy', 1); // Render est derrière un proxy (HTTPS + vraie IP)
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-this-secret-khayri',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: PROD, maxAge: 1000 * 60 * 60 * 8 }
}));
app.use(express.static(store.PUBLIC));

const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
function requireAdmin(req, res, next) {
  if (!req.session.admin) return res.status(401).json({ error: 'Accès administrateur requis.' });
  next();
}

/* ---------- Upload (en mémoire, puis envoyé vers Supabase ou disque) ---------- */
const allowed = {
  pdf: ['application/pdf'],
  photo: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  audio: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/webm'],
  event: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
};
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 45 * 1024 * 1024 }, // Supabase gratuit : 50 Mo max par fichier
  fileFilter: (req, file, cb) => {
    const type = req.body.type;
    if (!allowed[type] || !allowed[type].includes(file.mimetype)) return cb(new Error('Type de fichier non autorisé.'));
    cb(null, true);
  }
});

/* ---------- API contenus ---------- */
app.get('/api/health', (req, res) => res.json({ ok: true, storage: store.useSupabase ? 'supabase' : 'local' }));

app.get('/api/content', wrap(async (req, res) => res.json(await store.getContent())));

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username !== ADMIN_USER || !bcrypt.compareSync(password || '', ADMIN_PASSWORD_HASH)) {
    return res.status(401).json({ error: 'Identifiants incorrects.' });
  }
  req.session.admin = true;
  res.json({ ok: true });
});
app.post('/api/logout', (req, res) => req.session.destroy(() => res.json({ ok: true })));
app.get('/api/me', (req, res) => res.json({ admin: !!req.session.admin }));

app.post('/api/upload', requireAdmin, (req, res, next) => {
  upload.single('file')(req, res, async (err) => {
    try {
      if (err) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Fichier trop lourd (45 Mo max).' : err.message });
      const { title, type, section, description, date, time, place } = req.body;
      if (!title || !type) return res.status(400).json({ error: 'Le titre et le type sont obligatoires.' });
      if (!allowed[type]) return res.status(400).json({ error: 'Type inconnu.' });

      const f = await store.saveFile(type, req.file);
      const item = {
        id: crypto.randomUUID(),
        title: title.trim(),
        description: (description || '').trim(),
        section: section || '',
        date: date || '',
        time: time || '',
        place: (place || '').trim(),
        ...f,
        createdAt: new Date().toISOString()
      };
      await store.addItem(type, item);
      res.json({ ok: true, item });
    } catch (e) { next(e); }
  });
});

app.delete('/api/content/:type/:id', requireAdmin, wrap(async (req, res) => {
  const ok = await store.deleteItem(req.params.type, req.params.id);
  if (!ok) return res.status(404).json({ error: 'Contenu introuvable.' });
  res.json({ ok: true });
}));

/* ================= FORMULAIRE DE CONTACT ================= */
const clean = (v, max = 200) => String(v || '').replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, max);
const cleanLong = (v, max = 1500) => String(v || '').replace(/\r/g, '').trim().slice(0, max);

// anti-spam simple : 5 envois / 15 min par IP
const hits = new Map();
function rateLimit(req, res, next) {
  const ip = req.ip, now = Date.now();
  const list = (hits.get(ip) || []).filter(t => now - t < 15 * 60 * 1000);
  if (list.length >= 5) return res.status(429).json({ error: 'Trop de demandes. Réessayez dans quelques minutes.' });
  list.push(now); hits.set(ip, list); next();
}

app.post('/api/contact', rateLimit, wrap(async (req, res) => {
  const b = req.body || {};
  if (b.website) return res.json({ ok: true }); // robot (champ caché rempli)

  const prenom = clean(b.prenom, 60), nom = clean(b.nom, 60);
  const digits = String(b.telephone || '').replace(/\D/g, '').replace(/^221/, '');
  const email = clean(b.email, 100);
  const integrer = ['Oui', 'Non', 'Déjà membre'].includes(b.integrer) ? b.integrer : '';
  const pourquoi = cleanLong(b.pourquoi, 1000);

  if (prenom.length < 2 || nom.length < 2) return res.status(400).json({ error: 'Prénom et nom obligatoires.' });
  if (!/^[37]\d{8}$/.test(digits)) return res.status(400).json({ error: 'Numéro de téléphone invalide.' });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Email invalide.' });
  if (!integrer) return res.status(400).json({ error: 'Indiquez si vous souhaitez intégrer le Daara.' });
  if (integrer === 'Oui' && pourquoi.length < 10) return res.status(400).json({ error: 'Expliquez pourquoi vous souhaitez intégrer le Daara.' });
  if (b.consent !== 'oui') return res.status(400).json({ error: 'Le consentement est obligatoire.' });

  await store.addMessage({
    id: crypto.randomUUID(),
    prenom, nom,
    telephone: '+221 ' + digits.replace(/^(\d{2})(\d{3})(\d{2})(\d{2})$/, '$1 $2 $3 $4'),
    email,
    ville: clean(b.ville, 80),
    age: clean(b.age, 30),
    moyen: clean(b.moyen, 20),
    integrer,
    pourquoi: integrer === 'Oui' ? pourquoi : '',
    contributions: integrer === 'Oui' && Array.isArray(b.contributions) ? b.contributions.slice(0, 10).map(c => clean(c, 50)) : [],
    disponibilite: integrer === 'Oui' ? clean(b.disponibilite, 60) : '',
    objet: clean(b.objet, 60),
    suggestions: cleanLong(b.suggestions),
    message: cleanLong(b.message),
    source: clean(b.source, 40),
    lu: false,
    createdAt: new Date().toISOString()
  });
  res.json({ ok: true });
}));

app.get('/api/messages', requireAdmin, wrap(async (req, res) => res.json(await store.getMessages())));

app.patch('/api/messages/:id', requireAdmin, wrap(async (req, res) => {
  if (!(await store.setMessageRead(req.params.id, !!req.body.lu))) return res.status(404).json({ error: 'Message introuvable.' });
  res.json({ ok: true });
}));

app.delete('/api/messages/:id', requireAdmin, wrap(async (req, res) => {
  if (!(await store.deleteMessage(req.params.id))) return res.status(404).json({ error: 'Message introuvable.' });
  res.json({ ok: true });
}));

app.get('/api/messages.csv', requireAdmin, wrap(async (req, res) => {
  const cols = ['createdAt','prenom','nom','telephone','email','ville','age','moyen','integrer','pourquoi','contributions','disponibilite','objet','suggestions','message','source','lu'];
  const esc = v => '"' + String(Array.isArray(v) ? v.join(', ') : v ?? '').replace(/"/g, '""') + '"';
  const csv = '﻿' + cols.join(';') + '\n' + (await store.getMessages()).map(m => cols.map(c => esc(m[c])).join(';')).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="messages-daara.csv"');
  res.send(csv);
}));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Erreur serveur.' });
});

app.listen(PORT, () => {
  console.log('==========================================');
  console.log('Dahira Miftahoul Khayri');
  console.log(`Site : http://localhost:${PORT}`);
  console.log(`Stockage : ${store.useSupabase ? 'Supabase' : 'fichiers locaux'}`);
  console.log('==========================================');
});
