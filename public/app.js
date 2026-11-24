"use strict";

const PEOPLE=['Joan','Aidan','Donna','Michael','Jenna','Paul','Corinna','Jonathan'];
const PERSONAL={
 Joan:'Your name was the first one I wrote on my Christmas list this evening, Joan.',
 Aidan:'Just as the first flakes settled on the pines, a letter arrived for you, Aidan.',
 Donna:'There is a little envelope by the fire with your name written in gold, Donna.',
 Michael:'The reindeer insisted this special delivery be addressed to you, Michael.',
 Jenna:'The elves have been saving a particularly lovely letter just for you, Jenna.',
 Paul:'A quiet little Christmas mystery has travelled all this way for you, Paul.',
 Corinna:'Santa saved a little sparkle from the winter stars for your letter, Corinna.',
 Jonathan:'The North Pole postman has delivered one very important secret for you, Jonathan.'
};
const el=document.getElementById('app');
const query=new URLSearchParams(location.search);
let token=query.get('invite');
let session=query.get('session');
let isTest=query.get('test')==='1'||!token;
let current=null;
let opening=false;

// Only sound effects: wind in the forest, a quiet fire and irregular log crackles.
// Start on page load when permitted; resume on the first visitor gesture if autoplay is blocked.
let audio=null,wind=null,windGain=null,fire=null,fireGain=null,crackleLoop=null,recordedFire=null;
let audioStarted=false;
function makeNoise(seconds){
  const length=Math.floor(audio.sampleRate*seconds);
  const buffer=audio.createBuffer(1,length,audio.sampleRate);
  const data=buffer.getChannelData(0);
  for(let i=0;i<length;i++)data[i]=(Math.random()*2-1);
  return buffer;
}
function startAmbience(){
  if(audioStarted){
    if(audio?.state==='suspended')audio.resume().catch(()=>{});
    if(recordedFire?.paused)recordedFire.play().catch(()=>{});
    return;
  }
  try{
    audio=audio||new (window.AudioContext||window.webkitAudioContext)();
    audio.resume().catch(()=>{});
    const windFilter=audio.createBiquadFilter();
    windFilter.type='lowpass';windFilter.frequency.value=260;
    windGain=audio.createGain();windGain.gain.value=.036;
    wind=audio.createBufferSource();wind.buffer=makeNoise(3);wind.loop=true;
    wind.connect(windFilter).connect(windGain).connect(audio.destination);
    wind.start();
    const fireFilter=audio.createBiquadFilter();
    fireFilter.type='highpass';fireFilter.frequency.value=950;
    fireGain=audio.createGain();fireGain.gain.value=.0025;
    fire=audio.createBufferSource();fire.buffer=makeNoise(2);fire.loop=true;
    fire.connect(fireFilter).connect(fireGain).connect(audio.destination);
    fire.start();
    // Authentic public-domain fireplace field recording from Wikimedia Commons.
    // The procedural crackles remain a subtle fallback if external audio fails.
    recordedFire=new Audio('https://commons.wikimedia.org/wiki/Special:Redirect/file/Dry_grass_burning_in_open_fireplace.ogg');
    recordedFire.loop=true;recordedFire.volume=.22;
    recordedFire.play().catch(()=>{});
    crackleLoop=setInterval(function(){
      if(!audioStarted||Math.random()>.48)return;
      const n=audio.createBufferSource();
      const duration=.012+Math.random()*.035;
      const length=Math.max(12,Math.round(audio.sampleRate*duration));
      const b=audio.createBuffer(1,length,audio.sampleRate);
      const data=b.getChannelData(0);
      for(let i=0;i<length;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/length,1.7);
      n.buffer=b;
      const g=audio.createGain();g.gain.value=.011+Math.random()*.015;
      const filter=audio.createBiquadFilter();
      filter.type='highpass';filter.frequency.value=350+Math.random()*900;
      n.connect(filter).connect(g).connect(audio.destination);n.start();
    },120);
    audioStarted=true;
  }catch(e){
    console.warn('Unable to start winter ambience:', e);
    audioStarted=false;
  }
}
function enterWithSound(){startAmbience()}

function snow(){
  const target=document.getElementById('snow');
  const count=window.innerWidth<650?40:75;
  for(let i=0;i<count;i++){
    const span=document.createElement('span');
    const size=1+Math.random()*3.1;
    span.className='flake';
    span.style.setProperty('--x',(Math.random()*100).toFixed(2)+'%');
    span.style.setProperty('--s',size.toFixed(2)+'px');
    span.style.setProperty('--o',(Math.random()*.55+.17).toFixed(2));
    span.style.setProperty('--b',(Math.random()*1.2).toFixed(2)+'px');
    span.style.setProperty('--t',(8+Math.random()*16).toFixed(1)+'s');
    span.style.setProperty('--d',(-Math.random()*23).toFixed(1)+'s');
    span.style.setProperty('--drift',((Math.random()-.5)*85).toFixed(0)+'px');
    target.appendChild(span);
  }
}
function safe(text){
  return String(text??'').replace(/[&<>"']/g,function(ch){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];
  });
}
function setUrl(){
  const p=new URLSearchParams();
  if(isTest)p.set('test','1');
  if(session)p.set('session',session);
  if(token)p.set('invite',token);
  history.replaceState({},'',location.pathname+(p.toString()?'?'+p.toString():''));
}
async function api(action,payload={}){
  const response=await fetch('/.netlify/functions/santa',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action,test:isTest,session,token,...payload})
  });
  const result=await response.json();
  if(!response.ok)throw Error(result.error||'The workshop is temporarily unavailable.');
  return result;
}
function status(message){el.innerHTML='<div class="loading">✧ '+safe(message)+' ✧</div>'}
function nav(){
  return isTest?'<div class="footer-navigation"><button class="quiet-button" onclick="testMenu()">Try another family member</button> <button class="quiet-button" onclick="startTest(false)">Start a completely new test</button></div>':'';
}
function err(error){
  el.innerHTML='<section class="menu-shell"><span class="snowletter">A note from the North Pole</span>'+
    '<h2>Something has gone astray</h2><p class="error-note">'+safe(error.message||String(error))+'</p>'+
    '<div class="actions"><button class="btn" onclick="home()">Return to the cottage</button></div></section>';
}
function hearth(){
  return '<div class="fireplace" aria-label="A little glowing log fire" role="img"><i class="flame"></i><i class="flame"></i><i class="flame"></i></div>';
}
function panel(body){
  return '<div class="letter-outer"><article class="letter">'+body+'</article></div>'+nav();
}
function home(){
  document.body.classList.remove('inside');
  token=null;session=null;current=null;isTest=true;setUrl();
  el.innerHTML='<section class="hero">'+
    '<span class="snowletter">A winter invitation</span>'+
    '<h1>Some secrets<br>are best kept<br><em>by the fire.</em></h1>'+
    '<div class="goldline"></div>'+
    '<p>Deep in the snowy woods, a warm little cottage is waiting.<br>'+
    'Inside, Santa has eight letters for the Chesters family — and a Christmas secret for each one.</p>'+
    '<div class="actions"><button class="btn" onclick="startTest(true)">✧ Enter the cottage</button>'+
    '<button class="btn btn-outline" onclick="startTest(false)">Preview all eight invitations</button></div>'+
    '<div class="helptext">❄ PRIVATE PREVIEW · NO CODES · NO REAL DRAW CHANGES ❄</div>'+
    '</section>';
}
async function startTest(goMichael=true){
  enterWithSound();
  token=null;current=null;session=null;isTest=true;
  setUrl();status('Santa is lighting the fire');
  try{
    const result=await api('test-start');
    session=result.session;setUrl();
    if(goMichael){
      const me=result.invites.find(p=>p.name==='Michael');
      await choose(me.token);
    }else renderMenu(result.invites);
  }catch(e){err(e)}
}
function renderMenu(invites){
  el.innerHTML='<section class="menu-shell"><span class="pill">✧ A private rehearsal ✧</span>'+
    '<h2>Eight letters.<br>Eight little secrets.</h2>'+
    '<p>Choose a name to experience their personal invitation.<br>These are practice draws only.</p>'+
    '<div class="people">'+invites.map(p=>'<button class="person" onclick="choose(\''+safe(p.token)+'\')"><span>✉</span>'+safe(p.name)+'</button>').join('')+'</div>'+
    '<button class="btn btn-outline btn-mini" onclick="startTest(false)">Make a fresh practice draw</button></section>';
}
async function testMenu(){
  document.body.classList.remove('inside');
  if(!isTest||!session){home();return}
  token=null;current=null;setUrl();status('Finding the eight letters');
  try{const result=await api('test-list');renderMenu(result.invites)}
  catch(e){err(e)}
}
async function choose(next){
  token=next;current=null;setUrl();await showEnvelope();
}
async function showEnvelope(){
  document.body.classList.remove('inside');
  if(!token){home();return}
  status('An invitation is on its way');
  try{
    current=await api('view');
    const name=safe(current.name);
    const personal=safe(PERSONAL[current.name]||'A little Christmas secret has arrived with your name on it.');
    el.innerHTML='<section class="envelope-area">'+
      '<div class="envelope-copy">'+
      '<span class="snowletter">Delivered with love from the North Pole</span>'+
      '<h1>'+name+',<br><em>this is for you.</em></h1>'+
      '<p>'+personal+' The fire is glowing inside the cottage, and only you can open this special delivery.</p>'+
      '<div class="helptext">✧ PERSONAL & CONFIDENTIAL · CHRISTMAS 2026</div>'+
      '</div>'+
      '<button class="envelope" type="button" onclick="openLetter()" aria-label="Open the Christmas letter addressed to '+name+'">'+
      '<span class="seal">C</span><span class="envelope-label">For '+name+' · From Santa</span>'+
      '</button></section>'+nav();
  }catch(e){err(e)}
}
function openLetter(){
  if(opening||!current)return;
  enterWithSound();
  opening=true;
  const selectedToken=token;
  document.body.classList.add('inside');
  if(windGain)windGain.gain.setTargetAtTime(.012,audio.currentTime,.4);
  if(fireGain)fireGain.gain.setTargetAtTime(.006,audio.currentTime,.4);
  if(recordedFire)recordedFire.volume=.32;
  el.innerHTML='<div class="cottage-entry" role="status" aria-label="Opening the cottage doors and entering the cozy room">'+
    '<div class="cottage-entry-room"></div>'+
    '<div class="cottage-entry-door left"></div>'+
    '<div class="cottage-entry-door right"></div>'+
    '<p class="cottage-entry-caption">Come inside, '+safe(current.name)+'…<br>The fire is waiting for you.</p>'+
    '</div>';
  const wait=window.matchMedia('(prefers-reduced-motion: reduce)').matches?450:2900;
  window.setTimeout(()=>{
    if(selectedToken!==token)return;
    opening=false;
    renderCurrent();
  },wait);
}
function letterHeading(heading,subheading=''){
  return '<span class="letter-kicker">✦ The Chesters Christmas Conspiracy ✦</span>'+
    '<h2>'+heading+'</h2>'+(subheading?'<p>'+subheading+'</p>':'');
}
function wishForm(edit=false){
  const wishlist=edit&&current.wishlist?current.wishlist:{wishes:['','',''],notes:''};
  let html=letterHeading('Dear '+safe(current.name)+',','Santa has been waiting for you beside the fire. Before your secret is revealed, he has one little request.');
  html+='<p class="form-description">With a £50 gift budget, write three things you would be delighted to find under the tree. It will help your secret gift-giver make Christmas special.</p>';
  html+='<form id="wishForm" class="wish-form" onsubmit="saveWishes(event)">';
  for(let i=0;i<3;i++)html+='<label for="w'+i+'">Christmas wish No. '+(i+1)+'</label>'+
    '<input id="w'+i+'" name="wish'+i+'" maxlength="300" required placeholder="Something I would love…" value="'+safe(wishlist.wishes[i])+'">';
  html+='<label for="notes">A little extra help (optional)</label>'+
    '<textarea id="notes" maxlength="1200" placeholder="Sizes, favourite colours, shopping links, or a hint…">'+safe(wishlist.notes)+'</textarea>'+
    '<button type="submit" class="btn">✧ Seal my Christmas wishes</button></form>';
  return html;
}

function cinematicCottage(){
  document.body.classList.add('inside');
  if(!current||!current.wishlist||current.revealed){renderCurrent();return}
  opening=false;
  const thisToken=token;
  const words=safe(current.name);
  el.innerHTML='<section class="cinema-shell" aria-label="The cottage doors open to reveal the fireplace and your secret present">'+
    '<div class="cinema-words"><span class="snowletter">Your wishes are sealed, '+words+'</span>'+
    '<h2>Something is waiting by the fire.</h2>'+
    '<p>Your wishes are safe. The little present beside the fireplace holds your Christmas secret.</p></div>'+
    '<div class="cinema-window">'+
      '<div class="cinema-room" aria-hidden="true">'+
        '<div class="cinema-firelight"></div><div class="cinema-floor"></div>'+
        '<div class="cinema-beam"></div><div class="cinema-garland"></div>'+
        '<div class="cinema-mantel"><span class="cinema-candle"></span>'+
          '<div class="cinema-stockings"><span>❄</span><span>✦</span><span>❄</span></div>'+
          '<div class="cinema-hearth"><span class="cinema-flame"></span><span class="cinema-flame"></span><span class="cinema-flame"></span>'+
          '<span class="cinema-log"></span><span class="cinema-log alt"></span></div>'+
        '</div>'+
      '</div>'+
      '<div class="gift-rays" aria-hidden="true"></div>'+
      '<button id="secretGift" class="secret-gift" type="button" disabled onclick="revealGift()" aria-label="Open your wrapped gift to find your Secret Santa recipient">'+
        '<span class="gift-glow"></span><span class="gift-box"></span><span class="gift-lid"></span>'+
        '<span class="gift-bow"></span><span class="gift-bow other"></span>'+
      '</button>'+

    '</div>'+
    '<p class="cinema-caption" id="cinemaCaption" role="status">A little present is waiting beside the fire…</p>'+
    '<p class="helptext">✧ PRIVATE & PERSONAL · YOUR SECRET IS SAFE ✧</p></section>'+nav();
  const shell=el.querySelector('.cinema-shell');
  // An animation frame ensures the doors start closed before the transition begins.
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    if(shell?.isConnected&&thisToken===token)shell.classList.add('entered');
  }));
  const delay=window.matchMedia('(prefers-reduced-motion: reduce)').matches?100:1600;
  window.setTimeout(()=>{
    if(!shell?.isConnected||thisToken!==token)return;
    const button=shell.querySelector('#secretGift');
    if(button){button.disabled=false;button.classList.add('ready')}
    const caption=shell.querySelector('#cinemaCaption');
    if(caption)caption.textContent='A present just for you. Tap it to discover your Christmas secret. 🎁';
  },delay);
}
async function revealGift(){
  if(opening||!current||current.revealed||!current.wishlist)return;
  opening=true;
  const shell=el.querySelector('.cinema-shell');
  const gift=shell?.querySelector('#secretGift');
  const caption=shell?.querySelector('#cinemaCaption');
  if(gift){gift.disabled=true;gift.classList.remove('ready')}
  if(shell)shell.classList.add('unwrapped');
  if(caption)caption.textContent='The ribbon falls away… and the magic begins.';
  try{
    const revealed=await api('reveal');
    current=revealed;
    window.setTimeout(()=>{
      opening=false;
      renderCurrent();
    },1400);
  }catch(e){
    opening=false;
    if(shell?.isConnected){
      shell.classList.remove('unwrapped');
      if(gift){gift.disabled=false;gift.classList.add('ready')}
      if(caption)caption.textContent='Santa needs another moment. Tap the present to try again.';
    }else err(e);
  }
}

function renderCurrent(){
  document.body.classList.add('inside');
  if(!current){showEnvelope();return}
  if(!current.wishlist){
    el.innerHTML=panel(wishForm()) ;
    return;
  }
  if(!current.revealed){
    cinematicCottage();
    return;
  }
  let wish=current.recipientWishlist;
  let details='';
  if(wish){
    const items=wish.wishes.map(w=>'<li>✧ '+safe(w)+'</li>').join('');
    details='<div class="wishlist"><h3>'+safe(current.recipient)+'’s Christmas wishes</h3>'+
      (wish.sample?'<small>Practice wishlist — they have not entered their own yet.</small>':'')+
      '<ul>'+items+'</ul>'+
      (wish.notes?'<p class="form-description">'+safe(wish.notes)+'</p>':'')+'</div>';
  }else{
    details='<div class="wishlist"><h3>Still waiting for their wishes…</h3>'+
      '<p class="form-description">They have not completed their list yet. Come back soon and Santa will have it ready.</p></div>';
  }
  el.innerHTML='<div class="reveal-card">'+panel('<span class="letter-kicker">✦ Top secret · A letter for '+safe(current.name)+' ✦</span>'+
    '<p>Santa has made his choice. This Christmas, your one very special person is…</p>'+
    '<div class="recipient">'+safe(current.recipient)+'</div>'+
    '<div class="goldline"></div>'+
    '<p>Buy a little something with love, stay within £50, and keep this between us until Christmas Day.</p>'+
    details+
    '<div class="actions"><button class="btn btn-mini" onclick="editWishes()">Update my wishes</button>'+
    '<button class="btn btn-outline btn-mini" onclick="refreshWishes()">Check their wishlist</button></div>')+'</div>';
}
async function saveWishes(event){
  event.preventDefault();
  const wishes=[0,1,2].map(i=>document.getElementById('w'+i).value.trim());
  if(wishes.some(w=>!w)){alert('Please enter three Christmas gift ideas.');return}
  const notes=document.getElementById('notes').value.trim();
  status('Santa is sealing your letter');
  try{current=await api('save',{wishes,notes});renderCurrent()}
  catch(e){err(e)}
}
function editWishes(){
  el.innerHTML=panel(wishForm(true));
}
async function refreshWishes(){
  status('Checking the Christmas post');
  try{current=await api('view');renderCurrent()}
  catch(e){err(e)}
}
snow();
// Attempt immediately on page opening; no on-page mute or sound-off control.
startAmbience();
// Browsers that block autoplay will begin sound at the very first interaction.
window.addEventListener('pointerdown',enterWithSound,{capture:true});
window.addEventListener('keydown',enterWithSound,{capture:true});
window.addEventListener('touchstart',enterWithSound,{capture:true});
window.addEventListener('pageshow',enterWithSound);
if(token)showEnvelope();
else if(isTest&&session)testMenu();
else home();
