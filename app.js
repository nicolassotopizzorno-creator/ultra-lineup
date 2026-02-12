// ===============================
// FIREBASE CONFIG (versión compat para GitHub Pages)
// ===============================
const firebaseConfig = {
  apiKey: "AIzaSyCVJjjeUbduFLG6PixSLVg7sHxDyuTDTAc",
  authDomain: "ultra-buenos-aires.firebaseapp.com",
  projectId: "ultra-buenos-aires",
  storageBucket: "ultra-buenos-aires.firebasestorage.app",
  messagingSenderId: "646234622202",
  appId: "1:646234622202:web:69e8705419af7db8e2a143"
};

// Variables globales para Firebase (se inicializan después de cargar los scripts)
let db = null;

// ===============================
// CONFIG
// ===============================
const intervalMinutes = 60;
const startHour = 16;
const endHour   = 2;
const SLOT_MIN  = 1;

const stages = ["Main Stage","Resistance","Resistance 2","Ultra Park Stage"];

const STAGE_COLORS = {
  "Main Stage":       "#ff4da6",
  "Resistance":       "#7b3cff",
  "Resistance 2":     "#ff3b30",
  "Ultra Park Stage": "#2ecc71"
};

const USER_COLORS = [
  { name:"Dorado",      hex:"#FFD700" },
  { name:"Turquesa",    hex:"#00E5CC" },
  { name:"Naranja",     hex:"#FF6B00" },
  { name:"Amarillo",    hex:"#F9FF21" },
  { name:"Lavanda",     hex:"#C9A0FF" },
  { name:"Salmón",      hex:"#FF8A70" },
  { name:"Agua",        hex:"#80FFDB" },
  { name:"Blanco",      hex:"#FFFFFF" },
];

function darkenColor(hex, factor){
  const r=parseInt(hex.slice(1,3),16);
  const g=parseInt(hex.slice(3,5),16);
  const b=parseInt(hex.slice(5,7),16);
  const c=v=>Math.min(255,Math.max(0,Math.round(v*factor)));
  return `rgb(${c(r)},${c(g)},${c(b)})`;
}

// ===============================
// ESTADO
// ===============================
let activeDay  = 1;
let myColor    = null;
let myName     = "";
let myUserId   = null;
let allUsers   = {}; // {userId: {name, color, itinerary}}
let selectedUsers = new Set(); // IDs de usuarios a mostrar

// Ancho de columna horaria - responsive
function getColWidth(){
  return window.innerWidth <= 900 ? 120 : 240;
}
let colWidth = getColWidth();

window.addEventListener('resize', ()=>{
  const newWidth = getColWidth();
  if(newWidth !== colWidth){
    colWidth = newWidth;
    buildGrid();
    drawBlocks(activeDay);
  }
});

// ===============================
// FIREBASE - GUARDAR/CARGAR
// ===============================
async function saveUserProfile(){
  if(!myUserId || !myName || !myColor || !db) return;
  try {
    await db.collection("users").doc(myUserId).set({
      name: myName,
      color: myColor,
      updatedAt: Date.now()
    });
    console.log("✅ Perfil guardado");
  } catch(e){
    console.error("Error guardando perfil:", e);
  }
}

async function saveItinerary(day, data){
  if(!myUserId || !db) return;
  try {
    await db.collection("itineraries").doc(`${myUserId}_day${day}`).set({
      userId: myUserId,
      day: day,
      itinerary: data,
      updatedAt: Date.now()
    });
    console.log(`✅ Itinerario día ${day} guardado`);
  } catch(e){
    console.error("Error guardando itinerario:", e);
  }
}

async function loadItinerary(day){
  if(!myUserId || !db) return {};
  try {
    const docSnap = await db.collection("itineraries").doc(`${myUserId}_day${day}`).get();
    if(docSnap.exists){
      return docSnap.data().itinerary || {};
    }
  } catch(e){
    console.error("Error cargando itinerario:", e);
  }
  return {};
}

async function loadAllUsers(){
  if(!db) return;
  try {
    const snapshot = await db.collection("users").get();
    allUsers = {};
    snapshot.forEach(doc => {
      const data = doc.data();
      allUsers[doc.id] = {
        name: data.name,
        color: data.color,
        itinerary: {}
      };
    });
    
    const itinSnapshot = await db.collection("itineraries").get();
    itinSnapshot.forEach(doc => {
      const data = doc.data();
      if(allUsers[data.userId]){
        if(!allUsers[data.userId].itinerary) allUsers[data.userId].itinerary = {};
        allUsers[data.userId].itinerary[`day${data.day}`] = data.itinerary;
      }
    });
    renderUserSelector();
  } catch(e){
    console.error("Error cargando usuarios:", e);
  }
}

function subscribeToChanges(){
  if(!db) return;
  db.collection("users").onSnapshot(()=>{
    loadAllUsers().then(()=> drawBlocks(activeDay));
  });
  db.collection("itineraries").onSnapshot(()=>{
    loadAllUsers().then(()=> drawBlocks(activeDay));
  });
}

// ===============================
// USER ID
// ===============================
function getUserId(){
  let uid = localStorage.getItem('ultra_uid');
  if(!uid){
    uid = 'u' + Date.now() + Math.random().toString(36).substr(2,9);
    localStorage.setItem('ultra_uid', uid);
  }
  return uid;
}

// ===============================
// UTILS
// ===============================
function generateGradientColor(baseColor, index, total){
  if(total===1) return baseColor;
  const factor=0.85+((index/(total-1))*0.3);
  return `color-mix(in srgb, ${baseColor}, white ${(1-factor)*100}%)`;
}

function formatTime(minutes){
  let m=minutes%1440;
  const h=Math.floor(m/60),mm=m%60;
  return `${h.toString().padStart(2,'0')}:${mm.toString().padStart(2,'0')}`;
}

function getFestivalMinute(timeStr){
  const [h,m]=timeStr.split(':').map(Number);
  let min=h*60+m;
  if(h<startHour) min+=1440;
  return min;
}

function generateTimeSlots(){
  const slots=[];
  let current=startHour*60;
  const end=(endHour<startHour?endHour+24:endHour)*60;
  while(current<end){
    slots.push(current);
    current+=intervalMinutes;
  }
  return slots;
}

function festMinToPx(m){
  const festStart=generateTimeSlots()[0];
  return ((m-festStart)/intervalMinutes)*colWidth;
}

// ===============================
// COLOR PICKER
// ===============================
function showColorPicker(cb){
  const overlay=document.createElement("div");
  overlay.id="colorPickerOverlay";
  overlay.innerHTML=`
    <div class="cp-modal">
      <h2>Elegí tu color</h2>
      <p>Este color identificará tu itinerario</p>
      <div class="cp-colors" id="cpColors">
        ${USER_COLORS.map(c=>`
          <div class="cp-color" data-hex="${c.hex}" style="background:${c.hex}" title="${c.name}"></div>
        `).join('')}
      </div>
      <input type="text" id="cpName" placeholder="Tu nombre" maxlength="20" />
      <button id="cpConfirm" disabled>Continuar</button>
    </div>
  `;
  document.body.appendChild(overlay);

  let chosen=myColor;
  document.getElementById("cpName").value=myName;

  overlay.querySelectorAll(".cp-color").forEach(el=>{
    if(el.dataset.hex===chosen) el.classList.add("selected");
    el.addEventListener("click",()=>{
      overlay.querySelectorAll(".cp-color").forEach(e=>e.classList.remove("selected"));
      el.classList.add("selected");
      chosen=el.dataset.hex;
      const name=document.getElementById("cpName").value.trim();
      document.getElementById("cpConfirm").disabled=!(chosen&&name.length>0);
    });
  });

  document.getElementById("cpName").addEventListener("input",()=>{
    const name=document.getElementById("cpName").value.trim();
    document.getElementById("cpConfirm").disabled=!(chosen&&name.length>0);
  });

  document.getElementById("cpConfirm").addEventListener("click",()=>{
    const name=document.getElementById("cpName").value.trim();
    overlay.remove();
    cb(chosen,name);
  });
}

// ===============================
// USER SELECTOR (Ver itinerarios de otros)
// ===============================
function renderUserSelector(){
  const existing = document.getElementById("userSelector");
  if(existing) existing.remove();

  const selector = document.createElement("div");
  selector.id = "userSelector";
  selector.innerHTML = `
    <label>Ver itinerarios:</label>
    <div id="userCheckboxes"></div>
  `;
  
  const checkboxContainer = document.createElement("div");
  checkboxContainer.id = "userCheckboxes";

  // Siempre mostrar el mío primero
  if(myUserId){
    const myCheck = document.createElement("label");
    myCheck.className = "user-checkbox";
    myCheck.innerHTML = `
      <input type="checkbox" value="${myUserId}" ${selectedUsers.has(myUserId)?'checked':''}>
      <span class="user-dot" style="background:${myColor}"></span>
      <span>${myName} (yo)</span>
    `;
    checkboxContainer.appendChild(myCheck);
  }

  // Otros usuarios
  Object.entries(allUsers).forEach(([uid, userData])=>{
    if(uid === myUserId) return;
    const check = document.createElement("label");
    check.className = "user-checkbox";
    check.innerHTML = `
      <input type="checkbox" value="${uid}" ${selectedUsers.has(uid)?'checked':''}>
      <span class="user-dot" style="background:${userData.color}"></span>
      <span>${userData.name}</span>
    `;
    checkboxContainer.appendChild(check);
  });

  selector.appendChild(checkboxContainer);

  checkboxContainer.addEventListener("change", (e)=>{
    if(e.target.type === 'checkbox'){
      const uid = e.target.value;
      if(e.target.checked){
        selectedUsers.add(uid);
      } else {
        selectedUsers.delete(uid);
      }
      drawBlocks(activeDay);
    }
  });

  document.querySelector(".topbar-left").appendChild(selector);
}

// ===============================
// BADGE usuario
// ===============================
function renderUserBadge(){
  document.getElementById("userBadge")?.remove();
  const badge=document.createElement("div");
  badge.id="userBadge";
  badge.innerHTML=`
    <div class="user-dot" style="background:${myColor}"></div>
    <span class="user-name">${myName}</span>
    <button class="user-change" title="Cambiar">✏️</button>
  `;
  badge.querySelector(".user-change").addEventListener("click",()=>{
    showColorPicker((color,name)=>{
      myColor=color; myName=name;
      saveUserProfile(); renderUserBadge(); drawBlocks(activeDay);
      loadAllUsers();
    });
  });
  document.querySelector(".topbar-right").prepend(badge);
}

// ===============================
// BUILD columna de escenarios
// ===============================
const stageColumn=document.getElementById("stageColumn");
const timetable=document.getElementById("timetable");

function buildStageColumn(){
  stageColumn.innerHTML="";
  const corner=document.createElement("div");
  corner.className="stage-label corner";
  stageColumn.appendChild(corner);
  stages.forEach(s=>{
    const el=document.createElement("div");
    el.className="stage-label";
    el.textContent=s;
    stageColumn.appendChild(el);
  });
}

// ===============================
// BUILD grid de horas
// ===============================
function buildGrid(){
  const slots=generateTimeSlots();
  timetable.style.gridTemplateColumns=`repeat(${slots.length},${colWidth}px)`;
  timetable.innerHTML="";
  slots.forEach(t=>{
    const cell=document.createElement("div");
    cell.className="cell header"; cell.dataset.min=t; cell.textContent=formatTime(t);
    ["tick-hour","tick-30","tick-15 tick-15-a","tick-15 tick-15-b"].forEach(cls=>{
      const d=document.createElement("div"); d.className=cls; cell.appendChild(d);
    });
    timetable.appendChild(cell);
  });
  stages.forEach(()=>{
    slots.forEach(()=>{
      const c=document.createElement("div"); c.className="cell"; timetable.appendChild(c);
    });
  });
}

// ===============================
// DIBUJAR BLOQUES
// ===============================
function drawBlocks(day){
  timetable.querySelectorAll(".stage-row").forEach(el=>el.remove());

  const data=( day===1?window.LINEUP.day1:window.LINEUP.day2)||[];
  
  // Combinar itinerarios de usuarios seleccionados
  const combinedItineraries = {};
  selectedUsers.forEach(uid=>{
    const userData = uid === myUserId ? {color:myColor, itinerary:{[`day${day}`]:{}}} : allUsers[uid];
    if(!userData) return;
    
    // Cargar itinerario de este usuario
    const userItin = uid === myUserId ? {} : (userData.itinerary?.[`day${day}`] || {});
    
    Object.entries(userItin).forEach(([blockId, segs])=>{
      if(!combinedItineraries[blockId]) combinedItineraries[blockId] = [];
      combinedItineraries[blockId].push({
        userId: uid,
        color: userData.color,
        segments: segs
      });
    });
  });

  // Si el usuario actual está seleccionado, cargar su itinerario desde Firebase
  if(selectedUsers.has(myUserId)){
    loadItinerary(day).then(myItin=>{
      Object.entries(myItin).forEach(([blockId, segs])=>{
        if(!combinedItineraries[blockId]) combinedItineraries[blockId] = [];
        combinedItineraries[blockId].push({
          userId: myUserId,
          color: myColor,
          segments: segs
        });
      });
      renderBlocks();
    });
  } else {
    renderBlocks();
  }

  function renderBlocks(){
    timetable.querySelectorAll(".stage-row").forEach(el=>el.remove());
    
    const slots=generateTimeSlots();
    const festStart=slots[0];
    const festEnd=slots[slots.length-1];
    const rowH=92, headerH=46;

    // Construir mapa de cobertura para dimming
    const coveredMinutes = buildCoveredMinutes(combinedItineraries);

    stages.forEach((stage,si)=>{
      const topPx=headerH+si*rowH;
      const rowEl=document.createElement("div");
      rowEl.className="stage-row";
      rowEl.style.cssText=`top:${topPx}px;left:0;width:${slots.length*colWidth}px;height:${rowH}px;`;
      timetable.appendChild(rowEl);

      const items=data.filter(x=>x.stage===stage);
      items.forEach((item,idx)=>{
        const startM=getFestivalMinute(item.start);
        const endM=getFestivalMinute(item.end);
        if(endM<=festStart||startM>=festEnd+intervalMinutes) return;

        const cs=Math.max(startM,festStart);
        const ce=Math.min(endM,festEnd+intervalMinutes);
        const leftPx=Math.round(festMinToPx(cs));
        const widthPx=Math.max(1,Math.round(festMinToPx(ce)-festMinToPx(cs)));

        const bId=`d${day}|${stage}|${item.artist}|${item.start}|${item.end}`;
        const userSegs=combinedItineraries[bId]||[];

        const dimmedRanges=getDimmedRanges(cs,ce,stage,coveredMinutes);

        const block=document.createElement("div");
        block.className="dj-block";
        block.dataset.id=bId;
        block.style.left=`${leftPx}px`;
        block.style.width=`${widthPx}px`;
        block.style.background=generateGradientColor(STAGE_COLORS[stage]||"#888",idx,items.length);

        const nameEl=document.createElement("div");
        nameEl.className="dj-artist"; nameEl.textContent=item.artist;

        const timeEl=document.createElement("div");
        timeEl.className="dj-time"; timeEl.textContent=`${item.start} – ${item.end}`;

        block.appendChild(nameEl);
        block.appendChild(timeEl);

        // Dim overlays en la fila
        dimmedRanges.forEach(range=>{
          const dLeft=Math.round(festMinToPx(range.from));
          const dWidth=Math.max(1,Math.round(festMinToPx(range.to)-festMinToPx(range.from)));
          const rowDimEl=document.createElement("div");
          rowDimEl.className="dim-overlay-row";
          rowDimEl.style.cssText=`left:${dLeft}px;width:${dWidth}px;`;
          rowEl.appendChild(rowDimEl);

          const dLeftBlock=Math.round(festMinToPx(range.from)-festMinToPx(cs));
          const dimEl=document.createElement("div");
          dimEl.className="dim-overlay";
          dimEl.style.cssText=`left:${dLeftBlock}px;width:${dWidth}px;`;
          block.appendChild(dimEl);
        });

        // Segmentos de todos los usuarios seleccionados
        userSegs.forEach(({userId, color, segments})=>{
          segments.forEach(seg=>{
            const segLeft=Math.round(festMinToPx(seg.from)-festMinToPx(cs));
            const segWidth=Math.max(1,Math.round(festMinToPx(seg.to)-festMinToPx(seg.from)));
            const borderColor=darkenColor(color,0.55);

            const segEl=document.createElement("div");
            segEl.className="itinerary-seg";
            segEl.style.cssText=`left:${segLeft}px;width:${segWidth}px;background:${color};border-color:${borderColor};`;

            const label=document.createElement("div");
            label.className="itinerary-seg-label";
            const userName = userId===myUserId ? myName : (allUsers[userId]?.name || '');
            label.innerHTML=`<span class="seg-lbl-artist">${item.artist}</span><span class="seg-lbl-time">${formatTime(seg.from%1440)} – ${formatTime(seg.to%1440)}</span><span class="seg-lbl-user">${userName}</span>`;
            segEl.appendChild(label);

            block.appendChild(segEl);
          });
        });

        if(userSegs.length>0){
          nameEl.style.opacity="0";
          timeEl.style.opacity="0";
        }

        block.style.pointerEvents="auto";
        block.addEventListener("click",e=>{
          e.stopPropagation();
          if(!myUserId) return;
          loadItinerary(day).then(myItin=>{
            openSegmentPicker(day,bId,item,cs,ce,coveredMinutes,stage,myItin);
          });
        });

        rowEl.appendChild(block);
      });
    });
  }
}

function buildCoveredMinutes(combinedItineraries){
  const map={};
  stages.forEach(s=>{ map[s]=new Set(); });
  
  Object.entries(combinedItineraries).forEach(([bid,userSegsArray])=>{
    const parts=bid.split("|");
    const stage=parts[1];
    userSegsArray.forEach(({segments})=>{
      segments.forEach(seg=>{
        for(let m=seg.from; m<seg.to; m++) map[stage]?.add(m);
      });
    });
  });
  return map;
}

function getDimmedRanges(cs,ce,stage,coveredMinutes){
  const dimmedMins=[];
  for(const [s,mins] of Object.entries(coveredMinutes)){
    if(s===stage) continue;
    for(let m=cs;m<ce;m++){
      if(mins.has(m)) dimmedMins.push(m);
    }
  }
  if(dimmedMins.length===0) return [];

  const unique=[...new Set(dimmedMins)].sort((a,b)=>a-b);
  const ranges=[];
  let i=0;
  while(i<unique.length){
    let from=unique[i],to=from+1;
    while(i+1<unique.length&&unique[i+1]===to){ i++; to++; }
    ranges.push({from,to}); i++;
  }
  return ranges;
}

// ===============================
// POPUP SELECTOR
// ===============================
function openSegmentPicker(day,bId,item,cs,ce,coveredMinutes,stage,myItin){
  document.getElementById("segPickerOverlay")?.remove();

  const existing=myItin[bId]||[];
  let selFrom=cs;
  let selTo=ce;
  if(existing.length>0){
    selFrom=existing[0].from;
    selTo=existing[existing.length-1].to;
  }

  const blockedRanges=[];
  if(coveredMinutes){
    for(const [s,mins] of Object.entries(coveredMinutes)){
      if(s===stage) continue;
      const inBlock=[];
      for(let m=cs;m<ce;m++){
        if(mins.has(m)) inBlock.push(m);
      }
      let i=0;
      while(i<inBlock.length){
        let from=inBlock[i],to=from+1;
        while(i+1<inBlock.length&&inBlock[i+1]===to){ i++; to++; }
        if(blockedRanges.length>0&&blockedRanges[blockedRanges.length-1].to>=from){
          blockedRanges[blockedRanges.length-1].to=Math.max(blockedRanges[blockedRanges.length-1].to,to);
        }else{
          blockedRanges.push({from,to});
        }
        i++;
      }
    }
  }

  const totalMin=ce-cs;
  const SNAP=1;

  let minFreeFrom=cs;
  let maxFreeTo=ce;

  const sortedBlocked=[...blockedRanges].sort((a,b)=>a.from-b.from);

  for(const r of sortedBlocked){
    if(r.from<=minFreeFrom){
      minFreeFrom=Math.max(minFreeFrom,r.to);
    }
  }
  for(const r of [...sortedBlocked].reverse()){
    if(r.to>=maxFreeTo){
      maxFreeTo=Math.min(maxFreeTo,r.from);
    }
  }

  if(existing.length>0){
    selFrom=Math.max(existing[0].from,minFreeFrom);
    selTo=Math.min(existing[existing.length-1].to,maxFreeTo);
  }else{
    selFrom=minFreeFrom;
    selTo=maxFreeTo;
  }
  if(selFrom>=selTo){ selFrom=minFreeFrom; selTo=maxFreeTo; }

  const overlay=document.createElement("div");
  overlay.id="segPickerOverlay";
  const ytQuery=encodeURIComponent(`${item.artist} DJ set`);
  const spQuery=encodeURIComponent(item.artist);
  overlay.innerHTML=`
    <div class="seg-modal">
      <button class="seg-close" id="segClose">✕</button>
      <div class="seg-header">
        <div class="seg-title">${item.artist}</div>
        <div class="seg-subtitle">${item.start} – ${item.end} &nbsp;·&nbsp; ${item.stage}</div>
        <div class="seg-music-btns">
          <a class="music-btn yt" href="https://www.youtube.com/results?search_query=${ytQuery}" target="_blank" rel="noopener">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1C24 15.9 24 12 24 12s0-3.9-.5-5.8zM9.75 15.5v-7l6.5 3.5-6.5 3.5z"/></svg>
            YouTube
          </a>
          <a class="music-btn sp" href="https://open.spotify.com/search/${spQuery}" target="_blank" rel="noopener">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
            Spotify
          </a>
        </div>
      </div>
      <p class="seg-instructions">Arrastrá los extremos para elegir tu horario.</p>

      <div class="range-wrap" id="rangeWrap">
        <div class="range-blocked-layer" id="rangeBlockedLayer"></div>
        <div class="range-track"></div>
        <div class="range-fill" id="rangeFill"></div>
        <div class="range-handle" id="handleFrom" data-role="from">
          <div class="range-handle-inner"></div>
        </div>
        <div class="range-handle" id="handleTo" data-role="to">
          <div class="range-handle-inner"></div>
        </div>
        <div class="range-label range-label-start">${formatTime(cs%1440)}</div>
        <div class="range-label range-label-end">${formatTime(ce%1440)}</div>
      </div>

      <div class="range-summary" id="rangeSummary"></div>

      <div class="seg-actions">
        <button class="seg-btn seg-clear" id="segClear">Quitar del itinerario</button>
        <button class="seg-btn seg-save" id="segSave" style="--user-color:${myColor||"#FFD700"}">
          Guardar
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const wrap=document.getElementById("rangeWrap");
  const fillEl=document.getElementById("rangeFill");
  const handleFrom=document.getElementById("handleFrom");
  const handleTo=document.getElementById("handleTo");
  const summaryEl=document.getElementById("rangeSummary");
  const blockedLayer=document.getElementById("rangeBlockedLayer");

  blockedRanges.forEach(r=>{
    const leftPct=((r.from-cs)/totalMin)*100;
    const widthPct=((r.to-r.from)/totalMin)*100;
    const el=document.createElement("div");
    el.className="range-blocked";
    el.style.cssText=`left:${leftPct}%;width:${widthPct}%;`;
    el.title="Ocupado por otro escenario";
    blockedLayer.appendChild(el);
  });

  function minToPercent(m){ return ((m-cs)/totalMin)*100; }
  function percentToMin(p){ return cs+(p/100)*totalMin; }
  function clamp(m){ return Math.max(cs,Math.min(ce,m)); }

  function render(){
    const fromPct=minToPercent(selFrom);
    const toPct=minToPercent(selTo);
    handleFrom.style.left=`${fromPct}%`;
    handleTo.style.left=`${toPct}%`;
    fillEl.style.left=`${fromPct}%`;
    fillEl.style.width=`${toPct-fromPct}%`;
    fillEl.style.background=myColor||"#FFD700";
    summaryEl.textContent=`${formatTime(selFrom%1440)} – ${formatTime(selTo%1440)}`;
    summaryEl.style.color=myColor||"#FFD700";
  }

  function isInBlockedRange(m){
    return sortedBlocked.some(r=>m>=r.from&&m<r.to);
  }

  function startDrag(role,e){
    e.preventDefault();
    handleFrom.classList.toggle("dragging",role==="from");
    handleTo.classList.toggle("dragging",role==="to");
    const rect=wrap.getBoundingClientRect();

    function onMove(ev){
      const clientX=ev.touches?ev.touches[0].clientX:ev.clientX;
      const pct=Math.max(0,Math.min(100,((clientX-rect.left)/rect.width)*100));
      let m=Math.round(clamp(percentToMin(pct)));

      if(role==="from"){
        m=Math.max(m,minFreeFrom);
        m=Math.min(m,selTo-1);
        if(isInBlockedRange(m)){
          while(m<selTo&&isInBlockedRange(m))m++;
        }
        selFrom=m;
      }else{
        m=Math.min(m,maxFreeTo);
        m=Math.max(m,selFrom+1);
        if(isInBlockedRange(m)){
          while(m>selFrom&&isInBlockedRange(m))m--;
        }
        selTo=m;
      }
      render();
    }

    function onUp(){
      handleFrom.classList.remove("dragging");
      handleTo.classList.remove("dragging");
      document.removeEventListener("mousemove",onMove);
      document.removeEventListener("mouseup",onUp);
      document.removeEventListener("touchmove",onMove);
      document.removeEventListener("touchend",onUp);
    }

    document.addEventListener("mousemove",onMove);
    document.addEventListener("mouseup",onUp);
    document.addEventListener("touchmove",onMove,{passive:false});
    document.addEventListener("touchend",onUp);
  }

  handleFrom.addEventListener("mousedown",e=>startDrag("from",e));
  handleFrom.addEventListener("touchstart",e=>startDrag("from",e),{passive:false});
  handleTo.addEventListener("mousedown",e=>startDrag("to",e));
  handleTo.addEventListener("touchstart",e=>startDrag("to",e),{passive:false});

  render();

  document.getElementById("segClose").addEventListener("click",()=>overlay.remove());
  overlay.addEventListener("click",e=>{ if(e.target===overlay) overlay.remove(); });

  document.getElementById("segClear").addEventListener("click",()=>{
    loadItinerary(day).then(itin=>{
      delete itin[bId];
      saveItinerary(day,itin);
      overlay.remove();
      drawBlocks(day);
    });
  });

  document.getElementById("segSave").addEventListener("click",()=>{
    if(selFrom>=selTo){ overlay.remove(); return; }
    loadItinerary(day).then(itin=>{
      itin[bId]=[{from:selFrom,to:selTo}];
      saveItinerary(day,itin);
      overlay.remove();
      drawBlocks(day);
    });
  });
}

// ===============================
// LÍNEA "AHORA"
// ===============================
function updateTimeLine(){
  const line=document.getElementById("timeLine");
  const label=document.getElementById("timeLineLabel");
  if(!line) return;
  const now=new Date();
  let nowM=now.getHours()*60+now.getMinutes();
  const slots=generateTimeSlots();
  const festStart=slots[0],festEnd=slots[slots.length-1];
  if(endHour<startHour&&nowM<startHour*60) nowM+=1440;
  if(nowM<festStart||nowM>festEnd+intervalMinutes){ line.style.display="none"; return; }
  line.style.left=`${Math.round(festMinToPx(nowM))}px`;
  line.style.display="block";
  if(label) label.textContent=formatTime(nowM%1440);
}

// ===============================
// INIT
// ===============================
document.addEventListener("DOMContentLoaded",async ()=>{
  // Inicializar Firebase
  try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    console.log("✅ Firebase inicializado");
  } catch(e){
    console.error("Error inicializando Firebase:", e);
    alert("Error conectando con Firebase. Refresca la página.");
    return;
  }

  myUserId = getUserId();
  
  // Intentar cargar perfil desde Firebase
  try {
    const docSnap = await db.collection("users").doc(myUserId).get();
    if(docSnap.exists){
      const data = docSnap.data();
      myName = data.name;
      myColor = data.color;
    }
  } catch(e){
    console.error("Error cargando perfil:", e);
  }

  if(!myColor||!myName){
    showColorPicker((color,name)=>{
      myColor=color; myName=name;
      saveUserProfile();
      renderUserBadge();
      selectedUsers.add(myUserId);
      loadAllUsers().then(()=>{
        buildStageColumn();
        buildGrid();
        drawBlocks(activeDay);
        updateTimeLine();
        setInterval(updateTimeLine,60000);
        subscribeToChanges();
      });
    });
  } else {
    renderUserBadge();
    selectedUsers.add(myUserId);
    await loadAllUsers();
    buildStageColumn();
    buildGrid();
    drawBlocks(activeDay);
    updateTimeLine();
    setInterval(updateTimeLine,60000);
    subscribeToChanges();
  }

  document.getElementById("day1Btn").addEventListener("click",()=>{
    activeDay=1;
    document.querySelectorAll(".day-btn").forEach(b=>b.classList.remove("active"));
    document.getElementById("day1Btn").classList.add("active");
    document.getElementById("dayMeta").textContent="14/02";
    drawBlocks(1);
  });

  document.getElementById("day2Btn").addEventListener("click",()=>{
    activeDay=2;
    document.querySelectorAll(".day-btn").forEach(b=>b.classList.remove("active"));
    document.getElementById("day2Btn").classList.add("active");
    document.getElementById("dayMeta").textContent="15/02";
    drawBlocks(2);
  });
});
