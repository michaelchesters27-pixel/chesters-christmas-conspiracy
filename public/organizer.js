"use strict";
// Private organizer control room. This script contains no organizer secret.
const OWNER_STORAGE='chesters-2026-organizer-key';
let ownerKey=null,ownerState=null,ownerBusy=false;
function ownerEscape(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function ownerApi(action,extra={}){
  return fetch('/.netlify/functions/santa',{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({action,test:false,ownerKey,...extra})
  }).then(async r=>{
    let d;try{d=await r.json()}catch(e){throw Error('The Christmas workshop did not respond.')}
    if(!r.ok){
      const err=new Error(d.error||'Unable to access organizer controls');
      err.stage=d.stage||'';
      throw err;
    }
    return d;
  });
}
function ownerHomeLink(){return location.origin+'/?organizer=1'}
function ownerInvitation(person){
  const u=new URL('/',location.origin);
  u.searchParams.set('invite',person.token);
  return u.toString();
}
function ownerWhatsApp(person){
  const url=ownerInvitation(person);
  return '🎄 Hello '+person.name+'! Santa has left you a personal invitation to The Chesters Christmas Conspiracy! 🎅\n\n'+
    'Open your private Christmas letter here:\n'+url+'\n\n'+
    'Remember: the gift budget is £50. Write down three things you would love for Christmas, then discover your secret mission. 🤫 Please keep your assignment to yourself!\n\n'+
    'Merry Christmas! ❤️';
}
async function openOrganizer(){
  document.body.classList.add('inside');
  const url=new URL(location.href);
  const supplied=url.searchParams.get('organizer');
  try{
    if(supplied&&supplied!=='1'){
      // Key appears only once in the invitation the organizer opens;
      // remove it from the address bar before any interaction.
      localStorage.setItem(OWNER_STORAGE,supplied);
      url.searchParams.set('organizer','1');
      history.replaceState(null,'',url.pathname+url.search);
    }
    ownerKey=localStorage.getItem(OWNER_STORAGE);
  }catch(e){ownerKey=supplied&&supplied!=='1'?supplied:null}
  if(!ownerKey){
    el.innerHTML='<section class="menu-shell owner-shell"><span class="pill">✦ Private organizer access ✦</span>'+
      '<h2>This is Michael’s Christmas control room</h2>'+
      '<p>Open the special organizer link supplied privately. Only that link can access or resend the family invitations.</p></section>';
    return;
  }
  await ownerRefresh();
}
async function ownerRefresh(){
  if(ownerBusy)return;
  el.innerHTML='<div class="loading">✧ Checking the Christmas post ✧</div>';
  try{
    ownerState=await ownerApi('admin-state');
    ownerRender();
  }catch(e){
    el.innerHTML='<section class="menu-shell owner-shell"><span class="pill">Private Christmas control room</span>'+
      '<h2>Cannot open the organizer dashboard</h2><p>'+ownerEscape(e.message)+'</p>'+
      '<p class="owner-warning">Keep your organizer link private. Do not send it to family members.</p></section>';
  }
}
function ownerRender(){
  if(!ownerState)return;
  const ready=ownerState.created;
  const people=ownerState.people||[];
  const wishes=people.filter(p=>p.wishlistSaved).length;
  const reveals=people.filter(p=>p.revealed).length;
  const sent=people.filter(p=>p.sent).length;
  const header='<span class="pill">✦ Family organizer · Christmas 2026 ✦</span>'+
    '<h2>Santa’s private control room</h2>'+
    '<p>You are in charge of the eight family invitations. Nobody’s Secret Santa recipient is ever displayed here.</p>';
  if(!ready){
    el.innerHTML='<section class="menu-shell owner-shell">'+header+
      '<div class="owner-total"><span>8</span><small>family members</small><span>£50</span><small>maximum gift budget</small></div>'+
      '<p>The practice version is completely separate. The earlier draft invitations will <b>not</b> be used for the final family draw.</p>'+
      '<p><b>'+(ownerState.pending?'A previous draw attempt was interrupted. Resume that same draw safely.':'Ready to create the one and only final draw?')+'</b> Every person will be assigned someone outside their marriage, and the eight invitation links will remain available here for you to send later.</p>'+
      '<div class="actions"><button class="btn" onclick="ownerCreate()">✧ '+(ownerState.pending?'Resume the saved family draw':'Create the final family draw')+'</button>'+
      '<button class="btn btn-outline" onclick="location.assign(\'/?test=1\')">Open practice mode</button></div>'+
      '<p class="owner-warning">Creating the final draw is permanent. It will not send anything automatically or reveal matches to you.</p>'+
      '</section>';
    return;
  }
  let rows=people.map(p=>{
    const fullname=ownerEscape(p.name),id=ownerEscape(p.name);
    const badges='<span class="owner-status '+(p.sent?'okay':'')+'">'+(p.sent?'Marked sent':'Not marked sent')+'</span>'+
      '<span class="owner-status '+(p.wishlistSaved?'okay':'')+'">'+(p.wishlistSaved?'Wishes received':'Waiting for wishes')+'</span>'+
      '<span class="owner-status '+(p.revealed?'okay':'')+'">'+(p.revealed?'Secret opened':'Secret unopened')+'</span>';
    return '<div class="owner-person">'+
      '<div class="owner-person-top"><h3>✉ '+fullname+'</h3><div class="owner-status-group">'+badges+'</div></div>'+
      '<div class="owner-link"><input id="link-'+id+'" readonly aria-label="'+fullname+' private invitation" value="'+ownerEscape(ownerInvitation(p))+'"></div>'+
      '<div class="owner-controls">'+
        '<button class="btn btn-mini" onclick="ownerCopy(\''+id+'\',false)">Copy link</button>'+
        '<button class="btn btn-mini btn-outline" onclick="ownerShare(\''+id+'\')">Send via WhatsApp</button>'+
        '<button class="quiet-button" onclick="ownerCopy(\''+id+'\',true)">Copy message</button>'+
        '<button class="quiet-button" onclick="ownerMark(\''+id+'\','+(!p.sent)+')">'+(p.sent?'Unmark sent':'Mark sent')+'</button>'+
        '<button class="quiet-button owner-danger" onclick="ownerRotate(\''+id+'\')">Replace link</button>'+
      '</div></div>';
  }).join('');
  el.innerHTML='<section class="menu-shell owner-shell">'+header+
    '<div class="owner-summary"><div><b>8</b><span>invitations</span></div><div><b>'+sent+'</b><span>marked sent</span></div>'+
      '<div><b>'+wishes+'</b><span>wishlists saved</span></div><div><b>'+reveals+'</b><span>secrets revealed</span></div></div>'+
    '<p class="owner-note"><strong>Your job:</strong> Send each person their own unique link. They complete their wishes and open their present. Their assigned name stays private from you.</p>'+
    '<div class="owner-people">'+rows+'</div>'+
    '<div class="actions"><button class="btn btn-outline" onclick="ownerRefresh()">Refresh family progress</button>'+
      '<button class="btn btn-outline" onclick="location.assign(\'/?test=1\')">Try practice mode</button></div>'+
    '<p class="owner-warning">Never send your organizer link. Only send the personal invitation shown beside each name. “Marked sent” is your own checklist, not delivery confirmation.</p>'+
    '</section>';
}
function ownerPerson(name){
  return ownerState?.people?.find(p=>p.name===name)||null;
}
async function ownerCopy(name,message){
  const p=ownerPerson(name);if(!p)return;
  const content=message?ownerWhatsApp(p):ownerInvitation(p);
  try{
    await navigator.clipboard.writeText(content);
    ownerNotice((message?'WhatsApp message':'Private link')+' copied for '+name+'.');
  }catch(e){
    // Legacy copy fallback, preserving the user's ability to distribute links.
    const inp=document.createElement('textarea');
    inp.value=content;document.body.appendChild(inp);inp.select();
    try{document.execCommand('copy');ownerNotice('Copied for '+name+'.')}
    catch(err){ownerNotice('Clipboard unavailable. Select the invitation URL and copy it manually.')}
    inp.remove();
  }
}
function ownerNotice(message){
  let n=document.getElementById('ownerToast');
  if(!n){n=document.createElement('div');n.id='ownerToast';n.className='owner-toast';document.body.appendChild(n)}
  n.textContent=message;
  n.classList.add('show');
  if(ownerNotice.timer)clearTimeout(ownerNotice.timer);
  ownerNotice.timer=setTimeout(()=>n.classList.remove('show'),3200);
}
function ownerShare(name){
  const p=ownerPerson(name);if(!p)return;
  const url='https://wa.me/?text='+encodeURIComponent(ownerWhatsApp(p));
  window.open(url,'_blank','noopener,noreferrer');
}
async function ownerMark(name,sent){
  if(ownerBusy)return;ownerBusy=true;
  try{
    ownerState=await ownerApi('admin-sent',{name,sent:!!sent});ownerRender();
  }catch(e){ownerNotice(e.message)}
  finally{ownerBusy=false}
}
async function ownerRotate(name){
  if(ownerBusy)return;
  const p=ownerPerson(name);if(!p)return;
  if(!confirm('Replace '+name+'’s personal link?\n\nThe OLD link will immediately stop working, but '+name+' will keep the same assigned recipient and wishlist. You must send them the NEW link.'))return;
  ownerBusy=true;
  try{
    ownerState=await ownerApi('admin-rotate',{name});
    ownerRender();ownerNotice('New private invitation ready for '+name+'. The previous link is inactive.');
  }catch(e){ownerNotice(e.message)}
  finally{ownerBusy=false}
}
async function ownerCreate(){
  if(ownerBusy||ownerState?.created)return;
  if(!confirm(ownerState?.pending?
    'Resume the SAME saved final draw? This keeps the existing pairings and does not create another set.':
    'Create the FINAL Chesters Christmas 2026 draw for all eight people?\n\nNo spouses will be paired. Only one final draw is created. You will receive eight private links to share individually.'))return;
  ownerBusy=true;
  el.innerHTML='<div class="loading">✧ Santa is carefully preparing your eight invitations ✧</div>';
  try{
    ownerState=await ownerApi('admin-create');
    ownerRender();
    ownerNotice('The final draw is ready! Send each personal link when you are ready.');
  }catch(e){
    // A backend request can fail after the data was saved: always read the
    // persisted state before offering any new draw or declaring failure.
    let checkError='';
    try{
      ownerState=await ownerApi('admin-state');
      if(ownerState.created){
        ownerRender();
        ownerNotice('The draw was saved successfully. All eight links are ready.');
        return;
      }
    }catch(inner){checkError=inner.message;ownerState=null}
    el.innerHTML='<section class="menu-shell owner-shell"><h2>The final draw needs another check</h2>'+
      '<p>Something interrupted the creation process. No new family links should be sent yet.</p>'+
      '<p>'+ownerEscape(e.message)+'</p>'+
      (e.stage?'<p>Diagnostic stage: <strong>'+ownerEscape(e.stage)+'</strong></p>':'')+
      (checkError?'<p>The saved-draw check also failed: '+ownerEscape(checkError)+'</p>':'')+
      '<button class="btn" onclick="ownerRefresh()">Check saved draw</button>'+
      (ownerState?.pending?'<button class="btn btn-outline" onclick="ownerRender()">Resume safely</button>':'')+
      '</section>';
  }finally{ownerBusy=false}
}
