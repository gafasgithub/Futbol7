// Interfaz: pestañas Jugadores, Equipos y Condicionantes.
// La convocatoria se guarda en este navegador. Los condicionantes y criterios salen de
// datos/condicionantes.js; si se cambian aquí, quedan pendientes en el navegador hasta que se
// descarga y se sube ese fichero.

const CLAVE_GUARDADO = 'futbol7.v1';
const CONVOCADOS = POR_EQUIPO * 2;
const ABREV = { Portero: 'POR', Defensa: 'DEF', Medio: 'MED', Delantero: 'DEL' };
const LADOS = ['A', 'B'];
const NOMBRES_DEFECTO = { A: 'Amarillo', B: 'Negro' };

let jugadores = [];
let porId = new Map();

let estado = {
  seleccion: [],
  fecha: '',
  convocatoria: null,   // { fecha, ids, equipos: { A, B }, opciones, indice, retocada }
  condicionantes: [],   // { id, tipo: 'separar' | 'juntar', a, b } o { id, tipo: 'equipo', a, lado: 'A' | 'B' }
  pesos: { ...PESOS_DEFECTO },
  cambiosLocales: false, // condicionantes o criterios cambiados aquí y aún no subidos a datos/condicionantes.js
  nombres: { ...NOMBRES_DEFECTO },
};

const ui = { pestana: 'jugadores', texto: '', filtroPos: '', orden: 'media', marcado: null };

// ---------- utilidades ----------

const $ = sel => document.querySelector(sel);
const escapar = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (x, d = 1) => x.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d });
const nivel = m => m >= 7.5 ? 'top' : m >= 6.5 ? 'alto' : m >= 5.5 ? 'medio' : 'bajo';

function guardar() {
  try { localStorage.setItem(CLAVE_GUARDADO, JSON.stringify(estado)); } catch (e) { /* sin almacenamiento */ }
}

function recuperar() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE_GUARDADO) || 'null');
    if (guardado) estado = { ...estado, ...guardado, pesos: { ...PESOS_DEFECTO, ...guardado.pesos } };
  } catch (e) { /* datos corruptos o sin almacenamiento: se empieza de cero */ }
  if (estado.nombres.A === 'Blancos' && estado.nombres.B === 'Negros') estado.nombres = { ...NOMBRES_DEFECTO };
  limpiarEstado();
}

// Quita lo que ya no exista en la fuente de jugadores. Devuelve true si hubo que borrar la convocatoria.
function limpiarEstado() {
  estado.seleccion = estado.seleccion.filter(id => porId.has(id));
  estado.condicionantes = estado.condicionantes.filter(c => porId.has(c.a) && (c.tipo === 'equipo' || porId.has(c.b)));
  const conv = estado.convocatoria;
  const rota = conv && !LADOS.every(l => conv.equipos?.[l]?.every(h => porId.has(h.id)));
  if (rota) estado.convocatoria = null;
  sincronizarConFichero();
  guardar();
  return Boolean(rota);
}

function ponerJugadores({ jugadores: lista, fecha }) {
  jugadores = lista.filter(j => j.nombre);
  porId = new Map(jugadores.map(j => [j.id, j]));
  const conHora = fecha.length > 10;
  const cuando = new Date(conHora ? fecha : fecha + 'T12:00:00');
  const dia = cuando.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  const hora = conHora ? ' ' + cuando.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '';
  const enlace = `<a href="${FUENTE.web}" target="_blank" rel="noopener">fut7-puntuaciones</a>`;
  $('#fuente').innerHTML = `${jugadores.length} jugadores de ${enlace} · actualizados el ${dia}${hora}`;
}

// Botón "Recargar datos": vuelve a leer fut7-puntuaciones y cuenta qué ha cambiado.
async function recargarJugadores(boton) {
  boton.disabled = true;
  boton.textContent = 'Recargando…';
  const antes = porId;
  const leido = await descargarJugadores();
  boton.disabled = false;
  boton.textContent = '⟳ Recar.datos';
  if (!leido) { avisar('No se pudo conectar con fut7-puntuaciones. Se siguen usando los datos que había.'); return; }
  ponerJugadores(leido);
  const huellaJugador = j => JSON.stringify([j.nombre, j.pos, j.r, j.v, j.t]);
  const nuevos = jugadores.filter(j => !antes.has(j.id)).length;
  const quitados = [...antes.keys()].filter(id => !porId.has(id)).length;
  const cambiados = jugadores.filter(j => antes.has(j.id) && huellaJugador(antes.get(j.id)) !== huellaJugador(j)).length;
  const convocatoriaBorrada = limpiarEstado();
  pintar();
  const partes = [
    nuevos && `${nuevos} nuevo${nuevos > 1 ? 's' : ''}`,
    quitados && `${quitados} quitado${quitados > 1 ? 's' : ''}`,
    cambiados && `${cambiados} con cambios`,
  ].filter(Boolean);
  avisar((partes.length ? `Datos recargados: ${partes.join(', ')}.` : 'Datos recargados: no había cambios.')
    + (convocatoriaBorrada ? ' La convocatoria tenía jugadores que ya no existen y se ha quitado.' : ''));
}

let temporizadorAviso;
function avisar(texto) {
  const caja = $('#aviso');
  caja.textContent = texto;
  caja.hidden = false;
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => { caja.hidden = true; }, 2600);
}

// Próximos lunes y miércoles (incluido hoy si toca).
function proximasFechas(cuantas = 6) {
  const fechas = [];
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  while (fechas.length < cuantas) {
    if (d.getDay() === 1 || d.getDay() === 3) fechas.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return fechas;
}

function textoFecha(iso, largo = true) {
  const d = new Date(iso + 'T12:00:00');
  const t = d.toLocaleDateString('es-ES', largo
    ? { weekday: 'long', day: 'numeric', month: 'long' }
    : { weekday: 'short', day: 'numeric', month: 'short' });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function cambiarPestana(nombre) {
  ui.pestana = nombre;
  ui.marcado = null;
  document.querySelectorAll('[data-pestana]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.pestana === nombre)));
  document.querySelectorAll('.panel').forEach(p => { p.hidden = p.id !== nombre; });
  pintar();
  window.scrollTo({ top: 0 });
}

function pintar() {
  if (ui.pestana === 'jugadores') pintarJugadores();
  if (ui.pestana === 'equipos') pintarEquipos();
  if (ui.pestana === 'condicionantes') pintarCondicionantes();
}

// ---------- pestaña Jugadores ----------

function pintarJugadores() {
  const panel = $('#jugadores');
  if (!panel.dataset.montado) {
    panel.dataset.montado = '1';
    panel.innerHTML = `
      <div class="herramientas">
        <input type="search" id="buscar" placeholder="Buscar jugador" autocomplete="off">
        <div class="filtros" role="group" aria-label="Filtrar por posición">
          <button data-filtro="" class="activo">Todos</button>
          ${POSICIONES.map(p => `<button data-filtro="${p}">${ABREV[p]}</button>`).join('')}
        </div>
        <select id="orden" aria-label="Ordenar">
          <option value="media">Media</option>
          <option value="nombre">Nombre</option>
        </select>
        <button class="boton" id="pegar-lista" title="Pegar el mensaje con los convocados y seleccionarlos">☰ Pegar lista</button>
        <button class="boton" id="recargar" title="Recargar datos: volver a leer jugadores, puntuaciones y posiciones de fut7-puntuaciones">⟳ Recar.datos</button>
      </div>
      <div class="rejilla" id="rejilla"></div>
      <div class="barra" id="barra"></div>`;
    $('#buscar').addEventListener('input', e => { ui.texto = e.target.value; pintarRejilla(); });
    $('#orden').addEventListener('change', e => { ui.orden = e.target.value; pintarRejilla(); });
    $('#recargar').addEventListener('click', e => recargarJugadores(e.currentTarget));
    $('#pegar-lista').addEventListener('click', abrirLista);
    panel.querySelector('.filtros').addEventListener('click', e => {
      const b = e.target.closest('[data-filtro]');
      if (!b) return;
      ui.filtroPos = b.dataset.filtro;
      panel.querySelectorAll('[data-filtro]').forEach(x => x.classList.toggle('activo', x === b));
      pintarRejilla();
    });
    $('#rejilla').addEventListener('click', e => {
      const ficha = e.target.closest('.ficha');
      if (ficha) alternarJugador(Number(ficha.dataset.id));
    });
    $('#barra').addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.id === 'limpiar') { estado.seleccion = []; guardar(); pintarJugadores(); }
      if (b.id === 'crear') crearConvocatoria();
    });
    $('#barra').addEventListener('change', e => {
      if (e.target.id === 'fecha') { estado.fecha = e.target.value; guardar(); }
    });
  }
  pintarRejilla();
  pintarBarra();
}

function pintarRejilla() {
  const texto = ui.texto.trim().toLocaleLowerCase('es');
  const sel = new Set(estado.seleccion);
  const lleno = sel.size >= CONVOCADOS;
  const lista = jugadores
    .filter(j => !texto || j.nombre.toLocaleLowerCase('es').includes(texto))
    .filter(j => !ui.filtroPos || j.pos.includes(ui.filtroPos))
    .sort((x, y) => ui.orden === 'nombre' ? x.nombre.localeCompare(y.nombre, 'es') : y.media - x.media);
  $('#rejilla').innerHTML = lista.length ? lista.map(j => fichaJugador(j, sel.has(j.id), lleno && !sel.has(j.id))).join('')
    : '<p class="vacio">No hay jugadores con ese filtro.</p>';
}

function fichaJugador(j, elegido, bloqueado) {
  const barra = (letra, valor, titulo) => `
    <span class="atr" title="${titulo}: ${num(valor)}">
      <span class="atr-letra">${letra}</span>
      <span class="atr-pista"><span style="width:${Math.max(0, Math.min(100, valor * 10))}%"></span></span>
      <span class="atr-valor">${num(valor)}</span>
    </span>`;
  const segunda = j.pos[1] !== j.pos[0] ? `<span class="pos secundaria">${ABREV[j.pos[1]]}</span>` : '';
  return `
    <button class="ficha${elegido ? ' elegida' : ''}" data-id="${j.id}" aria-pressed="${elegido}" ${bloqueado ? 'aria-disabled="true"' : ''}>
      <span class="ficha-cabeza">
        <span class="ficha-nombre">${escapar(j.nombre)}</span>
        <span class="nota nivel-${nivel(j.media)}">${num(j.media)}</span>
      </span>
      <span class="ficha-pos"><span class="pos">${ABREV[j.pos[0]]}</span>${segunda}</span>
      <span class="ficha-atr">
        ${barra('R', j.r, 'Resistencia')}${barra('V', j.v, 'Velocidad')}${barra('T', j.t, 'Técnica')}
      </span>
      <span class="marca-check" aria-hidden="true">✓</span>
    </button>`;
}

function alternarJugador(id) {
  const i = estado.seleccion.indexOf(id);
  if (i >= 0) estado.seleccion.splice(i, 1);
  else if (estado.seleccion.length < CONVOCADOS) estado.seleccion.push(id);
  else { avisar(`Ya hay ${CONVOCADOS} seleccionados. Quita a alguien antes.`); return; }
  guardar();
  pintarRejilla();
  pintarBarra();
}

function pintarBarra() {
  const n = estado.seleccion.length;
  const elegidos = estado.seleccion.map(id => porId.get(id));
  const fechas = proximasFechas();
  if (!fechas.includes(estado.fecha)) estado.fecha = fechas[0];
  // Cuántos de los seleccionados pueden jugar en cada posición, frente a los huecos que hay.
  const cobertura = POSICIONES.map(p => {
    const hay = elegidos.filter(j => j.pos.includes(p)).length;
    const hacen = FORMACION[p] * 2;
    const corto = n === CONVOCADOS && hay < hacen;
    return `<span class="cob${corto ? ' corto' : ''}" title="${hay} pueden jugar de ${p.toLowerCase()} (hacen falta ${hacen})">${ABREV[p]} ${hay}</span>`;
  }).join('');
  $('#barra').innerHTML = `
    <div class="barra-info">
      <span class="contador"><b>${n}</b>/${CONVOCADOS}</span>
      <span class="coberturas">${cobertura}</span>
    </div>
    <div class="barra-acciones">
      <select id="fecha" aria-label="Fecha del partido">
        ${fechas.map(f => `<option value="${f}" ${f === estado.fecha ? 'selected' : ''}>${textoFecha(f, false)}</option>`).join('')}
      </select>
      <button id="limpiar" class="boton secundario" ${n ? '' : 'disabled'}>Limpiar</button>
      <button id="crear" class="boton principal" ${n === CONVOCADOS ? '' : 'disabled'}
        title="${n === CONVOCADOS ? '' : `Selecciona ${CONVOCADOS - n} más`}">Crear convocatoria</button>
    </div>`;
}

function crearConvocatoria() {
  if (estado.seleccion.length !== CONVOCADOS) return;
  const conv = estado.convocatoria;
  if (conv?.retocada && !confirm('La convocatoria actual tiene cambios hechos a mano. ¿Sustituirla por una nueva?')) return;
  generarConvocatoria(estado.seleccion, estado.fecha);
  cambiarPestana('equipos');
}

function generarConvocatoria(ids, fecha) {
  const convocados = ids.map(id => porId.get(id));
  const opciones = generarEquipos(convocados, estado.condicionantes, estado.pesos)
    .map(({ A, B }) => ({ A, B }));
  estado.convocatoria = { fecha, ids: [...ids], opciones, indice: 0, equipos: copiar(opciones[0]), retocada: false };
  ui.marcado = null;
  guardar();
}

const copiar = eq => ({ A: eq.A.map(h => ({ ...h })), B: eq.B.map(h => ({ ...h })) });

// ---------- pegar lista de convocados ----------

// { texto, filas: [{ texto, id, puntos }] | null }. Se conserva al cerrar para no perder lo pegado.
const lista = { texto: '', filas: null };

function abrirLista() {
  $('#modal-lista')?.remove();
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.id = 'modal-lista';
  modal.innerHTML = '<div class="modal-caja lista-caja" role="dialog" aria-label="Pegar lista de convocados"></div>';
  document.body.appendChild(modal);
  pintarLista();
  modal.querySelector('textarea')?.focus();
}

function pintarLista() {
  const caja = $('#modal-lista .modal-caja');
  if (!caja) return;
  if (!lista.filas) {
    caja.innerHTML = `
      <h2>PEGAR LISTA</h2>
      <p class="ayuda">Pega el mensaje con los convocados. Si los nombres van numerados ("1. Reta"), solo se leen esos y se ignoran el título y las reservas.</p>
      <textarea id="lista-texto" rows="12" placeholder="1. Reta&#10;2. Charly&#10;3. Luis&#10;…">${escapar(lista.texto)}</textarea>
      <div class="fila-botones">
        <button class="boton principal" data-lista="interpretar">Interpretar</button>
        <button class="boton secundario" data-lista="cerrar">Cancelar</button>
      </div>`;
    return;
  }
  const ids = lista.filas.map(f => f.id).filter(id => id !== null);
  const repetidos = new Set(ids.filter((id, i) => ids.indexOf(id) !== i));
  const elegidos = new Set(ids).size;
  const sinAsignar = lista.filas.filter(f => f.id === null).length;
  const opciones = [...jugadores].sort((x, y) => x.nombre.localeCompare(y.nombre, 'es'));
  const filas = lista.filas.map((f, i) => {
    const clase = f.id === null ? 'sin' : repetidos.has(f.id) ? 'repetido' : f.puntos && f.puntos < 90 ? 'dudoso' : '';
    const nota = { sin: 'sin asignar', repetido: 'repetido', dudoso: 'revisar' }[clase] ?? '';
    return `
      <li class="lista-fila ${clase}">
        <span class="lista-escrito" title="Texto pegado">${escapar(f.texto)}</span>
        <select data-fila="${i}" aria-label="Jugador para ${escapar(f.texto)}">
          <option value="">— Nadie —</option>
          ${opciones.map(j => `<option value="${j.id}" ${j.id === f.id ? 'selected' : ''}>${escapar(j.nombre)}</option>`).join('')}
        </select>
        <span class="lista-nota">${nota}</span>
      </li>`;
  }).join('');
  const demasiados = elegidos > CONVOCADOS;
  const resumen = [
    `<b>${elegidos}</b> jugadores elegidos de ${lista.filas.length} nombres`,
    sinAsignar && `${sinAsignar} sin asignar`,
    repetidos.size && 'hay jugadores repetidos',
  ].filter(Boolean).join(' · ');
  caja.innerHTML = `
    <h2>PEGAR LISTA</h2>
    <p class="ayuda">Comprueba a quién corresponde cada nombre y cámbialo en el desplegable si no es correcto. Al aceptar, estos jugadores sustituyen a la selección actual.</p>
    <ol class="lista-filas">${filas}</ol>
    <p class="lista-resumen${demasiados ? ' mal' : ''}">${resumen}${demasiados ? ` · máximo ${CONVOCADOS}: quita a alguien` : ''}</p>
    <div class="fila-botones">
      <button class="boton principal" data-lista="aceptar" ${elegidos && !demasiados ? '' : 'disabled'}>Aceptar</button>
      <button class="boton secundario" data-lista="volver">Editar texto</button>
      <button class="boton secundario" data-lista="cerrar">Cancelar</button>
    </div>`;
}

function accionLista(accion) {
  if (accion === 'cerrar') { $('#modal-lista')?.remove(); return; }
  if (accion === 'interpretar') {
    lista.texto = $('#lista-texto').value;
    const filas = interpretarLista(lista.texto, jugadores);
    if (!filas.length) { avisar('No se ha encontrado ningún nombre en el texto.'); return; }
    lista.filas = filas;
  }
  if (accion === 'volver') lista.filas = null;
  if (accion === 'aceptar') {
    estado.seleccion = [...new Set(lista.filas.map(f => f.id).filter(id => id !== null))];
    const fecha = fechaDeLista(lista.texto, proximasFechas());
    if (fecha) estado.fecha = fecha;
    guardar();
    $('#modal-lista')?.remove();
    lista.texto = '';
    lista.filas = null;
    pintarJugadores();
    const faltan = CONVOCADOS - estado.seleccion.length;
    avisar(`${estado.seleccion.length} jugadores seleccionados.` + (faltan ? ` Faltan ${faltan}.` : ' Ya puedes crear la convocatoria.'));
    return;
  }
  pintarLista();
}

// ---------- pestaña Equipos ----------

function pintarEquipos() {
  const panel = $('#equipos');
  const conv = estado.convocatoria;
  if (!conv) {
    panel.innerHTML = `
      <div class="vacio grande">
        <p>Todavía no hay convocatoria.</p>
        <p>Elige ${CONVOCADOS} jugadores en la pestaña <b>Jugadores</b> y pulsa <b>Crear convocatoria</b>.</p>
        <button class="boton principal" data-ir="jugadores">Ir a Jugadores</button>
      </div>`;
    return;
  }
  const an = analizarEquipos(conv.equipos, porId, estado.condicionantes);
  const comparar = (etiqueta, campo, dec = 1) => {
    const a = an.A[campo], b = an.B[campo];
    const pa = a + b ? (a / (a + b)) * 100 : 50;
    return `
      <div class="comp">
        <span class="comp-valor">${num(a, dec)}</span>
        <span class="comp-barra" title="${etiqueta}"><span style="width:${pa}%"></span></span>
        <span class="comp-valor">${num(b, dec)}</span>
        <span class="comp-etiqueta">${etiqueta}</span>
      </div>`;
  };
  const estadoOpcion = conv.retocada ? 'retocada a mano' : `opción ${conv.indice + 1} de ${conv.opciones.length}`;
  const avisos = an.avisos.map(a => {
    if (a.tipo === 'posicion') return `<li class="aviso-pos"><b>${escapar(a.jugador.nombre)}</b> juega de ${a.pos.toLowerCase()} (lo suyo: ${a.jugador.pos.map(p => p.toLowerCase()).filter((p, i, l) => l.indexOf(p) === i).join(' / ')})</li>`;
    if (a.tipo === 'equipo') return `<li class="aviso-cond"><b>${escapar(a.a.nombre)}</b> debe ir siempre en ${escapar(estado.nombres[a.lado])} y está en ${escapar(estado.nombres[a.lado === 'A' ? 'B' : 'A'])}</li>`;
    if (a.tipo === 'separar') return `<li class="aviso-cond"><b>${escapar(a.a.nombre)}</b> y <b>${escapar(a.b.nombre)}</b> no pueden ir juntos y están en el mismo equipo</li>`;
    return `<li class="aviso-cond"><b>${escapar(a.a.nombre)}</b> y <b>${escapar(a.b.nombre)}</b> deberían ir juntos y están separados</li>`;
  }).join('');

  panel.innerHTML = `
    <div class="eq-cabecera">
      <div>
        <h2>${textoFecha(conv.fecha)}</h2>
        <p class="sub">${estadoOpcion}${an.condiciones ? ` · ${an.condiciones} condicionante${an.condiciones > 1 ? 's' : ''} en juego` : ''}</p>
      </div>
      <div class="eq-acciones">
        <button class="boton secundario" data-accion="otra" ${conv.opciones.length > 1 ? '' : 'disabled'}>Otra opción</button>
        <button class="boton secundario" data-accion="regenerar">Volver a generar</button>
        <button class="boton principal" data-accion="imagen">Imagen para WhatsApp</button>
        <button class="boton secundario" data-accion="copiar">Copiar texto</button>
        <button class="boton peligro" data-accion="eliminar">Eliminar convocatoria</button>
      </div>
    </div>

    <div class="marcador">
      <div class="marcador-equipo lado-A">
        <span class="marcador-nombre">${escapar(estado.nombres.A)}</span>
        <span class="marcador-media">${num(an.A.media, 2)}</span>
      </div>
      <div class="marcador-dif ${an.difMedia < 0.1 ? 'bien' : an.difMedia < 0.25 ? 'regular' : 'mal'}">
        <span>diferencia</span><b>${num(an.difMedia, 2)}</b>
      </div>
      <div class="marcador-equipo lado-B">
        <span class="marcador-nombre">${escapar(estado.nombres.B)}</span>
        <span class="marcador-media">${num(an.B.media, 2)}</span>
      </div>
      <div class="comps">
        ${comparar('Resistencia', 'r')}${comparar('Velocidad', 'v')}${comparar('Técnica', 't')}
      </div>
    </div>

    ${avisos ? `<ul class="avisos">${avisos}</ul>` : ''}

    <p class="pista">${ui.marcado
      ? `<b>${escapar(porId.get(conv.equipos[ui.marcado.lado][ui.marcado.i].id).nombre)}</b> seleccionado: toca otro jugador para intercambiarlos o elige un sustituto.`
      : 'Toca un jugador y después otro para intercambiarlos de posición o de equipo.'}</p>

    ${ui.marcado ? panelSustituto(conv) : ''}

    <div class="campos">${LADOS.map(l => campo(l, conv.equipos[l], an[l])).join('')}</div>`;
}

function campo(lado, huecos, resumen) {
  const filas = [...POSICIONES].reverse().map(pos => {
    const enFila = huecos.map((h, i) => ({ ...h, i })).filter(h => h.pos === pos);
    return `<div class="fila fila-${pos}">${enFila.map(h => hueco(lado, h)).join('')}</div>`;
  }).join('');
  return `
    <div class="campo lado-${lado}">
      <div class="campo-cabeza">
        <input class="nombre-equipo" data-lado="${lado}" value="${escapar(estado.nombres[lado])}" aria-label="Nombre del equipo" maxlength="20">
        <span class="nota nivel-${nivel(resumen.media)}">${num(resumen.media, 2)}</span>
      </div>
      <div class="cesped">
        <div class="lineas" aria-hidden="true"><span class="medio-campo"></span><span class="area"></span></div>
        ${filas}
      </div>
    </div>`;
}

function hueco(lado, h) {
  const j = porId.get(h.id);
  const encaje = j.pos[0] === h.pos ? 'natural' : j.pos.includes(h.pos) ? 'segunda' : 'fuera';
  const titulo = { natural: 'En su posición favorita', segunda: 'En su segunda posición', fuera: 'Fuera de sus posiciones' }[encaje];
  const marcado = ui.marcado && ui.marcado.lado === lado && ui.marcado.i === h.i;
  return `
    <button class="hueco encaje-${encaje}${marcado ? ' marcado' : ''}" data-lado="${lado}" data-i="${h.i}" title="${titulo}">
      <span class="hueco-pos">${ABREV[h.pos]}</span>
      <span class="hueco-nombre">${escapar(j.nombre)}</span>
      <span class="hueco-pie"><span class="hueco-media">${num(j.media)}</span><span class="hueco-suyas">${j.pos.filter((p, i, l) => l.indexOf(p) === i).map(p => ABREV[p]).join('·')}</span></span>
    </button>`;
}

function panelSustituto(conv) {
  const enCampo = new Set(LADOS.flatMap(l => conv.equipos[l].map(h => h.id)));
  const resto = jugadores.filter(j => !enCampo.has(j.id)).sort((x, y) => x.nombre.localeCompare(y.nombre, 'es'));
  return `
    <div class="sustituto">
      <label for="sustituto">Sustituir por</label>
      <select id="sustituto">
        <option value="">— elige un jugador no convocado —</option>
        ${resto.map(j => `<option value="${j.id}">${escapar(j.nombre)} · ${num(j.media)} · ${j.pos.filter((p, i, l) => l.indexOf(p) === i).map(p => ABREV[p]).join('/')}</option>`).join('')}
      </select>
      <button class="boton secundario" data-accion="desmarcar">Cancelar</button>
    </div>`;
}

function tocarHueco(lado, i) {
  const conv = estado.convocatoria;
  const m = ui.marcado;
  if (!m) { ui.marcado = { lado, i }; pintarEquipos(); return; }
  if (m.lado === lado && m.i === i) { ui.marcado = null; pintarEquipos(); return; }
  // Se intercambian los jugadores; cada hueco conserva su posición.
  const x = conv.equipos[m.lado][m.i], y = conv.equipos[lado][i];
  [x.id, y.id] = [y.id, x.id];
  conv.retocada = true;
  ui.marcado = null;
  guardar();
  pintarEquipos();
}

function sustituir(idNuevo) {
  const conv = estado.convocatoria;
  const h = conv.equipos[ui.marcado.lado][ui.marcado.i];
  const viejo = h.id;
  h.id = idNuevo;
  conv.ids = conv.ids.map(id => id === viejo ? idNuevo : id);
  // La selección de la pestaña Jugadores sigue a la convocatoria.
  const k = estado.seleccion.indexOf(viejo);
  if (k >= 0) estado.seleccion[k] = idNuevo;
  conv.retocada = true;
  ui.marcado = null;
  guardar();
  pintarEquipos();
  avisar(`${porId.get(viejo).nombre} sale y entra ${porId.get(idNuevo).nombre}`);
}

function accionEquipos(accion) {
  const conv = estado.convocatoria;
  if (accion === 'otra') {
    if (conv.retocada && !confirm('Se perderán los cambios hechos a mano. ¿Seguir?')) return;
    conv.indice = (conv.indice + 1) % conv.opciones.length;
    conv.equipos = copiar(conv.opciones[conv.indice]);
    conv.retocada = false;
    ui.marcado = null;
    guardar();
    pintarEquipos();
  }
  if (accion === 'regenerar') {
    if (conv.retocada && !confirm('Se perderán los cambios hechos a mano. ¿Seguir?')) return;
    generarConvocatoria(conv.ids, conv.fecha);
    pintarEquipos();
    avisar('Equipos generados de nuevo con los criterios actuales');
  }
  if (accion === 'copiar') copiarTexto(textoWhatsApp());
  if (accion === 'imagen') abrirImagen();
  if (accion === 'eliminar') {
    if (!confirm('Se borrarán los equipos y la selección de jugadores. ¿Eliminar la convocatoria?')) return;
    estado.convocatoria = null;
    estado.seleccion = [];
    ui.marcado = null;
    guardar();
    pintarEquipos();
    avisar('Convocatoria eliminada');
  }
  if (accion === 'desmarcar') { ui.marcado = null; pintarEquipos(); }
}

function textoWhatsApp() {
  const conv = estado.convocatoria;
  const emoji = { A: '🟡', B: '⚫' };
  const bloques = LADOS.map(l =>
    `${emoji[l]} *${estado.nombres[l]}*\n${conv.equipos[l].map(h => porId.get(h.id).nombre).join('\n')}`);
  return `⚽ *Fútbol 7 · ${textoFecha(conv.fecha)}*\n\n${bloques.join('\n\n')}`;
}

// ---------- imagen para WhatsApp ----------

let imagenActual = null;  // { blob, url, archivo }

async function abrirImagen() {
  const conv = estado.convocatoria;
  const datos = {
    titulo: 'FUTBOL 7',
    fecha: textoFecha(conv.fecha),
    equipos: LADOS.map(l => ({ nombre: estado.nombres[l], lado: l, jugadores: conv.equipos[l].map(h => porId.get(h.id).nombre) })),
    pie: 'gafasgithub.github.io/Futbol7',
  };
  avisar('Preparando la imagen…');
  let blob;
  try {
    blob = await imagenConvocatoria(datos);
  } catch (e) {
    console.error(e);
    avisar('No se pudo crear la imagen en este navegador');
    return;
  }
  if (imagenActual) URL.revokeObjectURL(imagenActual.url);
  const archivo = new File([blob], `futbol7-${conv.fecha}.png`, { type: 'image/png' });
  imagenActual = { blob, url: URL.createObjectURL(blob), archivo };
  const compartir = navigator.canShare?.({ files: [archivo] });
  const copiar = typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write;
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.id = 'modal-imagen';
  modal.innerHTML = `
    <div class="modal-caja" role="dialog" aria-label="Imagen de la convocatoria">
      <img src="${imagenActual.url}" alt="Equipos de la convocatoria">
      <div class="fila-botones">
        ${compartir ? '<button class="boton principal" data-imagen="compartir">Compartir</button>' : ''}
        ${copiar ? `<button class="boton ${compartir ? 'secundario' : 'principal'}" data-imagen="copiar">Copiar imagen</button>` : ''}
        <button class="boton secundario" data-imagen="descargar">Descargar</button>
        <button class="boton secundario" data-imagen="cerrar">Cerrar</button>
      </div>
    </div>`;
  $('#modal-imagen')?.remove();
  document.body.appendChild(modal);
  $('#aviso').hidden = true;
}

async function accionImagen(accion) {
  const { blob, url, archivo } = imagenActual;
  if (accion === 'cerrar') { $('#modal-imagen')?.remove(); return; }
  if (accion === 'compartir') {
    try { await navigator.share({ files: [archivo], title: 'Fútbol 7' }); } catch (e) { /* cancelado */ }
  }
  if (accion === 'copiar') {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      avisar('Imagen copiada. Pégala en WhatsApp.');
    } catch (e) {
      avisar('No se pudo copiar; usa Descargar');
    }
  }
  if (accion === 'descargar') {
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = archivo.name;
    enlace.click();
  }
}

async function copiarTexto(texto) {
  try {
    await navigator.clipboard.writeText(texto);
  } catch (e) {
    const area = document.createElement('textarea');
    area.value = texto;
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }
  avisar('Equipos copiados. Ya puedes pegarlos en WhatsApp.');
}

// ---------- pestaña Condicionantes ----------

const TIPOS = {
  separar: { texto: 'no puede ir con', simbolo: '✕' },
  juntar: { texto: 'debe ir, si es posible, con', simbolo: '＋' },
  equipo: { texto: 'siempre en el equipo', simbolo: '' },
};

function textoCondicionante(c) {
  const t = TIPOS[c.tipo];
  const fin = c.tipo === 'equipo'
    ? `<span class="cuadro lado-${c.lado}"></span><b>${escapar(estado.nombres[c.lado])}</b>`
    : `<b>${escapar(porId.get(c.b).nombre)}</b>`;
  const simbolo = t.simbolo ? `${t.simbolo} ` : '';
  return `<b>${escapar(porId.get(c.a).nombre)}</b> <span class="cond-tipo">${simbolo}${t.texto}</span> ${fin}`;
}

const CRITERIOS = [
  { clave: 'media', titulo: 'Igualar la nota media', ayuda: 'Que los dos equipos tengan la media lo más parecida posible.' },
  { clave: 'posiciones', titulo: 'Respetar las posiciones favoritas', ayuda: 'Que cada uno juegue en su primera posición o, si no, en la segunda.' },
  { clave: 'condicionantes', titulo: 'Cumplir los "debe ir con"', ayuda: 'Los "no puede ir con" y "siempre en el equipo" se cumplen siempre que haya forma.' },
  { clave: 'atributos', titulo: 'Igualar resistencia, velocidad y técnica', ayuda: 'Además de la media, que cada atributo quede parecido.' },
];

function pintarCondicionantes() {
  const panel = $('#condicionantes');
  const orden = [...jugadores].sort((x, y) => x.nombre.localeCompare(y.nombre, 'es'));
  const opciones = orden.map(j => `<option value="${j.id}">${escapar(j.nombre)}</option>`).join('');
  const conv = estado.convocatoria;
  const ladoDe = new Map(conv ? LADOS.flatMap(l => conv.equipos[l].map(h => [h.id, l])) : []);

  const lista = estado.condicionantes.map(c => {
    let etiqueta = '';
    if (c.tipo === 'equipo') {
      if (ladoDe.has(c.a)) {
        const cumple = ladoDe.get(c.a) === c.lado;
        etiqueta = `<span class="etiqueta ${cumple ? 'cumple' : 'incumple'}">${cumple ? 'Se cumple' : 'No se cumple'}</span>`;
      } else if (conv) {
        etiqueta = '<span class="etiqueta neutra">No juega</span>';
      }
    } else if (ladoDe.has(c.a) && ladoDe.has(c.b)) {
      const mismo = ladoDe.get(c.a) === ladoDe.get(c.b);
      const cumple = c.tipo === 'separar' ? !mismo : mismo;
      etiqueta = `<span class="etiqueta ${cumple ? 'cumple' : 'incumple'}">${cumple ? 'Se cumple' : 'No se cumple'}</span>`;
    } else if (conv) {
      etiqueta = '<span class="etiqueta neutra">No juegan los dos</span>';
    }
    return `
      <li class="cond tipo-${c.tipo}">
        <span class="cond-texto">${textoCondicionante(c)}</span>
        ${etiqueta}
        <button class="borrar" data-borrar="${c.id}" aria-label="Borrar condicionante">Borrar</button>
      </li>`;
  }).join('');

  panel.innerHTML = `
    <div class="tarjeta">
      <h2>Condicionantes</h2>
      <p class="sub">Se tienen en cuenta al generar los equipos cuando juegan los jugadores afectados.</p>
      <form class="nuevo-cond" id="nuevo-cond">
        <select name="a" required aria-label="Jugador 1"><option value="">Jugador 1</option>${opciones}</select>
        <select name="tipo" aria-label="Tipo">
          <option value="separar">${TIPOS.separar.texto}</option>
          <option value="juntar">${TIPOS.juntar.texto}</option>
          ${LADOS.map(l => `<option value="equipo-${l}">${TIPOS.equipo.texto} ${escapar(estado.nombres[l])}</option>`).join('')}
        </select>
        <select name="b" required aria-label="Jugador 2"><option value="">Jugador 2</option>${opciones}</select>
        <button class="boton principal" type="submit">Añadir</button>
      </form>
      ${lista ? `<ul class="lista-cond">${lista}</ul>` : '<p class="vacio">Aún no hay condicionantes.</p>'}
    </div>

    <div class="tarjeta">
      <h2>Criterios del reparto</h2>
      <p class="sub">Cuánto pesa cada cosa al generar los equipos (0 = no se tiene en cuenta).</p>
      <div class="criterios">
        ${CRITERIOS.map(c => `
          <label class="criterio">
            <span class="criterio-cabeza"><span>${c.titulo}</span><output id="out-${c.clave}">${estado.pesos[c.clave]}</output></span>
            <input type="range" min="0" max="10" step="1" value="${estado.pesos[c.clave]}" data-peso="${c.clave}">
            <span class="ayuda">${c.ayuda}</span>
          </label>`).join('')}
      </div>
      <div class="fila-botones">
        <button class="boton secundario" data-accion="restablecer">Valores por defecto</button>
        ${conv ? '<button class="boton principal" data-accion="aplicar">Regenerar equipos con estos criterios</button>' : ''}
      </div>
    </div>

    ${tarjetaFichero()}`;
}

function tarjetaFichero() {
  if (!estado.cambiosLocales) {
    return `
      <div class="tarjeta" id="tarjeta-fichero">
        <h2>Fichero de condicionantes</h2>
        <p class="sub">Los condicionantes y criterios se leen de <code>${FICHERO_CONDICIONANTES}</code> en la propia web,
          así que todos veis los mismos. Lo que cambies aquí se queda pendiente en este navegador hasta que se suba el fichero nuevo.</p>
        <p class="estado-fichero al-dia">✓ Al día con el fichero</p>
      </div>`;
  }
  return `
    <div class="tarjeta pendiente" id="tarjeta-fichero">
      <h2>Fichero de condicionantes</h2>
      <p class="estado-fichero">Tienes cambios que todavía no están en el fichero. Solo los ves tú, en este navegador.</p>
      <ol class="pasos">
        <li>Pulsa <b>Descargar fichero</b>.</li>
        <li>Sube el fichero descargado a la carpeta <code>datos</code> del repositorio, sustituyendo a <code>condicionantes.js</code>.</li>
        <li>En un par de minutos la web lo publica y todos ven los cambios.</li>
      </ol>
      <div class="fila-botones">
        <button class="boton principal" data-accion="descargar">Descargar fichero</button>
        <button class="boton secundario" data-accion="descartar">Descartar mis cambios</button>
      </div>
    </div>`;
}

// ---------- fichero de condicionantes (datos/condicionantes.js) ----------

const FICHERO_CONDICIONANTES = 'datos/condicionantes.js';

// Lee window.CONDICIONANTES. Cada regla se busca por id y, si ese id ya no existe, por nombre.
function leerFichero() {
  const fichero = window.CONDICIONANTES || {};
  const porNombre = new Map(jugadores.map(j => [j.nombre.toLocaleLowerCase('es'), j.id]));
  const resolver = (id, nombre) => porId.has(id) ? id : porNombre.get(String(nombre ?? '').toLocaleLowerCase('es'));
  const condicionantes = [];
  for (const [i, c] of (fichero.condicionantes || []).entries()) {
    const a = resolver(c.a, c.nombreA), b = resolver(c.b, c.nombreB);
    if (c.tipo === 'equipo' && a && LADOS.includes(c.lado)) condicionantes.push({ id: i + 1, tipo: c.tipo, a, lado: c.lado });
    else if (TIPOS[c.tipo] && c.tipo !== 'equipo' && a && b && a !== b) condicionantes.push({ id: i + 1, tipo: c.tipo, a, b });
    else console.warn('Condicionante del fichero que no se entiende o con jugadores que no existen:', c);
  }
  return { condicionantes, pesos: { ...PESOS_DEFECTO, ...fichero.criterios } };
}

// Para comparar lo del navegador con lo del fichero sin fijarse en el orden ni en los id.
function huella({ condicionantes, pesos }) {
  const reglas = condicionantes.map(c => c.tipo === 'equipo'
    ? `equipo:${c.a}-${c.lado}`
    : `${c.tipo}:${Math.min(c.a, c.b)}-${Math.max(c.a, c.b)}`).sort();
  return JSON.stringify([reglas, CRITERIOS.map(c => pesos[c.clave])]);
}

// Si no hay cambios propios se usa el fichero; si los hay pero ya coinciden con él, se dan por subidos.
function sincronizarConFichero() {
  const fichero = leerFichero();
  if (!estado.cambiosLocales || huella(fichero) === huella(estado)) {
    estado.condicionantes = fichero.condicionantes;
    estado.pesos = fichero.pesos;
    estado.cambiosLocales = false;
  }
}

function marcarCambios() {
  estado.cambiosLocales = huella(estado) !== huella(leerFichero());
  guardar();
}

function contenidoFichero() {
  const reglas = estado.condicionantes.map(c => c.tipo === 'equipo'
    ? `    { "tipo": "equipo", "a": ${c.a}, "lado": "${c.lado}", "nombreA": ${JSON.stringify(porId.get(c.a).nombre)} }`
    : `    { "tipo": "${c.tipo}", "a": ${c.a}, "b": ${c.b}, "nombreA": ${JSON.stringify(porId.get(c.a).nombre)}, "nombreB": ${JSON.stringify(porId.get(c.b).nombre)} }`);
  const criterios = CRITERIOS.map(c => `"${c.clave}": ${estado.pesos[c.clave]}`).join(', ');
  return `// Condicionantes y criterios para generar los equipos de Fútbol 7.
// Se descarga desde la pestaña Condicionantes de la web, pero también se puede editar a mano.
//   tipo "separar": no pueden ir en el mismo equipo.
//   tipo "juntar":  deben ir juntos si es posible.
//   tipo "equipo":  el jugador a va siempre en el equipo "lado" ("A" = Amarillo, "B" = Negro).
//   a y b son los id de los jugadores en fut7-puntuaciones; nombreA y nombreB son para leerlo
//   mejor (si un id deja de existir, se busca al jugador por su nombre).
//   criterios: cuánto pesa cada cosa al generar los equipos, de 0 a 10.
window.CONDICIONANTES = {
  "condicionantes": [
${reglas.join(',\n')}
  ],
  "criterios": { ${criterios} }
};
`;
}

function anadirCondicionante(form) {
  const a = Number(form.a.value), b = Number(form.b.value), tipo = form.tipo.value;
  if (tipo.startsWith('equipo-')) {
    if (!a) { avisar('Elige el jugador'); return; }
    // Una sola regla de equipo por jugador.
    estado.condicionantes = estado.condicionantes.filter(c => !(c.tipo === 'equipo' && c.a === a));
    estado.condicionantes.push({ id: Date.now(), tipo: 'equipo', a, lado: tipo.slice(-1) });
    marcarCambios();
    pintarCondicionantes();
    return;
  }
  if (!a || !b) { avisar('Elige los dos jugadores'); return; }
  if (a === b) { avisar('Tienen que ser dos jugadores distintos'); return; }
  // Una sola regla por pareja: la nueva sustituye a la que hubiera.
  const misma = c => c.tipo !== 'equipo' && ((c.a === a && c.b === b) || (c.a === b && c.b === a));
  estado.condicionantes = estado.condicionantes.filter(c => !misma(c));
  estado.condicionantes.push({ id: Date.now(), tipo, a, b });
  marcarCambios();
  pintarCondicionantes();
}

function accionCondicionantes(accion) {
  if (accion === 'restablecer') { estado.pesos = { ...PESOS_DEFECTO }; marcarCambios(); pintarCondicionantes(); }
  if (accion === 'aplicar') {
    const conv = estado.convocatoria;
    if (conv.retocada && !confirm('Se perderán los cambios hechos a mano. ¿Seguir?')) return;
    generarConvocatoria(conv.ids, conv.fecha);
    cambiarPestana('equipos');
    avisar('Equipos generados de nuevo con los criterios actuales');
  }
  if (accion === 'descargar') {
    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(new Blob([contenidoFichero()], { type: 'text/javascript' }));
    enlace.download = 'condicionantes.js';
    enlace.click();
    setTimeout(() => URL.revokeObjectURL(enlace.href), 1000);
    avisar('Descargado condicionantes.js. Súbelo a la carpeta datos del repositorio.');
  }
  if (accion === 'descartar') {
    if (!confirm('Se perderán tus cambios y se volverá a lo que hay en el fichero. ¿Seguir?')) return;
    estado.cambiosLocales = false;
    sincronizarConFichero();
    guardar();
    pintarCondicionantes();
  }
}

// ---------- tema claro / oscuro ----------

function pintarBotonTema() {
  const oscuro = document.documentElement.dataset.tema === 'oscuro';
  const boton = $('#tema');
  boton.title = boton.ariaLabel = oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
}

$('#tema').addEventListener('click', () => {
  const oscuro = document.documentElement.dataset.tema !== 'oscuro';
  if (oscuro) document.documentElement.dataset.tema = 'oscuro';
  else delete document.documentElement.dataset.tema;
  try { localStorage.setItem('futbol7.tema', oscuro ? 'oscuro' : 'claro'); } catch (e) { /* sin almacenamiento */ }
  pintarBotonTema();
});
pintarBotonTema();

// ---------- eventos globales ----------

document.addEventListener('click', e => {
  const img = e.target.closest('[data-imagen]');
  if (img) { accionImagen(img.dataset.imagen); return; }
  if (e.target.id === 'modal-imagen') { e.target.remove(); return; }
  const enLista = e.target.closest('[data-lista]');
  if (enLista) { accionLista(enLista.dataset.lista); return; }
  if (e.target.id === 'modal-lista') { e.target.remove(); return; }
  const pestana = e.target.closest('[data-pestana]');
  if (pestana) { cambiarPestana(pestana.dataset.pestana); return; }
  const ir = e.target.closest('[data-ir]');
  if (ir) { cambiarPestana(ir.dataset.ir); return; }
  const h = e.target.closest('.hueco');
  if (h) { tocarHueco(h.dataset.lado, Number(h.dataset.i)); return; }
  const borrar = e.target.closest('[data-borrar]');
  if (borrar) {
    estado.condicionantes = estado.condicionantes.filter(c => String(c.id) !== borrar.dataset.borrar);
    marcarCambios();
    pintarCondicionantes();
    return;
  }
  const accion = e.target.closest('[data-accion]');
  if (accion) {
    if (ui.pestana === 'equipos') accionEquipos(accion.dataset.accion);
    if (ui.pestana === 'condicionantes') accionCondicionantes(accion.dataset.accion);
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { $('#modal-imagen')?.remove(); $('#modal-lista')?.remove(); }
});

document.addEventListener('submit', e => {
  if (e.target.id === 'nuevo-cond') { e.preventDefault(); anadirCondicionante(e.target); }
});

document.addEventListener('input', e => {
  const peso = e.target.dataset?.peso;
  if (peso) {
    estado.pesos[peso] = Number(e.target.value);
    $(`#out-${peso}`).textContent = e.target.value;
    marcarCambios();
  }
});

document.addEventListener('change', e => {
  if (e.target.id === 'sustituto' && e.target.value) sustituir(Number(e.target.value));
  if (e.target.dataset?.fila && lista.filas) {
    // Elegido a mano: deja de estar "por revisar".
    lista.filas[Number(e.target.dataset.fila)] = { ...lista.filas[e.target.dataset.fila], id: e.target.value ? Number(e.target.value) : null, puntos: 100 };
    const desplazado = $('.lista-filas')?.scrollTop;
    pintarLista();
    if (desplazado) $('.lista-filas').scrollTop = desplazado;
  }
  if (e.target.dataset?.peso) $('#tarjeta-fichero').outerHTML = tarjetaFichero();
  if (e.target.name === 'tipo' && e.target.form?.id === 'nuevo-cond') {
    const b = e.target.form.b;
    b.hidden = e.target.value.startsWith('equipo-');
    b.required = !b.hidden;
  }
  if (e.target.classList.contains('nombre-equipo')) {
    estado.nombres[e.target.dataset.lado] = e.target.value.trim() || NOMBRES_DEFECTO[e.target.dataset.lado];
    guardar();
    pintarEquipos();
  }
});

// ---------- arranque ----------

(function iniciar() {
  ponerJugadores(leerJugadoresGuardados());
  recuperar();
  const pedida = location.hash.slice(1);
  if (['jugadores', 'equipos', 'condicionantes'].includes(pedida)) ui.pestana = pedida;
  else if (estado.convocatoria) ui.pestana = 'equipos';
  cambiarPestana(ui.pestana);
})();
