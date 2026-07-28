// ══════════════════════════════════════════════
// GOBIERNO COMERCIAL™ · El tablero del dueño — junta semanal de los lunes
// SOLO visible para perfil dueño (y SuperAdmin). Cargado en cadena por fasec.js.
// ══════════════════════════════════════════════

const gbe=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const GOB_METODOLOGIAS=[
  {k:'ordenes_compra',n:'Sistema de Órdenes de Compra™'},
  {k:'arbol_ventas',n:'Árbol de Ventas Industriales™'},
  {k:'trafico_empresas',n:'Tráfico de las Empresas Industriales™'},
  {k:'piramide_reciprocidad',n:'Pirámide de la Reciprocidad™'},
  {k:'formuleada_1',n:'formuleada™ 1.0'},
  {k:'formuleada_2',n:'formuleada™ 2.0'},
  {k:'moneymaker',n:'MoneyMaker System™'},
  {k:'protocolo_radar',n:'Protocolo RADAR™'},
  {k:'torpedo',n:'TORPEDO™'},
  {k:'circulo_amistad',n:'Círculo de la Amistad™'},
  {k:'avatar',n:'Avatar™'},
  {k:'escalera_valor',n:'Escalera de Valor™'},
  {k:'nueva_oportunidad',n:'Nueva Oportunidad™'}
];
let GOB={cargado:false,orgId:null,met:[],junta:null,seg:{},juntaIdx:0,modoJunta:false,historial:[]};

function gobEsDueno(){return (typeof MI_ROL!=='undefined'&&MI_ROL==='dueno')||(typeof IS_SUPERADMIN!=='undefined'&&IS_SUPERADMIN);}

// ── INTEGRACIÓN: página + botón (solo dueño) + ruteo ──
(function gobIntegrar(){
  PAGE_TITLES.gobierno='Gobierno Comercial™';
  const body=document.querySelector('.content-body');
  if(body&&!document.getElementById('page-gobierno')){
    const d=document.createElement('div');d.id='page-gobierno';d.className='page';
    body.appendChild(d);
  }
  const _gGo=go;
  go=function(p){
    gobAsegurarBoton();
    if(p==='gobierno'){
      if(!gobEsDueno())return _gGo('inicio');
      document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));
      const pg=document.getElementById('page-gobierno');if(pg)pg.classList.add('active');
      const t=document.getElementById('page-title');if(t)t.textContent='Gobierno Comercial™';
      if(window.innerWidth<=768)closeSidebar();
      document.querySelectorAll('.sb-item').forEach(x=>x.classList.remove('sb-active'));
      const b=document.getElementById('sb-gob-btn');if(b)b.classList.add('sb-active');
      renderGobierno();
      return;
    }
    _gGo(p);
  };
})();
function gobAsegurarBoton(){
  if(!gobEsDueno())return;
  if(document.getElementById('sb-gob-btn'))return;
  const nav=document.querySelector('.sb-nav');if(!nav)return;
  const btn=document.createElement('button');
  btn.className='sb-item';btn.id='sb-gob-btn';
  btn.setAttribute('onclick',"go('gobierno')");
  btn.innerHTML='<span class="sb-icon">👑</span><span class="sb-label">Gobierno Comercial</span>';
  const radarBtn=document.getElementById('sb-radar-btn');
  if(radarBtn&&radarBtn.nextSibling)nav.insertBefore(btn,radarBtn.nextSibling);
  else nav.appendChild(btn);
}

// ── DATOS ──
async function gobCargar(force){
  if(GOB.cargado&&!force&&GOB.orgId===ORG?.id)return;
  await radarCargarDatos(true);
  const wk=radarWeekMon();
  const[{data:met},{data:juntas}]=await Promise.all([
    db.from('vendedor_metodologias').select('*').eq('org_id',ORG.id),
    db.from('gobierno_juntas').select('*').eq('org_id',ORG.id).order('week_key',{ascending:false}).limit(12)
  ]);
  GOB.met=met||[];
  GOB.historial=juntas||[];
  GOB.junta=(juntas||[]).find(j=>j.week_key===wk)||null;
  // Seguimientos 3x3 retrasados por vendedor
  GOB.seg={};
  const segsAct=(D.seg||[]).filter(s=>s.estado==='activo');
  if(segsAct.length){
    const{data:cons}=await db.from('seguimiento_contactos').select('*').in('seguimiento_id',segsAct.map(s=>s.id));
    segsAct.forEach(s=>{
      const c=(cons||[]).filter(x=>x.seguimiento_id===s.id);
      const ret=countSegRetrasados(s,c);
      const uid=s.user_id||s.registrado_por||'—';
      if(!GOB.seg[uid])GOB.seg[uid]={activos:0,retrasados:0};
      GOB.seg[uid].activos++;GOB.seg[uid].retrasados+=ret;
    });
  }
  GOB.cargado=true;GOB.orgId=ORG.id;
}
function gobMetDomina(uid,k){const m=GOB.met.find(x=>x.user_id===uid&&x.metodologia===k);return!!(m&&m.dominada);}
async function gobToggleMet(uid,k){
  const actual=gobMetDomina(uid,k);
  const{error}=await db.from('vendedor_metodologias').upsert(
    {org_id:ORG.id,user_id:uid,metodologia:k,dominada:!actual,updated_at:new Date().toISOString()},
    {onConflict:'org_id,user_id,metodologia'}
  );
  if(error)return alert(error.message+'\n\n¿Ya corriste el SQL del Gobierno Comercial en Supabase?');
  const m=GOB.met.find(x=>x.user_id===uid&&x.metodologia===k);
  if(m)m.dominada=!actual;else GOB.met.push({org_id:ORG.id,user_id:uid,metodologia:k,dominada:!actual});
  renderGobierno();
}

// ── DATOS POR VENDEDOR ──
function gobDatosVendedor(uid){
  const wk=radarWeekMon();
  const wkPrev=wRange(-1)[0];
  const radaresWk=(D.radar||[]).filter(r=>r.user_id===uid&&r.week_key===wk);
  const abiertosPasados=(D.radar||[]).filter(r=>r.user_id===uid&&r.estado==='activo'&&r.week_key<wk);
  const radaresPrev=(D.radar||[]).filter(r=>r.user_id===uid&&r.week_key===wkPrev);
  let movsPrev=0,ejPrev=0;
  radaresPrev.forEach(r=>{const ms=radarMovsDe(r.id);movsPrev+=ms.length;ejPrev+=ms.filter(m=>m.estado==='ejecutado').length;});
  let movsWk=0,hoyWk=0;
  radaresWk.forEach(r=>{const ms=radarMovsDe(r.id);movsWk+=ms.length;hoyWk+=ms.filter(m=>m.ejecutar_hoy&&m.estado==='pendiente').length;});
  const metOk=GOB_METODOLOGIAS.filter(m=>gobMetDomina(uid,m.k)).length;
  return{radaresWk,abiertosPasados,radaresPrev,movsPrev,ejPrev,pctPrev:movsPrev?Math.round(ejPrev/movsPrev*100):null,movsWk,hoyWk,metOk,seg:GOB.seg[uid]||{activos:0,retrasados:0}};
}
function gobObstaculos(){
  const wk=radarWeekMon();
  return(D.radar||[]).filter(r=>r.obstaculo&&(r.week_key===wk||(r.estado==='activo'&&r.week_key<wk)));
}

// ── RENDER PRINCIPAL ──
function renderGobierno(){
  const el=document.getElementById('page-gobierno');if(!el)return;
  if(!gobEsDueno()){el.innerHTML='<div class="empty">Esta sección es exclusiva del perfil dueño.</div>';return;}
  if(!GOB.cargado||GOB.orgId!==ORG?.id){
    el.innerHTML='<div class="empty">Cargando Gobierno Comercial™…</div>';
    gobCargar(true).then(renderGobierno).catch(e=>{el.innerHTML='<div class="empty">⚠️ No se pudo cargar. ¿Ya corriste el SQL del Gobierno Comercial en Supabase?<br><span style="font-size:12px;color:var(--text3)">'+String(e?.message||e)+'</span></div>';});
    return;
  }
  if(GOB.modoJunta){el.innerHTML=gobModoJuntaHTML();return;}
  const wk=radarWeekMon();
  const obst=gobObstaculos();
  const pend=obst.filter(r=>r.obstaculo_estado!=='atendido');

  // 1. Pase de lista
  const filas=MIEMBROS.map(m=>{
    const d=gobDatosVendedor(m.user_id);
    const sem=d.abiertosPasados.length?'🟡':(d.radaresWk.length?'🟢':'🔴');
    const estado=d.radaresWk.length
      ?d.radaresWk.map(r=>'🎯 '+gbe(r.empresa_nombre)).join(' · ')+' — '+d.movsWk+' mov'+(d.hoyWk?' · ⚡'+d.hoyWk+' hoy':'')
      :'<span style="color:var(--red)">Sin radar activado esta semana</span>';
    const alerta=d.abiertosPasados.length?'<div style="font-size:11px;color:var(--amber)">⚠️ '+d.abiertosPasados.length+' radar(es) de semanas pasadas sin cerrar</div>':'';
    const prev=d.pctPrev===null?'<span style="color:var(--text3)">—</span>':'<span style="color:'+(d.pctPrev>=80?'var(--green)':d.pctPrev>=50?'var(--amber)':'var(--red)')+';font-weight:700">'+d.pctPrev+'%</span>';
    return`<tr style="border-bottom:1px solid var(--border)">
      <td style="padding:9px 8px;font-size:13px">${sem} <b>${gbe(m.nombre)}</b>${m.rol==='dueno'?' <span style="font-size:10px;color:var(--gold-light)">👑</span>':''}</td>
      <td style="padding:9px 8px;font-size:12px;color:var(--text2)">${estado}${alerta}</td>
      <td style="padding:9px 8px;font-size:13px;text-align:center">${prev}</td>
      <td style="padding:9px 8px;font-size:12px;text-align:center;color:${d.seg.retrasados?'var(--red)':'var(--text2)'}">${d.seg.retrasados?'🔄 '+d.seg.retrasados+' retrasados':(d.seg.activos?'✅ al día':'—')}</td>
      <td style="padding:9px 8px;font-size:12px;text-align:center;color:${d.metOk===13?'var(--green)':'var(--text2)'}">${d.metOk}/13</td>
    </tr>`;
  }).join('');

  // 3. Obstáculos
  const obstHTML=obst.length?obst.map(r=>{
    const at=r.obstaculo_estado==='atendido';
    return`<div class="card" style="background:var(--bg3);margin-bottom:8px${at?';opacity:.7':''}">
      <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:flex-start">
        <div style="flex:1;min-width:220px">
          <div style="font-size:13px">🧱 <b>${gbe(r.vendedor_nombre||radarNombreMiembro(r.user_id))}</b> · ${gbe(r.empresa_nombre)} <span style="font-size:11px;color:var(--text3)">(${wLabel(r.week_key)})</span></div>
          <div style="font-size:13px;color:var(--text);margin-top:4px">${gbe(r.obstaculo)}</div>
          ${at?`<div style="font-size:12px;margin-top:6px;padding:6px 10px;background:var(--green-bg);border-radius:var(--radius)">👑 <b>Tu compromiso:</b> ${gbe(r.obstaculo_respuesta||'Atendido')}</div>`
          :`<textarea id="gob-resp-${r.id}" rows="1" placeholder="¿Qué te comprometes a hacer? Ej. Acompaño a la visita del miércoles..." style="width:100%;margin-top:8px;padding:7px 10px;font-size:12px;border:0.5px solid var(--border2);border-radius:var(--radius);background:var(--bg2);color:var(--text);resize:vertical">${gbe(r.obstaculo_respuesta||'')}</textarea>`}
        </div>
        <div>${at?'<span style="font-size:10px;padding:2px 8px;background:var(--green-bg);color:var(--green);border-radius:3px;font-weight:700">✅ ATENDIDO</span>'
        :`<button class="btn btn-s" style="color:var(--green)" onclick="gobAtenderObstaculo('${r.id}')">✅ Marcar atendido</button>`}</div>
      </div>
    </div>`;
  }).join(''):'<div class="empty" style="padding:1rem">Sin obstáculos declarados. 💪</div>';

  // 5. Matriz de capacitación
  const matriz=`<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:11px">
    <thead><tr><th style="text-align:left;padding:6px 8px;color:var(--text2);position:sticky;left:0;background:var(--bg2)">Metodología</th>
    ${MIEMBROS.map(m=>`<th style="padding:6px 4px;color:var(--text2);font-weight:600;max-width:90px">${gbe(m.nombre.split(' ')[0])}</th>`).join('')}</tr></thead>
    <tbody>${GOB_METODOLOGIAS.map(mt=>`<tr style="border-top:1px solid var(--border)">
      <td style="padding:6px 8px;color:var(--text);white-space:nowrap;position:sticky;left:0;background:var(--bg2)">${mt.n}</td>
      ${MIEMBROS.map(m=>`<td style="text-align:center;padding:5px 4px"><input type="checkbox"${gobMetDomina(m.user_id,mt.k)?' checked':''} onchange="gobToggleMet('${m.user_id}','${mt.k}')" style="accent-color:var(--gold);cursor:pointer;width:15px;height:15px"></td>`).join('')}
    </tr>`).join('')}</tbody></table></div>`;

  // 6. Acta
  const cerrada=GOB.junta&&GOB.junta.cerrada_at;
  const actaHTML=`
    <textarea id="gob-acuerdos" rows="3" ${cerrada?'disabled':''} placeholder="Acuerdos de la junta de hoy... Ej. Luis presenta propuesta AVE el miércoles; coaching de TORPEDO a Clara el jueves 10am..." style="width:100%;padding:8px 10px;font-size:13px;border:0.5px solid var(--border2);border-radius:var(--radius);background:var(--bg3);color:var(--text);resize:vertical${cerrada?';opacity:.7':''}">${gbe(GOB.junta?.acuerdos||'')}</textarea>
    <div style="margin-top:8px;display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap">
      ${cerrada?'<span style="font-size:11px;padding:4px 10px;background:var(--green-bg);color:var(--green);border-radius:3px;font-weight:700">✅ JUNTA CERRADA · '+fd(GOB.junta.cerrada_at.split('T')[0])+'</span>'
      :`<button class="btn btn-s" onclick="gobGuardarActa(false)">💾 Guardar acuerdos</button>
      <button class="btn btn-primary" onclick="gobGuardarActa(true)">✅ Cerrar junta de hoy</button>`}
    </div>
    ${GOB.historial.filter(j=>j.week_key!==wk).length?`<details style="margin-top:10px"><summary style="cursor:pointer;font-size:12px;color:var(--text2)">📚 Actas anteriores (${GOB.historial.filter(j=>j.week_key!==wk).length})</summary>
      ${GOB.historial.filter(j=>j.week_key!==wk).map(j=>`<div style="margin-top:8px;padding:8px 12px;background:var(--bg3);border-radius:var(--radius);font-size:12px"><b>Semana ${wLabel(j.week_key)}</b>${j.cerrada_at?' · cerrada':''}<br><span style="color:var(--text2);white-space:pre-line">${gbe(j.acuerdos||'Sin acuerdos registrados')}</span></div>`).join('')}</details>`:''}`;

  el.innerHTML=`
  <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:1rem">
    <div>
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--gold)">Junta semanal · ${wLabel(wk)}</div>
      <div style="font-size:13px;color:var(--text2)">Un solo sistema. Cero improvisación. Tú diriges, tú eliminas obstáculos.</div>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-s" onclick="gobImprimirActa()">🖨️ Acta en PDF</button>
      <button class="btn btn-primary" onclick="GOB.juntaIdx=0;GOB.modoJunta=true;renderGobierno()">🎙️ Modo Junta</button>
    </div>
  </div>

  <div class="card">
    <div style="font-weight:700;margin-bottom:8px">1 · Pase de lista de radares ${pend.length?'<span style="font-size:11px;color:var(--red);font-weight:400">· '+pend.length+' obstáculo(s) esperando tu respuesta 👇</span>':''}</div>
    <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">
      <thead><tr style="border-bottom:1px solid var(--border2)">
        <th style="text-align:left;padding:6px 8px;font-size:11px;color:var(--text2);text-transform:uppercase;letter-spacing:.04em">Vendedor</th>
        <th style="text-align:left;padding:6px 8px;font-size:11px;color:var(--text2);text-transform:uppercase;letter-spacing:.04em">Radar de esta semana</th>
        <th style="padding:6px 8px;font-size:11px;color:var(--text2);text-transform:uppercase;letter-spacing:.04em">Cumplim. sem. pasada</th>
        <th style="padding:6px 8px;font-size:11px;color:var(--text2);text-transform:uppercase;letter-spacing:.04em">3x3</th>
        <th style="padding:6px 8px;font-size:11px;color:var(--text2);text-transform:uppercase;letter-spacing:.04em">Metodologías</th>
      </tr></thead><tbody>${filas}</tbody></table></div>
  </div>

  <div class="card" style="border-color:rgba(201,168,76,0.35)">
    <div style="font-weight:700;margin-bottom:4px">2 · Tú eliminas obstáculos — "¿Qué necesitas de mí?"</div>
    <div style="font-size:12px;color:var(--text2);margin-bottom:10px">Lo que tu equipo declaró en sus radares. Responde con un compromiso concreto: quedará visible en el radar de cada vendedor.</div>
    ${obstHTML}
  </div>

  <div class="card">
    <div style="font-weight:700;margin-bottom:4px">3 · Matriz de Capacitación — Tú verificas la metodología</div>
    <div style="font-size:12px;color:var(--text2);margin-bottom:10px">Marca lo que cada persona ya domina. Esto persiste entre semanas: úsalo para detectar huecos y agendar coaching.</div>
    ${matriz}
  </div>

  <div class="card">
    <div style="font-weight:700;margin-bottom:4px">4 · Acta de la junta</div>
    <div style="font-size:12px;color:var(--text2);margin-bottom:10px">Acuerdos y compromisos de hoy. Al cerrar la junta queda guardada en el histórico.</div>
    ${actaHTML}
  </div>`;
}

// ── ACCIONES ──
async function gobAtenderObstaculo(rid){
  const resp=document.getElementById('gob-resp-'+rid)?.value.trim()||null;
  load(true);
  const{error}=await db.from('radares').update({obstaculo_estado:'atendido',obstaculo_respuesta:resp}).eq('id',rid);
  load(false);
  if(error)return alert(error.message);
  const r=(D.radar||[]).find(x=>x.id===rid);
  if(r){r.obstaculo_estado='atendido';r.obstaculo_respuesta=resp;}
  renderGobierno();
}
async function gobGuardarActa(cerrar){
  const ac=document.getElementById('gob-acuerdos')?.value.trim()||null;
  const wk=radarWeekMon();
  const payload={org_id:ORG.id,week_key:wk,dirigida_por:ME.id,dirigida_nombre:MI_NOMBRE,acuerdos:ac};
  if(cerrar)payload.cerrada_at=new Date().toISOString();
  load(true);
  const{data,error}=await db.from('gobierno_juntas').upsert(payload,{onConflict:'org_id,week_key'}).select().single();
  load(false);
  if(error)return alert(error.message);
  GOB.junta=data;
  const i=GOB.historial.findIndex(j=>j.week_key===wk);
  if(i>=0)GOB.historial[i]=data;else GOB.historial.unshift(data);
  renderGobierno();
}

// ── 🎙️ MODO JUNTA: recorrido vendedor por vendedor ──
function gobModoJuntaHTML(){
  const wk=radarWeekMon();
  const m=MIEMBROS[GOB.juntaIdx];
  if(!m){GOB.modoJunta=false;return renderGobierno(),'';}
  const d=gobDatosVendedor(m.user_id);
  const radaresHTML=d.radaresWk.length?d.radaresWk.map(r=>{
    const movs=radarMovsDe(r.id);
    return`<div style="text-align:left;background:var(--bg3);border:1px solid var(--border2);border-radius:var(--radius);padding:14px 16px;margin-bottom:10px">
      <div style="font-size:16px;font-weight:700">🎯 ${gbe(r.empresa_nombre)}</div>
      ${r.porque?`<div style="font-size:13px;color:var(--text2);margin-top:4px"><b style="color:var(--text)">¿Por qué?</b> ${gbe(r.porque)}</div>`:''}
      <div style="margin-top:8px">${movs.map(mv=>`<div style="font-size:13px;padding:3px 0;color:var(--text2)">${mv.estado==='ejecutado'?'✅':mv.estado==='no_ejecutado'?'❌':(mv.ejecutar_hoy?'⚡':'⏳')} <span style="color:var(--text)">${gbe(mv.descripcion)}</span> · 📅 ${fd(mv.fecha_compromiso)}</div>`).join('')}</div>
      ${r.obstaculo?`<div style="margin-top:8px;font-size:13px;padding:8px 10px;background:var(--amber-bg);border-radius:var(--radius)">🧱 <b>Necesita de ti:</b> ${gbe(r.obstaculo)}${r.obstaculo_estado==='atendido'?' <span style="color:var(--green)">✅ atendido</span>':''}</div>`:''}
    </div>`;
  }).join(''):'<div class="empty">🔴 No ha activado su radar esta semana.<br>Pregunta: ¿cuál es tu cuenta y tu siguiente movimiento?</div>';
  return`<div style="max-width:760px;margin:0 auto;text-align:center">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
      <span style="font-size:12px;color:var(--text2)">🎙️ Modo Junta · ${GOB.juntaIdx+1} de ${MIEMBROS.length}</span>
      <button class="btn btn-s" onclick="GOB.modoJunta=false;renderGobierno()">✕ Salir</button>
    </div>
    <div class="card" style="border-color:rgba(201,168,76,0.5);padding:1.5rem">
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:30px;font-weight:800">${gbe(m.nombre)}${m.rol==='dueno'?' 👑':''}</div>
      <div style="display:flex;justify-content:center;gap:18px;font-size:13px;color:var(--text2);margin:6px 0 14px;flex-wrap:wrap">
        <span>Cumplimiento sem. pasada: <b style="color:${d.pctPrev===null?'var(--text3)':d.pctPrev>=80?'var(--green)':d.pctPrev>=50?'var(--amber)':'var(--red)'}">${d.pctPrev===null?'—':d.pctPrev+'%'}</b></span>
        <span>3x3: <b style="color:${d.seg.retrasados?'var(--red)':'var(--green)'}">${d.seg.retrasados?d.seg.retrasados+' retrasados':'al día'}</b></span>
        <span>Metodologías: <b>${d.metOk}/13</b></span>
      </div>
      ${radaresHTML}
      <div style="font-size:12px;color:var(--gold-light);margin-top:10px;font-weight:700">Pregunta final: "¿Qué necesitas de mí esta semana?"</div>
    </div>
    <div style="display:flex;justify-content:space-between;margin-top:1rem">
      <button class="btn btn-s"${GOB.juntaIdx===0?' disabled style="opacity:.4"':''} onclick="GOB.juntaIdx--;renderGobierno()">← Anterior</button>
      ${GOB.juntaIdx<MIEMBROS.length-1?'<button class="btn btn-primary" onclick="GOB.juntaIdx++;renderGobierno()">Siguiente →</button>':'<button class="btn btn-primary" onclick="GOB.modoJunta=false;renderGobierno()">Terminar junta ✅</button>'}
    </div>
  </div>`;
}

// ── 🖨️ ACTA EN PDF (mismo patrón que Reportes) ──
function gobImprimirActa(){
  const wk=radarWeekMon();
  const filas=MIEMBROS.map(m=>{
    const d=gobDatosVendedor(m.user_id);
    const cuentas=d.radaresWk.map(r=>r.empresa_nombre).join(', ')||'—';
    return`<tr><td>${gbe(m.nombre)}</td><td>${d.radaresWk.length?'✅':'❌'}</td><td>${gbe(cuentas)}</td><td>${d.movsWk}</td><td>${d.pctPrev===null?'—':d.pctPrev+'%'}</td><td>${d.seg.retrasados||0}</td><td>${d.metOk}/13</td></tr>`;
  }).join('');
  const obst=gobObstaculos().map(r=>`<tr><td>${gbe(r.vendedor_nombre||radarNombreMiembro(r.user_id))}</td><td>${gbe(r.empresa_nombre)}</td><td>${gbe(r.obstaculo)}</td><td>${r.obstaculo_estado==='atendido'?'✅ '+gbe(r.obstaculo_respuesta||'Atendido'):'Pendiente'}</td></tr>`).join('');
  const movsDetalle=MIEMBROS.map(m=>{
    const d=gobDatosVendedor(m.user_id);
    if(!d.radaresWk.length)return'';
    return d.radaresWk.map(r=>{
      const movs=radarMovsDe(r.id);
      return`<h3 style="margin:14px 0 4px">${gbe(m.nombre)} · ${gbe(r.empresa_nombre)}</h3>
      ${r.porque?'<p style="font-size:12px;color:#5a6272;margin:2px 0">¿Por qué esta cuenta? '+gbe(r.porque)+'</p>':''}
      <ul style="margin:6px 0 0 18px;font-size:12px">${movs.map(mv=>`<li>${mv.estado==='ejecutado'?'✅':mv.estado==='no_ejecutado'?'❌':'⏳'} ${gbe(mv.descripcion)} — ${gbe(mv.responsable_nombre||'')}, ${fd(mv.fecha_compromiso)}${mv.hora?' '+String(mv.hora).slice(0,5):''}</li>`).join('')}</ul>`;
    }).join('');
  }).join('');
  const html=`
    <div style="border-bottom:3px solid #C9A84C;padding-bottom:10px;margin-bottom:16px">
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:26px;font-weight:800">GOBIERNO COMERCIAL™ — Acta de junta</div>
      <div style="font-size:13px;color:#5a6272">${gbe(ORG?.nombre||'')} · Semana ${wLabel(wk)} · Dirigida por ${gbe(MI_NOMBRE||'')} · ${fd(today())}</div>
    </div>
    <h2 style="font-size:15px;margin:14px 0 6px">1 · Pase de lista de radares</h2>
    <table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;width:100%;font-size:11px;border-color:#ddd">
      <tr style="background:#f5f3ef"><th>Vendedor</th><th>Radar</th><th>Cuenta(s)</th><th>Movs</th><th>% sem. pasada</th><th>3x3 retrasados</th><th>Metodologías</th></tr>${filas}
    </table>
    <h2 style="font-size:15px;margin:16px 0 6px">2 · Movimientos comprometidos de la semana</h2>
    ${movsDetalle||'<p style="font-size:12px;color:#5a6272">Sin radares activados.</p>'}
    <h2 style="font-size:15px;margin:16px 0 6px">3 · Obstáculos y compromisos del director</h2>
    ${obst?`<table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;width:100%;font-size:11px;border-color:#ddd"><tr style="background:#f5f3ef"><th>Vendedor</th><th>Cuenta</th><th>Obstáculo</th><th>Compromiso</th></tr>${obst}</table>`:'<p style="font-size:12px;color:#5a6272">Sin obstáculos declarados.</p>'}
    <h2 style="font-size:15px;margin:16px 0 6px">4 · Acuerdos de la junta</h2>
    <p style="font-size:12px;white-space:pre-line;border:1px solid #ddd;padding:10px;border-radius:6px;min-height:50px">${gbe(GOB.junta?.acuerdos||document.getElementById('gob-acuerdos')?.value||'')}</p>
    <div style="display:flex;justify-content:space-between;margin-top:50px;font-size:12px">
      <div style="text-align:center;width:40%"><div style="border-top:1px solid #333;padding-top:4px">Firma del director</div></div>
      <div style="text-align:center;width:40%"><div style="border-top:1px solid #333;padding-top:4px">Firma del equipo</div></div>
    </div>`;
  const w=window.open('','_blank');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>Acta Gobierno Comercial — ${wLabel(wk)}</title>
    <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&family=Barlow:wght@300;400;500;600&display=swap" rel="stylesheet">
    <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Barlow',sans-serif;background:#fff;color:#1a1a1a;padding:20px;-webkit-print-color-adjust:exact;print-color-adjust:exact}@media print{body{padding:0}@page{margin:15mm}}h2{font-family:'Barlow Condensed',sans-serif}h3{font-family:'Barlow Condensed',sans-serif;font-size:14px}</style>
    </head><body>${html}</body></html>`);
  w.document.close();
  setTimeout(()=>w.print(),800);
}

// ── Compromiso del director visible en el radar del vendedor ──
if(typeof radarDetalleHTML==='function'){
  const _gRadarDet=radarDetalleHTML;
  radarDetalleHTML=function(rid){
    let h=_gRadarDet(rid);
    const r=(D.radar||[]).find(x=>x.id===rid);
    if(r&&r.obstaculo_respuesta){
      h+=`<div style="max-width:860px"><div class="card" style="border-color:rgba(99,153,34,0.35);margin-top:8px"><div style="font-size:13px">👑 <b>Compromiso de tu director:</b> ${gbe(r.obstaculo_respuesta)}</div></div></div>`;
    }
    return h;
  };
}
console.log('✅ Gobierno Comercial™ cargado (solo dueño)');
// ══════════════════════════════════════════════
