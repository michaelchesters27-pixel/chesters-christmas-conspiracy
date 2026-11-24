"use strict";

const PEOPLE=['Joan','Aidan','Donna','Michael','Jenna','Paul','Corinna','Jonathan'];
const el=document.getElementById('app');
const soundButton=document.getElementById('soundToggle');
const query=new URLSearchParams(location.search);
let token=query.get('invite');
let session=query.get('session');
let isTest=query.get('test')==='1'||!token;
let current=null;
let opening=false;

// Only sound effects: wind in the forest, a quiet fire and irregular log crackles.
// The browser requires a tap or click before it can play.
let audio=null,wind=null,windGain=null,fire=null,fireGain=null,crackleLoop=null;
let audioOptedOut=false,audioStarted=false;
function makeNoise(seconds){
  const length=Math.floor(audio.sampleRate*seconds);
  const buffer=audio.createBuffer(1,length,audio.sampleRate);
  const data=buffer.getChannelData(0);
  for(let i=0;i<length;i++)data[i]=(Math.random()*2-1);
  return buffer;
}
function startAmbience(){
  if(audioStarted)return;
  try{
    audio=audio||new (window.AudioContext||window.webkitAudioContext)();
    audio.resume();
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
    soundButton.textContent='◖ 🔥 Wind & fire on';
    soundButton.setAttribute('aria-pressed','true');
  }catch(e){
    soundButton.textContent='Sound unavailable';
    audioStarted=false;
  }
}
function stopAmbience(){
  if(crackleLoop)clearInterval(crackleLoop);
  crackleLoop=null;
  try{if(wind){wind.stop();wind.disconnect()}if(fire){fire.stop();fire.disconnect()}}catch(e){}
  wind=fire=null;audioStarted=false;
  soundButton.textContent='◌ Wind & fire off';
  soundButton.setAttribute('aria-pressed','false');
}
function toggleAmbience(){
  if(audioStarted){audioOptedOut=true;stopAmbience()}
  else{audioOptedOut=false;startAmbience()}
}
function enterWithSound(){if(!audioStarted&&!audioOptedOut)startAmbience()}

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
  if(!isTest||!session){home();return}
  token=null;current=null;setUrl();status('Finding the eight letters');
  try{const result=await api('test-list');renderMenu(result.invites)}
  catch(e){err(e)}
}
async function choose(next){
  token=next;current=null;setUrl();await showEnvelope();
}
async function showEnvelope(){
  if(!token){home();return}
  status('An invitation is on its way');
  try{
    current=await api('view');
    const name=safe(current.name);
    el.innerHTML='<section class="envelope-area">'+
      '<div class="envelope-copy">'+
      '<span class="snowletter">Delivered with love from the North Pole</span>'+
      '<h1>'+name+',<br><em>this is for you.</em></h1>'+
      '<p>The snow is falling. The fire is glowing. And Santa has left a very special envelope with your name on it. Only you can discover what is inside.</p>'+
      '<div class="helptext">✧ PERSONAL & CONFIDENTIAL · CHRISTMAS 2026</div>'+
      '</div>'+
      '<button class="envelope" type="button" onclick="openLetter()" aria-label="Open the Christmas letter addressed to '+name+'">'+
      '<span class="seal">C</span><span class="envelope-label">For '+name+' · From Santa</span>'+
      '</button></section>'+nav();
  }catch(e){err(e)}
}
function openLetter(){enterWithSound();renderCurrent()}
function letterHeading(heading,subheading=''){
  return '<span class="letter-kicker">✦ The Chesters Christmas Conspiracy ✦</span>'+
    '<h2>'+heading+'</h2>'+(subheading?'<p>'+subheading+'</p>':'');
}
function wishForm(edit=false){
  const wishlist=edit&&current.wishlist?current.wishlist:{wishes:['','',''],notes:''};
  let html=letterHeading('Dear '+safe(current.name)+',','Santa has a little request before he reveals your Christmas secret.');
  html+='<p class="form-description">With a £50 gift budget, write three things you would be delighted to find under the tree. It will help your secret gift-giver make Christmas special.</p>';
  html+='<form id="wishForm" class="wish-form" onsubmit="saveWishes(event)">';
  for(let i=0;i<3;i++)html+='<label for="w'+i+'">Christmas wish No. '+(i+1)+'</label>'+
    '<input id="w'+i+'" name="wish'+i+'" maxlength="300" required placeholder="Something I would love…" value="'+safe(wishlist.wishes[i])+'">';
  html+='<label for="notes">A little extra help (optional)</label>'+
    '<textarea id="notes" maxlength="1200" placeholder="Sizes, favourite colours, shopping links, or a hint…">'+safe(wishlist.notes)+'</textarea>'+
    '<button type="submit" class="btn">✧ Seal my Christmas wishes</button></form>';
  return html;
}
function renderCurrent(){
  if(!current){showEnvelope();return}
  if(!current.wishlist){
    el.innerHTML=panel(wishForm()) ;
    return;
  }
  if(!current.revealed){
    el.innerHTML=panel(letterHeading('Your wishes are safe, '+safe(current.name)+'.',
      'Santa has sealed your letter and placed it by the fire. Now, the best part: your own Christmas mission is waiting.')+
      hearth()+
      '<div class="actions"><button class="btn" onclick="reveal()">Break the seal & discover your name</button></div>'+
      '<small>Promise to keep it secret until Christmas Day.</small>');
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
  el.innerHTML=panel('<span class="letter-kicker">✦ Top secret · A letter for '+safe(current.name)+' ✦</span>'+
    '<p>Santa has made his choice. This Christmas, your one very special person is…</p>'+
    '<div class="recipient">'+safe(current.recipient)+'</div>'+
    '<div class="goldline"></div>'+
    '<p>Buy a little something with love, stay within £50, and keep this between us until Christmas Day.</p>'+
    details+
    '<div class="actions"><button class="btn btn-mini" onclick="editWishes()">Update my wishes</button>'+
    '<button class="btn btn-outline btn-mini" onclick="refreshWishes()">Check their wishlist</button></div>');
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
async function reveal(){
  status('The seal is breaking…');
  try{
    current=await api('reveal');
    window.setTimeout(renderCurrent,1150);
  }catch(e){err(e)}
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
soundButton.addEventListener('click',toggleAmbience);
if(token)showEnvelope();
else if(isTest&&session)testMenu();
else home();
