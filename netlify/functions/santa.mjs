import { getStore } from '@netlify/blobs';
import { randomBytes } from 'node:crypto';

const people = ['Joan','Aidan','Donna','Michael','Jenna','Paul','Corinna','Jonathan'];
const spouse = {Joan:'Aidan',Aidan:'Joan',Donna:'Michael',Michael:'Donna',Jenna:'Paul',Paul:'Jenna',Corinna:'Jonathan',Jonathan:'Corinna'};
const reply = (value,status=200) => new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
const store = (test=false) => getStore({name:test?'chesters-christmas-sandbox':'chesters-christmas-2026',consistency:'strong'});
const secret = () => randomBytes(32).toString('hex');
const validToken = v => typeof v==='string' && /^[a-f0-9]{64}$/.test(v);

function shuffle(items) {
  const copy=[...items];
  for(let i=copy.length-1;i>0;i--){
    const j=randomBytes(4).readUInt32BE(0)%(i+1);
    [copy[i],copy[j]]=[copy[j],copy[i]];
  }
  return copy;
}
function draw() {
  for(let i=0;i<10000;i++){
    const shuffled=shuffle(people);
    if(people.every((name,index)=>shuffled[index]!==name && shuffled[index]!==spouse[name])){
      return Object.fromEntries(people.map((name,index)=>[name,shuffled[index]]));
    }
  }
  throw new Error('Could not create a valid family draw');
}

export default async function handler(request) {
  if(request.method!=='POST') return reply({error:'Method not allowed'},405);
  try {
    const b=await request.json();
    const test=b.test===true;
    const s=store(test);

    // New test sessions are independent. Repeating this never encounters an
    // old draw and never reads or modifies any production family invitation.
    if(b.action==='test-start'){
      if(!test) return reply({error:'Test mode only'},403);
      const session=secret();
      const pairs=draw();
      const invites=people.map(name=>({name,token:secret()}));
      for(const entry of invites){
        await s.setJSON('session-'+session+'-guest-'+entry.token,{
          name:entry.name,recipient:pairs[entry.name],wishlist:null,revealed:false
        });
      }
      await s.setJSON('session-'+session+'-invites',invites);
      return reply({session,invites});
    }

    const session=test && validToken(b.session) ? b.session : null;
    const prefix=session ? 'session-'+session+'-' : '';

    if(b.action==='test-list'){
      if(!test||!session) return reply({error:'Test session required'},400);
      const invites=await s.get(prefix+'invites',{type:'json'});
      return invites ? reply({invites,session}) : reply({error:'Test session not found'},404);
    }

    // Original organizer-protected production draw is deliberately unchanged.
    if(b.action==='setup'){
      if(test) return reply({error:'Use the new test experience instead'},400);
      if(!process.env.SANTA_SETUP_CODE) return reply({error:'Organizer setup has not been configured'},503);
      if(b.code!==process.env.SANTA_SETUP_CODE) return reply({error:'Incorrect organizer code'},403);
      if(await s.get('initialized')) return reply({error:'The family draw already exists'},409);
      const pairs=draw(),invites=people.map(name=>({name,token:secret()}));
      for(const person of invites) {
        await s.setJSON('guest-'+person.token,{name:person.name,recipient:pairs[person.name],wishlist:null,revealed:false});
      }
      await s.set('initialized','yes',{onlyIfNew:true});
      return reply({invites});
    }

    if(!validToken(b.token)) return reply({error:'Invalid invitation link'},403);
    const key=prefix+'guest-'+b.token;
    const user=await s.get(key,{type:'json'});
    if(!user) return reply({error:'Invitation not found'},404);
    const view=async () => {
      const data={name:user.name,wishlist:user.wishlist,revealed:user.revealed};
      if(user.revealed){
        let wishlist=await s.get(prefix+'wishlist-'+user.recipient,{type:'json'});
        if(test && !wishlist) wishlist={
          wishes:['A cosy Christmas gift','Something for the house','A surprise under £50'],
          notes:'These are sample wishes for testing only.',sample:true
        };
        data.recipient=user.recipient;
        data.recipientWishlist=wishlist;
      }
      return data;
    };
    if(b.action==='view') return reply(await view());
    if(b.action==='save'){
      if(!Array.isArray(b.wishes)||b.wishes.length!==3||
        b.wishes.some(w=>typeof w!=='string'||!w.trim()||w.length>300)||
        typeof b.notes!=='string'||b.notes.length>1200) {
        return reply({error:'Please enter three gift ideas, each up to 300 characters.'},400);
      }
      user.wishlist={wishes:b.wishes.map(w=>w.trim()),notes:b.notes};
      await s.setJSON(prefix+'wishlist-'+user.name,user.wishlist);
      await s.setJSON(key,user);
      return reply(await view());
    }
    if(b.action==='reveal'){
      if(!user.wishlist) return reply({error:'Save your wishlist first'},400);
      user.revealed=true;
      await s.setJSON(key,user);
      return reply(await view());
    }
    return reply({error:'Unknown action'},400);
  } catch(e) {
    console.error(e);
    return reply({error:'Santa’s workshop is temporarily unavailable'},500);
  }
}