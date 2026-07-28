// ══════════════════════════════════════════════
// FASE B · Ejecución diaria — ⚡ Agenda de hoy + Forecast honesto
// Módulo de extensión del MMS. Cargado en cadena por mapa2.js.
// ══════════════════════════════════════════════

const fbe=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

const _fbrInicio=rInicio;
rInicio=function(){
  _fbrInicio();
  try{fbForecastHonesto();}catch(e){console.error('faseb forecast:',e);}
  try{fbAgendaRender();}catch(e){console.error('faseb agenda:',e);}
};

// ── FORECAST HONESTO: dinero invisible por falta de fecha ──
function fbForecastHonesto(){
  const page=document.getElementById('page-inicio');if(!page)return;
  const hoy=today();
  const abiertas=D.proy.filter(p=>!['cerrado','perdido'].includes(p.etapa));
  const sinFecha=abiertas.filter(p=>!p.fecha_cierre);
  const vencidas=abiertas.filter(p=>p.fecha_cierre&&p.fecha_cierre<hoy);
  const monto=arr=>arr.reduce((a,p)=>a+(p.valor_estimado||0),0);
  if(!sinFecha.length&&!vencidas.length)return;
  const titulo=[...page.querySelectorAll('div')].find(d=>d.children.length===0&&/Forecast — próximos 3 meses/i.test(d.textContent||''));
  const card=titulo?titulo.parentElement:null;
  if(!card||card.querySelector('.fb-forecast-nota'))return;
  const partes=[];
  if(sinFecha.length)partes.push('💰 <b>'+fmt(monto(sinFecha))+'</b> en '+sinFecha.length+' oportunidad'+(sinFecha.length>1?'es':'')+' <b>sin fecha de cierre</b>');
  if(vencidas.length)partes.push('⏰ <b>'+fmt(monto(vencidas))+'</b> en '+vencidas.length+' con <b>fecha de cierre vencida</b>');
  card.insertAdjacentHTML('beforeend','<div class="fb-forecast-nota" style="margin-top:10px;padding:9px 12px;background:var(--amber-bg);border-radius:var(--radius);font-size:12px;color:var(--text);line-height:1.5">'+partes.join(' · ')+' — ese dinero <b>no aparece</b> en el forecast de arriba. Actualiza la fecha estimada en Oportunidades para recuperar visibilidad.</div>');
}

// ── ⚡ AGENDA DE HOY: movimientos RADAR + actividades programadas ──
let _fbCargando=false;
function fbAgendaRender(){
  const page=document.getElementById('page-inicio');if(!page)return;
  let cont=page.querySelector('#fb-agenda');
  if(!cont){cont=document.createElement('div');cont.id='fb-agenda';page.insertBefore(cont,page.firstChild);}
  const hoy=today();
  if((!_radarLoaded||_radarOrgId!==ORG?.id)&&!_fbCargando){
    _fbCargando=true;
    cont.innerHTML='';
    radarCargarDatos(true).then(()=>{_fbCargando=false;fbAgendaRender();}).catch(()=>{_fbCargando=false;});
    return;
  }
  // Movimientos RADAR pendientes donde YO soy responsable, con fecha hoy o atrasada
  const movs=(D.radar_mov||[]).filter(m=>m.estado==='pendiente'&&m.responsable_id===ME.id&&m.fecha_compromiso&&m.fecha_compromiso<=hoy)
    .sort((a,b)=>String(a.fecha_compromiso).localeCompare(String(b.fecha_compromiso))||String(a.hora||'99').localeCompare(String(b.hora||'99')));
  // Actividades programadas para hoy (que no sean del RADAR, para no duplicar)
  const acts=(D.act||[]).filter(a=>a.fecha_prog===hoy&&a.registrado_por===ME.id&&a.estado!=='movimiento_radar');
  if(!movs.length&&!acts.length){cont.innerHTML='';return;}
  const item=(icono,titulo,sub,extra)=>'<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);flex-wrap:wrap"><div style="flex:1;min-width:220px"><div style="font-size:13px;color:var(--text)">'+icono+' '+titulo+'</div><div style="font-size:11px;color:var(--text2);margin-top:2px">'+sub+'</div></div><div style="display:flex;gap:6px;align-items:center">'+(extra||'')+'</div></div>';
  const movHTML=movs.map(m=>{
    const r=(D.radar||[]).find(x=>x.id===m.radar_id)||{};
    const u=m.usuario_id?(D.usu||[]).find(x=>x.id===m.usuario_id):null;
    const atrasado=m.fecha_compromiso<hoy;
    const contacto=(u&&typeof m2ContactoIconos==='function')?m2ContactoIconos(u):'';
    return item(
      (atrasado?'<span style="color:var(--red);font-weight:700;font-size:10px">[ATRASADO '+fd(m.fecha_compromiso)+']</span> ':'')+(m.ejecutar_hoy?'⚡':'🎯'),
      fbe(m.descripcion),
      [r.empresa_nombre?'🏢 '+fbe(r.empresa_nombre):'',m.usuario_nombre?'👤 '+fbe(m.usuario_nombre):'',(m.canal&&typeof RADAR_CANALES!=='undefined'&&RADAR_CANALES[m.canal])?RADAR_CANALES[m.canal]:'',m.hora?'🕐 '+String(m.hora).slice(0,5):''].filter(Boolean).join(' · '),
      (contacto?'<span style="font-size:15px">'+contacto+'</span>':'')
      +'<button class="btn btn-s" onclick="fbIrRadar(\''+m.radar_id+'\')">Ver radar</button>'
      +'<button class="btn btn-s" style="color:var(--green)" onclick="fbEjecutar(\''+m.id+'\')">✅ Hecho</button>'
    );
  }).join('');
  const actHTML=acts.map(a=>{
    const et=(typeof ET!=='undefined'&&ET[a.estado])||{icon:'📌',label:a.estado};
    return item(et.icon,fbe(et.label)+(a.notas?' — '+fbe(a.notas):''),[a.empresa_nombre?'🏢 '+fbe(a.empresa_nombre):'',(a.usuario_nombre&&a.usuario_nombre!=='—')?'👤 '+fbe(a.usuario_nombre):''].filter(Boolean).join(' · '),'');
  }).join('');
  const n=movs.length+acts.length;
  cont.innerHTML='<div class="card" style="border-color:rgba(201,168,76,0.45);background:var(--gold-bg2);margin-bottom:1rem">'
    +'<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px"><div style="font-weight:800;color:var(--gold-light)">⚡ Tu agenda de hoy · '+n+' pendiente'+(n>1?'s':'')+'</div><div style="font-size:11px;color:var(--text2)">Regla de Acción™: si puede hacerse hoy, se hace hoy</div></div>'
    +'<div style="margin-top:6px">'+movHTML+actHTML+'</div></div>';
}
function fbIrRadar(rid){go('radar');radarGo('detalle',rid);}
async function fbEjecutar(mid){await radarMarcarMov(mid,'ejecutado');fbAgendaRender();}
console.log('✅ Fase B (agenda de hoy + forecast honesto) cargada');
// ══════════════════════════════════════════════
