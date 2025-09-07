
(function(){
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const LS="dgpos_v412";
  function load(){try{return JSON.parse(localStorage.getItem(LS))}catch(e){return null}}
  function save(){localStorage.setItem(LS,JSON.stringify(state))}
  function uid(){return Math.random().toString(36).slice(2,10)}
  function today(){return new Date().toISOString().slice(0,10)}
  function money(n){return '$'+Number(n||0).toFixed(2)}
  const views=["dashboard","ventas","inventario","clientes","membresias","cafeteria","historial","config","ticket"];

  let state=load()||{
    schemaVersion:"4.1.2",
    config:{iva:16,mensaje:"¡Gracias por tu compra en DINAMITA GYM POS!",logo:null,negocio:"DINAMITA GYM POS",direccion:"",telefono:"",web:""},
    inventario:[
      {sku:"SKU-001",nombre:"Shaker",categoria:"Accesorios",precio:120,costo:60,stock:10,descr:"",tipo:"Producto",duracionDias:0,creaMembresia:false},
      {sku:"SKU-002",nombre:"Proteína Whey",categoria:"Suplementos",precio:650,costo:420,stock:5,descr:"",tipo:"Producto",duracionDias:0,creaMembresia:false},
      {sku:"SKU-003",nombre:"Mensualidad",categoria:"Membresías",precio:500,costo:0,stock:null,descr:"",tipo:"Membresía",duracionDias:30,creaMembresia:true},
      {sku:"SKU-004",nombre:"Café americano",categoria:"Cafetería",precio:35,costo:8,stock:999,descr:"",tipo:"Producto",duracionDias:0,creaMembresia:false}
    ],
    clientes:[{id:"PUBLICO",nombre:"Público General",tel:"",email:"",certMed:false,entrenaSolo:false}],
    membresias:[], ventas:[]
  };

  function show(v){
    views.forEach(x=>$('#view-'+x).classList.add('hidden'));
    const el=$('#view-'+v); if(el) el.classList.remove('hidden');
    $$('.menu button').forEach(b=>b.classList.toggle('active', b.dataset.view===v));
    const b=$('.menu button[data-view="'+v+'"]'); $('#viewTitle').textContent=b?b.textContent.replace(/^[^\w]+/,'').trim():v;
    document.body.classList.remove('drawer-open');
  }

  // Dashboard
  function mountDashboard(){
    const h=today();
    const vh=state.ventas.filter(v=>v.fecha.slice(0,10)===h);
    const tot=vh.reduce((a,b)=>a+b.total,0);
    const gan=vh.reduce((a,b)=>a+b.items.reduce((g,it)=>{
      const p=state.inventario.find(pp=>pp.sku===it.sku);
      return g+((it.precio-(p?p.costo:0))*it.cant);
    },0),0);
    const stock=state.inventario.reduce((a,b)=>a+(b.stock||0),0);
    $('#dashboardMount').innerHTML=`<div class="cards">
      <div class="card"><div class="card-title">💵 Ventas de hoy</div><div class="card-value">${money(tot)}</div></div>
      <div class="card"><div class="card-title">🎫 Tickets emitidos</div><div class="card-value">${vh.length}</div></div>
      <div class="card"><div class="card-title">📦 Productos en stock</div><div class="card-value">${stock}</div></div>
      <div class="card"><div class="card-title">📈 Ganancia de hoy</div><div class="card-value">${money(gan)}</div></div>
    </div>`;
  }

  // Ventas
  let carrito=[];
  function buscarProducto(q){
    q=(q||"").toLowerCase();
    const res=state.inventario.filter(p=>[p.sku,p.nombre,p.categoria].join(" ").toLowerCase().includes(q));
    $('#ventaResultados').innerHTML = res.map(p=>`
      <div class="row" style="display:grid;grid-template-columns:1fr 80px 160px;gap:6px;padding:6px;border-bottom:1px solid var(--border)">
        <div><strong>${p.nombre}</strong><br><small class="badge">${p.categoria||""}</small></div>
        <div>${money(p.precio)}</div>
        <div><button class="btn small" data-add="${p.sku}">Agregar</button></div>
      </div>`).join("") || "<div style='padding:8px'>Sin resultados</div>";
    $$('#ventaResultados [data-add]').forEach(btn=>btn.addEventListener('click',()=>add(btn.dataset.add)));
  }
  function renderCarrito(){
    const c=$('#carrito');
    c.innerHTML = carrito.map(it=>{
      const inv=state.inventario.find(x=>x.sku===it.sku);
      const isServ=inv&&(inv.tipo==="Membresía"||inv.tipo==="Servicio");
      const s=it.serviceInfo||{};
      return `<div class="row" style="display:grid;grid-template-columns:1fr 70px 90px 90px;gap:6px;padding:6px;border-bottom:1px solid var(--border)">
        <div>${it.nombre} ${isServ?'<span class="badge">Servicio</span>':''}
          ${isServ?`<div style="margin-top:6px;display:grid;grid-template-columns:repeat(3,1fr);gap:6px">
            <label>Inicio<input type="date" value="${s.start||today()}" data-svc="${it.sku}" data-k="start"></label>
            <label>Fin<input type="date" value="${s.end||calcEnd(inv.duracionDias)}" data-svc="${it.sku}" data-k="end"></label>
            <label>Notas<input placeholder="Notas" value="${s.notes||''}" data-svc="${it.sku}" data-k="notes"></label>
          </div>`:''}
        </div>
        <div>x<input type="number" min="1" value="${it.cant}" style="width:50px" data-cant="${it.sku}"></div>
        <div>${money(it.precio)}</div>
        <div>${money(it.precio*it.cant)}</div>
      </div>`
    }).join("") || "<div style='padding:8px'>Carrito vacío</div>";
    $$('#carrito [data-cant]').forEach(i=>i.addEventListener('input',e=>cant(e.target.dataset.cant,e.target.value)));
    $$('#carrito [data-svc]').forEach(i=>i.addEventListener('input',e=>setSvc(e.target.dataset.svc,e.target.dataset.k,e.target.value)));
    const sub=carrito.reduce((a,b)=>a+b.precio*b.cant,0), iva=sub*(Number(state.config.iva||0)/100), tot=sub+iva;
    $('#ventaSubtotal').textContent=money(sub); $('#ventaIVA').textContent=money(iva); $('#ventaTotal').textContent=money(tot);
  }
  function calcEnd(d){const x=new Date(today()); x.setDate(x.getDate()+Number(d||0)); return x.toISOString().slice(0,10)}
  function add(sku){
    const p=state.inventario.find(x=>x.sku===sku); if(!p) return;
    const ex=carrito.find(i=>i.sku===sku);
    if(ex) ex.cant++;
    else {
      const it={sku:p.sku,nombre:p.nombre,precio:p.precio,cant:1};
      if(p.tipo==="Membresía"||p.tipo==="Servicio"){ it.serviceInfo={start:today(),end:calcEnd(p.duracionDias||0),notes:""} }
      carrito.push(it);
    }
    renderCarrito();
  }
  function setSvc(s,k,v){ const it=carrito.find(i=>i.sku===s); if(!it) return; it.serviceInfo=Object.assign({},it.serviceInfo||{}, {[k]:v}) }
  function cant(sku,v){ const it=carrito.find(i=>i.sku===sku); if(!it) return; it.cant=Math.max(1,Number(v||1)); renderCarrito() }
  function confirmar(){
    if(!carrito.length) return alert("Agrega productos");
    const sub=carrito.reduce((a,b)=>a+b.precio*b.cant,0), iva=sub*(Number(state.config.iva||0)/100), tot=sub+iva;
    const clienteSel=$('#ventaCliente').value||'PUBLICO';
    const clienteObj=state.clientes.find(c=>c.id===clienteSel)||state.clientes.find(c=>c.id==='PUBLICO');
    const notas=$('#ventaNotas').value||'';
    const venta={folio:'T'+(Date.now().toString(36).toUpperCase()), fecha:new Date().toISOString(), clienteId:clienteObj.id, clienteNombre:clienteObj.nombre, items:JSON.parse(JSON.stringify(carrito)), subtotal:sub, iva:iva, total:tot, notas};
    state.ventas.push(venta);
    carrito.forEach(it=>{const p=state.inventario.find(x=>x.sku===it.sku); if(p&&Number.isFinite(p.stock)) p.stock=Math.max(0,p.stock-it.cant)});
    save(); carrito=[]; renderCarrito(); Tickets.render(venta); window.print();
  }

  // Inventario (igual que 4.1, compactado)
  function invRow(p){return `<div class="row"><div>${p.sku}</div><div>${p.nombre} <span class="badge">${p.categoria||''}</span></div><div>${p.tipo||'Producto'}</div><div>${money(p.precio)}</div><div>${money(p.costo||0)}</div><div>${p.stock==null?'-':p.stock}</div><div><button class="icon-btn" data-edit="${p.sku}">✏️</button><button class="icon-btn" data-del="${p.sku}">🗑️</button></div></div>`}
  function renderInvTabla(){
    const q=($('#invSearch')?.value||'').toLowerCase(), cat=$('#invCat')?.value||'';
    const data=state.inventario.filter(p=>(!cat||p.categoria===cat)&&[p.sku,p.nombre,p.categoria,p.tipo].join(' ').toLowerCase().includes(q));
    $('#invTabla').innerHTML=`<div class="row header"><div>SKU</div><div>Nombre</div><div>Tipo</div><div>Precio</div><div>Costo</div><div>Stock</div><div>Acciones</div></div>`+data.map(invRow).join('');
    $$('#invTabla [data-edit]').forEach(b=>b.addEventListener('click',()=>editProd(b.dataset.edit)));
    $$('#invTabla [data-del]').forEach(b=>b.addEventListener('click',()=>delProd(b.dataset.del)));
  }
  function guardarProd(){
    const sku=$('#prodSku').value.trim(); if(!sku) return alert('SKU es obligatorio');
    let p=state.inventario.find(x=>x.sku===sku);
    const obj={sku,nombre:$('#prodNombre').value.trim(),categoria:$('#prodCategoria').value.trim(),tipo:$('#prodTipo').value,duracionDias:Number($('#prodDuracion').value||0),creaMembresia:($('#prodCreaMem').value==='true'),precio:Number($('#prodPrecio').value||0),costo:Number($('#prodCosto').value||0),stock:($('#prodTipo').value==='Producto'?Number($('#prodStock').value||0):null),descr:$('#prodDescr').value||'',img:null};
    if(p) Object.assign(p,obj); else state.inventario.push(obj);
    save(); renderInvTabla(); alert('Guardado');
  }
  function limpiarProd(){['prodSku','prodNombre','prodCategoria','prodPrecio','prodCosto','prodStock','prodDescr','prodDuracion'].forEach(id=>{const el=$('#'+id); if(el) el.value=''}); $('#prodTipo').value='Producto'; $('#prodCreaMem').value='false'}
  function editProd(sku){const p=state.inventario.find(x=>x.sku===sku); if(!p) return; $('#prodSku').value=p.sku; $('#prodNombre').value=p.nombre; $('#prodCategoria').value=p.categoria||''; $('#prodTipo').value=p.tipo||'Producto'; $('#prodDuracion').value=p.duracionDias||0; $('#prodCreaMem').value=p.creaMembresia?'true':'false'; $('#prodPrecio').value=p.precio; $('#prodCosto').value=p.costo||0; $('#prodStock').value=p.stock==null?'':p.stock; $('#prodDescr').value=p.descr||'' }
  function delProd(sku){ if(confirm('¿Borrar producto?')){ state.inventario=state.inventario.filter(x=>x.sku!==sku); save(); renderInvTabla() } }
  function exportInvCSV(){const rows=[['SKU','Nombre','Categoría','Tipo','DuraciónDías','CrearMembresía','Precio','Costo','Stock','Descripción']].concat(state.inventario.map(p=>[p.sku,p.nombre,p.categoria||'',p.tipo||'Producto',p.duracionDias||0,p.creaMembresia?1:0,p.precio,p.costo||0,p.stock==null?'':p.stock,(p.descr||'').replace(/\n/g,' ')])); downloadCSV('inventario.csv',rows)}
  const Inventario={renderTabla:renderInvTabla,guardar:guardarProd,limpiar:limpiarProd,edit:editProd,del:delProd,exportCSV:exportInvCSV}; window.Inventario=Inventario;

  // Clientes (igual que 4.1)
  function renderCliTabla(){const q=($('#cliSearch')?.value||'').toLowerCase();const data=state.clientes.filter(c=>[c.nombre,c.tel,c.email].join(' ').toLowerCase().includes(q));$('#cliTabla').innerHTML=`<div class="row header"><div>Cliente</div><div>ID</div><div>Teléfono</div><div>Email</div><div>Acciones</div></div>`+data.map(c=>`<div class="row" style="grid-template-columns:1fr 1fr 160px 160px 120px"><div>${c.nombre} ${c.certMed?'<span class="badge">Certif.</span>':''} ${c.entrenaSolo?'<span class="badge">Entrena solo</span>':''}</div><div>${c.id}</div><div>${c.tel||''}</div><div>${c.email||''}</div><div><button class="icon-btn" data-edit="${c.id}">✏️</button><button class="icon-btn" data-del="${c.id}">🗑️</button></div></div>`).join(''); $$('#cliTabla [data-edit]').forEach(b=>b.addEventListener('click',()=>cliEdit(b.dataset.edit))); $$('#cliTabla [data-del]').forEach(b=>b.addEventListener('click',()=>cliDel(b.dataset.del)))}
  function cliGuardar(){const id=$('#cliId').value||uid();const obj={id,nombre:$('#cliNombre').value.trim(),tel:$('#cliTel').value.trim(),email:$('#cliEmail').value.trim(),certMed:$('#cliCertMed').checked,entrenaSolo:$('#cliEntrenaSolo').checked};const ex=state.clientes.find(c=>c.id===id);if(ex)Object.assign(ex,obj);else state.clientes.push(obj); if(!state.clientes.find(c=>c.id==='PUBLICO')){state.clientes.unshift({id:'PUBLICO',nombre:'Público General',tel:'',email:'',certMed:false,entrenaSolo:false})} save(); Clientes.limpiar(); renderCliTabla()}
  function cliLimpiar(){['cliId','cliNombre','cliTel','cliEmail'].forEach(id=>$('#'+id).value=''); $('#cliCertMed').checked=false; $('#cliEntrenaSolo').checked=false}
  function cliEdit(id){const c=state.clientes.find(x=>x.id===id); if(!c) return; $('#cliId').value=c.id; $('#cliNombre').value=c.nombre; $('#cliTel').value=c.tel||''; $('#cliEmail').value=c.email||''; $('#cliCertMed').checked=!!c.certMed; $('#cliEntrenaSolo').checked=!!c.entrenaSolo }
  function cliDel(id){ if(id==='PUBLICO') return alert("No puedes borrar 'Público General'"); if(confirm('¿Borrar cliente?')){ state.clientes=state.clientes.filter(x=>x.id!==id); save(); renderCliTabla() } }
  function exportCliCSV(){const rows=[['ID','Nombre','Teléfono','Email','Certificado','EntrenaSolo']].concat(state.clientes.map(c=>[c.id,c.nombre,c.tel||'',c.email||'',c.certMed?1:0,c.entrenaSolo?1:0])); downloadCSV('clientes.csv',rows)}
  const Clientes={renderTabla:renderCliTabla,guardar:cliGuardar,limpiar:cliLimpiar,edit:cliEdit,del:cliDel,exportCSV:exportCliCSV}; window.Clientes=Clientes;

  // Membresías (igual que 4.1)
  function memChangeTipo(){const ini=$('#memInicio').value||today();const d=new Date(ini),t=$('#memTipo').value;if(t==='Mensualidad')d.setMonth(d.getMonth()+1);else if(t==='Semana')d.setDate(d.getDate()+7);else if(t==='6 Meses')d.setMonth(d.getMonth()+6);else if(t==='12 Meses')d.setMonth(d.getMonth()+12);else d.setDate(d.getDate()+1);$('#memFin').value=d.toISOString().slice(0,10)}
  function memSearchCliente(q){q=(q||'').toLowerCase();const data=state.clientes.filter(c=>[c.nombre,c.tel,c.email].join(' ').toLowerCase().includes(q));$('#memClienteResults').innerHTML=data.slice(0,10).map(c=>`<div style="padding:8px;border-bottom:1px solid var(--border);cursor:pointer" data-pick="${c.id}">${c.nombre}</div>`).join(''); $$('#memClienteResults [data-pick]').forEach(d=>d.addEventListener('click',()=>{ $('#memClienteId').value=d.dataset.pick; const c=state.clientes.find(x=>x.id===d.dataset.pick); $('#memClienteSearch').value=c?c.nombre:''; $('#memClienteResults').innerHTML=''; }))}
  function memGuardar(){const id=uid(),cli=$('#memClienteId').value; if(!cli) return alert('Selecciona cliente'); const obj={id,clienteId:cli,tipo:$('#memTipo').value,inicio:$('#memInicio').value,fin:$('#memFin').value,notas:$('#memNotas').value||''}; state.membresias.push(obj); save(); alert('Membresía registrada'); Membresias.renderTabla()}
  function memRender(){const q=($('#memSearch')?.value||'').toLowerCase(),st=$('#memStatus')?.value||'';const data=state.membresias.map(m=>({m,c:state.clientes.find(c=>c.id===m.clienteId)||{nombre:'(eliminado)'}})).filter(x=>[x.c.nombre,x.m.tipo,x.m.notas].join(' ').toLowerCase().includes(q)).filter(x=>{const h=today();const status=(x.m.fin<h)?'vencida':((new Date(x.m.fin)-new Date(h))<=7*86400000?'próxima':'activa');return !st||st===status});$('#memTabla').innerHTML=`<div class="row header"><div>Cliente</div><div>Tipo</div><div>Inicio</div><div>Fin</div><div>Notas</div><div>Acciones</div></div>`+data.map(x=>`<div class="row"><div>${x.c.nombre}</div><div>${x.m.tipo}</div><div>${x.m.inicio}</div><div>${x.m.fin}</div><div>${x.m.notas||''}</div><div><button class="icon-btn" data-del="${x.m.id}">🗑️</button></div></div>`).join(''); $$('#memTabla [data-del]').forEach(b=>b.addEventListener('click',()=>{ if(confirm('¿Borrar membresía?')){ state.membresias=state.membresias.filter(m=>m.id!==b.dataset.del); save(); memRender() } }))}
  const Membresias={changeTipo:memChangeTipo,searchCliente:memSearchCliente,guardar:memGuardar,renderTabla:memRender}; window.Membresias=Membresias;

  // Historial (reimpresión)
  function renderHist(){const qf=($('#histFolio')?.value||'').toLowerCase(), qc=($('#histCliente')?.value||'').toLowerCase(); const data=state.ventas.map(v=>({v,c:v.clienteId?state.clientes.find(c=>c.id===v.clienteId):null})).filter(x=>(!qf||x.v.folio.toLowerCase().includes(qf))&&(!qc||(x.c&&x.c.nombre.toLowerCase().includes(qc)))); $('#histTabla').innerHTML=`<div class="row header"><div>Folio</div><div>Fecha</div><div>Total</div><div>Cliente</div><div>Notas</div><div>Acciones</div></div>`+data.map(x=>`<div class="row"><div>${x.v.folio}</div><div>${x.v.fecha.slice(0,16).replace('T',' ')}</div><div>${money(x.v.total)}</div><div>${x.c?x.c.nombre:'-'}</div><div>${x.v.notas||''}</div><div><button class="icon-btn" data-re="${x.v.folio}">🖨️</button></div></div>`).join(''); $$('#histTabla [data-re]').forEach(b=>b.addEventListener('click',()=>{const v=state.ventas.find(x=>x.folio===b.dataset.re); if(!v) return; Tickets.render(v); window.print();})) }
  const Historial={render:renderHist}; window.Historial=Historial;

  // Config
  const Config={guardar(){state.config.iva=Number($('#cfgIVA').value||0);state.config.mensaje=$('#cfgMensaje').value||'';state.config.negocio=$('#cfgNegocio').value||'';state.config.direccion=$('#cfgDir').value||'';state.config.telefono=$('#cfgTel').value||'';state.config.web=$('#cfgWeb').value||'';save();alert('Configuración guardada');Config.renderPreview()},
    loadLogo(i){const f=i.files[0]; if(!f) return; const rd=new FileReader(); rd.onload=()=>{state.config.logo=rd.result; save(); Config.renderPreview()}; rd.readAsDataURL(f)},
    renderPreview(){ $('#cfgTicketPreview').innerHTML = `${state.config.logo?`<img src="${'${state.config.logo}'}">`:''}<div style="text-align:center;font-weight:800">${state.config.negocio||'DINAMITA GYM POS'}</div>`; },
    export(){const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='dgpos-backup-v412.json'; a.click()},
    import(input){const f=input.files[0]; if(!f) return; const rd=new FileReader(); rd.onload=()=>{ try{ const data=JSON.parse(rd.result); ['config','inventario','clientes','membresias','ventas'].forEach(k=>{ if(data[k]) state[k]=data[k] }); if(!state.clientes.find(c=>c.id==='PUBLICO')){state.clientes.unshift({id:'PUBLICO',nombre:'Público General',tel:'',email:'',certMed:false,entrenaSolo:false})} save(); alert('Respaldo importado'); location.reload() }catch(e){ alert('Archivo inválido') } }; rd.readAsText(f)}}
  window.Config=Config;

  // Ticket
  window.__lastTicketHTML__='';
  function center(t){t=String(t);const w=32;const pad=Math.max(0,Math.floor((w-t.length)/2));return ' '.repeat(pad)+t}
  function padLine(l,r,w){l=String(l);r=String(r); if(l.length+r.length>w) l=l.slice(0,w-r.length-1); return l+' '.repeat(Math.max(1,w-l.length-r.length))+r}
  function ticketLines(v){const lines=[]; lines.push(center('Ticket de venta')); lines.push('Folio: '+v.folio); lines.push('Fecha: '+v.fecha.slice(0,19).replace('T',' ')); if(v.clienteNombre) lines.push('Cliente: '+v.clienteNombre); lines.push('-'.repeat(32)); v.items.forEach(it=>{const name=String(it.nombre||'').slice(0,14); const tot=money(it.precio*it.cant).replace('$',''); lines.push(padLine(it.cant+'x '+name,tot,32)); if(it.serviceInfo&&it.serviceInfo.start&&it.serviceInfo.end){lines.push('   Vigencia: '+it.serviceInfo.start+' → '+it.serviceInfo.end)}}); lines.push('-'.repeat(32)); lines.push(padLine('SUBTOTAL',money(v.subtotal),32)); lines.push(padLine('IVA ('+state.config.iva+'%)',money(v.iva),32)); lines.push(padLine('TOTAL',money(v.total),32)); if(v.notas){lines.push('-'.repeat(32)); lines.push(String(v.notas).slice(0,200))} if(state.config.mensaje) lines.push(center(state.config.mensaje.slice(0,32))); return lines }
  function Tickets_render(v){ const header=`<div class="ticket58">${state.config.logo?`<img src="${'${state.config.logo}'}">`:''}<div style="text-align:center;font-weight:800">${state.config.negocio||'DINAMITA GYM POS'}</div>${state.config.direccion?`<div style="text-align:center">${'${state.config.direccion}'}</div>`:''}${state.config.telefono?`<div style="text-align:center">Tel: ${'${state.config.telefono}'}</div>`:''}${state.config.web?`<div style="text-align:center">${'${state.config.web}'}</div>`:''}</div>`; const lines=ticketLines(v).join('\n'); const body=$('#ticketMount'); body.innerHTML=header+`<pre>${lines}</pre><div class="right mt-2"><button class="btn" id="btnPrint">🖨️ Imprimir</button></div>`; $('#btnPrint').addEventListener('click',Tickets_print); window.__lastTicketHTML__=`<div id="ticketOnly" class="ticket58">${state.config.logo?`<img src="${'${state.config.logo}'}">`:''}<pre>${(state.config.negocio||'DINAMITA GYM POS')+'\n'}${lines}</pre></div>` }
  function Tickets_print(){ let h=$('#printHolder'); if(!h){h=document.createElement('div'); h.id='printHolder'; h.className='no-screen'; document.body.appendChild(h)} h.innerHTML=window.__lastTicketHTML__||''; window.print(); setTimeout(()=>{h.innerHTML=''},500) }
  window.Tickets={render:Tickets_render,print:Tickets_print};

  // Reportes (igual 4.1) – omitido por concisión

  // Mounts
  function mountVentas(){ $('#ventasMount').innerHTML = `<div class="grid-2">
    <div><label>Buscar producto</label><input id="ventaBuscar" placeholder="Nombre / SKU"><div id="ventaResultados" class="list"></div></div>
    <div><label>Carrito</label><div id="carrito" class="list"></div><div class="totals"><div>Subtotal: <strong id="ventaSubtotal">$0</strong></div><div>IVA (${state.config.iva}%): <strong id="ventaIVA">$0</strong></div><div>Total: <strong id="ventaTotal">$0</strong></div></div></div>
  </div>
  <div class="grid-2"><div><label>Cliente</label><select id="ventaCliente">${state.clientes.map(c=>`<option value="${c.id}" ${c.id==='PUBLICO'?'selected':''}>${c.nombre}</option>`).join('')}</select></div><div><label>Notas del ticket</label><input id="ventaNotas" placeholder="Gracias por tu compra 💥"></div></div>
  <div class="grid-2"><div></div><div class="right"><button class="btn" id="btnConfirm">✅ Confirmar venta</button></div></div>`;
    $('#ventaBuscar').addEventListener('input',e=>buscarProducto(e.target.value));
    $('#btnConfirm').addEventListener('click',confirmar);
    buscarProducto(''); renderCarrito();
  }
  function mountInventario(){ $('#inventarioMount').innerHTML=`<div class="grid-3">
    <div><label>SKU</label><input id="prodSku"></div><div><label>Nombre</label><input id="prodNombre"></div>
    <div><label>Categoría</label><input id="prodCategoria"></div><div><label>Tipo</label><select id="prodTipo"><option>Producto</option><option>Membresía</option><option>Servicio</option></select></div>
    <div><label>Duración (días)</label><input id="prodDuracion" type="number" value="0"></div><div><label>Crear membresía</label><select id="prodCreaMem"><option value="false">No</option><option value="true">Sí</option></select></div>
    <div><label>Precio</label><input id="prodPrecio" type="number" step="0.01"></div><div><label>Costo</label><input id="prodCosto" type="number" step="0.01"></div><div><label>Stock</label><input id="prodStock" type="number"></div>
    <div class="col-span-3"><label>Descripción</label><textarea id="prodDescr" rows="2"></textarea></div>
    <div class="col-span-3 right"><button class="btn" id="btnSaveInv">💾 Guardar/Actualizar</button><button class="btn outline" id="btnCleanInv">🧹 Limpiar</button><button class="btn small outline" id="btnCSVInv">📤 Exportar CSV</button></div></div>
    <div class="panel"><div class="filters"><input id="invSearch" placeholder="Buscar..."><select id="invCat"><option value="">Todas</option><option>Suplementos</option><option>Accesorios</option><option>Cafetería</option><option>Membresías</option><option>Servicios</option></select></div><div id="invTabla" class="table"></div></div>`;
    $('#btnSaveInv').addEventListener('click',guardarProd); $('#btnCleanInv').addEventListener('click',limpiarProd); $('#btnCSVInv').addEventListener('click',exportInvCSV);
    $('#invSearch').addEventListener('input',renderInvTabla); $('#invCat').addEventListener('change',renderInvTabla);
    renderInvTabla();
  }
  function mountClientes(){ $('#clientesMount').innerHTML=`<div class="grid-3">
    <input id="cliId" type="hidden"><div><label>Nombre</label><input id="cliNombre"></div><div><label>Teléfono</label><input id="cliTel"></div><div><label>Email</label><input id="cliEmail"></div>
    <div><label><input type="checkbox" id="cliCertMed"> Presenta certificado médico</label></div><div><label><input type="checkbox" id="cliEntrenaSolo"> Entrena por su cuenta</label></div><div></div>
    <div class="col-span-3 right"><button class="btn" id="btnCliSave">💾 Guardar/Actualizar</button><button class="btn outline" id="btnCliClean">🧹 Limpiar</button><button class="btn small outline" id="btnCliCSV">📤 Exportar CSV</button></div></div>
    <div class="panel"><div class="filters"><input id="cliSearch" placeholder="Buscar..."></div><div id="cliTabla" class="table"></div></div>`;
    $('#btnCliSave').addEventListener('click',cliGuardar); $('#btnCliClean').addEventListener('click',cliLimpiar); $('#btnCliCSV').addEventListener('click',exportCliCSV);
    $('#cliSearch').addEventListener('input',renderCliTabla);
    renderCliTabla();
  }
  function mountMembresias(){ $('#membresiasMount').innerHTML=`<div class="grid-3">
    <div><label>Cliente</label><div class="searchbox"><input id="memClienteSearch" placeholder="🔎 Buscar"><div id="memClienteResults" class="list"></div><input id="memClienteId" type="hidden"></div></div>
    <div><label>Tipo</label><select id="memTipo"><option>Visita</option><option>Semana</option><option selected>Mensualidad</option><option>6 Meses</option><option>12 Meses</option><option>VIP</option></select></div>
    <div><label>Inicio</label><input id="memInicio" type="date" value="${today()}"></div><div><label>Fin</label><input id="memFin" type="date" readonly></div>
    <div><label>Notas</label><input id="memNotas"></div><div class="right"><button class="btn" id="btnMemSave">💾 Guardar</button></div></div>
    <div class="panel"><div class="filters"><input id="memSearch" placeholder="Buscar..."><select id="memStatus"><option value="">Todos</option><option value="activa">Activas</option><option value="vencida">Vencidas</option><option value="próxima">Próx. a vencer</option></select></div><div id="memTabla" class="table"></div></div>`;
    $('#memClienteSearch').addEventListener('input',e=>memSearchCliente(e.target.value)); $('#memTipo').addEventListener('change',memChangeTipo); $('#memInicio').addEventListener('change',memChangeTipo); $('#btnMemSave').addEventListener('click',memGuardar); $('#memSearch').addEventListener('input',memRender); $('#memStatus').addEventListener('change',memRender); memChangeTipo(); memRender(); memSearchCliente('');
  }
  function mountCafeteria(){
    const grid=$('#cafeteriaMount'); const caf=state.inventario.filter(p=>p.categoria==='Cafetería');
    grid.innerHTML = '<div class=\"catalog\">'+caf.map(p=>`<div class="item"><div style="font-weight:700">${p.nombre}</div><div>${money(p.precio)}</div><button class="btn small" data-add="${p.sku}">Agregar</button></div>`).join('')+'</div><div class="right mt-2"><button class="btn" id="cafCobrar">Ir a cobrar</button></div>';
    $$('#cafeteriaMount [data-add]').forEach(b=>b.addEventListener('click',()=>add(b.dataset.add)));
    $('#cafCobrar').addEventListener('click',()=>{ const btn=$('.menu button[data-view=\"ventas\"]'); if(btn) btn.click() });
  }
  function mountHistorial(){ $('#historialMount').innerHTML=`<div class="filters"><input id="histFolio" placeholder="Folio"><input id="histCliente" placeholder="Cliente"><button class="btn small" id="btnHistBuscar">🔎 Buscar</button></div><div id="histTabla" class="table"></div>`; $('#btnHistBuscar').addEventListener('click',renderHist); renderHist(); }
  function mountConfig(){ $('#configMount').innerHTML=`<div class="grid-3">
    <div><label>IVA (%)</label><input id="cfgIVA" type="number" value="${state.config.iva}"></div><div><label>Nombre del negocio</label><input id="cfgNegocio" value="${state.config.negocio||''}"></div><div><label>Teléfono</label><input id="cfgTel" value="${state.config.telefono||''}"></div>
    <div class="col-span-3"><label>Dirección</label><input id="cfgDir" value="${state.config.direccion||''}"></div><div class="col-span-3"><label>Página web / Redes</label><input id="cfgWeb" value="${state.config.web||''}"></div>
    <div><label>Logo (local)</label><input type="file" accept="image/*" id="cfgLogo"></div><div class="col-span-3"><label>Mensaje de cierre</label><input id="cfgMensaje" value="${state.config.mensaje||''}"></div>
    <div class="col-span-3 right"><button class="btn" id="cfgSave">💾 Guardar</button><button class="btn outline" id="cfgExp">📤 Exportar respaldo</button><label class="btn outline"><input id="cfgImport" type="file" accept=".json" hidden>📥 Importar respaldo</label></div></div>
    <div class="panel"><div class="panel-title">🧾 Vista previa de encabezado de ticket</div><div id="cfgTicketPreview" class="ticket58"></div></div>`;
    $('#cfgLogo').addEventListener('change',e=>Config.loadLogo(e.target));
    $('#cfgSave').addEventListener('click',Config.guardar); $('#cfgExp').addEventListener('click',Config.export); $('#cfgImport').addEventListener('change',e=>Config.import(e.target));
    Config.renderPreview();
  }
  function mountTicket(){ $('#ticketMount').innerHTML='<div class="ticket58"><pre>Imprime una venta desde Ventas o Historial para ver aquí.</pre></div>'; }

  // Navigation events
  $('.menu').addEventListener('click',e=>{const b=e.target.closest('button[data-view]'); if(!b) return; show(b.dataset.view)});
  const hb=$('#hamburger'); if(hb){ let backdrop=$('.backdrop'); if(!backdrop){backdrop=document.createElement('div'); backdrop.className='backdrop'; document.body.appendChild(backdrop)} hb.addEventListener('click',()=>document.body.classList.toggle('drawer-open')); backdrop.addEventListener('click',()=>document.body.classList.remove('drawer-open')); }

  // CSV helper
  window.downloadCSV=function(filename,rows){const csv=rows.map(r=>r.map(x=>{x=(x==null?'':String(x)); if(x.includes(',')||x.includes('\"')||x.includes('\n')) x='\"'+x.replace(/\"/g,'\"\"')+'\"'; return x}).join(',')).join('\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename;a.click()};

  // Mount all
  function mountAll(){ mountDashboard(); mountVentas(); mountInventario(); mountClientes(); mountMembresias(); mountCafeteria(); mountHistorial(); mountConfig(); mountTicket(); }
  mountAll(); show('dashboard');
})();
