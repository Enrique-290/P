
// DINAMITA GYM POS v4.0.1 — simple functional core (LS-based)
(function(){
  const $ = (sel, root=document)=>root.querySelector(sel);
  const $$ = (sel, root=document)=>Array.from(root.querySelectorAll(sel));
  const LSKEY = "dgpos_v401";
  const state = load() || seed();
  const views = ["dashboard","ventas","inventario","clientes","membresias","cafeteria","historial","config","ticket"];

  function save(){ localStorage.setItem(LSKEY, JSON.stringify(state)); }
  function load(){ try{return JSON.parse(localStorage.getItem(LSKEY));}catch(e){return null;} }
  function uid(){ return Math.random().toString(36).slice(2,10); }
  function today(){ return (new Date()).toISOString().slice(0,10); }
  function money(n){ return "$" + (Number(n||0).toFixed(2)); }

  function seed(){
    return {
      schemaVersion:"4.0.1",
      config:{iva:16,mensaje:"¡Gracias por tu compra en DINAMITA GYM POS!",logo:null},
      inventario:[
        {sku:"SKU-001",nombre:"Shaker",categoria:"Accesorios",precio:120,costo:60,stock:10,descr:"Vaso mezclador",img:null},
        {sku:"SKU-002",nombre:"Proteína Whey",categoria:"Suplementos",precio:650,costo:420,stock:5,descr:"Whey 2lb",img:null},
        {sku:"SKU-003",nombre:"Café americano",categoria:"Cafetería",precio:35,costo:8,stock:999,descr:"",img:null}
      ],
      clientes:[{id:uid(),nombre:"Daniel Fuentes Ríos",tel:"555-111-2222",email:"daniel@mail.com",certMed:false,entrenaSolo:false}],
      membresias:[],
      ventas:[]
    };
  }

  // Router
  function show(view){
    views.forEach(v=>$("#view-"+v).classList.add("hidden"));
    $("#view-"+view).classList.remove("hidden");
    $$(".menu button").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
    $("#viewTitle").textContent = $(`.menu button[data-view="${view}"]`).textContent.replace(/^[^\w]+/,'').trim();
  }

  // Dashboard
  function mountDashboard(){
    const mount = $("#dashboardMount");
    const hoy = new Date().toISOString().slice(0,10);
    const ventasHoy = state.ventas.filter(v=>v.fecha.slice(0,10)===hoy);
    const totalHoy = ventasHoy.reduce((a,b)=>a+b.total,0);
    const ganHoy = ventasHoy.reduce((a,b)=>a + b.items.reduce((g,it)=>{
      const inv = state.inventario.find(p=>p.sku===it.sku);
      return g + ((it.precio-(inv?inv.costo:0))*it.cant);
    },0),0);
    const stock = state.inventario.reduce((a,b)=>a+(b.stock||0),0);
    mount.innerHTML = `
      <div class="cards">
        <div class="card"><div class="card-title">💵 Ventas de hoy</div><div class="card-value">${money(totalHoy)}</div></div>
        <div class="card"><div class="card-title">🎫 Tickets emitidos</div><div class="card-value">${ventasHoy.length}</div></div>
        <div class="card"><div class="card-title">📦 Productos en stock</div><div class="card-value">${stock}</div></div>
        <div class="card"><div class="card-title">📈 Ganancia de hoy</div><div class="card-value">${money(ganHoy)}</div></div>
      </div>`;
  }

  // Ventas
  let carrito = [];
  function buscarProducto(q){
    const res = state.inventario.filter(p=>[p.sku,p.nombre,p.categoria].join(" ").toLowerCase().includes(q.toLowerCase()));
    const list = $("#ventaResultados");
    list.innerHTML = res.map(p=>`
      <div class="row" style="display:grid;grid-template-columns:1fr 80px 80px;gap:6px;padding:6px;border-bottom:1px solid var(--border)">
        <div><strong>${p.nombre}</strong><br><small class="badge">${p.categoria||''}</small></div>
        <div>${money(p.precio)}</div>
        <div><button class="btn small" onclick="Ventas.add('${p.sku}')">Agregar</button></div>
      </div>
    `).join("") || "<div style='padding:8px'>Sin resultados</div>";
  }
  function renderCarrito(){
    const c = $("#carrito");
    c.innerHTML = carrito.map(it=>`
      <div class="row" style="display:grid;grid-template-columns:1fr 70px 90px 90px;gap:6px;padding:6px;border-bottom:1px solid var(--border)">
        <div>${it.nombre}</div>
        <div>x<input type="number" min="1" value="${it.cant}" style="width:50px" onchange="Ventas.cant('${it.sku}', this.value)"></div>
        <div>${money(it.precio)}</div>
        <div>${money(it.precio*it.cant)}</div>
      </div>
    `).join("") || "<div style='padding:8px'>Carrito vacío</div>";
    const sub = carrito.reduce((a,b)=>a+b.precio*b.cant,0);
    const iva = sub*(Number(state.config.iva||0)/100);
    const tot = sub+iva;
    $("#ventaSubtotal").textContent = money(sub);
    $("#ventaIVA").textContent = money(iva);
    $("#ventaTotal").textContent = money(tot);
  }
  function add(sku){
    const p = state.inventario.find(x=>x.sku===sku); if(!p) return;
    const ex = carrito.find(i=>i.sku===sku); 
    if(ex) ex.cant++; else carrito.push({sku:p.sku,nombre:p.nombre,precio:p.precio,cant:1});
    renderCarrito();
  }
  function cant(sku,v){ const it = carrito.find(i=>i.sku===sku); if(!it) return; it.cant = Math.max(1, Number(v||1)); renderCarrito(); }
  function confirmar(){
    if(!carrito.length) return alert("Agrega productos");
    const sub = carrito.reduce((a,b)=>a+b.precio*b.cant,0);
    const iva = sub*(Number(state.config.iva||0)/100);
    const tot = sub+iva;
    const clienteSel = $("#ventaCliente").value || null;
    const notas = $("#ventaNotas").value||"";
    const folio = "T"+(Date.now().toString(36).toUpperCase());
    const venta = {folio,fecha:new Date().toISOString(),clienteId:clienteSel,items:JSON.parse(JSON.stringify(carrito)),subtotal:sub,iva:iva,total:tot,notas};
    state.ventas.push(venta);
    // disminuir stock
    carrito.forEach(it=>{ const p=state.inventario.find(x=>x.sku===it.sku); if(p && Number.isFinite(p.stock)) p.stock = Math.max(0,(p.stock - it.cant)); });
    save();
    carrito = [];
    renderCarrito();
    alert("Venta registrada: "+folio);
    Tickets.render(venta);
    window.print();
  }
  const Ventas = {buscarProducto, add, cant, confirmar};
  window.Ventas = Ventas;

  function mountVentas(){
    $("#ventasMount").innerHTML = `
      <div class="grid-2">
        <div>
          <label>Buscar producto</label>
          <input id="ventaBuscar" placeholder="Nombre / SKU" oninput="Ventas.buscarProducto(this.value)">
          <div id="ventaResultados" class="list"></div>
        </div>
        <div>
          <label>Carrito</label>
          <div id="carrito" class="list"></div>
          <div class="totals">
            <div>Subtotal: <strong id="ventaSubtotal">$0</strong></div>
            <div>IVA (${state.config.iva}%): <strong id="ventaIVA">$0</strong></div>
            <div>Total: <strong id="ventaTotal">$0</strong></div>
          </div>
        </div>
      </div>
      <div class="grid-2">
        <div><label>Cliente (opcional)</label>
          <select id="ventaCliente">${state.clientes.map(c=>`<option value="${c.id}">${c.nombre}</option>`).join('<option value="">-- ninguno --</option>')}</select>
        </div>
        <div><label>Notas del ticket</label><input id="ventaNotas" placeholder="Gracias por tu compra en Dinamita 💥"></div>
      </div>
      <div class="grid-2"><div></div><div class="right"><button class="btn" onclick="Ventas.confirmar()">✅ Confirmar venta</button></div></div>
    `;
    buscarProducto("");
    renderCarrito();
  }

  // Inventario
  function mountInventario(){
    $("#inventarioMount").innerHTML = `
      <div class="grid-3">
        <div><label>SKU</label><input id="prodSku" placeholder="SKU-001"></div>
        <div><label>Nombre</label><input id="prodNombre" placeholder="Nombre"></div>
        <div><label>Categoría</label><input id="prodCategoria" placeholder="Suplementos/Accesorios/Cafetería"></div>
        <div><label>Precio</label><input id="prodPrecio" type="number" step="0.01"></div>
        <div><label>Costo</label><input id="prodCosto" type="number" step="0.01"></div>
        <div><label>Stock</label><input id="prodStock" type="number" step="1"></div>
        <div class="col-span-3"><label>Descripción</label><textarea id="prodDescr" rows="2"></textarea></div>
        <div class="col-span-3 right">
          <button class="btn" onclick="Inventario.guardar()">💾 Guardar/Actualizar</button>
          <button class="btn outline" onclick="Inventario.limpiar()">🧹 Limpiar</button>
          <button class="btn small outline" onclick="Inventario.exportCSV()">📤 Exportar CSV</button>
        </div>
      </div>
      <div class="panel">
        <div class="filters">
          <input id="invSearch" placeholder="Buscar..." oninput="Inventario.renderTabla()">
          <select id="invCat" onchange="Inventario.renderTabla()">
            <option value="">Todas</option><option>Suplementos</option><option>Accesorios</option><option>Cafetería</option>
          </select>
        </div>
        <div id="invTabla" class="table"></div>
      </div>
    `;
    Inventario.renderTabla();
  }
  function invRow(p){ return `
    <div class="row">
      <div>${p.sku}</div>
      <div>${p.nombre} <span class="badge">${p.categoria||''}</span></div>
      <div>${money(p.precio)}</div>
      <div>${money(p.costo||0)}</div>
      <div>${p.stock||0}</div>
      <div>
        <button class="icon-btn" onclick="Inventario.edit('${p.sku}')">✏️</button>
        <button class="icon-btn" onclick="Inventario.del('${p.sku}')">🗑️</button>
      </div>
    </div>`; }
  function renderInvTabla(){
    const q = ($("#invSearch")?.value||"").toLowerCase();
    const cat = $("#invCat")?.value||"";
    const data = state.inventario.filter(p=>(!cat || p.categoria===cat) && [p.sku,p.nombre,p.categoria].join(" ").toLowerCase().includes(q));
    $("#invTabla").innerHTML = `<div class="row header"><div>SKU</div><div>Nombre</div><div>Precio</div><div>Costo</div><div>Stock</div><div>Acciones</div></div>` + data.map(invRow).join("");
  }
  function guardarProd(){
    const sku=$("#prodSku").value.trim(); if(!sku) return alert("SKU es obligatorio");
    let p = state.inventario.find(x=>x.sku===sku);
    const obj = {
      sku,
      nombre:$("#prodNombre").value.trim(),
      categoria:$("#prodCategoria").value.trim(),
      precio:Number($("#prodPrecio").value||0),
      costo:Number($("#prodCosto").value||0),
      stock:Number($("#prodStock").value||0),
      descr:$("#prodDescr").value||"",
      img:null
    };
    if(p) Object.assign(p,obj); else state.inventario.push(obj);
    save(); renderInvTabla(); alert("Guardado");
  }
  function limpiarProd(){ ["prodSku","prodNombre","prodCategoria","prodPrecio","prodCosto","prodStock","prodDescr"].forEach(id=>$("#"+id).value=""); }
  function editProd(sku){
    const p = state.inventario.find(x=>x.sku===sku); if(!p) return;
    $("#prodSku").value=p.sku; $("#prodNombre").value=p.nombre; $("#prodCategoria").value=p.categoria||"";
    $("#prodPrecio").value=p.precio; $("#prodCosto").value=p.costo||0; $("#prodStock").value=p.stock||0;
    $("#prodDescr").value=p.descr||"";
  }
  function delProd(sku){ if(confirm("¿Borrar producto?")){ state.inventario = state.inventario.filter(x=>x.sku!==sku); save(); renderInvTabla(); } }
  function exportInvCSV(){
    const rows = [["SKU","Nombre","Categoría","Precio","Costo","Stock","Descripción"]]
      .concat(state.inventario.map(p=>[p.sku,p.nombre,p.categoria||"",p.precio,p.costo||0,p.stock||0,(p.descr||"").replace(/\n/g," ")]));
    downloadCSV("inventario.csv", rows);
  }
  const Inventario = {renderTabla:renderInvTabla, guardar:guardarProd, limpiar:limpiarProd, edit:editProd, del:delProd, exportCSV:exportInvCSV};
  window.Inventario = Inventario;

  // Clientes
  function mountClientes(){
    $("#clientesMount").innerHTML = `
      <div class="grid-3">
        <input id="cliId" type="hidden">
        <div><label>Nombre</label><input id="cliNombre"></div>
        <div><label>Teléfono</label><input id="cliTel"></div>
        <div><label>Email</label><input id="cliEmail"></div>
        <div><label><input type="checkbox" id="cliCertMed"> Presenta certificado médico</label></div>
        <div><label><input type="checkbox" id="cliEntrenaSolo"> Entrena por su cuenta</label></div>
        <div></div>
        <div class="col-span-3 right">
          <button class="btn" onclick="Clientes.guardar()">💾 Guardar/Actualizar</button>
          <button class="btn outline" onclick="Clientes.limpiar()">🧹 Limpiar</button>
          <button class="btn small outline" onclick="Clientes.exportCSV()">📤 Exportar CSV</button>
        </div>
      </div>
      <div class="panel">
        <div class="filters"><input id="cliSearch" placeholder="Buscar..." oninput="Clientes.renderTabla()"></div>
        <div id="cliTabla" class="table"></div>
      </div>`;
    Clientes.renderTabla();
  }
  function renderCliTabla(){
    const q = ($("#cliSearch")?.value||"").toLowerCase();
    const data = state.clientes.filter(c=>[c.nombre,c.tel,c.email].join(" ").toLowerCase().includes(q));
    $("#cliTabla").innerHTML = `<div class="row header"><div style="grid-column:1/3">Cliente</div><div>Teléfono</div><div>Email</div><div style="grid-column:5/7">Acciones</div></div>` + data.map(c=>`
      <div class="row" style="grid-template-columns:1fr 1fr 160px 160px 160px 120px">
        <div>${c.nombre} ${c.certMed?'<span class="badge">Certif.</span>':''} ${c.entrenaSolo?'<span class="badge">Entrena solo</span>':''}</div>
        <div>${c.id}</div>
        <div>${c.tel||''}</div>
        <div>${c.email||''}</div>
        <div>
          <button class="icon-btn" onclick="Clientes.edit('${c.id}')">✏️</button>
          <button class="icon-btn" onclick="Clientes.del('${c.id}')">🗑️</button>
        </div>
      </div>`).join("");
  }
  function cliGuardar(){
    const id = $("#cliId").value || uid();
    const obj = {
      id, nombre:$("#cliNombre").value.trim(),
      tel:$("#cliTel").value.trim(), email:$("#cliEmail").value.trim(),
      certMed:$("#cliCertMed").checked, entrenaSolo:$("#cliEntrenaSolo").checked
    };
    const ex = state.clientes.find(c=>c.id===id);
    if(ex) Object.assign(ex,obj); else state.clientes.push(obj);
    save(); Clientes.limpiar(); Clientes.renderTabla();
  }
  function cliLimpiar(){ ["cliId","cliNombre","cliTel","cliEmail"].forEach(id=>$("#"+id).value=""); $("#cliCertMed").checked=false; $("#cliEntrenaSolo").checked=false; }
  function cliEdit(id){
    const c = state.clientes.find(x=>x.id===id); if(!c) return;
    $("#cliId").value=c.id; $("#cliNombre").value=c.nombre; $("#cliTel").value=c.tel||""; $("#cliEmail").value=c.email||"";
    $("#cliCertMed").checked=!!c.certMed; $("#cliEntrenaSolo").checked=!!c.entrenaSolo;
  }
  function cliDel(id){ if(confirm("¿Borrar cliente?")){ state.clientes = state.clientes.filter(x=>x.id!==id); save(); Clientes.renderTabla(); } }
  function exportCliCSV(){
    const rows=[["ID","Nombre","Teléfono","Email","Certificado","EntrenaSolo"]]
      .concat(state.clientes.map(c=>[c.id,c.nombre,c.tel||"",c.email||"",c.certMed?1:0,c.entrenaSolo?1:0]));
    downloadCSV("clientes.csv",rows);
  }
  const Clientes = {renderTabla:renderCliTabla, guardar:cliGuardar, limpiar:cliLimpiar, edit:cliEdit, del:cliDel, exportCSV:exportCliCSV};
  window.Clientes = Clientes;

  // Membresías
  function mountMembresias(){
    $("#membresiasMount").innerHTML = `
      <div class="grid-3">
        <div>
          <label>Cliente</label>
          <div class="searchbox">
            <input id="memClienteSearch" placeholder="🔎 Buscar nombre/tel/email" oninput="Membresias.searchCliente(this.value)">
            <div id="memClienteResults" class="list"></div>
            <input id="memClienteId" type="hidden">
          </div>
        </div>
        <div><label>Tipo</label><select id="memTipo" onchange="Membresias.changeTipo()">
          <option>Visita</option><option>Semana</option><option selected>Mensualidad</option>
          <option>6 Meses</option><option>12 Meses</option><option>VIP</option><option>Promo 2x$500</option>
        </select></div>
        <div><label>Inicio</label><input id="memInicio" type="date" value="${today()}"></div>
        <div><label>Fin</label><input id="memFin" type="date" readonly></div>
        <div><label>Notas</label><input id="memNotas"></div>
        <div class="right"><button class="btn" onclick="Membresias.guardar()">💾 Guardar</button></div>
      </div>
      <div class="panel">
        <div class="filters"><input id="memSearch" placeholder="Buscar..." oninput="Membresias.renderTabla()">
          <select id="memStatus" onchange="Membresias.renderTabla()"><option value="">Todos</option><option value="activa">Activas</option><option value="vencida">Vencidas</option><option value="próxima">Próx. a vencer</option></select>
        </div>
        <div id="memTabla" class="table"></div>
      </div>`;
    Membresias.changeTipo(); Membresias.renderTabla(); Membresias.searchCliente("");
  }
  function memChangeTipo(){
    const ini = $("#memInicio").value || today();
    const d = new Date(ini);
    const tipo = $("#memTipo").value;
    if(tipo==="Mensualidad") d.setMonth(d.getMonth()+1);
    else if(tipo==="Semana") d.setDate(d.getDate()+7);
    else if(tipo==="6 Meses") d.setMonth(d.getMonth()+6);
    else if(tipo==="12 Meses") d.setMonth(d.getMonth()+12);
    else d.setDate(d.getDate()+1);
    $("#memFin").value = d.toISOString().slice(0,10);
  }
  function memSearchCliente(q){
    q = (q||"").toLowerCase();
    const data = state.clientes.filter(c=>[c.nombre,c.tel,c.email].join(" ").toLowerCase().includes(q));
    $("#memClienteResults").innerHTML = data.slice(0,10).map(c=>`<div style="padding:8px;border-bottom:1px solid var(--border);cursor:pointer" onclick="Membresias.selCliente('${c.id}')">${c.nombre} <small>${c.tel||''}</small></div>`).join("");
  }
  function memSelCliente(id){ $("#memClienteId").value=id; const c=state.clientes.find(x=>x.id===id); $("#memClienteSearch").value=c?c.nombre:""; $("#memClienteResults").innerHTML=""; }
  function memGuardar(){
    const id = uid();
    const cli = $("#memClienteId").value; if(!cli) return alert("Selecciona cliente");
    const obj = {id, clienteId:cli, tipo:$("#memTipo").value, inicio:$("#memInicio").value, fin:$("#memFin").value, notas:$("#memNotas").value||""};
    state.membresias.push(obj); save(); alert("Membresía registrada"); Membresias.renderTabla();
  }
  function memRender(){
    const q = ($("#memSearch")?.value||"").toLowerCase();
    const st = $("#memStatus")?.value||"";
    const data = state.membresias.map(m=>({m, c: state.clientes.find(c=>c.id===m.clienteId)||{nombre:"(eliminado)"}}))
      .filter(x=>[x.c.nombre,x.m.tipo,x.m.notas].join(" ").toLowerCase().includes(q))
      .filter(x=>{
        const hoy = today();
        const status = (x.m.fin<hoy)?"vencida":((new Date(x.m.fin)-new Date(hoy))<=7*86400000?"próxima":"activa");
        return !st || st===status;
      });
    $("#memTabla").innerHTML = `<div class="row header"><div>Cliente</div><div>Tipo</div><div>Inicio</div><div>Fin</div><div>Notas</div><div>Acciones</div></div>` +
      data.map(x=>`<div class="row"><div>${x.c.nombre}</div><div>${x.m.tipo}</div><div>${x.m.inicio}</div><div>${x.m.fin}</div><div>${x.m.notas||''}</div><div><button class="icon-btn" onclick="Membresias.del('${x.m.id}')">🗑️</button></div></div>`).join("");
  }
  function memDel(id){ if(confirm("¿Borrar membresía?")){ state.membresias=state.membresias.filter(m=>m.id!==id); save(); Membresias.renderTabla(); } }
  const Membresias = {changeTipo:memChangeTipo, searchCliente:memSearchCliente, selCliente:memSelCliente, guardar:memGuardar, renderTabla:memRender, del:memDel};
  window.Membresias = Membresias;

  // Cafetería
  function mountCafeteria(){
    const grid = $("#cafeteriaMount");
    const caf = state.inventario.filter(p=>p.categoria==="Cafetería");
    grid.innerHTML = `<div class="catalog">` + caf.map(p=>`
      <div class="item">
        <div style="font-weight:700">${p.nombre}</div>
        <div>${money(p.precio)}</div>
        <button class="btn small" onclick="Ventas.add('${p.sku}')">Agregar</button>
      </div>`).join("") + `</div>
      <div class="right mt-2"><button class="btn" onclick="document.querySelector('[data-view=ventas]').click()">Ir a cobrar</button></div>`;
  }

  // Historial
  function mountHistorial(){
    $("#historialMount").innerHTML = `
      <div class="filters">
        <input id="histFolio" placeholder="Folio">
        <input id="histCliente" placeholder="Cliente">
        <button class="btn small" onclick="Historial.render()">🔎 Buscar</button>
        <button class="btn small outline" onclick="Historial.exportCSV()">📤 Exportar CSV</button>
      </div>
      <div id="histTabla" class="table"></div>`;
    Historial.render();
  }
  function renderHist(){
    const qf=($("#histFolio")?.value||"").toLowerCase();
    const qc=($("#histCliente")?.value||"").toLowerCase();
    const data = state.ventas.map(v=>({v, c: v.clienteId ? state.clientes.find(c=>c.id===v.clienteId) : null}))
      .filter(x=>(!qf || x.v.folio.toLowerCase().includes(qf)) && (!qc || (x.c && x.c.nombre.toLowerCase().includes(qc))));
    $("#histTabla").innerHTML = `<div class="row header"><div>Folio</div><div>Fecha</div><div>Total</div><div>Cliente</div><div>Notas</div><div>Acciones</div></div>` +
      data.map(x=>`<div class="row"><div>${x.v.folio}</div><div>${x.v.fecha.slice(0,16).replace('T',' ')}</div><div>${money(x.v.total)}</div><div>${x.c?x.c.nombre:"-"}</div><div>${x.v.notas||''}</div><div><button class="icon-btn" onclick="Historial.reprint('${x.v.folio}')">🖨️</button></div></div>`).join("");
  }
  function exportHistCSV(){
    const rows=[["Folio","Fecha","Cliente","Subtotal","IVA","Total","Notas"]].concat(
      state.ventas.map(v=>[v.folio,v.fecha,(state.clientes.find(c=>c.id===v.clienteId)||{}).nombre||"",v.subtotal,v.iva,v.total,(v.notas||"").replace(/\n/g," ")])
    );
    downloadCSV("historial.csv",rows);
  }
  function reprint(folio){
    const v = state.ventas.find(x=>x.folio===folio); if(!v) return alert("No encontrado");
    Tickets.render(v); window.print();
  }
  const Historial = {render:renderHist, exportCSV:exportHistCSV, reprint:reprint};
  window.Historial = Historial;

  // Configuración & Respaldos
  function mountConfig(){
    $("#configMount").innerHTML = `
      <div class="grid-3">
        <div><label>IVA (%)</label><input id="cfgIVA" type="number" step="1" value="${state.config.iva}"></div>
        <div class="col-span-3"><label>Mensaje del ticket</label><input id="cfgMensaje" value="${state.config.mensaje}"></div>
        <div class="col-span-3 right">
          <button class="btn" onclick="Config.guardar()">💾 Guardar</button>
          <button class="btn outline" onclick="Config.export()">📤 Exportar respaldo</button>
          <label class="btn outline"><input id="cfgImport" type="file" accept=".json" hidden onchange="Config.import(this)">📥 Importar respaldo</label>
        </div>
      </div>`;
  }
  const Config = {
    guardar(){
      state.config.iva = Number($("#cfgIVA").value||0);
      state.config.mensaje = $("#cfgMensaje").value||"";
      save(); alert("Configuración guardada");
    },
    export(){
      const blob = new Blob([JSON.stringify(state,null,2)],{type:"application/json"});
      const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="dgpos-backup-v401.json"; a.click();
    },
    import(input){
      const f=input.files[0]; if(!f) return;
      const rd=new FileReader();
      rd.onload=()=>{
        try{
          const data=JSON.parse(rd.result);
          // Simple merge with defaults
          if(!data.schemaVersion) data.schemaVersion="import";
          ["config","inventario","clientes","membresias","ventas"].forEach(k=>{ if(Array.isArray(state[k])&&Array.isArray(data[k])) state[k]=data[k]; else if(data[k]) state[k]=data[k]; });
          save(); alert("Respaldo importado"); location.reload();
        }catch(e){ alert("Archivo inválido"); }
      };
      rd.readAsText(f);
    }
  };
  window.Config = Config;

  // Ticket
  function ticketLines(v){
    const lines=[];
    lines.push(center("DINAMITA GYM POS"));
    lines.push(center("Ticket de venta"));
    lines.push(`Folio: ${v.folio}`);
    lines.push(`Fecha: ${v.fecha.slice(0,19).replace('T',' ')}`);
    lines.push("-".repeat(32));
    v.items.forEach(it=>{
      const name = it.nombre.slice(0,14);
      const q = String(it.cant).padStart(2," ");
      const pr = money(it.precio).replace("$","");
      const tot = money(it.precio*it.cant).replace("$","");
      const left = `${q}x ${name}`;
      const right = tot;
      lines.push(padLine(left,right,32));
    });
    lines.push("-".repeat(32));
    lines.push(padLine("SUBTOTAL", money(v.subtotal), 32));
    lines.push(padLine("IVA", money(v.iva), 32));
    lines.push(padLine("TOTAL", money(v.total), 32));
    if(v.notas){ lines.push("-".repeat(32)); lines.push(v.notas); }
    lines.push(center((state.config.mensaje||"").slice(0,32)));
    return lines;
  }
  function center(t){ t=String(t); const w=32; const pad=Math.max(0,Math.floor((w-t.length)/2)); return " ".repeat(pad)+t; }
  function padLine(l,r,w){ l=String(l); r=String(r); if(l.length+r.length>w) l=l.slice(0,w-r.length-1); return l + " ".repeat(Math.max(1,w-l.length-r.length)) + r; }
  function renderTicket(v){
    const body=$("#ticketMount"); 
    const lines=ticketLines(v);
    body.innerHTML = `<div class="ticket"><div class="t-title">${window.APP_BRAND||"DINAMITA GYM POS"}</div><div class="t-sub">Resumen</div><pre style="white-space:pre-wrap">${lines.join("\n")}</pre></div>`;
  }
  const Tickets = {render:renderTicket, print:()=>window.print()};
  window.Tickets = Tickets;

  // Historial Reprint helper in header (button already in UI)
  // Navigation
  function mountAll(){
    mountDashboard(); mountVentas(); mountInventario(); mountClientes(); mountMembresias(); mountCafeteria(); mountHistorial(); mountConfig();
  }

  // Menu bindings
  $(".menu").addEventListener("click",(e)=>{
    const b=e.target.closest("button[data-view]"); if(!b) return;
    show(b.dataset.view);
    document.body.classList.remove("drawer-open");
  });

  // Drawer mobile
  document.addEventListener('DOMContentLoaded',()=>{
    const btn=$("#hamburger"); const bd=document.body; const backdrop=$(".backdrop")||document.createElement("div");
    if(backdrop && !backdrop.classList.contains("backdrop")){ backdrop.className="backdrop"; document.body.appendChild(backdrop); }
    const close=()=>bd.classList.remove('drawer-open');
    if(btn) btn.addEventListener('click',()=>bd.classList.toggle('drawer-open'));
    if(backdrop) backdrop.addEventListener('click',close);
  });

  // Expose helpers
  window.downloadCSV = function(filename, rows){
    const csv = rows.map(r=>r.map(x=>{
      x = (x==null?"":String(x));
      if(x.includes(",")||x.includes("\"")||x.includes("\n")) x = `"${x.replace(/"/g,'""')}"`;
      return x;
    }).join(",")).join("\n");
    const blob = new Blob([csv], {type:"text/csv;charset=utf-8;"});
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=filename; a.click();
  };

  // Init
  mountAll(); show("dashboard");
})();
