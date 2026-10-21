import { app, firebaseReady } from "./firebase.js";
import { auth, onAuthStateChanged, signInWithGoogle, signOut, friendlyAuthError } from "./auth.js";
import { getDatabase, ref, set, get, update, onValue, onChildAdded, push, remove, runTransaction, serverTimestamp, onDisconnect } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

const $ = id => document.getElementById(id);
const ui = {
  notice:$("notice"),authStatus:$("auth-status"),signIn:$("sign-in"),signOut:$("sign-out"),
  lobby:$("lobby"),room:$("room"),results:$("results"),create:$("create-room"),join:$("join-room"),code:$("room-code"),
  roomCode:$("room-code-display"),roomTitle:$("room-title"),roomSubtitle:$("room-subtitle"),copy:$("copy-invite"),leave:$("leave-room"),
  players:$("players"),playerCount:$("player-count"),hostControls:$("host-controls"),roundCount:$("round-count"),start:$("start-game"),waiting:$("waiting-help"),
  roundLabel:$("round-label"),turnTitle:$("turn-title"),timer:$("timer"),word:$("word-strip"),canvas:$("drawing"),canvasEmpty:$("canvas-empty"),
  tools:$("artist-tools"),swatches:$("swatches"),brush:$("brush-size"),eraser:$("eraser"),clear:$("clear-canvas"),
  messages:$("messages"),chatForm:$("chat-form"),chatInput:$("chat-input"),send:$("send-message"),scores:$("final-scores"),again:$("play-again")
};
const COLORS=["#101326","#e5484d","#f97316","#facc15","#22c55e","#06b6d4","#3b82f6","#8b5cf6","#ec4899","#ffffff"];
const WORDS=["rainbow","telescope","watermelon","guitar","volcano","butterfly","spaceship","pancake","octopus","skateboard","pineapple","snowman","crown","dragon","lighthouse","popcorn","robot","waterfall","dinosaur","backpack","football","ice cream","sunflower","rocket","umbrella","camera","castle","pizza","penguin","treasure"];
let db=null,user=null,roomId=null,roomData=null,unsubs=[],timerHandle=null,secondsLeft=0,selectedColor=COLORS[0],drawing=false,lastPoint=null,lastDrawAt=0,strokeRef=null,canvasCtx=null,canvasReady=false,seenMessageIds=new Set(),currentRoomToken=0,roundTransitionBusy=false,eraserOn=false;
const esc = value => String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function notice(message,type=""){ui.notice.textContent=message;ui.notice.className="notice"+(type?" "+type:"");}
function setSignedOut(){ui.authStatus.textContent="Sign in to play";ui.signIn.hidden=false;ui.signOut.hidden=true;ui.create.disabled=true;ui.join.disabled=true;}
function cleanupListeners(){unsubs.forEach(fn=>{try{fn()}catch{}});unsubs=[];if(timerHandle)clearInterval(timerHandle);timerHandle=null;}
function path(...parts){return ref(db,parts.join("/"));}
function isHost(){return !!user&&roomData?.hostUid===user.uid;}
function isArtist(){return !!user&&roomData?.game?.artistUid===user.uid;}
function members(){return Object.values(roomData?.players||{});}
function myPlayer(){return roomData?.players?.[user?.uid];}
function roomBase(){return "rooms/"+roomId;}
function setCanvasEnabled(on){ui.canvas.style.cursor=on?"crosshair":"default";ui.canvas.style.pointerEvents="auto";ui.tools.hidden=!on;}
function showLobby(){ui.lobby.hidden=false;ui.room.hidden=true;ui.results.hidden=true;}
function showRoom(){ui.lobby.hidden=true;ui.room.hidden=false;ui.results.hidden=true;}
function fitCanvas(){
 const rect=ui.canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;
 const dpr=Math.min(window.devicePixelRatio||1,2),w=Math.round(rect.width*dpr),h=Math.round(rect.height*dpr);
 if(ui.canvas.width!==w||ui.canvas.height!==h){const old=canvasReady?ui.canvas.toDataURL():"";ui.canvas.width=w;ui.canvas.height=h;canvasCtx=ui.canvas.getContext("2d");canvasCtx.fillStyle="#fbfbff";canvasCtx.fillRect(0,0,w,h);canvasCtx.lineCap="round";canvasCtx.lineJoin="round";canvasReady=true;if(old){const img=new Image();img.onload=()=>canvasCtx.drawImage(img,0,0,w,h);img.src=old;}}
}
function drawSegment(segment){
 if(!segment||!canvasCtx)return;fitCanvas();const w=ui.canvas.width,h=ui.canvas.height;
 canvasCtx.save();canvasCtx.strokeStyle=segment.color||"#101326";canvasCtx.lineWidth=Math.max(1,Number(segment.size)||5)*(window.devicePixelRatio||1);canvasCtx.lineCap="round";canvasCtx.lineJoin="round";
 canvasCtx.beginPath();canvasCtx.moveTo(segment.x1*w,segment.y1*h);canvasCtx.lineTo(segment.x2*w,segment.y2*h);canvasCtx.stroke();canvasCtx.restore();ui.canvasEmpty.hidden=true;
}
function redraw(segments){fitCanvas();if(!canvasCtx)return;canvasCtx.fillStyle="#fbfbff";canvasCtx.fillRect(0,0,ui.canvas.width,ui.canvas.height);(segments||[]).forEach(drawSegment);ui.canvasEmpty.hidden=!!(segments||[]).length;}
function resetRoundListeners(){unsubs=unsubs.filter(fn=>!fn.__roundListener);}
function listenRoom(token){
 cleanupListeners();seenMessageIds.clear();
 unsubs.push(onValue(path(roomBase()),snap=>{
   if(token!==currentRoomToken)return;
   if(!snap.exists()){leaveLocal("This room has ended or no longer exists.");return;}
   roomData=snap.val();renderRoom();
 },err=>notice("Room sync failed: "+err.message,"error")));
 unsubs.push(onChildAdded(path(roomBase(),"messages"),snap=>{
   if(token!==currentRoomToken||seenMessageIds.has(snap.key))return;seenMessageIds.add(snap.key);renderMessage(snap.key,snap.val());
 }));
 unsubs.push(onChildAdded(path(roomBase(),"drawings"),snap=>{if(token!==currentRoomToken)return;drawSegment(snap.val());}));
 unsubs.push(onValue(path(roomBase(),"drawings"),snap=>{if(token!==currentRoomToken)return;redraw(Object.values(snap.val()||{}));}));
 unsubs.push(onValue(path(roomBase(),"game","deadline"),snap=>{if(token!==currentRoomToken)return;syncTimer(snap.val());}));
}
function renderRoom(){
 if(!roomData||!user)return;showRoom();ui.roomCode.textContent=roomId;ui.roomTitle.innerHTML="Room <span>"+esc(roomId)+"</span>";ui.roomSubtitle.textContent=roomData.status==="playing"?"Round in progress — good luck!":"Share the code and wait for your friends.";const list=members();
 ui.playerCount.textContent=list.length+" / 8";ui.players.innerHTML="";
 list.sort((a,b)=>(b.score||0)-(a.score||0)).forEach(p=>{
   const li=document.createElement("li");li.className="player";
   const role=p.uid===roomData.hostUid?"HOST":p.uid===roomData.game?.artistUid?"DRAWING":"PLAYER";
   li.innerHTML='<span class="avatar">'+esc((p.displayName||"?").trim().slice(0,1).toUpperCase())+'</span><span class="player-info"><b>'+esc(p.displayName||"Player")+'</b><small>'+role+'</small></span><span class="score">'+Number(p.score||0)+'</span>';ui.players.append(li);
 });
 ui.hostControls.hidden=!isHost()||roomData.status==="playing";ui.start.disabled=list.length<2||list.length>8||roomData.status==="playing";ui.waiting.hidden=roomData.status==="playing";ui.waiting.textContent=list.length<2?"At least two signed-in players are needed to start.":"The host can start when everyone is ready.";
 const game=roomData.game||{};ui.roundLabel.textContent=roomData.status==="playing"?"ROUND "+(game.round||1)+" / "+(game.totalRounds||5):roomData.status==="finished"?"FINISHED":"WAITING ROOM";
 ui.turnTitle.textContent=roomData.status==="playing"?(isArtist()?"Your turn — draw the word!":(game.artistName||"Artist")+" is drawing…"):roomData.status==="finished"?"Game complete":"Waiting for the host…";
 ui.word.textContent=roomData.status!=="playing"?"The drawing canvas appears when a round begins.":isArtist()?"Your word: "+(game.secretWord||"…"):"Guess the word in chat to earn points!";
 ui.canvasEmpty.hidden=Object.keys(roomData.drawings||{}).length>0;setCanvasEnabled(roomData.status==="playing"&&isArtist());
 ui.chatInput.disabled=roomData.status!=="playing";ui.send.disabled=roomData.status!=="playing";ui.chatInput.placeholder=roomData.status==="playing"?"Type your guess…":"Chat opens when the round begins.";
 if(roomData.status==="finished"){showResults();}
}
function renderMessage(id,msg){
 const row=document.createElement("div");row.className="message"+(msg.kind==="system"?" system":msg.kind==="correct"?" correct":"");
 if(msg.kind==="system")row.textContent=msg.text||"";
 else {const b=document.createElement("b");b.textContent=(msg.name||"Player")+":";row.append(b,document.createTextNode(" "+(msg.text||"")));}ui.messages.append(row);ui.messages.scrollTop=ui.messages.scrollHeight;
}
async function postMessage(text,kind="chat"){
 if(!roomId||!user||!text.trim())return;
 await set(push(path(roomBase(),"messages")),{uid:user.uid,name:user.displayName||"Player",text:text.trim().slice(0,120),kind,createdAt:Date.now()});
}
function syncTimer(deadline){
 if(timerHandle)clearInterval(timerHandle);if(!deadline){ui.timer.textContent="—";return;}
 const tick=()=>{secondsLeft=Math.max(0,Math.ceil((Number(deadline)-Date.now())/1000));ui.timer.textContent=String(secondsLeft).padStart(2,"0");ui.timer.classList.toggle("low",secondsLeft<=10);if(secondsLeft===0&&isHost()&&roomData?.status==="playing")advanceRound("Time's up!");};
 tick();timerHandle=setInterval(tick,300);
}
async function createRoom(){
 if(!user||!db)return;ui.create.disabled=true;
 try{
  const id=Array.from(crypto.getRandomValues(new Uint8Array(6)),n=>"ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[n%32]).join("");
  const now=Date.now();const initial={hostUid:user.uid,status:"waiting",createdAt:now,players:{[user.uid]:{uid:user.uid,displayName:user.displayName||user.email?.split("@")[0]||"Player",score:0,joinedAt:now,online:true}},game:{round:0,totalRounds:5,artistUid:"",deadline:0},drawings:{},messages:{}};
  const roomRef=path("rooms",id);await set(roomRef,initial);await onDisconnect(path("rooms",id,"players",user.uid,"online")).set(false);await enterRoom(id);
 }catch(e){notice("Couldn't create room: "+friendlyAuthError(e),"error");ui.create.disabled=false;}
}
async function enterRoom(id){
 id=String(id||"").toUpperCase().replace(/[^A-Z0-9]/g,"");if(!/^[A-Z2-9]{6}$/.test(id)){notice("Enter a valid 6-character room code.","error");return;}
 const token=++currentRoomToken;cleanupListeners();
 try{
  const snap=await get(path("rooms",id));if(!snap.exists())throw new Error("Room not found. Check the code and try again.");
  const data=snap.val();const roster=data.players||{};
  if(data.status==="finished")throw new Error("This game has finished. Ask the host to create a new room.");
  if(!roster[user.uid]&&Object.keys(roster).length>=8)throw new Error("This room is full (8 players maximum).");
  if(!roster[user.uid])await update(path("rooms",id,"players",user.uid),{uid:user.uid,displayName:user.displayName||user.email?.split("@")[0]||"Player",score:0,joinedAt:Date.now(),online:true});
  else await update(path("rooms",id,"players",user.uid),{online:true});
  roomId=id;roomData=data;seenMessageIds.clear();ui.messages.replaceChildren();showRoom();listenRoom(token);await onDisconnect(path("rooms",id,"players",user.uid,"online")).set(false);notice("Connected to room "+id,"success");
 }catch(e){roomId=null;roomData=null;showLobby();notice(e.message||"Could not join room.","error");}
}
async function leaveRoom(){
 if(!roomId||!user)return;const old=roomId;cleanupListeners();currentRoomToken++;
 try{await remove(path("rooms",old,"players",user.uid));const snap=await get(path("rooms",old,"players"));if(!snap.exists()||!Object.keys(snap.val()||{}).length)await remove(path("rooms",old));else{const roomSnap=await get(path("rooms",old));if(roomSnap.exists()&&roomSnap.val().hostUid===user.uid){const next=Object.keys(snap.val())[0];await update(path("rooms",old),{hostUid:next});}}}catch(e){console.warn("Room cleanup",e);}
 roomId=null;roomData=null;showLobby();notice("You left the room.");ui.messages.replaceChildren();
}
function leaveLocal(message){cleanupListeners();roomId=null;roomData=null;showLobby();notice(message,"error");}
async function startGame(){
 if(!isHost()||members().length<2||members().length>8)return;
 try{
  const roster=members();const roundOrder=roster.map(p=>p.uid).sort(()=>Math.random()-.5);
  await update(path(roomBase()),{status:"playing","game/round":1,"game/totalRounds":Number(ui.roundCount.value)||5,"game/artistOrder":roundOrder,"game/artistIndex":0,"game/artistUid":roundOrder[0],"game/artistName":roster.find(p=>p.uid===roundOrder[0])?.displayName||"Artist","game/secretWord":WORDS[Math.floor(Math.random()*WORDS.length)],"game/deadline":Date.now()+80000,"drawings":{}});
  await postMessage("Round 1 begins! The artist has a secret word.","system");
 }catch(e){notice("Couldn't start the game: "+e.message,"error");}
}
async function advanceRound(reason){
 if(roundTransitionBusy||!isHost()||roomData?.status!=="playing")return;roundTransitionBusy=true;
 try{
  await postMessage(reason,"system");
  const game=roomData.game||{},nextRound=(game.round||1)+1,total=game.totalRounds||5;
  if(nextRound>total){await update(path(roomBase()),{status:"finished","game/deadline":0});return;}
  const order=game.artistOrder||members().map(p=>p.uid);const index=(game.artistIndex+1)%order.length;const uid=order[index];const artist=roomData.players?.[uid];
  await update(path(roomBase()),{"game/round":nextRound,"game/artistIndex":index,"game/artistUid":uid,"game/artistName":artist?.displayName||"Artist","game/secretWord":WORDS[Math.floor(Math.random()*WORDS.length)],"game/deadline":Date.now()+80000,"drawings":{}});
  await postMessage("Round "+nextRound+" begins! "+(artist?.displayName||"The artist")+" is drawing.","system");
 }catch(e){notice("Round update failed: "+e.message,"error");}finally{roundTransitionBusy=false;}
}
async function sendChat(raw){
 const text=raw.trim();if(!text||!roomId||roomData?.status!=="playing")return;
 const game=roomData.game||{};
 if(isArtist()){await postMessage(text);return;}
 if(text.toLowerCase()===String(game.secretWord||"").toLowerCase()){
   // Client-side prototype scoring; move answer validation to a trusted server before public launch.
   const already=Object.values(roomData.messages||{}).some(m=>m.uid===user.uid&&m.kind==="correct"&&m.round===game.round);
   if(!already){await runTransaction(path(roomBase(),"players",user.uid,"score"),v=>(Number(v)||0)+Math.max(10,Math.ceil((Number(game.deadline)-Date.now())/1000)));await set(push(path(roomBase(),"messages")),{uid:user.uid,name:user.displayName||"Player",text:"guessed the word! 🎉",kind:"correct",round:game.round,createdAt:Date.now()});}
   const guessed=Object.values(roomData.messages||{}).filter(m=>m.kind==="correct"&&m.round===game.round).length+1;
   if(isHost()&&guessed>=Math.max(1,members().length-1))await advanceRound("Everyone guessed it!");
 }else await postMessage(text);
}
function setupDrawing(){
 canvasCtx=ui.canvas.getContext("2d");fitCanvas();window.addEventListener("resize",fitCanvas);
 const point=e=>{const r=ui.canvas.getBoundingClientRect();return{x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))};};
 ui.canvas.addEventListener("pointerdown",e=>{if(!isArtist()||roomData?.status!=="playing")return;drawing=true;lastPoint=point(e);lastDrawAt=0;ui.canvas.setPointerCapture?.(e.pointerId);});
 ui.canvas.addEventListener("pointermove",e=>{if(!drawing||!lastPoint||!isArtist())return;const now=performance.now();if(now-lastDrawAt<18)return;lastDrawAt=now;const p=point(e);const seg={x1:lastPoint.x,y1:lastPoint.y,x2:p.x,y2:p.y,color:eraserOn?"#fbfbff":selectedColor,size:eraserOn?24:Number(ui.brush.value)||5,by:user.uid,at:Date.now()};lastPoint=p;drawSegment(seg);if(!strokeRef)strokeRef=push(path(roomBase(),"drawings"));set(strokeRef,seg).catch(()=>{});strokeRef=null;});
 const end=()=>{drawing=false;lastPoint=null;strokeRef=null;};ui.canvas.addEventListener("pointerup",end);ui.canvas.addEventListener("pointercancel",end);ui.canvas.addEventListener("pointerleave",end);
 COLORS.forEach((color,i)=>{const b=document.createElement("button");b.type="button";b.className="swatch";b.style.background=color;b.setAttribute("aria-label","Brush "+color);b.setAttribute("aria-pressed",String(i===0));b.addEventListener("click",()=>{selectedColor=color;eraserOn=false;ui.eraser.classList.remove("active");[...ui.swatches.children].forEach(x=>x.setAttribute("aria-pressed",String(x===b)));});ui.swatches.append(b);});
}
ui.create.addEventListener("click",createRoom);ui.join.addEventListener("click",()=>enterRoom(ui.code.value));ui.code.addEventListener("input",()=>ui.code.value=ui.code.value.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,6));ui.code.addEventListener("keydown",e=>{if(e.key==="Enter")enterRoom(ui.code.value);});
ui.start.addEventListener("click",startGame);ui.leave.addEventListener("click",leaveRoom);ui.copy.addEventListener("click",async()=>{const link=new URL("draw-guess.html?room="+roomId,location.href).href;try{await navigator.clipboard.writeText(link);notice("Invite link copied! Share it with your friends.","success");}catch{notice("Share this room code: "+roomId);}});
ui.chatForm.addEventListener("submit",async e=>{e.preventDefault();const val=ui.chatInput.value;ui.chatInput.value="";try{await sendChat(val);}catch(err){notice("Message failed: "+err.message,"error");}});
ui.eraser.addEventListener("click",()=>{eraserOn=!eraserOn;ui.eraser.classList.toggle("active",eraserOn);});ui.clear.addEventListener("click",async()=>{if(!isArtist())return;await remove(path(roomBase(),"drawings"));});ui.again.addEventListener("click",async()=>{await leaveRoom();ui.code.value="";});
ui.signIn.addEventListener("click",async()=>{try{await signInWithGoogle();}catch(e){notice(friendlyAuthError(e),"error");}});ui.signOut.addEventListener("click",async()=>{await leaveRoom();await signOut(auth);});
onAuthStateChanged(auth,async current=>{
 user=current||null;ui.authStatus.textContent=user?(user.displayName||user.email||"Signed in"):"Sign in to play";ui.signIn.hidden=!!user;ui.signOut.hidden=!user;ui.create.disabled=!user||!db;ui.join.disabled=!user||!db;
 if(!user){cleanupListeners();roomId=null;roomData=null;showLobby();notice("Sign in with Google to create or join a room.");return;}
 if(!firebaseReady){notice("Firebase isn't configured. Check firebase-config.js.","error");return;}
 const params=new URLSearchParams(location.search);if(params.get("room")&&!roomId){ui.code.value=params.get("room");await enterRoom(ui.code.value);}
 else notice("Signed in. Create a room or enter a friend's code.","success");
});
if(firebaseReady&&app){db=getDatabase(app);setupDrawing();notice("Firebase ready. Sign in to play.","success");}
else{setSignedOut();notice("Firebase isn't configured yet. Configure the project before playing.","error");}
function showResults(){
 ui.results.hidden=false;ui.room.hidden=true;const sorted=members().sort((a,b)=>(b.score||0)-(a.score||0));ui.scores.innerHTML="";sorted.forEach(p=>{const li=document.createElement("li");li.textContent=(p.displayName||"Player")+" — "+Number(p.score||0)+" points";ui.scores.append(li);});
}
