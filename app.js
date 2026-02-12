// ===============================
// CONFIG
// ===============================
const intervalMinutes = 60;
const startHour = 16;
const endHour   = 2;
const SLOT_MIN  = 1;    // granularidad de minutos exactos

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

// Oscurece un color hex por un factor (0-1)
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
// Ancho de columna horaria - responsive
function getColWidth(){
  return window.innerWidth <= 900 ? 120 : 240;
}
let colWidth = getColWidth();

// Actualizar colWidth en resize
window.addEventListener('resize', ()=>{
  const newWidth = getColWidth();
  if(newWidth !== colWidth){
    colWidth = newWidth;
    buildGrid();
    drawBlocks(activeDay);
  }
});

// ===============================
// STORAGE
// ===============================
function iKey(day){ return `ultra_itin2_day${day}`; }

function loadItinerary(day){
  try{ const r=localStorage.getItem(iKey(day)); return r?JSON.parse(r):{}; }
  catch{ return {}; }
}

function saveItinerary(day, data){
  localStorage.setItem(iKey(day), JSON.stringify(data));
}

function loadUserProfile(){
  try{
    const r=localStorage.getItem("ultra_user2");
    if(r){ const p=JSON.parse(r); myColor=p.color; myName=p.name; }
  }catch{}
}

function saveUserProfile(){
  localStorage.setItem("ultra_user2", JSON.stringify({color:myColor,name:myName}));
}

// ===============================
// DOM
// ===============================
const stageColumn = document.getElementById("stageColumn");
const timetable   = document.getElementById("timetable");

// ===============================
// TIEMPO
// ===============================
function parseHHMM(s){ const [h,m]=s.split(":").map(Number); return h*60+m; }

function getFestivalMinute(s){
  let m=parseHHMM(s);
  if(endHour<startHour && m<startHour*60) m+=1440;
  return m;
}

function generateTimeSlots(){
  const slots=[]; let cur=startHour*60;
  const end=endHour<startHour?(24+endHour)*60:endHour*60;
  while(cur<=end){ slots.push(cur); cur+=intervalMinutes; }
  return slots;
}

function formatTime(min){
  const h=Math.floor(min/60)%24, m=min%60;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
}

function festMinToPx(m){
  const festStart=generateTimeSlots()[0];
  return ((m-festStart)/intervalMinutes)*colWidth;
}

// ===============================
// COLORES DJ
// ===============================
function generateGradientColor(baseColor,index,total){
  const r=parseInt(baseColor.slice(1,3),16);
  const g=parseInt(baseColor.slice(3,5),16);
  const b=parseInt(baseColor.slice(5,7),16);
  const pos=index/Math.max(total-1,1);
  const l1=0.6+pos*0.8, l2=l1+0.25;
  const c=v=>Math.min(255,Math.max(0,Math.round(v)));
  return `linear-gradient(135deg,rgb(${c(r*l1)},${c(g*l1)},${c(b*l1)}),rgb(${c(r*l2)},${c(g*l2)},${c(b*l2)}))`;
}

// ===============================
// MODAL — elegir color y nombre
// ===============================
function showColorPicker(cb){
  const overlay=document.createElement("div");
  overlay.id="colorPickerOverlay";
  overlay.innerHTML=`
    <div class="cp-modal">
      <div class="cp-logo">🎧</div>
      <h2>Ultra Buenos Aires 2026</h2>
      <p class="cp-sub">¿Cómo te llamás?</p>
      <input id="cpName" type="text" placeholder="Tu nombre" maxlength="20" autocomplete="off"/>
      <p class="cp-sub">Elegí tu color:</p>
      <div class="cp-colors">
        ${USER_COLORS.map(c=>`
          <button class="cp-color-btn" data-hex="${c.hex}" title="${c.name}"
            style="--c:${c.hex}">
            <div class="cp-swatch"></div>
            <span>${c.name}</span>
          </button>
        `).join("")}
      </div>
      <div class="cp-preview" id="cpPreview">← Elegí un color</div>
      <button class="cp-confirm" id="cpConfirm" disabled>¡Empezar! →</button>
    </div>
  `;
  document.body.appendChild(overlay);

  let chosen=null;

  overlay.querySelectorAll(".cp-color-btn").forEach(btn=>{
    btn.addEventListener("click",()=>{
      overlay.querySelectorAll(".cp-color-btn").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      chosen=btn.dataset.hex;
      const preview=document.getElementById("cpPreview");
      preview.textContent=`Tu color: ${btn.title}`;
      preview.style.color=chosen;
      checkReady();
    });
  });

  document.getElementById("cpName").addEventListener("input",checkReady);

  function checkReady(){
    const name=document.getElementById("cpName").value.trim();
    document.getElementById("cpConfirm").disabled=!(chosen&&name.length>0);
  }

  document.getElementById("cpConfirm").addEventListener("click",()=>{
    const name=document.getElementById("cpName").value.trim();
    overlay.remove();
    cb(chosen,name);
  });
}

// ===============================
// BADGE usuario en topbar
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
    });
  });
  document.querySelector(".topbar-right").prepend(badge);
}

// ===============================
// BUILD columna de escenarios
// ===============================
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

  const data     =(day===1?window.LINEUP.day1:window.LINEUP.day2)||[];
  const itinerary=loadItinerary(day);
  const slots    =generateTimeSlots();
  const festStart=slots[0];
  const festEnd  =slots[slots.length-1];
  const rowH=92, headerH=46;

  // Construir set de minutos cubiertos por el itinerario, por escenario-hora
  // Un bloque se "atenúa" si existe OTRO bloque en diferente escenario
  // que tenga selección en el mismo rango horario
  const coveredMinutes = buildCoveredMinutes(itinerary);

  stages.forEach((stage,si)=>{
    const topPx=headerH+si*rowH;
    const rowEl=document.createElement("div");
    rowEl.className="stage-row";
    rowEl.style.cssText=`top:${topPx}px;left:0;width:${slots.length*colWidth}px;height:${rowH}px;`;
    timetable.appendChild(rowEl);

    const items=data.filter(x=>x.stage===stage);
    items.forEach((item,idx)=>{
      const startM=getFestivalMinute(item.start);
      const endM  =getFestivalMinute(item.end);
      if(endM<=festStart||startM>=festEnd+intervalMinutes) return;

      const cs=Math.max(startM,festStart);
      const ce=Math.min(endM,festEnd+intervalMinutes);
      const leftPx =Math.round(festMinToPx(cs));
      const widthPx=Math.max(1,Math.round(festMinToPx(ce)-festMinToPx(cs)));

      const bId=`d${day}|${stage}|${item.artist}|${item.start}|${item.end}`;
      const segs=itinerary[bId]||[];

      // Rangos dentro de este bloque que están cubiertos por OTROS escenarios
      const dimmedRanges = getDimmedRanges(cs, ce, stage, coveredMinutes);

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

      // Atenuado: dos capas
      // 1) overlay en la FILA (cubre los gaps top/bottom del bloque)
      // 2) overlay en el BLOQUE (overflow:hidden lo recorta en las esquinas)
      dimmedRanges.forEach(range=>{
        const dLeft  = Math.round(festMinToPx(range.from));
        const dWidth = Math.max(1, Math.round(festMinToPx(range.to) - festMinToPx(range.from)));

        // Capa 1: en la fila, cubre todo el alto (gap incluido)
        const rowDimEl = document.createElement("div");
        rowDimEl.className = "dim-overlay-row";
        rowDimEl.style.cssText = `left:${dLeft}px;width:${dWidth}px;`;
        rowEl.appendChild(rowDimEl);

        // Capa 2: en el bloque, recortada por border-radius del bloque
        const dLeftBlock = Math.round(festMinToPx(range.from) - festMinToPx(cs));
        const dimEl = document.createElement("div");
        dimEl.className = "dim-overlay";
        dimEl.style.cssText = `left:${dLeftBlock}px;width:${dWidth}px;`;
        block.appendChild(dimEl);
      });

      // Segmentos seleccionados encima
      segs.forEach(seg=>{
        const segLeft =Math.round(festMinToPx(seg.from)-festMinToPx(cs));
        const segWidth=Math.max(1,Math.round(festMinToPx(seg.to)-festMinToPx(seg.from)));

        const borderColor = darkenColor(myColor||"#FFD700", 0.55);

        const segEl=document.createElement("div");
        segEl.className="itinerary-seg";
        segEl.style.cssText=`left:${segLeft}px;width:${segWidth}px;background:${myColor||"#FFD700"};border-color:${borderColor};`;

        // Label: nombre del artista + horario seleccionado
        const label=document.createElement("div");
        label.className="itinerary-seg-label";
        label.innerHTML=`<span class="seg-lbl-artist">${item.artist}</span><span class="seg-lbl-time">${formatTime(seg.from%1440)} – ${formatTime(seg.to%1440)}</span>`;
        segEl.appendChild(label);

        block.appendChild(segEl);
      });

      // Si tiene segmentos, ocultar el texto original del bloque
      if(segs.length > 0){
        nameEl.style.opacity = "0";
        timeEl.style.opacity = "0";
      }

      block.style.pointerEvents="auto";
      block.addEventListener("click",e=>{
        e.stopPropagation();
        openSegmentPicker(day,bId,item,cs,ce,coveredMinutes,stage);
      });

      rowEl.appendChild(block);
    });
  });
}

function buildCoveredMinutes(itinerary){
  // { stage: Set<minute> } — cada minuto exacto cubierto por cada escenario
  const map={};
  stages.forEach(s=>{ map[s]=new Set(); });
  Object.entries(itinerary).forEach(([bid,segs])=>{
    const parts=bid.split("|");
    const stage=parts[1];
    segs.forEach(seg=>{
      // paso de 1 minuto para precisión exacta
      for(let m=seg.from; m<seg.to; m++) map[stage]?.add(m);
    });
  });
  return map;
}

// Devuelve rangos {from,to} dentro de [cs,ce] cubiertos por OTROS escenarios
function getDimmedRanges(cs, ce, stage, coveredMinutes){
  const dimmedMins = [];
  for(const [s, mins] of Object.entries(coveredMinutes)){
    if(s===stage) continue;
    for(let m=cs; m<ce; m++){
      if(mins.has(m)) dimmedMins.push(m);
    }
  }
  if(dimmedMins.length===0) return [];

  // Agrupar minutos contiguos en rangos
  const unique=[...new Set(dimmedMins)].sort((a,b)=>a-b);
  const ranges=[];
  let i=0;
  while(i<unique.length){
    let from=unique[i], to=from+1;
    while(i+1<unique.length && unique[i+1]===to){ i++; to++; }
    ranges.push({from,to}); i++;
  }
  return ranges;
}

// ===============================
// POPUP — selector de rango con slider
// ===============================
function openSegmentPicker(day,bId,item,cs,ce,coveredMinutes,stage){
  document.getElementById("segPickerOverlay")?.remove();

  const itinerary=loadItinerary(day);
  const existing =itinerary[bId]||[];

  // Rango previo o default = rango completo del bloque (se ajusta abajo)
  let selFrom = cs;
  let selTo   = ce;
  if(existing.length>0){
    selFrom = existing[0].from;
    selTo   = existing[existing.length-1].to;
  }

  // Rangos bloqueados por otros escenarios (para mostrar en slider)
  const blockedRanges=[];
  if(coveredMinutes){
    for(const [s,mins] of Object.entries(coveredMinutes)){
      if(s===stage) continue;
      // recolectar minutos dentro de [cs,ce] cubiertos por este otro escenario
      const inBlock=[];
      for(let m=cs;m<ce;m++){
        if(mins.has(m)) inBlock.push(m);
      }
      // agrupar en rangos contiguos
      let i=0;
      while(i<inBlock.length){
        let from=inBlock[i], to=from+1;
        while(i+1<inBlock.length && inBlock[i+1]===to){ i++; to++; }
        // fusionar con el último rango si es contiguo
        if(blockedRanges.length>0 && blockedRanges[blockedRanges.length-1].to>=from){
          blockedRanges[blockedRanges.length-1].to=Math.max(blockedRanges[blockedRanges.length-1].to,to);
        } else {
          blockedRanges.push({from,to});
        }
        i++;
      }
    }
  }

  const totalMin = ce - cs;  // duración total del bloque en minutos
  const SNAP = 1;            // snap a 1 minuto exacto

  // Calcular el límite mínimo libre (después del último bloqueo desde el inicio)
  // Si hay bloqueados al inicio, el from debe comenzar después de ellos
  let minFreeFrom = cs;
  let maxFreeTo   = ce;

  // Ordenar rangos bloqueados
  const sortedBlocked = [...blockedRanges].sort((a,b)=>a.from-b.from);

  // Si el primer rango bloqueado empieza desde el inicio del bloque,
  // el handle izquierdo no puede ir antes del fin de ese bloque bloqueado
  for(const r of sortedBlocked){
    if(r.from <= minFreeFrom){
      minFreeFrom = Math.max(minFreeFrom, r.to);
    }
  }
  // Análogo para el final: si hay bloqueados al final, el handle derecho no puede ir después
  for(const r of [...sortedBlocked].reverse()){
    if(r.to >= maxFreeTo){
      maxFreeTo = Math.min(maxFreeTo, r.from);
    }
  }

  // Ajustar selección inicial al rango libre
  if(existing.length>0){
    selFrom = Math.max(existing[0].from, minFreeFrom);
    selTo   = Math.min(existing[existing.length-1].to, maxFreeTo);
  } else {
    selFrom = minFreeFrom;
    selTo   = maxFreeTo;
  }
  // Garantizar que selFrom < selTo
  if(selFrom >= selTo){ selFrom = minFreeFrom; selTo = maxFreeTo; }

  const overlay=document.createElement("div");
  overlay.id="segPickerOverlay";
  const ytQuery  = encodeURIComponent(`${item.artist} DJ set`);
  const spQuery  = encodeURIComponent(item.artist);
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
        <!-- Bloques ocupados por otros escenarios -->
        <div class="range-blocked-layer" id="rangeBlockedLayer"></div>
        <!-- Riel de fondo -->
        <div class="range-track"></div>
        <!-- Selección activa -->
        <div class="range-fill" id="rangeFill"></div>
        <!-- Handles -->
        <div class="range-handle" id="handleFrom" data-role="from">
          <div class="range-handle-inner"></div>
        </div>
        <div class="range-handle" id="handleTo" data-role="to">
          <div class="range-handle-inner"></div>
        </div>
        <!-- Labels de tiempo en los extremos del riel -->
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

  const wrap       = document.getElementById("rangeWrap");
  const fillEl     = document.getElementById("rangeFill");
  const handleFrom = document.getElementById("handleFrom");
  const handleTo   = document.getElementById("handleTo");
  const summaryEl  = document.getElementById("rangeSummary");
  const blockedLayer = document.getElementById("rangeBlockedLayer");

  // Dibujar zonas bloqueadas
  blockedRanges.forEach(r=>{
    const leftPct  = ((r.from-cs)/totalMin)*100;
    const widthPct = ((r.to-r.from)/totalMin)*100;
    const el=document.createElement("div");
    el.className="range-blocked";
    el.style.cssText=`left:${leftPct}%;width:${widthPct}%;`;
    el.title="Ocupado por otro escenario";
    blockedLayer.appendChild(el);
  });

  function minToPercent(m){ return ((m-cs)/totalMin)*100; }
  function percentToMin(p){ return cs + (p/100)*totalMin; }
  function snapMin(m){ return Math.round(m/SNAP)*SNAP; }
  function clamp(m){ return Math.max(cs, Math.min(ce, m)); }

  function render(){
    const fromPct = minToPercent(selFrom);
    const toPct   = minToPercent(selTo);
    handleFrom.style.left = `${fromPct}%`;
    handleTo.style.left   = `${toPct}%`;
    fillEl.style.left     = `${fromPct}%`;
    fillEl.style.width    = `${toPct-fromPct}%`;
    fillEl.style.background = myColor||"#FFD700";
    summaryEl.textContent = `${formatTime(selFrom%1440)} – ${formatTime(selTo%1440)}`;
    summaryEl.style.color = myColor||"#FFD700";
  }

  function isInBlockedRange(m){
    return sortedBlocked.some(r => m >= r.from && m < r.to);
  }

  function startDrag(role, e){
    e.preventDefault();
    handleFrom.classList.toggle("dragging", role==="from");
    handleTo.classList.toggle("dragging",   role==="to");
    const rect = wrap.getBoundingClientRect();

    function onMove(ev){
      const clientX = ev.touches ? ev.touches[0].clientX : ev.clientX;
      const pct = Math.max(0, Math.min(100, ((clientX-rect.left)/rect.width)*100));
      let m = Math.round(clamp(percentToMin(pct)));

      if(role==="from"){
        // No puede entrar en zona bloqueada ni ir más allá del handle derecho
        m = Math.max(m, minFreeFrom);
        m = Math.min(m, selTo - 1);
        // Si cae en zona bloqueada, empujar al borde libre más cercano
        if(isInBlockedRange(m)){
          // buscar el siguiente minuto libre hacia adelante
          while(m < selTo && isInBlockedRange(m)) m++;
        }
        selFrom = m;
      } else {
        // No puede entrar en zona bloqueada ni ir antes del handle izquierdo
        m = Math.min(m, maxFreeTo);
        m = Math.max(m, selFrom + 1);
        if(isInBlockedRange(m)){
          // buscar el siguiente minuto libre hacia atrás
          while(m > selFrom && isInBlockedRange(m)) m--;
        }
        selTo = m;
      }
      render();
    }

    function onUp(){
      handleFrom.classList.remove("dragging");
      handleTo.classList.remove("dragging");
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup",   onUp);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend",  onUp);
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup",   onUp);
    document.addEventListener("touchmove", onMove, {passive:false});
    document.addEventListener("touchend",  onUp);
  }

  handleFrom.addEventListener("mousedown",  e=>startDrag("from",e));
  handleFrom.addEventListener("touchstart", e=>startDrag("from",e), {passive:false});
  handleTo.addEventListener("mousedown",    e=>startDrag("to",e));
  handleTo.addEventListener("touchstart",   e=>startDrag("to",e), {passive:false});

  render();

  // Cerrar
  document.getElementById("segClose").addEventListener("click",()=>overlay.remove());
  overlay.addEventListener("click",e=>{ if(e.target===overlay) overlay.remove(); });

  // Limpiar
  document.getElementById("segClear").addEventListener("click",()=>{
    const itin=loadItinerary(day);
    delete itin[bId];
    saveItinerary(day,itin);
    overlay.remove();
    drawBlocks(day);
  });

  // Guardar
  document.getElementById("segSave").addEventListener("click",()=>{
    if(selFrom>=selTo){ overlay.remove(); return; }
    const itin=loadItinerary(day);
    itin[bId]=[{from:selFrom, to:selTo}];
    saveItinerary(day,itin);
    overlay.remove();
    drawBlocks(day);
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
  const festStart=slots[0], festEnd=slots[slots.length-1];
  if(endHour<startHour && nowM<startHour*60) nowM+=1440;
  if(nowM<festStart||nowM>festEnd+intervalMinutes){ line.style.display="none"; return; }
  line.style.left=`${Math.round(festMinToPx(nowM))}px`;
  line.style.display="block";
  if(label) label.textContent=formatTime(nowM%1440);
}

// ===============================
// DAY SWITCH
// ===============================
function setActiveDay(day){
  activeDay=day;
  document.getElementById("day1Btn")?.classList.toggle("active",day===1);
  document.getElementById("day2Btn")?.classList.toggle("active",day===2);
  document.getElementById("dayMeta").textContent=day===1?"14/02":"15/02";
  buildStageColumn(); buildGrid(); drawBlocks(day); updateTimeLine();
}

// ===============================
// INIT
// ===============================
document.getElementById("day1Btn")?.addEventListener("click",()=>setActiveDay(1));
document.getElementById("day2Btn")?.addEventListener("click",()=>setActiveDay(2));

loadUserProfile();

if(!myColor||!myName){
  showColorPicker((color,name)=>{
    myColor=color; myName=name;
    saveUserProfile(); renderUserBadge();
    setActiveDay(1); setInterval(updateTimeLine,60000);
  });
} else {
  renderUserBadge();
  setActiveDay(1);
  setInterval(updateTimeLine,60000);
}
