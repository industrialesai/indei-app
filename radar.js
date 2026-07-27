// ══════════════════════════════════════════════
// PROTOCOLO RADAR™ · Módulo independiente del MoneyMaker System
// Se integra en runtime — NO modifica el núcleo del MMS.
// Requiere: <script src="radar.js"></script> justo antes de </body>
// ══════════════════════════════════════════════

// ── INTEGRACIÓN CON EL MMS ──
let _radarLoaded=false;
let _radarOrgId=null;
(function radarIntegrar(){
  // 1. Título de página y tipo de actividad
  PAGE_TITLES.radar='Protocolo RADAR™';
  ET.movimiento_radar={label:'Movimiento RADAR',icon:'🎯',bg:'rgba(201,168,76,0.15)',badge:'b-amarillo'};
  // 2. Contenedor de página
  const body=document.querySelector('.content-body');
  const mapaPage=document.getElementById('page-mapa');
  if(body&&!document.getElementById('page-radar')){
    const d=document.createElement('div');d.id='page-radar';d.className='page';
    body.insertBefore(d,mapaPage||null);
  }
  // 3. Botón en el sidebar (primero de la sección "Principal")
  const nav=document.querySelector('.sb-nav');
  if(nav&&!document.getElementById('sb-radar-btn')){
    const btn=document.createElement('button');
    btn.className='sb-item';btn.id='sb-radar-btn';
    btn.setAttribute('onclick',"go('radar')");
    btn.innerHTML='<span class="sb-icon">🎯</span><span class="sb-label">Protocolo RADAR</span>';
    const mapaBtn=[...nav.querySelectorAll('.sb-item')].find(b=>b.getAttribute('onclick')==="go('mapa')");
    if(mapaBtn)nav.insertBefore(btn,mapaBtn);else nav.appendChild(btn);
  }
  // 4. Envolver go() para rutear 'radar' y corregir el resaltado del sidebar
  const _goOrig=go;
  go=function(p){
    if(p==='radar'){
      document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));
      const pg=document.getElementById('page-radar');if(pg)pg.classList.add('active');
      const t=document.getElementById('page-title');if(t)t.textContent='Protocolo RADAR™';
      if(window.innerWidth<=768)closeSidebar();
      radarView={mode:'lista',radarId:null};
      renderRadar();
    }else{
      _goOrig(p);
    }
    // Resaltado por atributo onclick (inmune al corrimiento de índices)
    document.querySelectorAll('.sb-item').forEach(x=>x.classList.remove('sb-active'));
    const target=[...document.querySelectorAll('.sb-item')].find(b=>b.getAttribute('onclick')==="go('"+p+"')");
    if(target)target.classList.add('sb-active');
  };
})();

// ── CARGA DE DATOS (perezosa, con caché por organización) ──
async function radarCargarDatos(force){
  if(_radarLoaded&&!force&&_radarOrgId===ORG?.id)return;
  const[{data:rd},{data:rm}]=await Promise.all([
    db.from('radares').select('*').eq('org_id',ORG.id).order('created_at',{ascending:false}),
    db.from('radar_movimientos').select('*').eq('org_id',ORG.id).order('prioridad')
  ]);
  D.radar=rd||[];D.radar_mov=rm||[];
  _radarLoaded=true;_radarOrgId=ORG.id;
}

// ── ESTADO DEL MÓDULO ──
let radarView={mode:'lista',radarId:null};
let radarFiltroUid='todos';
let rw=null; // estado del wizard
const escR=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const RADAR_CANALES={llamada:'📞 Llamada',whatsapp:'💬 WhatsApp',correo:'📧 Correo',reunion:'🤝 Reunión',seguimiento:'🔁 Seguimiento',knockout:'🥊 Knockout™',otro:'📌 Otro'};
function radarWeekMon(){return wRange(0)[0];}
function radarMovsDe(rid){return D.radar_mov.filter(m=>m.radar_id===rid).sort((a,b)=>(a.prioridad||1)-(b.prioridad||1));}
function radarNombreMiembro(uid){const m=MIEMBROS.find(x=>x.user_id===uid);return m?m.nombre:'—';}
function radarGo(mode,rid){radarView={mode,radarId:rid||null};renderRadar();}

// ── SEÑALES DE CUENTA (el sistema mide, la persona interpreta) ──
function radarSenalesSync(eid){
  const hoy=today();const sen=[];
  const dias=(a,b)=>Math.floor((new Date(b)-new Date(a))/864e5);
  // Oportunidades
  const opAb=D.proy.filter(p=>p.empresa_id===eid&&!['cerrado','perdido'].includes(p.etapa));
  opAb.forEach(p=>{
    if(p.fecha_cierre&&p.fecha_cierre<hoy)sen.push({nivel:'rojo',icon:'⏰',txt:`Oportunidad "${escR(p.nombre)}" con fecha de cierre vencida (${fd(p.fecha_cierre)})`});
    else if(p.created_at&&dias(p.created_at.split('T')[0],hoy)>=14)sen.push({nivel:'amarillo',icon:'💼',txt:`Oportunidad "${escR(p.nombre)}" abierta hace ${dias(p.created_at.split('T')[0],hoy)} días (etapa: ${(ETAPAS_PROY[p.etapa]||{}).label||p.etapa})`});
  });
  // Contactos
  const us=D.usu.filter(u=>u.empresa_id===eid);
  us.forEach(u=>{
    const acts=D.act.filter(a=>a.usuario_id===u.id&&a.fecha);
    const ult=acts.length?acts.reduce((m,a)=>a.fecha>m?a.fecha:m,'0000'):null;
    const tipo=u.tipo_usuario||'activo';
    if(!ult){
      if(tipo!=='activo')sen.push({nivel:'amarillo',icon:tipo==='knockout'?'🥊':'🎯',txt:`${escR(u.nombre)} (${tipo==='knockout'?'Knockout':'Prospecto'}) sin primer contacto registrado`});
      else sen.push({nivel:'gris',icon:'👤',txt:`${escR(u.nombre)} (activo) sin ninguna actividad registrada`});
    } else if(dias(ult,hoy)>=30){
      sen.push({nivel:tipo==='activo'?'rojo':'amarillo',icon:'🧊',txt:`${escR(u.nombre)} sin actividad desde hace ${dias(ult,hoy)} días (última: ${fd(ult)})`});
    }
  });
  return sen;
}
async function radarSenalesSeg(eid){
  const segs=D.seg.filter(s=>s.empresa_id===eid&&s.estado==='activo');
  if(!segs.length)return[];
  const{data:cons}=await db.from('seguimiento_contactos').select('*').in('seguimiento_id',segs.map(s=>s.id));
  const sen=[];
  segs.forEach(s=>{
    const c=(cons||[]).filter(x=>x.seguimiento_id===s.id);
    const ret=countSegRetrasados(s,c);
    if(ret>0)sen.push({nivel:'rojo',icon:'🔄',txt:`Seguimiento 3x3 de ${escR(s.usuario_nombre)} con ${ret} toque${ret>1?'s':''} pendiente${ret>1?'s':''}`});
  });
  return sen;
}
function radarSenalesHTML(sen){
  if(!sen.length)return'<div style="font-size:13px;color:var(--text2);padding:8px 0">✅ Sin señales críticas detectadas por el sistema en esta cuenta.</div>';
  const col={rojo:'var(--red)',amarillo:'var(--amber)',gris:'var(--text2)'};
  const bg={rojo:'var(--red-bg)',amarillo:'var(--amber-bg)',gris:'var(--gray-bg)'};
  return sen.map(s=>`<div style="display:flex;gap:8px;align-items:flex-start;padding:7px 10px;background:${bg[s.nivel]};border-radius:var(--radius);margin-bottom:6px;font-size:13px;color:${col[s.nivel]}">${s.icon} <span style="color:var(--text)">${s.txt}</span></div>`).join('');
}

// ── VISTA PRINCIPAL ──
function renderRadar(){
  const el=document.getElementById('page-radar');
  if(!el)return;
  if(!_radarLoaded||_radarOrgId!==ORG?.id){
    el.innerHTML='<div class="empty">Cargando Protocolo RADAR…</div>';
    radarCargarDatos(true).then(renderRadar).catch(e=>{el.innerHTML='<div class="empty">⚠️ No se pudieron cargar los radares. ¿Ya corriste el SQL en Supabase?<br><span style="font-size:12px;color:var(--text3)">'+String(e?.message||e)+'</span></div>';});
    return;
  }
  if(radarView.mode==='wizard'){el.innerHTML=radarWizardHTML();radarWizardPost();return;}
  if(radarView.mode==='activado'){el.innerHTML=radarActivadoHTML(radarView.radarId);return;}
  if(radarView.mode==='detalle'){el.innerHTML=radarDetalleHTML(radarView.radarId);return;}
  const wk=radarWeekMon();
  let rads=D.radar;
  if(MI_ROL!=='dueno')rads=rads.filter(r=>r.user_id===ME.id);
  else if(radarFiltroUid!=='todos')rads=rads.filter(r=>r.user_id===radarFiltroUid);
  const actuales=rads.filter(r=>r.week_key===wk);
  const pasadosAbiertos=rads.filter(r=>r.estado==='activo'&&r.week_key<wk);
  const cerradosPrevios=rads.filter(r=>r.estado==='cerrado'&&r.week_key<wk).slice(0,10);

  const filtro=MI_ROL==='dueno'?`<select onchange="radarFiltroUid=this.value;renderRadar()" style="padding:6px 10px;font-size:13px;border:0.5px solid var(--border2);border-radius:var(--radius);background:var(--bg3);color:var(--text)">
    <option value="todos"${radarFiltroUid==='todos'?' selected':''}>Todo el equipo</option>
    ${MIEMBROS.map(m=>`<option value="${m.user_id}"${radarFiltroUid===m.user_id?' selected':''}>${escR(m.nombre)}</option>`).join('')}
  </select>`:'';

  let alerta='';
  if(pasadosAbiertos.length)alerta=`<div class="card" style="border-color:rgba(226,75,74,0.4);background:var(--red-bg)">
    <div style="font-weight:700;color:var(--red);margin-bottom:6px">⚠️ Tienes ${pasadosAbiertos.length} radar${pasadosAbiertos.length>1?'es':''} de semanas anteriores sin cerrar</div>
    <div style="font-size:13px;color:var(--text2);margin-bottom:10px">Regla del sistema: antes de activar un nuevo RADAR en una cuenta, debes cerrar el anterior con su Revisión de Ejecución™.</div>
    ${pasadosAbiertos.map(r=>`<button class="btn btn-s" style="margin:2px 6px 2px 0" onclick="radarGo('detalle','${r.id}')">Cerrar radar de ${escR(r.empresa_nombre)} (${wLabel(r.week_key)})</button>`).join('')}
  </div>`;

  const tarjetas=actuales.length?actuales.map(r=>radarCardHTML(r)).join(''):'<div class="empty">No hay radares activados esta semana.<br>Prende tu Radar y regresa al ataque. 🎯</div>';

  el.innerHTML=`
  <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:1rem">
    <div>
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--gold)">Semana ${wLabel(wk)}</div>
      <div style="font-size:13px;color:var(--text2)">Visibilidad · Prioridad · Claridad · Ejecución</div>
    </div>
    <div style="display:flex;gap:8px;align-items:center">${filtro}
      <button class="btn btn-primary" onclick="radarNuevo()">🎯 Activar Radar</button>
    </div>
  </div>
  ${alerta}
  ${tarjetas}
  ${cerradosPrevios.length?`<div style="margin-top:1.5rem"><div style="font-family:'Barlow Condensed',sans-serif;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--text2);margin-bottom:8px">Radares cerrados recientes</div>${cerradosPrevios.map(r=>radarCardHTML(r,true)).join('')}</div>`:''}`;
}
function radarCardHTML(r,mini){
  const movs=radarMovsDe(r.id);
  const ej=movs.filter(m=>m.estado==='ejecutado').length;
  const noEj=movs.filter(m=>m.estado==='no_ejecutado').length;
  const pct=movs.length?Math.round(ej/movs.length*100):0;
  const estadoBadge=r.estado==='cerrado'
    ?`<span style="font-size:10px;padding:2px 8px;background:var(--green-bg);color:var(--green);border-radius:3px;font-weight:700;letter-spacing:.06em">CERRADO · ${pct}%</span>`
    :`<span style="font-size:10px;padding:2px 8px;background:var(--gold-bg);color:var(--gold-light);border-radius:3px;font-weight:700;letter-spacing:.06em">RADAR ACTIVADO</span>`;
  return`<div class="card" style="cursor:pointer${mini?';opacity:.75':''}" onclick="radarGo('detalle','${r.id}')">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap">
      <div>
        <div style="font-weight:700;font-size:15px">🎯 ${escR(r.empresa_nombre)}</div>
        <div style="font-size:12px;color:var(--text2);margin-top:2px">${escR(radarNombreMiembro(r.user_id))} · ${wLabel(r.week_key)}</div>
      </div>
      ${estadoBadge}
    </div>
    <div style="margin-top:10px;display:flex;gap:14px;font-size:13px;color:var(--text2);flex-wrap:wrap">
      <span>📌 ${movs.length} movimiento${movs.length!==1?'s':''}</span>
      <span style="color:var(--green)">✅ ${ej} ejecutado${ej!==1?'s':''}</span>
      ${noEj?`<span style="color:var(--red)">❌ ${noEj} no ejecutado${noEj!==1?'s':''}</span>`:''}
      <span>⏳ ${movs.length-ej-noEj} pendiente${movs.length-ej-noEj!==1?'s':''}</span>
    </div>
    <div style="margin-top:8px;height:5px;background:var(--bg3);border-radius:3px;overflow:hidden"><div style="height:100%;width:${pct}%;background:var(--gold);transition:width .3s"></div></div>
    ${r.obstaculo?`<div style="margin-top:8px;font-size:12px;padding:6px 10px;background:var(--amber-bg);border-radius:var(--radius);color:var(--text)">🧱 <b>Obstáculo:</b> ${escR(r.obstaculo)}</div>`:''}
  </div>`;
}

// ── WIZARD DE ACTIVACIÓN ──
function radarNuevo(){
  rw={paso:1,empresa_id:'',contexto:'',porque:'',vision:'',urgencias:'',defensa:'',obstaculo:'',movs:[radarMovVacio()]};
  radarGo('wizard');
}
function radarMovVacio(){return{descripcion:'',usuario_id:'',proyecto_id:'',responsable_id:ME.id,fecha:'',hora:'',prioridad:1,canal:'',hoy:false};}
function radarWizardHTML(){
  const wk=radarWeekMon();
  const pasos=['CUENTA','MAPA DE PODER™','SIGUIENTE MOVIMIENTO','BLINDAJE™'];
  const stepper=`<div style="display:flex;gap:4px;margin-bottom:1rem;flex-wrap:wrap">${pasos.map((p,i)=>`<div style="flex:1;min-width:110px;text-align:center;padding:7px 4px;font-family:'Barlow Condensed',sans-serif;font-size:12px;letter-spacing:.06em;border-radius:var(--radius);${rw.paso===i+1?'background:var(--gold-bg);color:var(--gold-light);border:1px solid rgba(201,168,76,0.4);font-weight:700':'background:var(--bg3);color:var(--text3);border:1px solid var(--border)'}">PASO ${i+1}<br>${p}</div>`).join('')}</div>`;
  let cuerpo='';
  if(rw.paso===1)cuerpo=radarPaso1HTML();
  if(rw.paso===2)cuerpo=radarPaso2HTML();
  if(rw.paso===3)cuerpo=radarPaso3HTML(); // incluye blindaje por movimiento (paso 4 integrado)
  return`<div style="max-width:860px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem">
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--gold)">Activando Radar · Semana ${wLabel(wk)}</div>
      <button class="btn btn-s" onclick="radarGo('lista')">✕ Cancelar</button>
    </div>
    ${stepper}${cuerpo}</div>`;
}
function radarPaso1HTML(){
  const wk=radarWeekMon();
  const opts=D.emp.map(e=>`<option value="${e.id}"${rw.empresa_id===e.id?' selected':''}>${escR(e.nombre)}</option>`).join('');
  let aviso='';
  if(rw.empresa_id){
    const abiertoPasado=D.radar.find(r=>r.empresa_id===rw.empresa_id&&r.user_id===ME.id&&r.estado==='activo'&&r.week_key<wk);
    const activoActual=D.radar.find(r=>r.empresa_id===rw.empresa_id&&r.user_id===ME.id&&r.week_key===wk);
    if(abiertoPasado)aviso=`<div style="margin-top:10px;padding:10px 12px;background:var(--red-bg);border:1px solid rgba(226,75,74,0.3);border-radius:var(--radius);font-size:13px;color:var(--text)">⚠️ Tienes un radar de la semana ${wLabel(abiertoPasado.week_key)} sin cerrar en esta cuenta. Ciérralo con su Revisión de Ejecución™ antes de activar uno nuevo.<br><button class="btn btn-s" style="margin-top:8px" onclick="radarGo('detalle','${abiertoPasado.id}')">Ir a cerrar ese radar →</button></div>`;
    else if(activoActual)aviso=`<div style="margin-top:10px;padding:10px 12px;background:var(--amber-bg);border:1px solid rgba(201,168,76,0.3);border-radius:var(--radius);font-size:13px;color:var(--text)">Ya tienes un radar activo esta semana en esta cuenta.<br><button class="btn btn-s" style="margin-top:8px" onclick="radarGo('detalle','${activoActual.id}')">Ver ese radar →</button></div>`;
  }
  const puedeAvanzar=(()=>{
    if(!rw.empresa_id)return false;
    const wk2=radarWeekMon();
    return!D.radar.find(r=>r.empresa_id===rw.empresa_id&&r.user_id===ME.id&&((r.estado==='activo'&&r.week_key<wk2)||r.week_key===wk2));
  })();
  return`<div class="card">
    <div style="font-weight:700;margin-bottom:4px">PASO 1 — Define la cuenta</div>
    <div style="font-size:13px;color:var(--text2);margin-bottom:12px">No buscamos un plan anual. Buscamos el siguiente movimiento en UNA cuenta con potencial de generar más órdenes de compra.</div>
    <select onchange="rw.empresa_id=this.value;renderRadar()" style="width:100%;padding:9px 10px;font-size:14px;border:0.5px solid var(--border2);border-radius:var(--radius);background:var(--bg3);color:var(--text)">
      <option value="">— Selecciona la cuenta —</option>${opts}</select>
    ${aviso}
    <div style="margin-top:14px">
      <label style="display:block;font-size:11px;color:var(--text2);text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">1. ¿Por qué elegiste esta cuenta?</label>
      <textarea id="rw-porque" rows="2" style="width:100%;padding:8px 10px;font-size:13px;border:0.5px solid var(--border2);border-radius:var(--radius);background:var(--bg3);color:var(--text);resize:vertical" placeholder="Ej. Ya nos compran refacciones, tienen 3 líneas nuevas arrancando y el presupuesto 2026 se define en agosto...">${escR(rw.porque)}</textarea>
    </div>
    <div style="margin-top:12px">
      <label style="display:block;font-size:11px;color:var(--text2);text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">2. ¿Qué oportunidad visualizas dentro de esta cuenta? (hasta 3)</label>
      <textarea id="rw-vision" rows="3" style="width:100%;padding:8px 10px;font-size:13px;border:0.5px solid var(--border2);border-radius:var(--radius);background:var(--bg3);color:var(--text);resize:vertical" placeholder="1. Contrato anual de mantenimiento&#10;2. Equipar la línea 4&#10;3. Entrar con el área de calidad">${escR(rw.vision)}</textarea>
    </div>
    <div style="margin-top:12px">
      <label style="display:block;font-size:11px;color:var(--text2);text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">¿Cómo está esta cuenta hoy? (contexto rápido, opcional)</label>
      <textarea id="rw-contexto" rows="2" style="width:100%;padding:8px 10px;font-size:13px;border:0.5px solid var(--border2);border-radius:var(--radius);background:var(--bg3);color:var(--text);resize:vertical" placeholder="Ej. Tenemos 2 oportunidades cotizadas, el ingeniero de calidad no responde desde hace 3 semanas...">${escR(rw.contexto)}</textarea>
    </div>
    <div style="margin-top:14px;text-align:right"><button class="btn btn-primary"${puedeAvanzar?'':' disabled style="opacity:.4;cursor:not-allowed"'} onclick="radarLeerPaso1();rw.paso=2;renderRadar()">Siguiente: Mapa de Poder™ →</button></div>
  </div>`;
}
function radarPaso2HTML(){
  const us=D.usu.filter(u=>u.empresa_id===rw.empresa_id);
  const grupos={activo:{t:'🟡 Contactos activos (ya te compran)',arr:[]},knockout:{t:'🥊 Knockouts (referenciados)',arr:[]},prospecto:{t:'🎯 Prospectos (prospección propia)',arr:[]}};
  us.forEach(u=>{(grupos[u.tipo_usuario||'activo']||grupos.activo).arr.push(u);});
  const emp=D.emp.find(e=>e.id===rw.empresa_id)||{};
  const bloques=Object.values(grupos).map(g=>g.arr.length?`<div style="margin-bottom:12px">
    <div style="font-size:12px;font-weight:700;letter-spacing:.04em;color:var(--text2);margin-bottom:6px">${g.t}</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px">${g.arr.map(u=>`<span style="padding:6px 12px;background:var(--bg3);border:1px solid var(--border2);border-radius:var(--radius);font-size:13px">${escR(u.nombre)}${u.area?`<span style="color:var(--text3)"> · ${escR(u.area)}</span>`:''}</span>`).join('')}</div>
  </div>`:'').join('');
  return`<div class="card">
    <div style="font-weight:700;margin-bottom:4px">PASO 2 — Mapa de Poder™ de ${escR(emp.nombre||'')}</div>
    <div style="font-size:13px;color:var(--text2);margin-bottom:14px">Estas son las personas que hoy tienes visibles dentro de la cuenta. El radar debe considerarlas a todas: ¿a quién falta contactar, agregar o profundizar?</div>
    ${us.length?bloques:'<div class="empty">Esta cuenta no tiene contactos registrados aún.</div>'}
    <div style="font-size:12px;color:var(--text3);margin-top:6px">Para agregar o editar contactos usa el <a href="#" onclick="go('mapa');return false" style="color:var(--gold-light)">Mapa del Éxito</a> — el radar los tomará automáticamente.</div>
    <div style="margin-top:14px;display:flex;justify-content:space-between">
      <button class="btn btn-s" onclick="rw.paso=1;renderRadar()">← Atrás</button>
      <button class="btn btn-primary" onclick="rw.paso=3;renderRadar()">Siguiente: Movimientos →</button>
    </div>
  </div>`;
}
function radarPaso3HTML(){
  const us=D.usu.filter(u=>u.empresa_id===rw.empresa_id);
  const proys=D.proy.filter(p=>p.empresa_id===rw.empresa_id&&!['cerrado','perdido'].includes(p.etapa));
  const sen=radarSenalesSync(rw.empresa_id);
  // Movimientos no ejecutados del último radar cerrado en esta cuenta
  const wk=radarWeekMon();
  const prevCerrado=D.radar.filter(r=>r.empresa_id===rw.empresa_id&&r.user_id===ME.id&&r.estado==='cerrado').sort((a,b)=>b.week_key.localeCompare(a.week_key))[0];
  const pendPrev=prevCerrado?radarMovsDe(prevCerrado.id).filter(m=>m.estado==='no_ejecutado'):[];
  const movRows=rw.movs.map((m,i)=>`<div class="card" style="background:var(--bg3);margin-bottom:10px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:12px;letter-spacing:.08em;color:var(--gold-light);font-weight:700">MOVIMIENTO ${i+1}</div>
      ${rw.movs.length>1?`<button class="btn btn-s" onclick="radarLeerFormTodos();rw.movs.splice(${i},1);renderRadar()" style="font-size:11px">🗑 Quitar</button>`:''}
    </div>
    <textarea id="rm-desc-${i}" rows="2" style="width:100%;padding:8px 10px;font-size:13px;border:0.5px solid var(--border2);border-radius:var(--radius);background:var(--bg2);color:var(--text);resize:vertical" placeholder="¿Cuál es el movimiento? Ej. Contactar a Angélica para agendar la presentación del modelo de cooperación">${escR(m.descripcion)}</textarea>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px;margin-top:8px">
      <div><label style="font-size:10px;color:var(--text2);text-transform:uppercase;letter-spacing:.04em">Contacto (opcional)</label>
        <select id="rm-usu-${i}" style="width:100%;padding:7px;font-size:12px;border:0.5px solid var(--border2);border-radius:var(--radius);background:var(--bg2);color:var(--text)"><option value="">—</option>${us.map(u=>`<option value="${u.id}"${m.usuario_id===u.id?' selected':''}>${escR(u.nombre)}</option>`).join('')}</select></div>
      <div><label style="font-size:10px;color:var(--text2);text-transform:uppercase;letter-spacing:.04em">Oportunidad (opcional)</label>
        <select id="rm-proy-${i}" style="width:100%;padding:7px;font-size:12px;border:0.5px solid var(--border2);border-radius:var(--radius);background:var(--bg2);color:var(--text)"><option value="">—</option>${proys.map(p=>`<option value="${p.id}"${m.proyecto_id===p.id?' selected':''}>${escR(p.nombre)}</option>`).join('')}</select></div>
      <div><label style="font-size:10px;color:var(--text2);text-transform:uppercase;letter-spacing:.04em">Canal</label>
        <select id="rm-canal-${i}" style="width:100%;padding:7px;font-size:12px;border:0.5px solid var(--border2);border-radius:var(--radius);background:var(--bg2);color:var(--text)"><option value="">—</option>${Object.entries(RADAR_CANALES).map(([k,v])=>`<option value="${k}"${m.canal===k?' selected':''}>${v}</option>`).join('')}</select></div>
      <div><label style="font-size:10px;color:var(--text2);text-transform:uppercase;letter-spacing:.04em">Prioridad</label>
        <select id="rm-prio-${i}" style="width:100%;padding:7px;font-size:12px;border:0.5px solid var(--border2);border-radius:var(--radius);background:var(--bg2);color:var(--text)">${[1,2,3,4,5].map(p=>`<option value="${p}"${(m.prioridad||1)===p?' selected':''}>${p}</option>`).join('')}</select></div>
    </div>
    <label style="display:flex;align-items:center;gap:8px;margin-top:8px;font-size:13px;cursor:pointer;color:var(--gold-light)"><input type="checkbox" id="rm-hoy-${i}"${m.hoy?' checked':''} style="accent-color:var(--gold)"> ⚡ Puedo ejecutarlo HOY mismo (Regla de Acción™: si puede hacerse hoy, se hace hoy)</label>
    <div style="margin-top:10px;padding-top:10px;border-top:1px dashed var(--border2)">
      <div style="font-size:11px;font-weight:700;letter-spacing:.06em;color:var(--gold-light);margin-bottom:6px">🛡️ BLINDAJE™ — responsable + fecha + hora + registro en MMS</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px">
        <div><label style="font-size:10px;color:var(--text2);text-transform:uppercase;letter-spacing:.04em">Responsable *</label>
          <select id="rm-resp-${i}" style="width:100%;padding:7px;font-size:12px;border:0.5px solid var(--border2);border-radius:var(--radius);background:var(--bg2);color:var(--text)">${MIEMBROS.map(mm=>`<option value="${mm.user_id}"${(m.responsable_id||ME.id)===mm.user_id?' selected':''}>${escR(mm.nombre)}</option>`).join('')}</select></div>
        <div><label style="font-size:10px;color:var(--text2);text-transform:uppercase;letter-spacing:.04em">Fecha compromiso *</label>
          <input type="date" id="rm-fecha-${i}" value="${m.fecha||''}" style="width:100%;padding:6px;font-size:12px;border:0.5px solid var(--border2);border-radius:var(--radius);background:var(--bg2);color:var(--text)"></div>
        <div><label style="font-size:10px;color:var(--text2);text-transform:uppercase;letter-spacing:.04em">Hora</label>
          <input type="time" id="rm-hora-${i}" value="${m.hora||''}" style="width:100%;padding:6px;font-size:12px;border:0.5px solid var(--border2);border-radius:var(--radius);background:var(--bg2);color:var(--text)"></div>
      </div>
    </div>
  </div>`).join('');
  return`
  <div class="card" style="background:var(--gold-bg2)">
    <div style="font-weight:700;margin-bottom:6px">📡 Señales del sistema en esta cuenta</div>
    <div style="font-size:12px;color:var(--text2);margin-bottom:8px">El sistema mide lo fijo. Tú interpretas y decides el siguiente movimiento.</div>
    ${radarSenalesHTML(sen)}
    <div id="rw-senales-seg"><div style="font-size:12px;color:var(--text3)">Cargando seguimientos 3x3…</div></div>
  </div>
  ${prevCerrado&&prevCerrado.siguiente_movimiento?`<div class="card" style="border-color:rgba(201,168,76,0.35)">
    <div style="font-weight:700;margin-bottom:6px">➡️ Al cerrar tu radar anterior declaraste este siguiente movimiento:</div>
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:13px"><span>${escR(prevCerrado.siguiente_movimiento)}</span><button class="btn btn-s" onclick="radarUsarSiguiente('${prevCerrado.id}')">＋ Usarlo</button></div>
  </div>`:''}
  ${pendPrev.length?`<div class="card" style="border-color:rgba(201,168,76,0.35)">
    <div style="font-weight:700;margin-bottom:6px">↩️ Movimientos no ejecutados de tu radar anterior</div>
    ${pendPrev.map(m=>`<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);font-size:13px"><span>${escR(m.descripcion)}</span><button class="btn btn-s" onclick="radarRetomarMov('${m.id}')">＋ Retomar</button></div>`).join('')}
  </div>`:''}
  <div class="card">
    <div style="font-weight:700;margin-bottom:4px">PASO 3 y 4 — Siguientes movimientos + Blindaje™</div>
    <div style="font-size:13px;color:var(--text2);margin-bottom:12px">Define de 1 a 5 movimientos para esta semana. Sin blindaje (responsable, fecha, hora) el movimiento no existe. Al activar el radar, cada movimiento se registra automáticamente como actividad en el MMS.</div>
    ${movRows}
    ${rw.movs.length<5?`<button class="btn btn-s" onclick="radarLeerFormTodos();rw.movs.push(radarMovVacio());renderRadar()">＋ Agregar movimiento</button>`:''}
    <div style="margin-top:16px;padding:12px;background:var(--bg3);border:1px dashed var(--border2);border-radius:var(--radius)">
      <div style="font-size:11px;font-weight:700;letter-spacing:.06em;color:var(--gold-light);margin-bottom:8px">🛡️ IDENTIFICA LOS OBSTÁCULOS — protege tu plan del secuestro operativo</div>
      <label style="display:block;font-size:10px;color:var(--text2);text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px">¿Qué urgencias normalmente te secuestran?</label>
      <textarea id="rw-urgencias" rows="1" style="width:100%;padding:7px 10px;font-size:13px;border:0.5px solid var(--border2);border-radius:var(--radius);background:var(--bg2);color:var(--text);resize:vertical;margin-bottom:8px" placeholder="Ej. Reclamos de entrega, cotizaciones exprés, juntas de operación...">${escR(rw.urgencias)}</textarea>
      <label style="display:block;font-size:10px;color:var(--text2);text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px">¿Qué harás cuando aparezcan?</label>
      <textarea id="rw-defensa" rows="1" style="width:100%;padding:7px 10px;font-size:13px;border:0.5px solid var(--border2);border-radius:var(--radius);background:var(--bg2);color:var(--text);resize:vertical;margin-bottom:8px" placeholder="Ej. Bloquear martes y jueves de 8 a 10 am solo para movimientos RADAR; delegar reclamos a Luis...">${escR(rw.defensa)}</textarea>
      <label style="display:block;font-size:10px;color:var(--text2);text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px">🧱 ¿Qué necesitas de tu director para avanzar? (se verá en Gobierno Comercial)</label>
      <textarea id="rw-obst" rows="1" style="width:100%;padding:7px 10px;font-size:13px;border:0.5px solid var(--border2);border-radius:var(--radius);background:var(--bg2);color:var(--text);resize:vertical" placeholder="Ej. Necesito que el área técnica me acompañe a la visita del miércoles">${escR(rw.obstaculo)}</textarea>
    </div>
    <div style="margin-top:14px;display:flex;justify-content:space-between">
      <button class="btn btn-s" onclick="radarLeerFormTodos();rw.paso=2;renderRadar()">← Atrás</button>
      <button class="btn btn-primary" onclick="radarActivar()">🎯 ACTIVAR RADAR</button>
    </div>
  </div>`;
}
function radarWizardPost(){
  if(rw&&rw.paso===3&&rw.empresa_id){
    radarSenalesSeg(rw.empresa_id).then(sen=>{
      const el=document.getElementById('rw-senales-seg');
      if(el)el.innerHTML=sen.length?radarSenalesHTML(sen):'<div style="font-size:12px;color:var(--text2)">✅ Seguimientos 3x3 de esta cuenta al día.</div>';
    });
  }
}
function radarLeerPaso1(){
  const g=id=>document.getElementById(id);
  if(g('rw-porque'))rw.porque=g('rw-porque').value;
  if(g('rw-vision'))rw.vision=g('rw-vision').value;
  if(g('rw-contexto'))rw.contexto=g('rw-contexto').value;
}
function radarLeerForm(i){
  const g=id=>document.getElementById(id);
  const m=rw.movs[i];if(!m)return;
  if(g('rm-desc-'+i))m.descripcion=g('rm-desc-'+i).value;
  if(g('rm-usu-'+i))m.usuario_id=g('rm-usu-'+i).value;
  if(g('rm-proy-'+i))m.proyecto_id=g('rm-proy-'+i).value;
  if(g('rm-prio-'+i))m.prioridad=parseInt(g('rm-prio-'+i).value)||1;
  if(g('rm-resp-'+i))m.responsable_id=g('rm-resp-'+i).value;
  if(g('rm-fecha-'+i))m.fecha=g('rm-fecha-'+i).value;
  if(g('rm-hora-'+i))m.hora=g('rm-hora-'+i).value;
  if(g('rm-canal-'+i))m.canal=g('rm-canal-'+i).value;
  if(g('rm-hoy-'+i))m.hoy=g('rm-hoy-'+i).checked;
}
function radarLeerFormTodos(){
  rw.movs.forEach((_,i)=>radarLeerForm(i));
  const g=id=>document.getElementById(id);
  if(g('rw-obst'))rw.obstaculo=g('rw-obst').value;
  if(g('rw-urgencias'))rw.urgencias=g('rw-urgencias').value;
  if(g('rw-defensa'))rw.defensa=g('rw-defensa').value;
}
function radarUsarSiguiente(rid){
  radarLeerFormTodos();
  const prev=D.radar.find(x=>x.id===rid);
  if(!prev||!prev.siguiente_movimiento)return;
  if(rw.movs.length===1&&!rw.movs[0].descripcion)rw.movs=[];
  if(rw.movs.length>=5)return alert('Máximo 5 movimientos por radar.');
  rw.movs.push({descripcion:prev.siguiente_movimiento,usuario_id:'',proyecto_id:'',responsable_id:ME.id,fecha:'',hora:'',prioridad:1,canal:'',hoy:false});
  renderRadar();
}
function radarRetomarMov(mid){
  radarLeerFormTodos();
  const m=D.radar_mov.find(x=>x.id===mid);if(!m)return;
  if(rw.movs.length===1&&!rw.movs[0].descripcion)rw.movs=[];
  if(rw.movs.length>=5)return alert('Máximo 5 movimientos por radar.');
  rw.movs.push({descripcion:m.descripcion,usuario_id:m.usuario_id||'',proyecto_id:m.proyecto_id||'',responsable_id:m.responsable_id||ME.id,fecha:'',hora:'',prioridad:m.prioridad||1,canal:m.canal||'',hoy:false});
  renderRadar();
}
async function radarActivar(){
  radarLeerFormTodos();
  const movs=rw.movs.filter(m=>m.descripcion.trim());
  if(!movs.length)return alert('Define al menos un movimiento.');
  for(const m of movs){
    if(!m.responsable_id||!m.fecha)return alert('Blindaje incompleto: todo movimiento necesita responsable y fecha compromiso.');
  }
  const emp=D.emp.find(e=>e.id===rw.empresa_id);
  if(!emp)return alert('Selecciona una cuenta.');
  load(true);
  const{data:rad,error}=await db.from('radares').insert({
    org_id:ORG.id,empresa_id:emp.id,empresa_nombre:emp.nombre,
    user_id:ME.id,vendedor_nombre:MI_NOMBRE,week_key:radarWeekMon(),
    contexto:rw.contexto||null,obstaculo:rw.obstaculo||null,
    porque:rw.porque||null,oportunidad_vision:rw.vision||null,
    urgencias:rw.urgencias||null,plan_defensa:rw.defensa||null,estado:'activo'
  }).select().single();
  if(error){load(false);return alert('Error al crear el radar: '+error.message);}
  D.radar.unshift(rad);
  for(const m of movs){
    const usu=D.usu.find(u=>u.id===m.usuario_id);
    const proy=D.proy.find(p=>p.id===m.proyecto_id);
    // 1) Insertar movimiento
    const{data:mov,error:e1}=await db.from('radar_movimientos').insert({
      radar_id:rad.id,org_id:ORG.id,descripcion:m.descripcion.trim(),
      usuario_id:m.usuario_id||null,usuario_nombre:usu?.nombre||null,
      proyecto_id:m.proyecto_id||null,proyecto_nombre:proy?.nombre||null,
      responsable_id:m.responsable_id,responsable_nombre:radarNombreMiembro(m.responsable_id),
      fecha_compromiso:m.fecha,hora:m.hora||null,prioridad:m.prioridad||1,
      canal:m.canal||null,ejecutar_hoy:!!m.hoy,estado:'pendiente'
    }).select().single();
    if(e1){console.error(e1);continue;}
    // 2) Registro automático en MMS (Paso 5 — Registro™)
    try{
      const{data:act}=await db.from('actividades').insert({
        org_id:ORG.id,registrado_por:ME.id,registrado_nombre:MI_NOMBRE,
        empresa_id:emp.id,empresa_nombre:emp.nombre,
        usuario_id:m.usuario_id||null,usuario_nombre:usu?.nombre||'—',
        estado:'movimiento_radar',fecha:today(),fecha_prog:m.fecha,
        notas:'🎯 RADAR'+(m.canal&&RADAR_CANALES[m.canal]?' · '+RADAR_CANALES[m.canal]:'')+': '+m.descripcion.trim()+(m.hora?' ('+m.hora+')':'')+(m.hoy?' ⚡HOY':'')
      }).select().single();
      if(act){
        D.act.unshift(act);
        await db.from('radar_movimientos').update({actividad_id:act.id}).eq('id',mov.id);
        mov.actividad_id=act.id;
      }
    }catch(ex){console.error('Registro actividad:',ex);}
    D.radar_mov.push(mov);
  }
  load(false);
  radarGo('activado',rad.id);
}

// ── PANTALLA: RADAR ACTIVADO™ 🚀 ──
function radarActivadoHTML(rid){
  const r=D.radar.find(x=>x.id===rid);
  const movs=radarMovsDe(rid);
  const hoyN=movs.filter(m=>m.ejecutar_hoy).length;
  const checks=['Cuenta definida','Mapa de Poder revisado','Contactos identificados','Siguientes movimientos definidos ('+movs.length+')','Blindaje completado','Registro realizado en MMS — automático ✓',hoyN?'Acción inmediata: '+hoyN+' movimiento'+(hoyN>1?'s':'')+' para HOY ⚡':'Acción programada en agenda','Reporte: se completa el viernes al cerrar'];
  return`<div style="max-width:640px;margin:0 auto;text-align:center">
    <div class="card" style="border-color:rgba(201,168,76,0.5);background:var(--gold-bg2);padding:2rem 1.5rem">
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:34px;font-weight:800;color:var(--gold-light);letter-spacing:.04em">RADAR ACTIVADO™ 🚀</div>
      <div style="font-size:14px;color:var(--text2);margin-top:4px">${escR(r?.empresa_nombre||'')} · Semana ${r?wLabel(r.week_key):''}</div>
      <div style="text-align:left;margin:1.5rem auto 0;max-width:420px">
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--gold);margin-bottom:8px">Tablero RADAR™</div>
        ${checks.map(c=>`<div style="display:flex;gap:8px;align-items:flex-start;font-size:13px;padding:4px 0;color:var(--text)"><span style="color:var(--green)">✅</span> ${c}</div>`).join('')}
      </div>
      <div style="margin:1.5rem auto 0;max-width:420px;text-align:left;padding:14px;background:var(--bg2);border-radius:var(--radius);border:0.5px solid var(--border2)">
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--gold);margin-bottom:8px">Declaración RADAR™</div>
        <div style="font-size:13px;line-height:1.7;color:var(--text)">
          <b>No voy a esperar oportunidades.</b> Voy a provocarlas.<br>
          <b>No voy a depender de la suerte.</b> Voy a depender de un sistema.<br>
          <b>No voy a permitir que la operación secuestre mi crecimiento.</b><br>
          Voy a regresar al ataque. Voy a ejecutar. Voy a crecer.<br>
          <span style="color:var(--gold-light);font-weight:700">Voy a darle machín. 🥊</span>
        </div>
      </div>
      <button class="btn btn-primary" style="margin-top:1.5rem;font-size:15px;padding:10px 28px" onclick="radarGo('detalle','${rid}')">Ir a mis movimientos →</button>
    </div>
  </div>`;
}

// ── DETALLE / EJECUCIÓN / CIERRE ──
function radarDetalleHTML(rid){
  const r=D.radar.find(x=>x.id===rid);
  if(!r)return'<div class="empty">Radar no encontrado.</div>';
  const movs=radarMovsDe(rid).sort((a,b)=>((b.ejecutar_hoy&&b.estado==='pendiente')?1:0)-((a.ejecutar_hoy&&a.estado==='pendiente')?1:0));
  const ej=movs.filter(m=>m.estado==='ejecutado').length;
  const noEj=movs.filter(m=>m.estado==='no_ejecutado').length;
  const pend=movs.length-ej-noEj;
  const pct=movs.length?Math.round(ej/movs.length*100):0;
  const esMio=r.user_id===ME.id;
  const cerrado=r.estado==='cerrado';
  const movHTML=movs.map(m=>{
    const chip=m.estado==='ejecutado'?'<span style="font-size:10px;padding:2px 8px;background:var(--green-bg);color:var(--green);border-radius:3px;font-weight:700">✅ EJECUTADO</span>'
      :m.estado==='no_ejecutado'?'<span style="font-size:10px;padding:2px 8px;background:var(--red-bg);color:var(--red);border-radius:3px;font-weight:700">❌ NO EJECUTADO</span>'
      :'<span style="font-size:10px;padding:2px 8px;background:var(--gray-bg);color:var(--text2);border-radius:3px;font-weight:700">⏳ PENDIENTE</span>';
    return`<div class="card" style="background:var(--bg3);margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap">
        <div style="flex:1;min-width:200px">
          <div style="font-size:14px">${m.ejecutar_hoy&&m.estado==='pendiente'?'<span style="font-size:10px;padding:1px 7px;background:var(--gold);color:#111;border-radius:3px;font-weight:800;letter-spacing:.04em;margin-right:6px;vertical-align:middle">⚡ HOY</span>':''}<span style="color:var(--gold-light);font-weight:700">P${m.prioridad||1}</span> · ${escR(m.descripcion)}</div>
          <div style="font-size:12px;color:var(--text2);margin-top:4px">
            ${m.canal&&RADAR_CANALES[m.canal]?RADAR_CANALES[m.canal]+' · ':''}🛡️ ${escR(m.responsable_nombre||radarNombreMiembro(m.responsable_id))} · 📅 ${fd(m.fecha_compromiso)}${m.hora?' '+m.hora.slice(0,5):''}
            ${m.usuario_nombre?' · 👤 '+escR(m.usuario_nombre):''}${m.proyecto_nombre?' · 💼 '+escR(m.proyecto_nombre):''}
            ${m.actividad_id?' · <span style="color:var(--gold-light)">registrado en MMS ✓</span>':''}
          </div>
          ${m.resultado?`<div style="font-size:12px;margin-top:6px;padding:6px 10px;background:var(--bg2);border-radius:var(--radius);color:var(--text2)">📝 ${escR(m.resultado)}</div>`:''}
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">${chip}
          ${!cerrado&&esMio&&m.estado==='pendiente'?`<div style="display:flex;gap:6px">
            <button class="btn btn-s" style="color:var(--green)" onclick="radarMarcarMov('${m.id}','ejecutado')">✅ Ejecutado</button>
            <button class="btn btn-s" style="color:var(--red)" onclick="radarMarcarMov('${m.id}','no_ejecutado')">❌ No</button>
          </div>`:''}
          ${!cerrado&&esMio&&m.estado!=='pendiente'?`<button class="btn btn-s" style="font-size:10px" onclick="radarMarcarMov('${m.id}','pendiente')">↩ Reabrir</button>`:''}
        </div>
      </div>
    </div>`;
  }).join('');
  const cierreHTML=cerrado
    ?`<div class="card" style="border-color:rgba(99,153,34,0.35)">
        <div style="font-weight:700;color:var(--green);margin-bottom:6px">✅ Revisión de Ejecución™ completada (${pct}% de cumplimiento)</div>
        ${r.aprendizaje?`<div style="font-size:13px;color:var(--text)"><b>¿Qué aprendimos / qué ajustamos?</b><br>${escR(r.aprendizaje)}</div>`:''}
        ${r.siguiente_movimiento?`<div style="font-size:13px;color:var(--text);margin-top:8px"><b>➡️ Siguiente movimiento:</b> ${escR(r.siguiente_movimiento)}</div>`:''}
        ${esMio?`<button class="btn btn-primary" style="margin-top:10px" onclick="radarNuevoDesde('${r.empresa_id}')">🎯 Activar nuevo radar en esta cuenta</button>`:''}
      </div>`
    :esMio?`<div class="card">
        <div style="font-weight:700;margin-bottom:4px">PASO 7 — Cerrar radar · Revisión de Ejecución™</div>
        <div style="font-size:13px;color:var(--text2);margin-bottom:10px">Responde las tres preguntas: ¿qué ejecutamos? (arriba) · ¿qué aprendimos? · ¿qué vamos a ajustar? ${pend>0?`<br><span style="color:var(--red)">Aún tienes ${pend} movimiento${pend>1?'s':''} pendiente${pend>1?'s':''} por marcar.</span>`:''}</div>
        <label style="display:block;font-size:10px;color:var(--text2);text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px">¿Qué aprendimos? ¿Qué vamos a ajustar?</label>
        <textarea id="rd-aprendizaje" rows="2" style="width:100%;padding:8px 10px;font-size:13px;border:0.5px solid var(--border2);border-radius:var(--radius);background:var(--bg3);color:var(--text);resize:vertical" placeholder="Ej. Las visitas en martes funcionan mejor; el contacto clave es el jefe de mantenimiento, no compras...">${escR(r.aprendizaje||'')}</textarea>
        <label style="display:block;font-size:10px;color:var(--text2);text-transform:uppercase;letter-spacing:.04em;margin:10px 0 3px">¿Cuál es el siguiente movimiento? (arranque del próximo radar)</label>
        <textarea id="rd-siguiente" rows="2" style="width:100%;padding:8px 10px;font-size:13px;border:0.5px solid var(--border2);border-radius:var(--radius);background:var(--bg3);color:var(--text);resize:vertical" placeholder="Ej. Presentar la propuesta del contrato anual al gerente de planta">${escR(r.siguiente_movimiento||'')}</textarea>
        <div style="margin-top:10px;text-align:right"><button class="btn btn-primary"${pend>0?' disabled style="opacity:.4;cursor:not-allowed"':''} onclick="radarCerrar('${r.id}')">Cerrar radar</button></div>
      </div>`:'';
  return`<div style="max-width:860px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem;flex-wrap:wrap;gap:8px">
      <button class="btn btn-s" onclick="radarGo('lista')">← Mis radares</button>
      ${cerrado?'<span style="font-size:11px;padding:3px 10px;background:var(--green-bg);color:var(--green);border-radius:3px;font-weight:700;letter-spacing:.06em">CERRADO</span>':'<span style="font-size:11px;padding:3px 10px;background:var(--gold-bg);color:var(--gold-light);border-radius:3px;font-weight:700;letter-spacing:.06em">RADAR ACTIVADO</span>'}
    </div>
    <div class="card">
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:22px;font-weight:800">🎯 ${escR(r.empresa_nombre)}</div>
      <div style="font-size:13px;color:var(--text2)">${escR(radarNombreMiembro(r.user_id))} · Semana ${wLabel(r.week_key)}</div>
      ${r.porque?`<div style="font-size:13px;margin-top:8px;color:var(--text2)"><b style="color:var(--text)">¿Por qué esta cuenta?</b> ${escR(r.porque)}</div>`:''}
      ${r.oportunidad_vision?`<div style="font-size:13px;margin-top:6px;color:var(--text2);white-space:pre-line"><b style="color:var(--text)">Oportunidad que visualizo:</b> ${escR(r.oportunidad_vision)}</div>`:''}
      ${r.contexto?`<div style="font-size:13px;margin-top:6px;color:var(--text2)"><b style="color:var(--text)">Contexto:</b> ${escR(r.contexto)}</div>`:''}
      ${r.urgencias||r.plan_defensa?`<div style="margin-top:8px;font-size:12px;padding:8px 10px;background:var(--bg2);border:1px dashed var(--border2);border-radius:var(--radius);color:var(--text2)">🛡️ <b style="color:var(--text)">Plan de defensa:</b> ${r.urgencias?'Me secuestran: '+escR(r.urgencias)+'. ':''}${r.plan_defensa?'Cuando aparezcan: '+escR(r.plan_defensa):''}</div>`:''}
      ${r.obstaculo?`<div style="margin-top:8px;font-size:13px;padding:8px 10px;background:var(--amber-bg);border-radius:var(--radius)">🧱 <b>Obstáculo / necesito de mi director:</b> ${escR(r.obstaculo)}</div>`:''}
      <div style="margin-top:12px;display:flex;gap:14px;font-size:13px;flex-wrap:wrap">
        <span style="color:var(--green)">✅ ${ej} ejecutados</span><span style="color:var(--red)">❌ ${noEj} no ejecutados</span><span style="color:var(--text2)">⏳ ${pend} pendientes</span><span style="color:var(--gold-light);font-weight:700">${pct}% cumplimiento</span>
      </div>
      <div style="margin-top:8px;height:6px;background:var(--bg3);border-radius:3px;overflow:hidden"><div style="height:100%;width:${pct}%;background:var(--gold)"></div></div>
    </div>
    ${!cerrado&&movs.some(m=>m.ejecutar_hoy&&m.estado==='pendiente')?`<div class="card" style="border-color:rgba(201,168,76,0.5);background:var(--gold-bg2);margin-top:14px">
      <div style="font-weight:800;color:var(--gold-light)">⚡ ACCIÓN INMEDIATA — el momento de la verdad</div>
      <div style="font-size:13px;color:var(--text2);margin-top:4px">Regla de Acción™: si puede hacerse hoy, se hace hoy. Ningún movimiento se queda sin dueño, sin fecha ni sin ejecución. Tienes ${movs.filter(m=>m.ejecutar_hoy&&m.estado==='pendiente').length} movimiento${movs.filter(m=>m.ejecutar_hoy&&m.estado==='pendiente').length>1?'s':''} marcado${movs.filter(m=>m.ejecutar_hoy&&m.estado==='pendiente').length>1?'s':''} para HOY — están destacados abajo.</div>
    </div>`:''}
    <div style="font-family:'Barlow Condensed',sans-serif;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--text2);margin:14px 0 8px">Paso 6 — Acción™ · Movimientos de la semana</div>
    ${movHTML||'<div class="empty">Sin movimientos.</div>'}
    ${cierreHTML}
  </div>`;
}
async function radarMarcarMov(mid,estado){
  const m=D.radar_mov.find(x=>x.id===mid);if(!m)return;
  let resultado=m.resultado||null;
  if(estado==='ejecutado'){resultado=prompt('¿Cuál fue el resultado de este movimiento?',m.resultado||'')||null;}
  if(estado==='no_ejecutado'){resultado=prompt('¿Por qué no se ejecutó? (se retomará la próxima semana)',m.resultado||'')||null;}
  if(estado==='pendiente')resultado=null;
  load(true);
  const{error}=await db.from('radar_movimientos').update({estado,resultado}).eq('id',mid);
  load(false);
  if(error)return alert(error.message);
  m.estado=estado;m.resultado=resultado;
  renderRadar();
}
async function radarCerrar(rid){
  const r=D.radar.find(x=>x.id===rid);if(!r)return;
  const movs=radarMovsDe(rid);
  if(movs.some(m=>m.estado==='pendiente'))return alert('Marca todos los movimientos como ejecutados o no ejecutados antes de cerrar.');
  const ap=document.getElementById('rd-aprendizaje')?.value.trim();
  const sig=document.getElementById('rd-siguiente')?.value.trim()||null;
  if(!ap)return alert('La Revisión de Ejecución™ requiere responder: ¿qué aprendimos y qué vamos a ajustar?');
  load(true);
  const{error}=await db.from('radares').update({estado:'cerrado',aprendizaje:ap,siguiente_movimiento:sig,cerrado_at:new Date().toISOString()}).eq('id',rid);
  load(false);
  if(error)return alert(error.message);
  r.estado='cerrado';r.aprendizaje=ap;r.siguiente_movimiento=sig;r.cerrado_at=new Date().toISOString();
  renderRadar();
}
function radarNuevoDesde(eid){
  rw={paso:1,empresa_id:eid,contexto:'',porque:'',vision:'',urgencias:'',defensa:'',obstaculo:'',movs:[radarMovVacio()]};
  radarGo('wizard');
}
// ══════════════════════════════════════════════
