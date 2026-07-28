// ══════════════════════════════════════════════
// MAPA DEL ÉXITO v2 · Fase A — Perfil de empresa + Contactos + Mapa de Poder™
// Módulo de extensión del MMS. Cargado por radar.js. No modifica el núcleo.
// ══════════════════════════════════════════════

const M2_NIVELES={profesional:{e:'🔴',t:'Profesional'},amistoso:{e:'🟡',t:'Amistoso'},fuerte:{e:'🟢',t:'Relación fuerte'}};
const m2e=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const m2inp='width:100%;padding:8px 10px;font-size:13px;border:0.5px solid var(--border2);border-radius:var(--radius);background:var(--bg2);color:var(--text)';
function m2Tel(t){return String(t||'').replace(/[^0-9+]/g,'');}

// ── A. EMPRESA: formulario de alta enriquecido ──
showEF=function(){
  const c=document.getElementById('ef-container');
  if(c.innerHTML){c.innerHTML='';return;}
  c.innerHTML=m2FormEmpHTML(null);
  document.getElementById('m2ef-n').focus();
};
function m2FormEmpHTML(emp){
  const e=emp||{};
  const corps=D.emp.filter(x=>x.tipo_empresa==='corporativo'&&x.id!==e.id);
  return `<div style="background:#0a0a0a;border-left:3px solid var(--gold);border-radius:0 var(--radius-lg) var(--radius-lg) 0;padding:1.25rem 1.5rem;margin-top:10px;margin-bottom:1rem">
    <div style="font-size:14px;font-weight:500;color:var(--gold);margin-bottom:14px">${emp?'Perfil de la empresa':'Nueva empresa'}</div>
    <div class="grid g3" style="margin-bottom:10px">
      <div><label>Nombre de la empresa *</label><input id="m2ef-n" placeholder="Ej: JABIL" value="${m2e(e.nombre||'')}"></div>
      <div><label>Tipo</label><select id="m2ef-tipo" onchange="document.getElementById('m2ef-matriz-wrap').style.display=this.value==='planta'?'block':'none'">
        <option value="">— Sin especificar —</option>
        <option value="corporativo"${e.tipo_empresa==='corporativo'?' selected':''}>🏢 Corporativo</option>
        <option value="planta"${e.tipo_empresa==='planta'?' selected':''}>🏭 Planta</option>
      </select></div>
      <div id="m2ef-matriz-wrap" style="display:${e.tipo_empresa==='planta'?'block':'none'}"><label>Corporativo al que pertenece</label>
        <select id="m2ef-matriz"><option value="">— Ninguno / no registrado —</option>${corps.map(x=>`<option value="${x.id}"${e.matriz_id===x.id?' selected':''}>${m2e(x.nombre)}</option>`).join('')}</select></div>
    </div>
    <div class="grid g3" style="margin-bottom:10px">
      <div><label>Giro / Industria</label><input id="m2ef-giro" placeholder="Ej: Automotriz, Electrónica..." value="${m2e(e.giro||'')}"></div>
      <div><label>Ciudad</label><input id="m2ef-ciudad" placeholder="Ej: Chihuahua" value="${m2e(e.ciudad||'')}"></div>
      <div><label>Estado</label><input id="m2ef-estado" placeholder="Ej: Chihuahua" value="${m2e(e.estado||'')}"></div>
    </div>
    <div class="grid g2" style="margin-bottom:10px">
      <div><label>Sitio web</label><input id="m2ef-web" placeholder="Ej: jabil.com" value="${m2e(e.sitio_web||'')}"></div>
      <div><label>Notas del perfil</label><input id="m2ef-notas" placeholder="Ej: 3 líneas de producción, turno 24/7..." value="${m2e(e.perfil_notas||'')}"></div>
    </div>
    <div style="display:flex;justify-content:flex-end;gap:8px">
      <button class="btn" onclick="document.getElementById('ef-container').innerHTML=''">Cancelar</button>
      <button class="btn btn-primary" onclick="${emp?`m2GuardarPerfil('${e.id}')`:'saveEmp()'}">${emp?'Guardar perfil':'Agregar empresa'}</button>
    </div>
  </div>`;
}
function m2LeerFormEmp(){
  const g=id=>document.getElementById(id);
  const tipo=g('m2ef-tipo')?.value||null;
  return{
    nombre:g('m2ef-n')?.value.trim(),
    tipo_empresa:tipo,
    matriz_id:tipo==='planta'?(g('m2ef-matriz')?.value||null):null,
    giro:g('m2ef-giro')?.value.trim()||null,
    ciudad:g('m2ef-ciudad')?.value.trim()||null,
    estado:g('m2ef-estado')?.value.trim()||null,
    sitio_web:g('m2ef-web')?.value.trim()||null,
    perfil_notas:g('m2ef-notas')?.value.trim()||null
  };
}
saveEmp=async function(){
  const f=m2LeerFormEmp();
  if(!f.nombre)return alert('Escribe el nombre');
  load(true);
  const{data,error}=await db.from('empresas').insert(Object.assign({org_id:ORG.id},f)).select().single();
  load(false);
  if(error)return alert(error.message);
  D.emp.push(data);document.getElementById('ef-container').innerHTML='';rMapa();
};
function m2EditarPerfil(eid){
  const emp=D.emp.find(x=>x.id===eid);if(!emp)return;
  const c=document.getElementById('ef-container');
  c.innerHTML=m2FormEmpHTML(emp);
  c.scrollIntoView({behavior:'smooth',block:'start'});
}
async function m2GuardarPerfil(eid){
  const f=m2LeerFormEmp();
  if(!f.nombre)return alert('Escribe el nombre');
  load(true);
  const{error}=await db.from('empresas').update(f).eq('id',eid);
  load(false);
  if(error)return alert(error.message);
  const emp=D.emp.find(x=>x.id===eid);if(emp)Object.assign(emp,f);
  document.getElementById('ef-container').innerHTML='';rMapa();
}

// ── B. DECORACIÓN DEL MAPA: perfil visible + acciones de contacto ──
const _m2rMapaOrig=rMapa;
rMapa=function(){
  _m2rMapaOrig();
  try{m2Decorar();}catch(e){console.error('mapa2 decorar:',e);}
};
function m2PerfilLineaHTML(emp){
  const b=[];
  if(emp.tipo_empresa==='corporativo')b.push('🏢 Corporativo');
  if(emp.tipo_empresa==='planta'){
    const mat=emp.matriz_id?D.emp.find(x=>x.id===emp.matriz_id):null;
    b.push('🏭 Planta'+(mat?' de <b>'+m2e(mat.nombre)+'</b>':''));
  }
  if(emp.tipo_empresa==='corporativo'){
    const plantas=D.emp.filter(x=>x.matriz_id===emp.id);
    if(plantas.length)b.push('🔗 '+plantas.length+' planta'+(plantas.length>1?'s':'')+' registrada'+(plantas.length>1?'s':''));
  }
  if(emp.giro)b.push('⚙️ '+m2e(emp.giro));
  if(emp.ciudad||emp.estado)b.push('📍 '+m2e([emp.ciudad,emp.estado].filter(Boolean).join(', ')));
  if(emp.sitio_web){const url=emp.sitio_web.startsWith('http')?emp.sitio_web:'https://'+emp.sitio_web;b.push('🌐 <a href="'+m2e(url)+'" target="_blank" rel="noopener" style="color:var(--gold-light)" onclick="event.stopPropagation()">'+m2e(emp.sitio_web)+'</a>');}
  if(emp.perfil_notas)b.push('📝 '+m2e(emp.perfil_notas));
  return b.length?`<div class="m2-perfil" style="font-size:12px;color:var(--text2);margin:-2px 0 10px 0;display:flex;flex-wrap:wrap;gap:4px 14px">${b.map(x=>'<span>'+x+'</span>').join('')}</div>`:'';
}
function m2ContactoIconos(u){
  const a=[];
  if(u.correo)a.push('<a href="mailto:'+m2e(u.correo)+'" title="'+m2e(u.correo)+'" style="text-decoration:none" onclick="event.stopPropagation()">📧</a>');
  if(u.telefono)a.push('<a href="tel:'+m2Tel(u.telefono)+'" title="'+m2e(u.telefono)+(u.extension?' ext. '+m2e(u.extension):'')+'" style="text-decoration:none" onclick="event.stopPropagation()">📞</a>');
  if(u.whatsapp)a.push('<a href="https://wa.me/'+m2Tel(u.whatsapp)+'" target="_blank" rel="noopener" title="WhatsApp '+m2e(u.whatsapp)+'" style="text-decoration:none" onclick="event.stopPropagation()">💬</a>');
  return a.join(' ');
}
function m2PoderIconos(u){
  const a=[];
  if(u.es_principal)a.push('<span title="Contacto principal de la cuenta">⭐</span>');
  if(u.nivel_relacion&&M2_NIVELES[u.nivel_relacion])a.push('<span title="'+M2_NIVELES[u.nivel_relacion].t+'">'+M2_NIVELES[u.nivel_relacion].e+'</span>');
  if(u.conoce_oportunidad)a.push('<span title="Ya conoce nuestra oportunidad">🟦</span>');
  if(u.knockout_pendiente)a.push('<span title="Knockout pendiente: pedir referencia">🥊</span>');
  return a.join(' ');
}
function m2Decorar(){
  const page=document.getElementById('page-mapa');
  if(!page)return;
  // Perfil por tarjeta de empresa (ancla: botón delEmp)
  page.querySelectorAll('button[onclick^="delEmp("]').forEach(btn=>{
    const eid=(btn.getAttribute('onclick').match(/delEmp\('([^']+)'\)/)||[])[1];
    const emp=D.emp.find(x=>x.id===eid);if(!emp)return;
    const header=btn.closest('.flex-between');if(!header)return;
    // Botón "Perfil" junto a "Eliminar"
    if(!header.querySelector('.m2-btn-perfil')){
      const bp=document.createElement('button');
      bp.className='btn btn-sm m2-btn-perfil';
      bp.textContent='✏️ Perfil';
      bp.setAttribute('onclick',"m2EditarPerfil('"+eid+"')");
      btn.parentNode.insertBefore(bp,btn);
      btn.parentNode.insertBefore(document.createTextNode(' '),btn);
    }
    // Línea de perfil bajo el encabezado
    if(!header.nextElementSibling||!header.nextElementSibling.classList||!header.nextElementSibling.classList.contains('m2-perfil')){
      const linea=m2PerfilLineaHTML(emp);
      if(linea)header.insertAdjacentHTML('afterend',linea);
    }
  });
  // Iconos de contacto y poder por fila de usuario (anclas: editarUsuario / editarKO)
  page.querySelectorAll('button[onclick^="editarUsuario("],button[onclick^="editarKO("]').forEach(btn=>{
    const uid=(btn.getAttribute('onclick').match(/\('([^']+)'/)||[])[1];
    const u=D.usu.find(x=>x.id===uid);if(!u)return;
    const tr=btn.closest('tr');if(!tr||tr.querySelector('.m2-chips'))return;
    const nombreTd=tr.querySelector('td');if(!nombreTd)return;
    const chips=m2PoderIconos(u)+(m2PoderIconos(u)&&m2ContactoIconos(u)?' · ':'')+m2ContactoIconos(u);
    if(chips)nombreTd.insertAdjacentHTML('beforeend',' <span class="m2-chips" style="font-size:12px;margin-left:4px">'+chips+'</span>');
    else nombreTd.insertAdjacentHTML('beforeend','<span class="m2-chips"></span>');
  });
}

// ── C. CONTACTO + MAPA DE PODER en formularios de usuario ──
function m2ExtrasFormHTML(pref,u){
  u=u||{};
  return `<div class="m2-extras" style="margin:12px 0;padding:12px 14px;background:var(--bg2);border:1px solid var(--border2);border-radius:var(--radius)">
    <div style="font-size:11px;font-weight:700;letter-spacing:.05em;color:var(--gold);text-transform:uppercase;margin-bottom:8px">📇 Datos de contacto</div>
    <div class="grid g3" style="margin-bottom:8px">
      <div><label>Puesto</label><input id="${pref}-puesto" placeholder="Ej: Gerente de Mantenimiento" value="${m2e(u.puesto||'')}" style="${m2inp}"></div>
      <div><label>Correo</label><input id="${pref}-correo" type="email" placeholder="nombre@empresa.com" value="${m2e(u.correo||'')}" style="${m2inp}"></div>
      <div><label>WhatsApp</label><input id="${pref}-wa" placeholder="Ej: +52 614 123 4567" value="${m2e(u.whatsapp||'')}" style="${m2inp}"></div>
    </div>
    <div class="grid g3" style="margin-bottom:12px">
      <div><label>Teléfono</label><input id="${pref}-tel" placeholder="Ej: 614 123 4567" value="${m2e(u.telefono||'')}" style="${m2inp}"></div>
      <div><label>Extensión</label><input id="${pref}-ext" placeholder="Ej: 2201" value="${m2e(u.extension||'')}" style="${m2inp}"></div>
      <div></div>
    </div>
    <div style="font-size:11px;font-weight:700;letter-spacing:.05em;color:var(--gold);text-transform:uppercase;margin-bottom:8px">🥊 Mapa de Poder™</div>
    <div class="grid g4">
      <div><label>Nivel de relación</label><select id="${pref}-nivel" style="${m2inp}">
        <option value="">— Sin definir —</option>
        <option value="profesional"${u.nivel_relacion==='profesional'?' selected':''}>🔴 Profesional</option>
        <option value="amistoso"${u.nivel_relacion==='amistoso'?' selected':''}>🟡 Amistoso</option>
        <option value="fuerte"${u.nivel_relacion==='fuerte'?' selected':''}>🟢 Relación fuerte</option>
      </select></div>
      <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;padding-top:16px"><input type="checkbox" id="${pref}-conoce"${u.conoce_oportunidad?' checked':''} style="accent-color:var(--gold)"> 🟦 Ya conoce nuestra oportunidad</label>
      <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;padding-top:16px"><input type="checkbox" id="${pref}-kopend"${u.knockout_pendiente?' checked':''} style="accent-color:var(--gold)"> 🥊 Knockout pendiente</label>
      <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;padding-top:16px"><input type="checkbox" id="${pref}-principal"${u.es_principal?' checked':''} style="accent-color:var(--gold)"> ⭐ Contacto principal</label>
    </div>
  </div>`;
}
function m2LeerExtras(pref){
  const g=id=>document.getElementById(id);
  if(!g(pref+'-puesto'))return null;
  return{
    puesto:g(pref+'-puesto').value.trim()||null,
    correo:g(pref+'-correo').value.trim()||null,
    whatsapp:g(pref+'-wa').value.trim()||null,
    telefono:g(pref+'-tel').value.trim()||null,
    extension:g(pref+'-ext').value.trim()||null,
    nivel_relacion:g(pref+'-nivel').value||null,
    conoce_oportunidad:g(pref+'-conoce').checked,
    knockout_pendiente:g(pref+'-kopend').checked,
    es_principal:g(pref+'-principal').checked
  };
}
async function m2AplicarExtras(uid,extras){
  if(!extras)return;
  const{error}=await db.from('usuarios').update(extras).eq('id',uid);
  if(error){console.error('extras:',error);return;}
  const u=D.usu.find(x=>x.id===uid);
  if(u)Object.assign(u,extras);
  if(extras.es_principal&&u){ // solo un principal por empresa
    const otros=D.usu.filter(x=>x.empresa_id===u.empresa_id&&x.id!==uid&&x.es_principal);
    for(const o of otros){await db.from('usuarios').update({es_principal:false}).eq('id',o.id);o.es_principal=false;}
  }
}
// Alta de usuario: inyectar extras al formulario y guardarlos tras el insert
const _m2showUF=showUF;
showUF=function(eid){
  _m2showUF(eid);
  try{
    const form=document.getElementById('uform-'+eid);
    if(form&&form.innerHTML&&!form.querySelector('.m2-extras')){
      const gk=document.getElementById('ugk-'+eid);
      const ancla=gk?gk.closest('div[style*="margin-bottom"]')||gk.parentElement:null;
      const html=m2ExtrasFormHTML('m2u-'+eid,null);
      if(ancla&&ancla.parentElement)ancla.insertAdjacentHTML('beforebegin',html);
      else if(form.firstElementChild)form.firstElementChild.insertAdjacentHTML('beforeend',html);
    }
  }catch(e){console.error('mapa2 showUF:',e);}
};
const _m2saveU=saveU;
saveU=async function(eid){
  const extras=m2LeerExtras('m2u-'+eid);
  const antes=D.usu.length;
  await _m2saveU(eid);
  if(D.usu.length>antes){
    const nuevo=D.usu[D.usu.length-1];
    await m2AplicarExtras(nuevo.id,extras);
    rMapa();
  }
};
// Edición de usuario activo: inyectar extras con valores actuales y guardarlos junto
const _m2editarUsuario=editarUsuario;
editarUsuario=function(uid,eid){
  _m2editarUsuario(uid,eid);
  try{
    const form=document.getElementById('uform-'+eid);
    const u=D.usu.find(x=>x.id===uid);
    if(form&&form.innerHTML&&u&&!form.querySelector('.m2-extras')){
      const btnG=form.querySelector('button[onclick^="euGuardar"]');
      const fila=btnG?btnG.closest('.flex-end'):null;
      const html=m2ExtrasFormHTML('m2e-'+uid,u);
      if(fila)fila.insertAdjacentHTML('beforebegin',html);
    }
  }catch(e){console.error('mapa2 editarUsuario:',e);}
};
const _m2euGuardar=euGuardar;
euGuardar=async function(el){
  const uid=el.dataset.uid;
  const extras=m2LeerExtras('m2e-'+uid);
  await _m2euGuardar(el);
  if(extras){await m2AplicarExtras(uid,extras);rMapa();}
};
// Edición de KO/Prospecto: mini-form de contacto con guardado propio (sin convertir a activo)
const _m2editarKO=editarKO;
editarKO=async function(uid,eid){
  await _m2editarKO(uid,eid);
  try{
    const form=document.getElementById('uform-'+eid);
    const u=D.usu.find(x=>x.id===uid);
    if(form&&form.innerHTML&&u&&!form.querySelector('.m2-extras')){
      const btnC=form.querySelector('button[onclick^="koDatosGuardar"]');
      const fila=btnC?btnC.closest('.flex-end'):null;
      const html=m2ExtrasFormHTML('m2k-'+uid,u)+`<div style="text-align:right;margin:-4px 0 10px"><button class="btn btn-sm" onclick="m2GuardarExtrasKO('${uid}','${eid}')">💾 Guardar solo datos de contacto</button></div>`;
      if(fila)fila.insertAdjacentHTML('beforebegin',html);
    }
  }catch(e){console.error('mapa2 editarKO:',e);}
};
async function m2GuardarExtrasKO(uid,eid){
  const extras=m2LeerExtras('m2k-'+uid);
  load(true);await m2AplicarExtras(uid,extras);load(false);
  const f=document.getElementById('uform-'+eid);if(f)f.innerHTML='';
  rMapa();
}

// ── D. RADAR Paso 2: Mapa de Poder™ enriquecido ──
if(typeof radarPaso2HTML==='function'){
  radarPaso2HTML=function(){
    const us=D.usu.filter(u=>u.empresa_id===rw.empresa_id);
    const emp=D.emp.find(e=>e.id===rw.empresa_id)||{};
    const grupos={activo:{t:'🟡 Contactos activos (ya te compran)',arr:[]},knockout:{t:'🥊 Knockouts (referenciados)',arr:[]},prospecto:{t:'🎯 Prospectos (prospección propia)',arr:[]}};
    us.forEach(u=>{(grupos[u.tipo_usuario||'activo']||grupos.activo).arr.push(u);});
    const chip=u=>{
      const pod=m2PoderIconos(u),con=m2ContactoIconos(u);
      return `<span style="padding:6px 12px;background:var(--bg3);border:1px solid ${u.es_principal?'rgba(201,168,76,0.5)':'var(--border2)'};border-radius:var(--radius);font-size:13px">${pod?pod+' ':''}${m2e(u.nombre)}${u.puesto?`<span style="color:var(--text3)"> · ${m2e(u.puesto)}</span>`:u.area?`<span style="color:var(--text3)"> · ${m2e(u.area)}</span>`:''}${con?' '+con:''}</span>`;
    };
    const bloques=Object.values(grupos).map(g=>g.arr.length?`<div style="margin-bottom:12px">
      <div style="font-size:12px;font-weight:700;letter-spacing:.04em;color:var(--text2);margin-bottom:6px">${g.t}</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">${g.arr.map(chip).join('')}</div>
    </div>`:'').join('');
    const sinKO=us.filter(u=>u.knockout_pendiente);
    const sinConocer=us.filter(u=>!u.conoce_oportunidad&&(u.tipo_usuario||'activo')==='activo');
    const analisis=[];
    if(us.some(u=>u.es_principal))analisis.push('⭐ Principal: <b>'+m2e(us.find(u=>u.es_principal).nombre)+'</b>');
    if(sinKO.length)analisis.push('🥊 Knockouts pendientes: '+sinKO.map(u=>m2e(u.nombre)).join(', '));
    if(sinConocer.length)analisis.push('🟪 Aún no conocen tu oportunidad: '+sinConocer.map(u=>m2e(u.nombre)).join(', '));
    return`<div class="card">
      <div style="font-weight:700;margin-bottom:4px">PASO 2 — Mapa de Poder™ de ${m2e(emp.nombre||'')}</div>
      <div style="font-size:13px;color:var(--text2);margin-bottom:8px">Leyenda: 🔴 profesional · 🟡 amistoso · 🟢 fuerte · 🟦 conoce la oportunidad · 🥊 knockout pendiente · ⭐ principal</div>
      ${us.length?bloques:'<div class="empty">Esta cuenta no tiene contactos registrados aún.</div>'}
      ${analisis.length?`<div style="margin-top:10px;padding:10px 12px;background:var(--gold-bg2);border-radius:var(--radius);font-size:13px;display:flex;flex-direction:column;gap:4px">${analisis.map(a=>'<span>'+a+'</span>').join('')}</div>`:''}
      <div style="font-size:12px;color:var(--text3);margin-top:8px">Para editar contactos o su Mapa de Poder usa el <a href="#" onclick="go('mapa');return false" style="color:var(--gold-light)">Mapa del Éxito</a>.</div>
      <div style="margin-top:14px;display:flex;justify-content:space-between">
        <button class="btn btn-s" onclick="rw.paso=1;renderRadar()">← Atrás</button>
        <button class="btn btn-primary" onclick="rw.paso=3;renderRadar()">Siguiente: Movimientos →</button>
      </div>
    </div>`;
  };
}
console.log('✅ Mapa del Éxito v2 cargado');
// ══════════════════════════════════════════════
