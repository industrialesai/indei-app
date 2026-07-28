// ══════════════════════════════════════════════
// FASE C · Blindaje de datos — Archivar empresas + renombrado en cascada
// Módulo de extensión del MMS. Cargado en cadena por faseb.js.
// ══════════════════════════════════════════════

const fce=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
let _fcEmpArch=[];

// ── 1. ARCHIVAR EN LUGAR DE BORRAR ──
function fcSepararArchivadas(){
  _fcEmpArch=(D.emp||[]).filter(e=>e.archivada);
  D.emp=(D.emp||[]).filter(e=>!e.archivada);
}
const _fcLoadAll=loadAll;
loadAll=async function(){
  await _fcLoadAll();
  try{fcSepararArchivadas();}catch(e){console.error('fasec loadAll:',e);}
};
// Si el módulo cargó después del arranque, filtrar de inmediato
try{if(D.emp&&D.emp.length&&D.emp.some(e=>e.archivada)){fcSepararArchivadas();}}catch(e){}

delEmp=async function(id){
  const emp=D.emp.find(e=>e.id===id);if(!emp)return;
  if(confirm('📦 ¿ARCHIVAR "'+emp.nombre+'"?\n\nRecomendado: desaparece de las vistas pero conserva TODO su histórico (actividades, oportunidades, seguimientos, radares) y puedes restaurarla cuando quieras.\n\n• Aceptar = Archivar (seguro)\n• Cancelar = ver opción de borrado definitivo')){
    load(true);
    const{error}=await db.from('empresas').update({archivada:true}).eq('id',id);
    load(false);
    if(error)return alert(error.message+'\n\n¿Ya corriste el SQL de la Fase C en Supabase?');
    emp.archivada=true;_fcEmpArch.push(emp);
    D.emp=D.emp.filter(e=>e.id!==id);
    rMapa();return;
  }
  if(!confirm('⚠️ ¿ELIMINAR DEFINITIVAMENTE "'+emp.nombre+'" con TODO su histórico?\n\nEsta acción NO se puede deshacer. Si tienes duda, usa Archivar.'))return;
  load(true);await db.from('empresas').delete().eq('id',id);
  D.emp=D.emp.filter(e=>e.id!==id);D.usu=D.usu.filter(u=>u.empresa_id!==id);D.act=D.act.filter(a=>a.empresa_id!==id);
  load(false);rMapa();
};

// Bloque de archivadas al final del mapa
const _fcrMapa=rMapa;
rMapa=function(){
  _fcrMapa();
  try{fcArchivadasUI();}catch(e){console.error('fasec ui:',e);}
};
function fcArchivadasUI(){
  const page=document.getElementById('page-mapa');
  if(!page||!_fcEmpArch.length||page.querySelector('#fc-arch'))return;
  const html='<div id="fc-arch" style="margin-top:1.25rem"><details><summary style="cursor:pointer;font-size:12px;color:var(--text2);letter-spacing:.04em">📦 EMPRESAS ARCHIVADAS ('+_fcEmpArch.length+')</summary><div style="margin-top:8px">'
    +_fcEmpArch.map(e=>'<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 12px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);margin-bottom:6px;font-size:13px;flex-wrap:wrap"><span>🏭 '+fce(e.nombre)+'<span style="color:var(--text3);font-size:11px"> · histórico conservado</span></span><button class="btn btn-sm" onclick="fcRestaurar(\''+e.id+'\')">↩ Restaurar</button></div>').join('')
    +'</div></details></div>';
  page.insertAdjacentHTML('beforeend',html);
}
async function fcRestaurar(id){
  load(true);
  const{error}=await db.from('empresas').update({archivada:false}).eq('id',id);
  load(false);
  if(error)return alert(error.message);
  const emp=_fcEmpArch.find(e=>e.id===id);
  if(emp){emp.archivada=false;D.emp.push(emp);_fcEmpArch=_fcEmpArch.filter(e=>e.id!==id);}
  rMapa();
}

// ── 2. RENOMBRADO EN CASCADA ──
// Empresa: al guardar el perfil con nombre nuevo, actualizar el histórico denormalizado
const _fcGuardarPerfil=m2GuardarPerfil;
m2GuardarPerfil=async function(eid){
  const antes=(D.emp.find(e=>e.id===eid)||{}).nombre;
  await _fcGuardarPerfil(eid);
  const despues=(D.emp.find(e=>e.id===eid)||{}).nombre;
  if(antes&&despues&&antes!==despues){
    for(const t of ['actividades','proyectos','seguimientos','radares']){
      const{error}=await db.from(t).update({empresa_nombre:despues}).eq('empresa_id',eid);
      if(error)console.warn('cascada '+t+':',error.message);
    }
    (D.act||[]).forEach(a=>{if(a.empresa_id===eid)a.empresa_nombre=despues;});
    (D.proy||[]).forEach(p=>{if(p.empresa_id===eid)p.empresa_nombre=despues;});
    (D.seg||[]).forEach(s=>{if(s.empresa_id===eid)s.empresa_nombre=despues;});
    (D.radar||[]).forEach(r=>{if(r.empresa_id===eid)r.empresa_nombre=despues;});
  }
};
// Usuario: al guardar edición con nombre nuevo, actualizar el histórico
const _fcEuGuardar=euGuardar;
euGuardar=async function(el){
  const uid=el.dataset.uid;
  const antes=(D.usu.find(u=>u.id===uid)||{}).nombre;
  await _fcEuGuardar(el);
  const despues=(D.usu.find(u=>u.id===uid)||{}).nombre;
  if(antes&&despues&&antes!==despues){
    for(const t of ['actividades','seguimientos','radar_movimientos']){
      const{error}=await db.from(t).update({usuario_nombre:despues}).eq('usuario_id',uid);
      if(error)console.warn('cascada '+t+':',error.message);
    }
    (D.act||[]).forEach(a=>{if(a.usuario_id===uid)a.usuario_nombre=despues;});
    (D.seg||[]).forEach(s=>{if(s.usuario_id===uid)s.usuario_nombre=despues;});
    (D.radar_mov||[]).forEach(m=>{if(m.usuario_id===uid)m.usuario_nombre=despues;});
  }
};
console.log('✅ Fase C (archivado + renombrado en cascada) cargada');
// ── Cargar siguiente módulo de la cadena ──
(function(){const s=document.createElement('script');s.src='gobierno.js';s.onerror=()=>console.warn('Módulo no encontrado: gobierno.js');document.body.appendChild(s);})();
// ══════════════════════════════════════════════
