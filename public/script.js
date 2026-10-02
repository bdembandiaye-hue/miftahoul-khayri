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
