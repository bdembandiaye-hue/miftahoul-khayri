/* ================= BOT TELEGRAM DU DAARA =================
 * - Répond aux questions (menu + FAQ par mots-clés, + IA Groq si GROQ_API_KEY est défini)
 * - Prévient l'équipe (TELEGRAM_ADMIN_CHAT_ID) à chaque formulaire de contact
 * Variables : TELEGRAM_BOT_TOKEN (obligatoire), TELEGRAM_ADMIN_CHAT_ID, GROQ_API_KEY, GROQ_MODEL
 */
const crypto = require('crypto');

const TOKEN = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
const ADMIN_CHAT = (process.env.TELEGRAM_ADMIN_CHAT_ID || '').trim();
const CHANNEL = (process.env.TELEGRAM_CHANNEL_ID || '').trim(); // ex : @miftahoulkhayri ou -100…
const REMIND_HOUR = parseInt(process.env.REMINDER_HOUR || '18', 10); // heure du rappel (GMT = heure du Sénégal)
const GROQ_KEY = (process.env.GROQ_API_KEY || '').trim();
const GROQ_MODEL = (process.env.GROQ_MODEL || 'llama-3.3-70b-versatile').trim();
const SITE = (process.env.SITE_URL || process.env.RENDER_EXTERNAL_URL || 'https://dahira-miftahoul-khayri.onrender.com').replace(/\/$/, '');
const SECRET = crypto.createHash('sha256').update('khayri-tg-' + TOKEN).digest('hex').slice(0, 32);
const enabled = !!TOKEN;

const INFO = {
  nom: 'Daara Miftahoul Khayri',
  arabe: 'دار مفتاح الخير',
  lieu: 'Daral Miftahoul Khayri — Quartier Diakhao, Thiès (près de l\'hôpital Saint Jean de Dieu), Sénégal',
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

const BUTTONS = new Set(['📅 Événements', '📖 Xam sa diné', '🤝 Rejoindre le Daara', '📍 Adresse', '🕌 Historique', '👥 Membres', '📰 Actualités', '📞 Contact']);
const MENU = {
  reply_markup: {
    keyboard: [
      [{ text: '📅 Événements' }, { text: '📖 Xam sa diné' }],
      [{ text: '🤝 Rejoindre le Daara' }, { text: '📍 Adresse' }],
      [{ text: '🕌 Historique' }, { text: '👥 Membres' }],
      [{ text: '📰 Actualités' }, { text: '📞 Contact' }]
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

// texte du site -> HTML Telegram (**gras**)
const richTg = t => esc(String(t || '').trim()).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');

async function histoireText(store) {
  let txt = '';
  try { txt = ((await store.getPages()) || {}).historique || ''; } catch (e) {}
  const corps = txt.trim() ? richTg(txt).slice(0, 3500) : esc(INFO.histoire);
  return `🕌 <b>Historique</b>\n\n${corps}\n\nEn savoir plus : ${SITE}/historique.html`;
}

async function membresText(store) {
  const m = [...((await store.getContent()).members || [])]
    .sort((a, b) => ((a.ordre || 999) - (b.ordre || 999)) || String(a.createdAt).localeCompare(String(b.createdAt)));
  if (!m.length) return `👥 La liste des membres sera bientôt publiée.\n${SITE}/historique.html`;
  return '👥 <b>Membres du Dahira</b>\n\n' + m.slice(0, 40).map(x => `• <b>${esc(x.title)}</b>${x.role ? ' — ' + esc(x.role) : ''}`).join('\n') +
    (m.length > 40 ? `\n… et ${m.length - 40} autres` : '') + `\n\nPhotos et détails : ${SITE}/historique.html`;
}

async function actusText(store) {
  const db = await store.getContent();
  const all = [
    ...db.photos.map(x => ({ ...x, ic: '📸', lien: x.url ? (x.url.startsWith('http') ? x.url : SITE + x.url) : '' })),
    ...(db.videos || []).map(x => ({ ...x, ic: '🎬', lien: 'https://youtu.be/' + x.youtube })),
    ...db.audios.map(x => ({ ...x, ic: '🎧', lien: x.url ? (x.url.startsWith('http') ? x.url : SITE + x.url) : '' }))
  ].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 8);
  if (!all.length) return `📰 Aucune actualité publiée pour le moment.\n${SITE}/actualites.html`;
  return '📰 <b>Dernières actualités</b>\n\n' + all.map(x => `${x.ic} <b>${esc(x.title)}</b>${x.lien ? `\n   ${x.lien}` : ''}`).join('\n') +
    `\n\nTout voir : ${SITE}/actualites.html`;
}

const T = {
  start: n => `Assalamou aleykoum ${esc(n || '')} 🤲🏾\n\nBienvenue sur le bot du <b>${INFO.nom}</b> (${INFO.arabe}).\n<i>${INFO.devise}</i>\n\nChoisissez une option ci-dessous ou posez-moi votre question.\n\n🔎 Vous pouvez aussi écrire <b>un nom</b> (ex : <i>Baye Demba</i>) pour retrouver tous les événements, photos, vidéos et audios qui le concernent.`,
  rejoindre: () => `🤝 <b>Rejoindre le Daara</b>\n\nRemplissez le formulaire, un responsable vous recontactera :\n👉 ${SITE}/contact.html\n\nOu écrivez-nous sur WhatsApp : ${INFO.wa}`,
  adresse: () => `📍 <b>Adresse</b>\n${INFO.lieu}\n\nItinéraire : https://www.google.com/maps/dir/?api=1&destination=14.798387,-16.938859\nCarte : ${SITE}/contact.html#carte`,
  contact: () => `📞 <b>Contact</b>\nTéléphone / WhatsApp : ${INFO.tel}\nWhatsApp : ${INFO.wa}\nSite : ${SITE}`,
  histoire: () => `🕌 <b>Historique</b>\n${INFO.histoire}\n\nEn savoir plus : ${SITE}/historique.html`,
  inconnu: () => `Je n'ai pas bien compris 🙏🏾\nUtilisez le menu ci-dessous, ou contactez-nous au ${INFO.tel} (WhatsApp : ${INFO.wa}).`
};

// FAQ par mots-clés (fonctionne sans IA)
const RULES = [
  [/(^\/start|salam|bonjour|bonsoir|^salut|nanga def|asalam)/i, (s, m) => T.start(m.from && m.from.first_name)],
  [/(^\/evenements|év[eé]nement|evenement|activit|programme|magal|kazu|ziar|wazifa|quand)/i, s => eventsText(s)],
  [/(^\/xam|xam sa|pdf|tazawoud|massalik|choubane|sikhar|document|xassa[iï]d|livre)/i, s => pdfText(s)],
  [/(^\/rejoindre|rejoindre|int[eé]grer|inscri|adh[eé]rer|devenir)/i, () => T.rejoindre()],
  [/(^\/membres|membre|bureau|responsable|diaraaf|jaraaf|pr[eé]sident|tr[eé]sorier|secr[eé]taire)/i, s => membresText(s)],
  [/(^\/actualites|actualit|nouveaut|nouvelles|photos?\b|audios?\b|derni)/i, s => actusText(s)],
  [/(^\/adresse|adresse|o[uù] se trouve|localisation|itin[eé]raire|carte|diakhao|situ[eé])/i, () => T.adresse()],
  [/(^\/contact|contact|t[eé]l[eé]phone|num[eé]ro|appeler|whatsapp|joindre)/i, () => T.contact()],
  [/(^\/historique|histoire|historique|cr[eé][eé]|fondateur|fond[eé]|serigne saliou)/i, s => histoireText(s)],
  [/(^\/canal|canal|cha[iî]ne|annonce)/i, () => CHANNEL ? `📢 Rejoignez notre canal d'annonces : ${CHANNEL.startsWith('@') ? 'https://t.me/' + CHANNEL.slice(1) : CHANNEL}` : `📢 Canal d'annonces bientôt disponible.`],
  [/(^\/youtube|youtube|vid[eé]o|kurel tv)/i, () => `🎬 Notre chaîne YouTube : https://www.youtube.com/@kurelmiftaahulxayritv\nVidéos aussi sur ${SITE}/actualites.html`],
  [/(^\/site|site web|site internet|lien)/i, () => `🌐 ${SITE}`]
];

async function askAI(question, store) {
  if (!GROQ_KEY) return null;
  try {
    const dbAI = await store.getContent();
    let hist = ''; try { hist = ((await store.getPages()) || {}).historique || ''; } catch (e) {}
    const membres = (dbAI.members || []).map(x => x.title + (x.role ? ' (' + x.role + ')' : '')).join('; ') || 'non publiés';
    const events = dbAI.events.map(e => `${e.title} (${e.date || 'date à venir'}${e.place ? ', ' + e.place : ''})`).join('; ') || 'aucun';
    const system = `Tu es l'assistant du ${INFO.nom} (${INFO.lieu}). Réponds en français simple (ou en wolof si on te parle wolof), poliment, en 4 phrases maximum.
Faits connus : ${INFO.histoire} Devise : ${INFO.devise}. Téléphone/WhatsApp : ${INFO.tel}. Site : ${SITE}. Formulaire pour rejoindre : ${SITE}/contact.html. Événements publiés : ${events}. Membres et responsables : ${membres}. Historique publié : ${hist.replace(/\*\*/g, '').slice(0, 1500)}.
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


/* ---------- Recherche dans tout le site (nom d'une personne, d'un événement…) ---------- */
const norm = x => String(x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, ' ').trim();
const STOP = new Set(('le la les l de d du des un une et ou a au aux en pour par sur avec dans qui que qu quoi quand est sont c ce cet cette ces ' +
  'mon ma mes ton ta tes son sa ses je j tu il elle on nous vous ils me m te t se s y quel quelle quels quelles comment combien ' +
  'info infos information informations voir vois montre montrer donne donner dis moi svp stp merci tout tous toutes chose choses ' +
  'lie liee lies concernant propos daara dahira miftahoul miftahul khayri xayri khayr bot veux voudrais peux fait fais faire avoir ' +
  'il y a avait ete etait yi bi ci ak na nga ngi').split(' '));
const CAT = { magal: 'event', kurel: 'event', ziar: 'event', ziarra: 'event', wazifa: 'event', evenement: 'event', evenements: 'event', activite: 'event', activites: 'event', ceremonie: 'event', conference: 'event', programme: 'event',
  photo: 'photo', photos: 'photo', image: 'photo', images: 'photo', video: 'video', videos: 'video', youtube: 'video',
  audio: 'audio', audios: 'audio', xassida: 'audio', xassaide: 'audio', xassaides: 'audio', khassida: 'audio',
  pdf: 'pdf', document: 'pdf', documents: 'pdf', livre: 'pdf', membre: 'member', membres: 'member', responsable: 'member', responsables: 'member' };
// mots des boutons / questions habituelles : ils ne servent pas à chercher un nom
const RULEWORDS = new Set(('rejoindre integrer inscrire inscription adherer devenir adresse localisation itineraire carte situe trouve trouver ' +
  'contact telephone numero appeler joindre whatsapp historique histoire cree fondateur fonde site lien canal chaine annonce annonces ' +
  'actualites actualite nouveautes nouvelles dernier derniers derniere dernieres prochain prochains prochaine quand xam dine menu aide start ' +
  'salam bonjour bonsoir salut asalam assalamou aleykoum nanga def chercher cherche recherche').split(' '));

function keywords(q) {
  const toks = norm(q).split(' ').filter(t => t.length >= 2 && !STOP.has(t));
  const types = new Set(toks.filter(t => CAT[t]).map(t => CAT[t]));
  const names = toks.filter(t => !CAT[t] && !RULEWORDS.has(t));
  return { types, names };
}
const hasTok = (txt, t) => t.length >= 3 ? txt.includes(t) : (' ' + txt + ' ').includes(' ' + t + ' ');
const frShort = iso => { try { return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }); } catch (e) { return ''; } };
const cut = (t, n) => { t = String(t || '').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };

async function searchSite(q, store) {
  const { types, names } = keywords(q);
  if (!names.length) return null;
  const db = await store.getContent();
  const pool = [
    ...db.events.map(x => ({ ...x, _t: 'event' })), ...db.photos.map(x => ({ ...x, _t: 'photo' })),
    ...(db.videos || []).map(x => ({ ...x, _t: 'video' })), ...db.audios.map(x => ({ ...x, _t: 'audio' })),
    ...db.pdfs.map(x => ({ ...x, _t: 'pdf' })), ...(db.members || []).map(x => ({ ...x, _t: 'member' }))
  ].filter(x => !types.size || types.has(x._t));
  const found = pool.filter(x => { const txt = norm([x.title, x.description, x.place, x.role, x.originalName].join(' ')); return names.every(t => hasTok(txt, t)); });
  let hist = null;
  if (!types.size) {
    let h = ''; try { h = ((await store.getPages()) || {}).historique || ''; } catch (e) {}
    const phrases = h.replace(/\*\*/g, '').split(/(?<=[.!?\n])\s+/);
    const p = phrases.find(ph => { const n = norm(ph); return names.every(t => hasTok(n, t)); });
    if (p) hist = p;
  }
  if (!found.length && !hist) return null;

  const today = new Date().toISOString().slice(0, 10);
  const lien = x => x.url ? (x.url.startsWith('http') ? x.url : SITE + x.url) : '';
  const out = [`🔎 <b>Résultats pour « ${esc(cut(q, 60))} »</b>`];
  const ev = found.filter(x => x._t === 'event').sort((a, b) => {
    const fa = (a.date || '9') >= today, fb = (b.date || '9') >= today;
    return fa !== fb ? (fa ? -1 : 1) : (fa ? String(a.date).localeCompare(String(b.date)) : String(b.date).localeCompare(String(a.date)));
  });
  if (ev.length) out.push('\n📅 <b>Événements</b>\n' + ev.slice(0, 8).map(e =>
    `• <b>${esc(e.title)}</b>${(e.date || '9') >= today ? ' <i>(à venir)</i>' : ''}\n   ${esc(frDate(e.date))}${e.time ? ' à ' + esc(e.time) : ''}${e.place ? ' — 📍 ' + esc(e.place) : ''}` +
    (e.description ? `\n   ${esc(cut(e.description, 140))}` : '')).join('\n'));
  const mem = found.filter(x => x._t === 'member');
  if (mem.length) out.push('\n👤 <b>Membres</b>\n' + mem.map(x => `• <b>${esc(x.title)}</b>${x.role ? ' — ' + esc(x.role) : ''}${x.description ? '\n   ' + esc(cut(x.description, 120)) : ''}`).join('\n'));
  const media = [['photo', '📸 <b>Photos</b>'], ['video', '🎬 <b>Vidéos</b>'], ['audio', '🎧 <b>Audios</b>'], ['pdf', '📖 <b>Documents</b>']];
  for (const [t, titre] of media) {
    const l = found.filter(x => x._t === t).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    if (l.length) out.push('\n' + titre + '\n' + l.slice(0, 6).map(x => `• <b>${esc(x.title)}</b>${x.createdAt ? ' — ' + esc(frShort(x.createdAt)) : ''}` +
      (t === 'video' ? `\n   https://youtu.be/${x.youtube}` : lien(x) ? `\n   ${lien(x)}` : '')).join('\n'));
  }
  if (hist) out.push(`\n🕌 <b>Historique</b>\n« ${esc(cut(hist, 300))} »\n${SITE}/historique.html`);
  out.push(`\n🌐 ${SITE}`);
  return out.join('\n').slice(0, 4000);
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

  // /chercher <nom>
  const cm = text.match(/^\/(chercher|recherche|search)(?:@\w+)?\s*(.*)$/i);
  if (cm) {
    if (!cm[2].trim()) return send(chat, '🔎 Tapez /chercher suivi d\'un nom ou d\'un mot.\nExemple : <code>/chercher Baye Demba</code>');
    return send(chat, (await searchSite(cm[2], store)) || `🔎 Aucun résultat pour « ${esc(cm[2])} ».\nEssayez avec un autre mot ou une autre orthographe.`);
  }
  // texte libre (un nom…) : on cherche d'abord dans le site, sauf pour les boutons du menu
  if (!text.startsWith('/') && !BUTTONS.has(text)) {
    const r = await searchSite(text, store).catch(() => null);
    if (r) return send(chat, r);
  }

  for (const [re, fn] of RULES) {
    if (re.test(text)) {
      const out = await fn(store, m);
      return send(chat, out, /^\/start/.test(text) || re === RULES[0][0] ? MENU : {});
    }
  }
  await tg('sendChatAction', { chat_id: chat, action: 'typing' });
  const ai = await askAI(text, store);
  if (!ai) {
    const { names } = keywords(text);
    if (names.length && names.length <= 4) return send(chat, `🔎 Je n'ai rien trouvé sur le site pour « ${esc(cut(text, 60))} ».\nVérifiez l'orthographe, essayez un seul mot (ex : un prénom), ou utilisez le menu ci-dessous.`, MENU);
  }
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


/* ---------- Canal d'annonces : publication automatique ---------- */
const fullUrl = u => !u ? '' : (u.startsWith('http') ? u : SITE + u);
const frDate = d => { if (!d) return 'Date à venir'; const [y, m, j] = d.split('-'); return new Date(Date.UTC(+y, m - 1, +j)).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }); };

function eventText(e, prefix) {
  return `${prefix}\n\n<b>${esc(e.title)}</b>\n📅 ${esc(frDate(e.date))}${e.time ? ' à ' + esc(e.time) : ''}` +
    (e.place ? `\n📍 ${esc(e.place)}` : '') + (e.description ? `\n\n${esc(e.description)}` : '') +
    `\n\n👉 ${SITE}/evenements.html`;
}

async function post(chat, text, photo) {
  if (photo && photo.startsWith('http')) {
    const r = await tg('sendPhoto', { chat_id: chat, photo, caption: text.slice(0, 1000), parse_mode: 'HTML' });
    if (r && r.ok) return r;
  }
  return send(chat, text);
}

/* Envoi d'un vrai fichier (PDF, audio, photo) à Telegram — jusqu'à 50 Mo */
const MAX_TG = 49 * 1024 * 1024;
async function sendFile(method, field, chat, file, caption, extra = {}) {
  const fd = new FormData();
  fd.append('chat_id', String(chat));
  if (caption) { fd.append('caption', caption.slice(0, 1020)); fd.append('parse_mode', 'HTML'); }
  for (const [k, v] of Object.entries(extra)) if (v) fd.append(k, String(v));
  fd.append(field, new Blob([file.buffer], { type: file.mimetype || 'application/octet-stream' }), file.originalname || 'fichier');
  try {
    const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, { method: 'POST', body: fd });
    const d = await r.json();
    if (!d.ok) console.error('Telegram', method, d.description);
    return d;
  } catch (e) { console.error('Telegram', method, e.message); return { ok: false, description: e.message }; }
}

// Récupère le fichier d'un contenu déjà en ligne (Supabase ou dossier local)
async function loadFile(item) {
  if (!item || !item.url) return null;
  try {
    let buffer;
    if (item.url.startsWith('http')) {
      const r = await fetch(item.url); if (!r.ok) return null;
      buffer = Buffer.from(await r.arrayBuffer());
    } else {
      buffer = require('fs').readFileSync(require('path').join(__dirname, 'public', decodeURIComponent(item.url)));
    }
    const ext = (item.filename || '').split('.').pop().toLowerCase();
    const mime = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', mp3: 'audio/mpeg', m4a: 'audio/mp4', ogg: 'audio/ogg', wav: 'audio/wav', aac: 'audio/aac' }[ext];
    return { buffer, mimetype: mime, originalname: item.originalName || item.filename };
  } catch (e) { console.error('Lecture fichier', e.message); return null; }
}

/* Publie un contenu sur le canal. file = fichier reçu à l'instant (sinon relu depuis le site).
   Retourne { ok, error } pour l'afficher dans l'admin. */
async function announce(type, item, file) {
  if (!enabled || !CHANNEL) return { ok: false, error: 'Canal Telegram non configuré (TELEGRAM_CHANNEL_ID).' };
  try {
    if (!file && item.filename) file = await loadFile(item);
    const big = file && file.buffer.length > MAX_TG;
    let text, r;
    if (type === 'event') {
      text = eventText(item, '🕌 <b>Nouvel événement du Daara</b>');
      r = file && !big ? await sendFile('sendPhoto', 'photo', CHANNEL, file, text) : null;
      if (!r || !r.ok) r = await send(CHANNEL, text);
    } else if (type === 'photo') {
      text = `📸 <b>${esc(item.title)}</b>${item.description ? '\n' + esc(item.description) : ''}\n\n👉 ${SITE}/actualites.html`;
      r = file && !big ? await sendFile('sendPhoto', 'photo', CHANNEL, file, text) : null;
      if (!r || !r.ok) r = file && !big ? await sendFile('sendDocument', 'document', CHANNEL, file, text) : null; // photo > 10 Mo
      if (!r || !r.ok) r = await post(CHANNEL, text, fullUrl(item.url));
    } else if (type === 'pdf') {
      text = `📖 <b>${esc(item.title)}</b>${item.description ? '\n' + esc(item.description) : ''}\n\n👉 ${SITE}/xam-sa-dine.html`;
      r = file && !big ? await sendFile('sendDocument', 'document', CHANNEL, file, text) : null;
      if (!r || !r.ok) r = await send(CHANNEL, text + (item.url ? `\n⬇️ ${fullUrl(item.url)}` : ''));
    } else if (type === 'audio') {
      text = `🎧 <b>${esc(item.title)}</b>${item.description ? '\n' + esc(item.description) : ''}\n\n👉 ${SITE}/actualites.html`;
      r = file && !big ? await sendFile('sendAudio', 'audio', CHANNEL, file, text, { title: item.title, performer: 'Daara Miftahoul Khayri' }) : null;
      if (!r || !r.ok) r = await send(CHANNEL, text + (item.url ? `\n⬇️ ${fullUrl(item.url)}` : ''));
    } else if (type === 'video') {
      text = `🎬 <b>${esc(item.title)}</b>${item.description ? '\n' + esc(item.description) : ''}\n\n▶️ https://youtu.be/${item.youtube}`;
      r = await tg('sendMessage', { chat_id: CHANNEL, text, parse_mode: 'HTML' }); // aperçu YouTube affiché
    } else return { ok: false, error: 'Type non publiable.' };
    if (r && r.ok) return { ok: true, note: big ? 'Fichier trop lourd pour Telegram (50 Mo) : lien publié à la place.' : '' };
    const why = (r && r.description) || 'erreur inconnue';
    return { ok: false, error: /chat not found|not enough rights|administrator/i.test(why) ? 'Le bot doit être administrateur du canal ' + CHANNEL + '.' : why };
  } catch (e) { console.error('Annonce', e.message); return { ok: false, error: e.message }; }
}

/* ---------- Rappel automatique la veille de chaque événement ---------- */
function startReminders(store) {
  if (!enabled || (!CHANNEL && !ADMIN_CHAT)) return;
  const tick = async () => {
    try {
      const now = new Date();
      if (now.getUTCHours() < REMIND_HOUR) return; // à partir de 18h la veille
      const demain = new Date(now.getTime() + 86400000).toISOString().slice(0, 10);
      const db = await store.getContent();
      for (const e of db.events) {
        if (e.date !== demain || e.remindedFor === e.date) continue;
        await store.updateItem('event', e.id, { remindedFor: e.date }); // marqué avant l'envoi : jamais 2 rappels
        const txt = eventText(e, '⏰ <b>RAPPEL — c\'est demain, inch\'Allah !</b>');
        if (CHANNEL) await post(CHANNEL, txt, fullUrl(e.url));
        if (ADMIN_CHAT && ADMIN_CHAT !== CHANNEL) await send(ADMIN_CHAT, txt);
        console.log('Rappel envoyé :', e.title);
      }
    } catch (err) { console.error('Rappels', err.message); }
  };
  setTimeout(tick, 20000);
  setInterval(tick, 15 * 60 * 1000); // toutes les 15 min
  console.log(`Rappels d'événements : actifs (la veille à partir de ${REMIND_HOUR}h)`);
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
  startReminders(arguments[0]);
  if (!process.env.RENDER_EXTERNAL_URL && !process.env.SITE_URL) return startPolling(arguments[0]);
  await tg('setWebhook', { url: `${SITE}/api/telegram/webhook`, secret_token: SECRET, allowed_updates: ['message', 'edited_message'], drop_pending_updates: false });
  await tg('setMyCommands', { commands: [
    { command: 'start', description: 'Menu principal' },
    { command: 'evenements', description: 'Prochains événements' },
    { command: 'xam', description: 'Documents Xam sa diné' },
    { command: 'rejoindre', description: 'Rejoindre le Daara' },
    { command: 'adresse', description: 'Adresse et itinéraire' },
    { command: 'contact', description: 'Téléphone / WhatsApp' },
    { command: 'historique', description: 'Histoire du Dahira' },
    { command: 'membres', description: 'Membres et responsables' },
    { command: 'actualites', description: 'Dernières photos, vidéos et audios' },
    { command: 'chercher', description: 'Chercher un nom (ex : /chercher Baye Demba)' }
  ] });
  console.log('Bot Telegram : webhook OK →', `${SITE}/api/telegram/webhook`);
}

module.exports = { enabled, channel: !!CHANNEL, mount, setup, notifyNewMessage, handleUpdate, announce, _SECRET: SECRET };
