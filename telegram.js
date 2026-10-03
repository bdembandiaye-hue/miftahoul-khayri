/* ================= BOT TELEGRAM DU DAARA =================
 * - Répond aux questions (menu + FAQ par mots-clés, + IA Groq si GROQ_API_KEY est défini)
 * - Prévient l'équipe (TELEGRAM_ADMIN_CHAT_ID) à chaque formulaire de contact
 * Variables : TELEGRAM_BOT_TOKEN (obligatoire), TELEGRAM_ADMIN_CHAT_ID, GROQ_API_KEY, GROQ_MODEL
 */
const crypto = require('crypto');

const TOKEN = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
const ADMIN_CHAT = (process.env.TELEGRAM_ADMIN_CHAT_ID || '').trim();
const GROQ_KEY = (process.env.GROQ_API_KEY || '').trim();
const GROQ_MODEL = (process.env.GROQ_MODEL || 'llama-3.3-70b-versatile').trim();
const SITE = (process.env.SITE_URL || process.env.RENDER_EXTERNAL_URL || 'https://dahira-miftahoul-khayri.onrender.com').replace(/\/$/, '');
const SECRET = crypto.createHash('sha256').update('khayri-tg-' + TOKEN).digest('hex').slice(0, 32);
const enabled = !!TOKEN;

const INFO = {
  nom: 'Daara Miftahoul Khayri',
  arabe: 'دار مفتاح الخير',
  lieu: 'Daral Miftahoul Khayri — Diakhao (région de Fatick), Sénégal',
  tel: '+221 77 889 27 34',
  wa: 'https://wa.me/221778892734',
  histoire: 'Le Dahira Miftahoul Khayri a été créé en 2007 par Serigne Saliou Mbacké, fils de Serigne Touba.',
  devise: 'Jamou Yalla • Ligéeyal Serigne Bi • Dimbalanté'
};

const esc = s => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

async function tg(method, body) {
  if (!enabled) return null;
  try {
    const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    const d = await r.json();
    if (!d.ok) console.error('Telegram', method, d.description);
    return d;
  } catch (e) { console.error('Telegram', method, e.message); return null; }
}
const send = (chat_id, text, extra = {}) =>
  tg('sendMessage', { chat_id, text, parse_mode: 'HTML', disable_web_page_preview: true, ...extra });

const MENU = {
  reply_markup: {
    keyboard: [
      [{ text: '📅 Événements' }, { text: '📖 Xam sa diné' }],
      [{ text: '🤝 Rejoindre le Daara' }, { text: '📍 Adresse' }],
      [{ text: '📞 Contact' }, { text: '🕌 Historique' }]
    ],
    resize_keyboard: true
  }
};

/* ---------- Réponses ---------- */
async function eventsText(store) {
  const db = await store.getContent();
  const today = new Date().toISOString().slice(0, 10);
  const list = db.events.filter(e => !e.date || e.date >= today).sort((a, b) => (a.date || '9').localeCompare(b.date || '9')).slice(0, 5);
  if (!list.length) return `📅 Aucun événement programmé pour le moment.\nSuivez le site : ${SITE}/evenements.html`;
  return '📅 <b>Prochains événements</b>\n\n' + list.map(e =>
    `• <b>${esc(e.title)}</b>\n  ${esc(e.date || 'Date à venir')}${e.time ? ' à ' + esc(e.time) : ''}${e.place ? '\n  📍 ' + esc(e.place) : ''}`
  ).join('\n\n') + `\n\nTous les événements : ${SITE}/evenements.html`;
}

async function pdfText(store) {
  const db = await store.getContent();
  const lines = db.pdfs.map(p => `• ${esc(p.title)}${p.url ? ` — <a href="${p.url.startsWith('http') ? p.url : SITE + p.url}">télécharger</a>` : ' (bientôt disponible)'}`);
  return '📖 <b>Xam sa diné</b>\n\n' + (lines.join('\n') || 'Aucun document pour le moment.') + `\n\n${SITE}/xam-sa-dine.html`;
}

const T = {
  start: n => `Assalamou aleykoum ${esc(n || '')} 🤲🏾\n\nBienvenue sur le bot du <b>${INFO.nom}</b> (${INFO.arabe}).\n<i>${INFO.devise}</i>\n\nChoisissez une option ci-dessous ou posez-moi votre question.`,
  rejoindre: () => `🤝 <b>Rejoindre le Daara</b>\n\nRemplissez le formulaire, un responsable vous recontactera :\n👉 ${SITE}/contact.html\n\nOu écrivez-nous sur WhatsApp : ${INFO.wa}`,
  adresse: () => `📍 <b>Adresse</b>\n${INFO.lieu}\n\nItinéraire : https://www.google.com/maps/dir/?api=1&destination=14.46209,-16.29039\nCarte : ${SITE}/contact.html#carte`,
  contact: () => `📞 <b>Contact</b>\nTéléphone / WhatsApp : ${INFO.tel}\nWhatsApp : ${INFO.wa}\nSite : ${SITE}`,
  histoire: () => `🕌 <b>Historique</b>\n${INFO.histoire}\n\nEn savoir plus : ${SITE}/historique.html`,
  inconnu: () => `Je n'ai pas bien compris 🙏🏾\nUtilisez le menu ci-dessous, ou contactez-nous au ${INFO.tel} (WhatsApp : ${INFO.wa}).`
};

// FAQ par mots-clés (fonctionne sans IA)
const RULES = [
  [/(^\/start|salam|bonjour|bonsoir|^salut|nanga def|asalam)/i, (s, m) => T.start(m.from && m.from.first_name)],
  [/(^\/evenements|év[eé]nement|evenement|activit|programme|magal|kazu|ziar|wazifa|quand)/i, s => eventsText(s)],
  [/(^\/xam|xam sa|pdf|tazawoud|massalik|choubane|sikhar|document|xassa[iï]d|livre)/i, s => pdfText(s)],
  [/(^\/rejoindre|rejoindre|int[eé]grer|inscri|membre|adh[eé]rer|devenir)/i, () => T.rejoindre()],
  [/(^\/adresse|adresse|o[uù] se trouve|localisation|itin[eé]raire|carte|diakhao|situ[eé])/i, () => T.adresse()],
  [/(^\/contact|contact|t[eé]l[eé]phone|num[eé]ro|appeler|whatsapp|joindre)/i, () => T.contact()],
  [/(^\/historique|histoire|historique|cr[eé][eé]|fondateur|fond[eé]|serigne saliou)/i, () => T.histoire()],
  [/(^\/site|site web|site internet|lien)/i, () => `🌐 ${SITE}`]
];

async function askAI(question, store) {
  if (!GROQ_KEY) return null;
  try {
    const events = (await store.getContent()).events.map(e => `${e.title} (${e.date || 'date à venir'}${e.place ? ', ' + e.place : ''})`).join('; ') || 'aucun';
    const system = `Tu es l'assistant du ${INFO.nom} (${INFO.lieu}). Réponds en français simple (ou en wolof si on te parle wolof), poliment, en 4 phrases maximum.
Faits connus : ${INFO.histoire} Devise : ${INFO.devise}. Téléphone/WhatsApp : ${INFO.tel}. Site : ${SITE}. Formulaire pour rejoindre : ${SITE}/contact.html. Événements publiés : ${events}.
Si tu ne connais pas la réponse (horaires, cotisations, règles internes…), ne l'invente pas : dis de contacter le ${INFO.tel}. Ne donne jamais d'avis religieux (fatwa) : oriente vers un Serigne du Daara.`;
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({ model: GROQ_MODEL, temperature: 0.3, max_tokens: 350, messages: [{ role: 'system', content: system }, { role: 'user', content: question.slice(0, 800) }] })
    });
    const d = await r.json();
    const txt = d.choices && d.choices[0] && d.choices[0].message.content;
    return txt ? esc(txt.trim()) : null;
  } catch (e) { console.error('Groq', e.message); return null; }
}

async function handleUpdate(update, store) {
  const m = update.message || update.edited_message;
  if (!m || !m.text) return;
  const chat = m.chat.id, text = m.text.trim();

  if (/^\/id\b/.test(text)) return send(chat, `ID de cette discussion : <code>${chat}</code>\n(à mettre dans TELEGRAM_ADMIN_CHAT_ID sur Render pour recevoir les formulaires)`);
  if (/^\/aide|^\/help|^\/menu/i.test(text)) return send(chat, T.start(m.from && m.from.first_name), MENU);

  // dans un groupe, ne répondre qu'aux commandes / mentions
  const isGroup = m.chat.type !== 'private';
  if (isGroup && !text.startsWith('/') && !/khayri|bot/i.test(text)) return;

  for (const [re, fn] of RULES) {
    if (re.test(text)) {
      const out = await fn(store, m);
      return send(chat, out, /^\/start/.test(text) || re === RULES[0][0] ? MENU : {});
    }
  }
  await tg('sendChatAction', { chat_id: chat, action: 'typing' });
  const ai = await askAI(text, store);
  return send(chat, ai || T.inconnu(), MENU);
}

/* ---------- Alerte équipe : nouveau formulaire ---------- */
function notifyNewMessage(msg) {
  if (!enabled || !ADMIN_CHAT) return;
  const l = (k, v) => v && (!Array.isArray(v) || v.length) ? `\n<b>${k} :</b> ${esc(Array.isArray(v) ? v.join(', ') : v)}` : '';
  const head = msg.integrer === 'Oui' ? '🟢 <b>Nouvelle demande d’intégration !</b>' : '📩 <b>Nouveau message du site</b>';
  send(ADMIN_CHAT,
    `${head}\n\n👤 <b>${esc(msg.prenom)} ${esc(msg.nom)}</b>` +
    l('Téléphone', msg.telephone) + l('Recontacter par', msg.moyen) + l('Ville', msg.ville) +
    l('Intégrer', msg.integrer) + l('Pourquoi', msg.pourquoi) + l('Contributions', msg.contributions) +
    l('Suggestions', msg.suggestions) + l('Message', msg.message) +
    `\n\n💬 WhatsApp : https://wa.me/${String(msg.telephone).replace(/\D/g, '')}\n🔐 ${SITE}/admin.html`
  );
}

/* ---------- Branchement Express ---------- */
function mount(app, store) {
  app.post('/api/telegram/webhook', (req, res) => {
    if (!enabled || req.get('X-Telegram-Bot-Api-Secret-Token') !== SECRET) return res.sendStatus(403);
    res.sendStatus(200); // répondre vite à Telegram
    handleUpdate(req.body, store).catch(e => console.error('Bot', e));
  });
}

/* ---------- Mode local (localhost) : le bot va chercher les messages lui-même ---------- */
async function startPolling(store) {
  await tg('deleteWebhook', { drop_pending_updates: false });
  console.log('Bot Telegram : mode LOCAL actif (polling). Écris à ton bot sur Telegram !');
  let offset = 0;
  for (;;) {
    try {
      const r = await fetch(`https://api.telegram.org/bot${TOKEN}/getUpdates?timeout=25&offset=${offset}`);
      const d = await r.json();
      if (!d.ok) { console.error('Telegram getUpdates', d.description); await new Promise(z => setTimeout(z, 5000)); continue; }
      for (const u of d.result) { offset = u.update_id + 1; handleUpdate(u, store).catch(e => console.error('Bot', e)); }
    } catch (e) { console.error('Telegram polling', e.message); await new Promise(z => setTimeout(z, 5000)); }
  }
}

async function setup() {
  if (!enabled) { console.log('Bot Telegram : désactivé (TELEGRAM_BOT_TOKEN absent)'); return; }
  if (!process.env.RENDER_EXTERNAL_URL && !process.env.SITE_URL) return startPolling(arguments[0]);
  await tg('setWebhook', { url: `${SITE}/api/telegram/webhook`, secret_token: SECRET, allowed_updates: ['message', 'edited_message'], drop_pending_updates: false });
  await tg('setMyCommands', { commands: [
    { command: 'start', description: 'Menu principal' },
    { command: 'evenements', description: 'Prochains événements' },
    { command: 'xam', description: 'Documents Xam sa diné' },
    { command: 'rejoindre', description: 'Rejoindre le Daara' },
    { command: 'adresse', description: 'Adresse et itinéraire' },
    { command: 'contact', description: 'Téléphone / WhatsApp' },
    { command: 'historique', description: 'Histoire du Dahira' }
  ] });
  console.log('Bot Telegram : webhook OK →', `${SITE}/api/telegram/webhook`);
}

module.exports = { enabled, mount, setup, notifyNewMessage, handleUpdate, _SECRET: SECRET };
