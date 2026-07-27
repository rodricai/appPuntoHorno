// URL DE GOOGLE APPS SCRIPT
const URL_API = "https://script.google.com/macros/s/AKfycbzEI8RkXq0ynb1eVW81SxLUuLuL-KnwOmyhwHqjyQ_-5M8jE8nYSVLgH1lRE_aOVJkAdg/exec";

// ESTADO GLOBAL DE LA APLICACIÓN
let productos = [];
let pedidos = [];
let ticketActual = [];

// INICIALIZACIÓN DE LA APLICACIÓN
document.addEventListener("DOMContentLoaded", () => {
  iniciarReloj();
  cargarDatosDesdeGoogle();
  configurarEventos();
});

// RELOJ EN TIEMPO REAL
function iniciarReloj() {
  const clockEl = document.getElementById("reloj-sistema");
  setInterval(() => {
    if (clockEl) {
      const ahora = new Date();
      clockEl.textContent = `${ahora.toLocaleDateString("es-AR")} ${ahora.toLocaleTimeString("es-AR")}`;
    }
  }, 1000);
}

// ASIGNACIÓN DE EVENTOS PRINCIPALES
function configurarEventos() {
  // Formularios
  document.getElementById("form-admin-stock")?.addEventListener("submit", guardarOActualizarProducto);
  document.getElementById("form-item-pedido")?.addEventListener("submit", agregarItemAlTicket);
  
  // Selects e Inputs de cálculo
  document.getElementById("admin-select-producto")?.addEventListener("change", alSeleccionarProdAdmin);
  document.getElementById("admin-costo")?.addEventListener("input", calcularPrecioFinalAdmin);
  document.getElementById("admin-ganancia")?.addEventListener("input", calcularPrecioFinalAdmin);
  document.getElementById("ticket-descuento")?.addEventListener("input", calcularTotalesTicket);
  document.getElementById("ticket-impuesto")?.addEventListener("input", calcularTotalesTicket);

  // Botones de Acción
  document.getElementById("btn-confirmar-pedido")?.addEventListener("click", confirmarPedido);
  document.getElementById("btn-imprimir-ticket")?.addEventListener("click", imprimirTicketActual);
  document.getElementById("btn-sincronizar")?.addEventListener("click", cargarDatosDesdeGoogle);
  document.getElementById("btn-imprimir-resumen")?.addEventListener("click", imprimirResumenDiario);
  document.getElementById("btn-limpiar-entregadas")?.addEventListener("click", limpiarComandasEntregadas);
}

// -------------------------------------------------------------
// COMUNICACIÓN ASINCRÓNICA CON API
// -------------------------------------------------------------
async function cargarDatosDesdeGoogle() {
  mostrarToast("Cargando datos...");
  try {
    const res = await fetch(URL_API);
    const data = await res.json();
    if (data.status === "success") {
      productos = data.productos || [];
      pedidos = data.pedidos || [];
      
      renderizarStock();
      poblarSelectoresProductos();
      renderizarComandas();
      mostrarToast("Datos actualizados correctamente");
    } else {
      mostrarToast("Error al leer datos: " + data.message, true);
    }
  } catch (err) {
    mostrarToast("Error de conexión con la API", true);
  }
}

async function guardarCambiosEnGoogle() {
  try {
    mostrarToast("Guardando cambios...");
    const payload = { productos, pedidos };
    
    await fetch(URL_API, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });

    mostrarToast("Cambios guardados exitosamente");
  } catch (err) {
    mostrarToast("Error al guardar cambios", true);
  }
}

// -------------------------------------------------------------
// GESTIÓN DE STOCK & PRODUCTOS
// -------------------------------------------------------------
function renderizarStock() {
  const listaStock = document.getElementById("lista-stock");
  if (!listaStock) return;

  if (productos.length === 0) {
    listaStock.innerHTML = '<div class="ticket-vacio">No hay productos registrados en el stock.</div>';
    return;
  }

  listaStock.innerHTML = productos.map(p => {
    const min = p.stockMinimo || 3;
    let estadoClass = "ok";
    if (p.stock <= 0) estadoClass = "critico";
    else if (p.stock <= min) estadoClass = "bajo";

    const porcentajeBarra = Math.min(100, Math.max(0, (p.stock / (min * 3)) * 100));

    return `
      <div class="stock-item">
        <div class="stock-item-info">
          <strong>${p.nombre} ${p.tamaño ? `(${p.tamaño})` : ''}</strong>
          <div>
            <span class="cantidad">${p.stock} u.</span>
            <button class="btn btn-secundario btn-restar-stock" style="padding: 2px 6px; font-size: 10px; margin-left: 4px;" data-id="${p.id}" title="Restar 1 unidad">-1</button>
            <button class="btn btn-secundario btn-eliminar-stock" style="padding: 2px 6px; font-size: 10px; color: var(--tomato); margin-left: 4px;" data-id="${p.id}" title="Eliminar producto">🗑️</button>
          </div>
        </div>
        <div class="stock-item-info">
          <span class="categoria">${p.categoria} — $${p.precioFinal.toFixed(2)}</span>
        </div>
        <div class="gauge-track">
          <div class="gauge-fill ${estadoClass}" style="width: ${porcentajeBarra}%;"></div>
        </div>
      </div>
    `;
  }).join('');

  // Asignar escuchadores dinámicos a botones de la lista de stock
  document.querySelectorAll(".btn-restar-stock").forEach(btn => {
    btn.addEventListener("click", (e) => restarUnidadStock(e.target.dataset.id));
  });

  document.querySelectorAll(".btn-eliminar-stock").forEach(btn => {
    btn.addEventListener("click", (e) => eliminarProductoStock(e.target.dataset.id));
  });
}

async function restarUnidadStock(idProd) {
  const prod = productos.find(p => p.id === idProd);
  if (prod) {
    if (prod.stock > 0) {
      prod.stock -= 1;
      renderizarStock();
      poblarSelectoresProductos();
      await guardarCambiosEnGoogle();
    } else {
      mostrarToast("El producto ya no tiene unidades disponibles", true);
    }
  }
}

async function eliminarProductoStock(idProd) {
  const prod = productos.find(p => p.id === idProd);
  if (!prod) return;

  // Uso de SweetAlert2 en reemplazo del confirm() nativo
  const result = await Swal.fire({
    title: '¿Eliminar producto?',
    text: `¿Deseas quitar "${prod.nombre}" del sistema?`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#e63946',
    cancelButtonColor: '#2e302b',
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar',
    background: '#1c1d1a',
    color: '#f4ebd0'
  });

  if (result.isConfirmed) {
    productos = productos.filter(p => p.id !== idProd);
    renderizarStock();
    poblarSelectoresProductos();
    await guardarCambiosEnGoogle();
    mostrarToast(`Se eliminó "${prod.nombre}" del sistema.`);
  }
}

function poblarSelectoresProductos() {
  const selectTicket = document.getElementById("select-producto-ticket");
  const selectAdmin = document.getElementById("admin-select-producto");

  if (selectTicket) {
    selectTicket.innerHTML = '<option value="">-- Seleccionar producto --</option>' + 
      productos.map(p => `<option value="${p.id}">${p.nombre} ${p.tamaño ? `(${p.tamaño})` : ''} - $${p.precioFinal.toFixed(2)} [Stock: ${p.stock}]</option>`).join('');
  }

  if (selectAdmin) {
    selectAdmin.innerHTML = '<option value="nuevo">+ Crear Nuevo Producto</option>' + 
      productos.map(p => `<option value="${p.id}">${p.nombre} ${p.tamaño ? `(${p.tamaño})` : ''}</option>`).join('');
  }
}

function alSeleccionarProdAdmin() {
  const selectAdmin = document.getElementById("admin-select-producto");
  const camposNuevo = document.getElementById("campos-nuevo-producto");
  if (!selectAdmin) return;
  const idProd = selectAdmin.value;

  if (idProd === "nuevo" || !idProd) {
    if (camposNuevo) camposNuevo.style.display = "flex";
    const formAdmin = document.getElementById("form-admin-stock");
    if (formAdmin) formAdmin.reset();
    return;
  }

  const prod = productos.find(p => p.id === idProd);
  if (prod) {
    if (camposNuevo) camposNuevo.style.display = "flex";
    document.getElementById("admin-nombre").value = prod.nombre || "";
    document.getElementById("admin-categoria").value = prod.categoria || "Pizza armada";
    document.getElementById("admin-tamano").value = prod.tamaño || "Grande";
    document.getElementById("admin-costo").value = prod.costo || 0;
    document.getElementById("admin-ganancia").value = prod.ganancia || 0;
    document.getElementById("admin-precio-final").value = prod.precioFinal || 0;
    document.getElementById("admin-stock-actual").value = prod.stock || 0;
    document.getElementById("admin-stock-minimo").value = prod.stockMinimo || 3;
  }
}

function calcularPrecioFinalAdmin() {
  const costo = parseFloat(document.getElementById("admin-costo").value) || 0;
  const ganancia = parseFloat(document.getElementById("admin-ganancia").value) || 0;
  const precioFinal = costo * (1 + ganancia / 100);
  document.getElementById("admin-precio-final").value = precioFinal.toFixed(2);
}

async function guardarOActualizarProducto(event) {
  event.preventDefault();
  const selectAdmin = document.getElementById("admin-select-producto");
  const idProd = selectAdmin ? selectAdmin.value : "nuevo";

  const nombre = document.getElementById("admin-nombre").value.trim();
  const categoria = document.getElementById("admin-categoria").value;
  const tamaño = document.getElementById("admin-tamano").value;
  const costo = parseFloat(document.getElementById("admin-costo").value) || 0;
  const ganancia = parseFloat(document.getElementById("admin-ganancia").value) || 0;
  let precioFinal = parseFloat(document.getElementById("admin-precio-final").value) || 0;
  
  if (precioFinal <= 0 && costo > 0) {
    precioFinal = costo * (1 + ganancia / 100);
  }

  const stock = parseInt(document.getElementById("admin-stock-actual").value) || 0;
  const stockMinimo = parseInt(document.getElementById("admin-stock-minimo").value) || 3;

  if (idProd === "nuevo") {
    if (!nombre) {
      mostrarToast("Por favor ingresa un nombre de producto", true);
      return;
    }
    const nuevoProducto = {
      id: "PROD-" + Date.now(),
      nombre,
      categoria,
      tamaño,
      costo,
      ganancia,
      precioFinal,
      stock,
      stockMinimo
    };
    productos.push(nuevoProducto);
  } else {
    const index = productos.findIndex(p => p.id === idProd);
    if (index !== -1) {
      productos[index] = {
        ...productos[index],
        nombre: nombre || productos[index].nombre,
        categoria,
        tamaño,
        costo,
        ganancia,
        precioFinal,
        stock,
        stockMinimo
      };
    }
  }

  renderizarStock();
  poblarSelectoresProductos();
  await guardarCambiosEnGoogle();
  
  const formAdmin = document.getElementById("form-admin-stock");
  if (formAdmin) formAdmin.reset();
  if (selectAdmin) selectAdmin.value = "nuevo";
}

// -------------------------------------------------------------
// ARMAR COMANDAS & TICKET
// -------------------------------------------------------------
function agregarItemAlTicket(e) {
  e.preventDefault();
  const selectProd = document.getElementById("select-producto-ticket");
  const cantInput = document.getElementById("input-cant-ticket");
  
  const idProd = selectProd ? selectProd.value : "";
  const cantidad = parseInt(cantInput ? cantInput.value : 1) || 1;

  if (!idProd) {
    mostrarToast("Selecciona un producto válido", true);
    return;
  }

  const prod = productos.find(p => p.id === idProd);
  if (!prod) return;

  if (prod.stock < cantidad) {
    mostrarToast(`Stock insuficiente. Quedan ${prod.stock} unidades de ${prod.nombre}`, true);
    return;
  }

  const itemExistente = ticketActual.find(i => i.id === idProd);
  if (itemExistente) {
    if (prod.stock < itemExistente.cantidad + cantidad) {
      mostrarToast(`Supera el stock disponible (${prod.stock})`, true);
      return;
    }
    itemExistente.cantidad += cantidad;
  } else {
    ticketActual.push({
      id: prod.id,
      nombre: prod.nombre,
      tamaño: prod.tamaño,
      precioUnitario: prod.precioFinal,
      costoUnitario: prod.costo,
      cantidad: cantidad
    });
  }

  cantInput.value = "1";
  renderizarTicket();
}

function quitarItemTicket(index) {
  ticketActual.splice(index, 1);
  renderizarTicket();
}

function renderizarTicket() {
  const lista = document.getElementById("lista-ticket-items");
  if (!lista) return;

  if (ticketActual.length === 0) {
    lista.innerHTML = '<li class="ticket-vacio">No hay productos agregados</li>';
    calcularTotalesTicket();
    return;
  }

  lista.innerHTML = ticketActual.map((item, idx) => `
    <li>
      <div>
        <strong>${item.cantidad}x</strong> ${item.nombre} ${item.tamaño ? `(${item.tamaño})` : ''}
        <br><small style="color:var(--text-dim)">$${item.precioUnitario.toFixed(2)} c/u</small>
      </div>
      <div>
        <strong>$${(item.cantidad * item.precioUnitario).toFixed(2)}</strong>
        <button class="quitar btn-quitar-item" data-idx="${idx}">✕</button>
      </div>
    </li>
  `).join('');

  document.querySelectorAll(".btn-quitar-item").forEach(btn => {
    btn.addEventListener("click", (e) => quitarItemTicket(parseInt(e.target.dataset.idx)));
  });

  calcularTotalesTicket();
}

function calcularTotalesTicket() {
  const subtotal = ticketActual.reduce((acc, item) => acc + (item.precioUnitario * item.cantidad), 0);
  
  const pctDescuento = parseFloat(document.getElementById("ticket-descuento").value) || 0;
  const pctImpuesto = parseFloat(document.getElementById("ticket-impuesto").value) || 0;

  const montoDescuento = subtotal * (pctDescuento / 100);
  const montoImpuesto = subtotal * (pctImpuesto / 100);

  const totalFinal = Math.max(0, subtotal - montoDescuento + montoImpuesto);

  document.getElementById("lbl-subtotal").textContent = `$${subtotal.toFixed(2)}`;
  document.getElementById("lbl-descuento").textContent = `-$${montoDescuento.toFixed(2)} (${pctDescuento}%)`;
  document.getElementById("lbl-impuesto").textContent = `+$${montoImpuesto.toFixed(2)} (${pctImpuesto}%)`;
  document.getElementById("lbl-total-final").textContent = `$${totalFinal.toFixed(2)}`;
}

async function confirmarPedido() {
  if (ticketActual.length === 0) {
    mostrarToast("Agrega al menos un producto a la comanda", true);
    return;
  }

  const cliente = document.getElementById("cliente-nombre").value.trim() || "Mostrador";
  const direccion = document.getElementById("cliente-direccion").value.trim() || "Local";
  
  const subtotal = ticketActual.reduce((acc, item) => acc + (item.precioUnitario * item.cantidad), 0);
  
  const pctDescuento = parseFloat(document.getElementById("ticket-descuento").value) || 0;
  const pctImpuesto = parseFloat(document.getElementById("ticket-impuesto").value) || 0;

  const montoDescuento = subtotal * (pctDescuento / 100);
  const montoImpuesto = subtotal * (pctImpuesto / 100);
  const totalFinal = Math.max(0, subtotal - montoDescuento + montoImpuesto);

  // Descontar Stock
  ticketActual.forEach(item => {
    const prod = productos.find(p => p.id === item.id);
    if (prod) {
      prod.stock = Math.max(0, prod.stock - item.cantidad);
    }
  });

  const ahora = new Date();
  const fechaHoraStr = `${ahora.toLocaleDateString("es-AR")} ${ahora.toLocaleTimeString("es-AR", { hour: '2-digit', minute: '2-digit' })}`;

  const nuevoPedido = {
    id: "CMD-" + Date.now().toString().slice(-4),
    cliente,
    direccion,
    hora: fechaHoraStr,
    items: [...ticketActual],
    subtotal,
    pctDescuento,
    montoDescuento,
    pctImpuesto,
    montoImpuesto,
    totalFinal,
    estado: "Pendiente"
  };

  pedidos.unshift(nuevoPedido);

  // Limpiar campos
  ticketActual = [];
  document.getElementById("cliente-nombre").value = "";
  document.getElementById("cliente-direccion").value = "";
  document.getElementById("ticket-descuento").value = "0";
  document.getElementById("ticket-impuesto").value = "0";

  renderizarTicket();
  renderizarStock();
  poblarSelectoresProductos();
  renderizarComandas();

  await guardarCambiosEnGoogle();
}

// -------------------------------------------------------------
// VISUALIZACIÓN Y CAMBIO DE ESTADO DE COMANDAS
// -------------------------------------------------------------
function renderizarComandas() {
  const listaComandas = document.getElementById("lista-comandas");
  if (!listaComandas) return;

  if (pedidos.length === 0) {
    listaComandas.innerHTML = '<div class="ticket-vacio">No hay comandas registradas.</div>';
    return;
  }

  listaComandas.innerHTML = pedidos.map(cmd => {
    let btnAccion = '';
    if (cmd.estado === "Pendiente") {
      btnAccion = `<button class="btn btn-primary btn-cambiar-estado" data-id="${cmd.id}" data-estado="En Preparación">En Preparación</button>`;
    } else if (cmd.estado === "En Preparación") {
      btnAccion = `<button class="btn btn-confirmar btn-cambiar-estado" data-id="${cmd.id}" data-estado="Listo">Marcar Listo</button>`;
    } else if (cmd.estado === "Listo") {
      btnAccion = `<button class="btn btn-secundario btn-cambiar-estado" data-id="${cmd.id}" data-estado="Entregado">Archivar / Entregado</button>`;
    }

    return `
      <div class="comanda ${cmd.estado === 'Entregado' ? 'entregada' : ''}">
        <div class="comanda-header">
          <strong>${cmd.id} — ${cmd.cliente}</strong>
          <span style="font-size: 11px; opacity: 0.8;">${cmd.hora}</span>
        </div>
        <div class="comanda-info">
          📍 ${cmd.direccion} | Estado: <strong>${cmd.estado}</strong>
        </div>
        <ul>
          ${(cmd.items || []).map(i => `<li><span>${i.cantidad}x ${i.nombre}</span> <strong>$${(i.cantidad * i.precioUnitario).toFixed(2)}</strong></li>`).join('')}
        </ul>
        <div class="stock-item-info comanda-totales" style="margin-bottom:8px;">
          <span>Total:</span>
          <strong>$${cmd.totalFinal.toFixed(2)}</strong>
        </div>
        <div class="comanda-acciones">
          ${btnAccion}
          <button class="btn btn-secundario btn-imprimir-cmd" data-id="${cmd.id}" title="Imprimir comanda">🖨️</button>
        </div>
      </div>
    `;
  }).join('');

  document.querySelectorAll(".btn-cambiar-estado").forEach(btn => {
    btn.addEventListener("click", (e) => cambiarEstadoComanda(e.target.dataset.id, e.target.dataset.estado));
  });

  document.querySelectorAll(".btn-imprimir-cmd").forEach(btn => {
    btn.addEventListener("click", (e) => imprimirComandaGuardada(e.target.dataset.id));
  });
}

async function cambiarEstadoComanda(idCmd, nuevoEstado) {
  const cmd = pedidos.find(p => p.id === idCmd);
  if (cmd) {
    cmd.estado = nuevoEstado;
    renderizarComandas();
    await guardarCambiosEnGoogle();
  }
}

async function limpiarComandasEntregadas() {
  const entregadas = pedidos.filter(p => p.estado === "Entregado");
  if (entregadas.length === 0) {
    mostrarToast("No hay comandas entregadas para limpiar", true);
    return;
  }

  // Uso de SweetAlert2 en reemplazo del confirm() nativo
  const result = await Swal.fire({
    title: '¿Limpiar historial?',
    text: `¿Deseas quitar las ${entregadas.length} comandas entregadas de la pantalla?`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#e63946',
    cancelButtonColor: '#2e302b',
    confirmButtonText: 'Sí, limpiar',
    cancelButtonText: 'Cancelar',
    background: '#1c1d1a',
    color: '#f4ebd0'
  });

  if (result.isConfirmed) {
    pedidos = pedidos.filter(p => p.estado !== "Entregado");
    renderizarComandas();
    await guardarCambiosEnGoogle();
    mostrarToast("Comandas entregadas removidas del panel.");
  }
}

// -------------------------------------------------------------
// FUNCIONES DE IMPRESIÓN
// -------------------------------------------------------------
function imprimirTicketActual() {
  if (ticketActual.length === 0) {
    mostrarToast("No hay productos en el ticket para imprimir", true);
    return;
  }

  const cliente = document.getElementById("cliente-nombre").value.trim() || "Mostrador";
  const direccion = document.getElementById("cliente-direccion").value.trim() || "Local";
  const total = document.getElementById("lbl-total-final").textContent;

  const ahora = new Date();
  const fechaHora = `${ahora.toLocaleDateString("es-AR")} ${ahora.toLocaleTimeString("es-AR")}`;

  let contenidoImp = `
    <html>
    <head>
      <title>Ticket Comanda - Punto Horno</title>
      <style>
        body { font-family: monospace; width: 260px; padding: 10px; font-size: 12px; }
        h2 { text-align: center; margin: 5px 0; }
        p { margin: 3px 0; }
        hr { border-top: 1px dashed #000; }
        .row { display: flex; justify-content: space-between; margin: 4px 0; }
      </style>
    </head>
    <body>
      <h2>PUNTO HORNO</h2>
      <p><strong>Fecha/Hora:</strong> ${fechaHora}</p>
      <p><strong>Cliente:</strong> ${cliente}</p>
      <p><strong>Ubicación:</strong> ${direccion}</p>
      <hr>
      ${ticketActual.map(i => `<div class="row"><span>${i.cantidad}x ${i.nombre} (${i.tamaño || 'Gde'})</span><span>$${(i.cantidad * i.precioUnitario).toFixed(2)}</span></div>`).join('')}
      <hr>
      <div class="row"><strong>TOTAL:</strong> <strong>${total}</strong></div>
    </body>
    </html>
  `;

  const ventanaImp = window.open("", "_blank", "width=300,height=450");
  ventanaImp.document.write(contenidoImp);
  ventanaImp.document.close();
  ventanaImp.print();
}

function imprimirComandaGuardada(idCmd) {
  const cmd = pedidos.find(p => p.id === idCmd);
  if (!cmd) return;

  let contenidoImp = `
    <html>
    <head>
      <title>Comanda ${cmd.id} - Punto Horno</title>
      <style>
        body { font-family: monospace; width: 260px; padding: 10px; font-size: 12px; }
        h2 { text-align: center; margin: 5px 0; }
        p { margin: 3px 0; }
        hr { border-top: 1px dashed #000; }
        .row { display: flex; justify-content: space-between; margin: 4px 0; }
      </style>
    </head>
    <body>
      <h2>PUNTO HORNO</h2>
      <p><strong>COMANDA:</strong> ${cmd.id}</p>
      <p><strong>Fecha/Hora:</strong> ${cmd.hora}</p>
      <p><strong>Cliente:</strong> ${cmd.cliente}</p>
      <p><strong>Ubicación:</strong> ${cmd.direccion}</p>
      <p><strong>Estado:</strong> ${cmd.estado}</p>
      <hr>
      ${(cmd.items || []).map(i => `<div class="row"><span>${i.cantidad}x ${i.nombre}</span><span>$${(i.cantidad * i.precioUnitario).toFixed(2)}</span></div>`).join('')}
      <hr>
      <div class="row"><strong>TOTAL:</strong> <strong>$${cmd.totalFinal.toFixed(2)}</strong></div>
    </body>
    </html>
  `;

  const ventanaImp = window.open("", "_blank", "width=300,height=450");
  ventanaImp.document.write(contenidoImp);
  ventanaImp.document.close();
  ventanaImp.print();
}

function imprimirResumenDiario() {
  if (pedidos.length === 0) {
    mostrarToast("No hay comandas registradas para el resumen", true);
    return;
  }

  const ahora = new Date();
  const fechaHoraActual = `${ahora.toLocaleDateString("es-AR")} ${ahora.toLocaleTimeString("es-AR")}`;
  const totalRecaudado = pedidos.reduce((acc, p) => acc + (p.totalFinal || 0), 0);

  let contenidoImp = `
    <html>
    <head>
      <title>Resumen de Ventas - Punto Horno</title>
      <style>
        body { font-family: monospace; width: 280px; padding: 10px; font-size: 12px; }
        h2, h3 { text-align: center; margin: 4px 0; }
        p { margin: 3px 0; }
        hr { border-top: 1px dashed #000; }
        .row { display: flex; justify-content: space-between; margin: 3px 0; }
      </style>
    </head>
    <body>
      <h2>PUNTO HORNO</h2>
      <h3>RESUMEN DE COMANDAS</h3>
      <p><strong>Generado:</strong> ${fechaHoraActual}</p>
      <p><strong>Total Comandas:</strong> ${pedidos.length}</p>
      <hr>
      ${pedidos.map(p => `
        <div class="row">
          <span>${p.id} (${p.cliente})</span>
          <span>$${p.totalFinal.toFixed(2)}</span>
        </div>
      `).join('')}
      <hr>
      <div class="row" style="font-size: 14px;">
        <strong>TOTAL GENERAL:</strong>
        <strong>$${totalRecaudado.toFixed(2)}</strong>
      </div>
    </body>
    </html>
  `;

  const ventanaImp = window.open("", "_blank", "width=320,height=500");
  ventanaImp.document.write(contenidoImp);
  ventanaImp.document.close();
  ventanaImp.print();
}

// -------------------------------------------------------------
// NOTIFICACIONES CON TOASTIFY JS
// -------------------------------------------------------------
function mostrarToast(mensaje, esError = false) {
  Toastify({
    text: mensaje,
    duration: 3000,
    gravity: "bottom",
    position: "right",
    style: {
      background: esError ? "#e63946" : "#52796f",
      color: "#ffffff",
      borderRadius: "4px",
      fontFamily: "Inter, sans-serif",
      fontSize: "13px"
    }
  }).showToast();
}