import { getStore } from '@netlify/blobs';
import { randomBytes, randomInt, createHash, timingSafeEqual } from 'node:crypto';

// Nothing in the family-facing website or organizer dashboard contains a pairing list.
const PEOPLE=['Joan','Aidan','Donna','Michael','Jenna','Paul','Corinna','Jonathan'];
const SPOUSES={Joan:'Aidan',Aidan:'Joan',Donna:'Michael',Michael:'Donna',Jenna:'Paul',Paul:'Jenna',Corinna:'Jonathan',Jonathan:'Corinna'};
const OWNER_KEY_SHA256='4a1a7b063d5f2264e952ed46ef7b22da127deed5f8267873b95e7553e22c9de7';
const reply=(v,status=200)=>new Response(JSON.stringify(v),{
  status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, private','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}
});
const token=()=>randomBytes(32).toString('hex');
const isToken=s=>typeof s==='string' && /^[a-f0-9]{64}$/.test(s);
const store=test=>getStore({name:test?'chesters-christmas-sandbox':'chesters-christmas-final-2026',consistency:'strong'});
const validOwner=v=>{
  if(typeof v!=='string'||v.length>250)return false;
  const digest=createHash('sha256').update(v).digest();
  return timingSafeEqual(digest,Buffer.from(OWNER_KEY_SHA256,'hex'));
};
function shuffled(a){
  const b=[...a];
  for(let i=b.length-1;i>0;i--){const j=randomInt(i+1);[b[i],b[j]]=[b[j],b[i]]}
  return b;
}
function makeDraw(){
  for(let i=0;i<10000;i++){
    const result=shuffled(PEOPLE);
    if(PEOPLE.every((name,j)=>result[j]!==name && result[j]!==SPOUSES[name])){
      return Object.fromEntries(PEOPLE.map((name,j)=>[name,result[j]]));
    }
  }
  throw Error('Could not create a valid draw');
}
function validWishes(b){
  return Array.isArray(b.wishes)&&b.wishes.length===3&&
    b.wishes.every(w=>typeof w==='string'&&w.trim().length>0&&w.length<=300)&&
    typeof b.notes==='string'&&b.notes.length<=1200;
}
async function finalState(s){
  const ready=await s.get('draw-ready',{type:'json'});
  if(!ready){
    const draft=await s.get('draw-draft',{type:'json'});
    return {created:false,pending:!!draft,year:2026,people:PEOPLE.map(name=>({name,status:'Not sent'}))};
  }
  const people=await Promise.all(ready.invites.map(async p=>{
    const [wish,rev,sent]=await Promise.all([
      s.get('wishlist-'+p.name,{type:'json'}),
      s.get('revealed-'+p.name),
      s.get('sent-'+p.name)
    ]);
    return {name:p.name,token:p.token,wishlistSaved:!!wish,revealed:rev!==null,sent:sent!==null};
  }));
  return {created:true,year:2026,createdAt:ready.createdAt,people};
}
async function createFinal(s){
  let stage='check-existing-draw';
  try{
    const ready=await s.get('draw-ready',{type:'json'});
    if(ready)return finalState(s);
    stage='recover-pending-draw';
    let draft=await s.get('draw-draft',{type:'json'});
    if(!draft){
      stage='create-pending-draw';
      const pairs=makeDraw();
      const value={invites:PEOPLE.map(name=>({name,token:token()})),pairs,createdAt:new Date().toISOString()};
      const result=await s.setJSON('draw-draft',value,{onlyIfNew:true});
      draft=result.modified?value:await s.get('draw-draft',{type:'json'});
      if(!draft)throw Error('Pending draw could not be recovered');
    }
    if(!Array.isArray(draft.invites)||draft.invites.length!==PEOPLE.length||!draft.pairs){
      throw Error('Pending draw data is incomplete');
    }
    stage='save-family-invitations';
    // A partial attempt is safe to retry: always reuse the same pending draw.
    for(const person of draft.invites){
      if(!PEOPLE.includes(person.name)||!isToken(person.token)){
        throw Error('A pending invitation was invalid');
      }
      const data={name:person.name,recipient:draft.pairs[person.name]};
      const previous=await s.get('guest-'+person.token,{type:'json'});
      if(previous){
        if(previous.name!==data.name||previous.recipient!==data.recipient){
          throw Error('An existing invitation does not match the pending draw');
        }
      }else{
        await s.setJSON('guest-'+person.token,data);
      }
    }
    stage='finalize-draw';
    await s.setJSON('draw-ready',{invites:draft.invites,createdAt:draft.createdAt});
    // Cleanup failure must not turn a successfully saved final draw into an error.
    try{await s.delete('draw-draft')}catch(e){console.warn('Draft cleanup can be retried')}
    stage='read-final-draw';
    return await finalState(s);
  }catch(error){
    console.error('Final draw failed at',stage,error);
    const failure=new Error('The final draw could not be completed');
    failure.stage=stage;
    throw failure;
  }
}
async function rotateInvitation(s,name){
  if(!PEOPLE.includes(name))return reply({error:'Unknown family member'},400);
  const ready=await s.get('draw-ready',{type:'json'});
  if(!ready)return reply({error:'Create the family draw first'},409);
  const old=ready.invites.find(p=>p.name===name);
  if(!old)return reply({error:'Invitation does not exist'},404);
  const guest=await s.get('guest-'+old.token,{type:'json'});
  if(!guest||guest.name!==name)return reply({error:'Unable to recover the invitation; no change made'},500);
  const newToken=token();
  await s.setJSON('guest-'+newToken,guest,{onlyIfNew:true});
  const updated={...ready,invites:ready.invites.map(p=>p.name===name?{name,token:newToken}:p)};
  await s.setJSON('draw-ready',updated);
  // The old link is now invalid because every request checks the active invitation list.
  await s.delete('guest-'+old.token);
  await s.delete('sent-'+name);
  return reply(await finalState(s));
}
export default async function handler(req){
  if(req.method!=='POST')return reply({error:'Method not allowed'},405);
  let b;
  try{
    if(Number(req.headers?.get?.('content-length')||0)>10000)return reply({error:'Request too large'},413);
    b=await req.json();
    if(!b||typeof b!=='object')return reply({error:'Invalid request'},400);
    const test=b.test===true;
    const s=store(test);

    // An independent, disposable test session never touches the final draw.
    if(b.action==='test-start'){
      if(!test)return reply({error:'Test mode only'},403);
      const session=token(),pairs=makeDraw();
      const invites=PEOPLE.map(name=>({name,token:token()}));
      for(const p of invites){
        await s.setJSON('session-'+session+'-guest-'+p.token,{
          name:p.name,recipient:pairs[p.name],wishlist:null,revealed:false
        });
      }
      await s.setJSON('session-'+session+'-invites',invites);
      return reply({session,invites});
    }
    const session=test&&isToken(b.session)?b.session:null;
    const prefix=session?'session-'+session+'-':'';
    if(b.action==='test-list'){
      if(!test||!session)return reply({error:'Test session required'},400);
      const invites=await s.get(prefix+'invites',{type:'json'});
      return invites?reply({session,invites}):reply({error:'Test session not found'},404);
    }

    if(typeof b.action==='string'&&b.action.startsWith('admin-')){
      if(test||!validOwner(b.ownerKey))return reply({error:'Private organizer access required'},403);
      if(b.action==='admin-state')return reply(await finalState(s));
      if(b.action==='admin-create')return reply(await createFinal(s));
      if(b.action==='admin-rotate')return rotateInvitation(s,b.name);
      if(b.action==='admin-sent'){
        if(!PEOPLE.includes(b.name))return reply({error:'Unknown family member'},400);
        if(!await s.get('draw-ready'))return reply({error:'Draw not created'},409);
        if(b.sent===true)await s.set('sent-'+b.name,'yes');
        else if(b.sent===false)await s.delete('sent-'+b.name);
        else return reply({error:'Invalid sent status'},400);
        return reply(await finalState(s));
      }
      return reply({error:'Unknown organizer command'},400);
    }
    // Old real-draw setup is disabled; the original practice-era data is never reused.
    if(b.action==='setup')return reply({error:'Use the private organizer dashboard'},403);
    if(!isToken(b.token))return reply({error:'Invalid invitation'},403);

    let key=prefix+'guest-'+b.token;
    let guest;
    if(test){
      if(!session)return reply({error:'Test session required'},403);
      guest=await s.get(key,{type:'json'});
    }else{
      const ready=await s.get('draw-ready',{type:'json'});
      if(!ready||!ready.invites.some(p=>p.token===b.token))return reply({error:'This invitation is no longer active. Ask your organizer for your private link.'},404);
      guest=await s.get('guest-'+b.token,{type:'json'});
    }
    if(!guest)return reply({error:'Invitation not found'},404);

    if(test){
      // Keep sandbox behavior unchanged so all practice flows remain available.
      const view=async()=>({
        name:guest.name,wishlist:guest.wishlist,revealed:guest.revealed,
        ...(guest.revealed?{
          recipient:guest.recipient,
          recipientWishlist:(await s.get(prefix+'wishlist-'+guest.recipient,{type:'json'}))||
            {wishes:['A cosy Christmas gift','Something for the house','A surprise under £50'],
              notes:'These are sample wishes for testing only.',sample:true}
        }:{})
      });
      if(b.action==='view')return reply(await view());
      if(b.action==='save'){
        if(!validWishes(b))return reply({error:'Enter three gift ideas, each under 300 characters'},400);
        guest.wishlist={wishes:b.wishes.map(w=>w.trim()),notes:b.notes};
        await s.setJSON(prefix+'wishlist-'+guest.name,guest.wishlist);
        await s.setJSON(key,guest);
        return reply(await view());
      }
      if(b.action==='reveal'){
        if(!guest.wishlist)return reply({error:'Save your wishlist first'},400);
        guest.revealed=true;await s.setJSON(key,guest);
        return reply(await view());
      }
    }else{
      const view=async()=>{
        const [wish,revealed]=await Promise.all([
          s.get('wishlist-'+guest.name,{type:'json'}),
          s.get('revealed-'+guest.name)
        ]);
        const result={name:guest.name,wishlist:wish,revealed:revealed!==null};
        if(result.revealed){
          result.recipient=guest.recipient;
          result.recipientWishlist=await s.get('wishlist-'+guest.recipient,{type:'json'});
        }
        return result;
      };
      if(b.action==='view')return reply(await view());
      if(b.action==='save'){
        if(!validWishes(b))return reply({error:'Enter three gift ideas, each under 300 characters'},400);
        await s.setJSON('wishlist-'+guest.name,{wishes:b.wishes.map(w=>w.trim()),notes:b.notes});
        return reply(await view());
      }
      if(b.action==='reveal'){
        const wish=await s.get('wishlist-'+guest.name,{type:'json'});
        if(!wish)return reply({error:'Seal your wishlist first'},400);
        await s.set('revealed-'+guest.name,'yes',{onlyIfNew:true});
        return reply(await view());
      }
    }
    return reply({error:'Unknown command'},400);
  }catch(e){
    console.error('Santa API error',e);
    // Only a valid organizer can see a diagnostic stage, never assignments or credentials.
    if(typeof b!=='undefined' && b?.action==='admin-create' && validOwner(b.ownerKey)){
      return reply({error:'The final draw was interrupted. Please check the draw; do not send invitations yet.',stage:e.stage||'unexpected-error'},500);
    }
    return reply({error:'The workshop is temporarily unavailable; please try again'},500);
  }
}
export const config={rateLimit:{action:'rate_limit',aggregateBy:'ip',windowSize:60,windowLimit:120}};
