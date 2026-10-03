async function getContent(){const r=await fetch('/api/content');return r.json()}
function escapeHTML(value=''){return String(value).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function navActive(){const page=location.pathname.split('/').pop()||'index.html';document.querySelectorAll('.menu a').forEach(a=>{if(a.getAttribute('href')===page)a.classList.add('active')})}
function burgerMenu(){
  const nav=document.querySelector('nav'),menu=document.querySelector('.menu');
  if(!nav||!menu||nav.querySelector('.burger'))return;
  const b=document.createElement('button');
  b.className='burger';b.type='button';b.setAttribute('aria-label','Ouvrir le menu');b.setAttribute('aria-expanded','false');b.textContent='☰';
  b.onclick=()=>{const o=menu.classList.toggle('open');b.setAttribute('aria-expanded',o);b.textContent=o?'✕':'☰'};
  nav.appendChild(b);
}
document.addEventListener('DOMContentLoaded',()=>{navActive();burgerMenu()});
function fileUrl(x,folder){return x.url||('/uploads/'+folder+'/'+encodeURIComponent(x.filename))}

/* ===== Réseaux sociaux du Daara (mettre les liens ici, vide = caché) ===== */
const RESEAUX={
  whatsapp:'https://wa.me/221778892734',
  telephone:'+221 77 889 27 34',
  telegram:'https://t.me/MiftahoulKhayriBot',
  tiktok:'https://www.tiktok.com/@miftakhoulkhayri0',
  youtube:''     // ex : https://www.youtube.com/@miftahoulkhayri
};
const ICONES={
  whatsapp:'<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3Z"/></svg>',
  telegram:'<svg viewBox="0 0 24 24"><path d="M21.9 4.3 18.7 19.5c-.2 1-.9 1.3-1.7.8l-4.8-3.6-2.3 2.2c-.3.3-.5.5-1 .5l.3-4.9 8.9-8c.4-.3-.1-.5-.6-.2L6.5 13.2l-4.7-1.5c-1-.3-1-1 .2-1.5L20.5 3c.9-.3 1.6.2 1.4 1.3Z"/></svg>',
  tiktok:'<svg viewBox="0 0 24 24"><path d="M16.6 5.8A4.3 4.3 0 0 1 15.5 3h-3.1v12.4a2.6 2.6 0 1 1-2.6-2.6c.3 0 .5 0 .8.1V9.7a5.7 5.7 0 1 0 4.9 5.7V9a7.4 7.4 0 0 0 4.3 1.4V7.3a4.3 4.3 0 0 1-3.2-1.5Z"/></svg>',
  youtube:'<svg viewBox="0 0 24 24"><path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12a31 31 0 0 0 .5 4.8 3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8ZM9.8 15V9l5.8 3-5.8 3Z"/></svg>'
};
const NOMS={whatsapp:'WhatsApp',telegram:'Telegram',tiktok:'TikTok',youtube:'YouTube'};
function liensReseaux(cls){return ['whatsapp','telegram','tiktok','youtube'].filter(k=>RESEAUX[k]).map(k=>`<a class="${cls} ${k}" href="${RESEAUX[k]}" target="_blank" rel="noopener" aria-label="${NOMS[k]}" title="${NOMS[k]}">${ICONES[k]}</a>`).join('')}
function reseaux(){
  const f=document.querySelector('footer');
  if(f&&!f.querySelector('.socials')){f.insertAdjacentHTML('afterbegin',`<div class="socials">${liensReseaux('soc')}</div><div class="foot-tel">📞 <a href="tel:${RESEAUX.telephone.replace(/\s/g,'')}">${RESEAUX.telephone}</a></div>`)}
  document.querySelectorAll('[data-reseaux]').forEach(el=>el.innerHTML=liensReseaux('soc'));
  if(RESEAUX.whatsapp&&!document.querySelector('.wa-float')&&!location.pathname.endsWith('admin.html'))
    document.body.insertAdjacentHTML('beforeend',`<a class="wa-float" href="${RESEAUX.whatsapp}?text=${encodeURIComponent('Assalamou aleykoum, je vous contacte depuis le site du Daara Miftahoul Khayri.')}" target="_blank" rel="noopener" aria-label="Écrire sur WhatsApp">${ICONES.whatsapp}</a>`);
}
document.addEventListener('DOMContentLoaded',reseaux);
