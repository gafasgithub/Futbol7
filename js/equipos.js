// Generador de equipos. Sin dependencias, para poder probarlo aparte (pruebas/equipos.html).
//
// Con 16 jugadores solo hay 6.435 formas de partirlos en dos equipos de 8, así que se prueban
// todas. Para cada equipo se busca la mejor alineación (1 portero, 2 defensas, 4 medios,
// 1 delantero) con programación dinámica, y cada reparto recibe un "coste": cuanto más bajo,
// mejor. El coste suma:
//   - la diferencia de media entre los dos equipos,
//   - jugadores fuera de su posición favorita,
//   - condicionantes incumplidos,
//   - la diferencia en resistencia, velocidad y técnica.
// Cada término se multiplica por su peso (0 a 10, configurable en la pestaña Condicionantes).

const POSICIONES = ['Portero', 'Defensa', 'Medio', 'Delantero'];
const FORMACION = { Portero: 1, Defensa: 2, Medio: 4, Delantero: 1 };
const POR_EQUIPO = POSICIONES.reduce((n, p) => n + FORMACION[p], 0);

const PESOS_DEFECTO = { media: 5, posiciones: 5, condicionantes: 5, atributos: 1 };

// Coste con todos los pesos en 5. Con estos valores, 0,1 puntos de diferencia de media
// equivalen a 2 jugadores en su segunda posición.
const COSTE = {
  puntoMedia: 20,      // por cada punto de diferencia entre las medias de los equipos
  puntoAtributo: 4,    // por cada punto de diferencia media en resistencia/velocidad/técnica
  secundaria: 1,       // jugador en su segunda posición
  fuera: 3,            // jugador en una posición que no es ninguna de las suyas
  juntar: 6,           // "debe ir con" incumplido
  separar: 1000,       // "no puede ir con" incumplido: solo ocurre si no hay otra salida
};

function costePosicion(jugador, posicion) {
  if (jugador.pos[0] === posicion) return 0;
  if (jugador.pos[1] === posicion) return COSTE.secundaria;
  return COSTE.fuera;
}

// Cada estado de la programación dinámica cuenta cuántos huecos de cada posición están ocupados.
const CAPACIDAD = POSICIONES.map(p => FORMACION[p]);
const PASO = [];
let N_ESTADOS = 1;
for (const c of CAPACIDAD) { PASO.push(N_ESTADOS); N_ESTADOS *= c + 1; }
const ESTADO_FINAL = CAPACIDAD.reduce((s, c, k) => s + c * PASO[k], 0);
const ocupados = (estado, k) => Math.floor(estado / PASO[k]) % (CAPACIDAD[k] + 1);

// costes[i][k]: coste de poner al jugador i del equipo en la posición k.
// Devuelve el coste mínimo y, si se pide, la alineación: [{ pos, id }] en orden de POSICIONES.
function alinear(equipo, costes, conAlineacion) {
  let dp = new Float64Array(N_ESTADOS).fill(Infinity);
  dp[0] = 0;
  const rastro = [];
  for (let i = 0; i < equipo.length; i++) {
    const nuevo = new Float64Array(N_ESTADOS).fill(Infinity);
    const eleccion = conAlineacion ? new Int8Array(N_ESTADOS).fill(-1) : null;
    for (let s = 0; s < N_ESTADOS; s++) {
      if (dp[s] === Infinity) continue;
      for (let k = 0; k < CAPACIDAD.length; k++) {
        if (ocupados(s, k) >= CAPACIDAD[k]) continue;
        const t = s + PASO[k];
        const c = dp[s] + costes[i][k];
        if (c < nuevo[t]) { nuevo[t] = c; if (eleccion) eleccion[t] = k; }
      }
    }
    dp = nuevo;
    if (eleccion) rastro.push(eleccion);
  }
  const resultado = { coste: dp[ESTADO_FINAL] };
  if (conAlineacion) {
    const posDe = new Array(equipo.length);
    let s = ESTADO_FINAL;
    for (let i = equipo.length - 1; i >= 0; i--) {
      const k = rastro[i][s];
      posDe[i] = k;
      s -= PASO[k];
    }
    resultado.alineacion = POSICIONES.flatMap((pos, k) =>
      equipo.filter((_, i) => posDe[i] === k).map(j => ({ pos, id: j.id })));
  }
  return resultado;
}

const media = (lista, campo) => lista.reduce((s, j) => s + j[campo], 0) / lista.length;

// Condicionantes que afectan a esta convocatoria (los dos jugadores convocados).
function condicionantesAplicables(condicionantes, ids) {
  return condicionantes.filter(c => ids.has(c.a) && ids.has(c.b) && c.a !== c.b);
}

// Desglose del coste de un reparto. equipoDe: Map id -> 'A' | 'B'.
function costeReparto(a, b, equipoDe, conds, pesos) {
  const f = clave => (pesos[clave] ?? PESOS_DEFECTO[clave]) / 5;
  const difMedia = Math.abs(media(a, 'media') - media(b, 'media'));
  const difAtributos = ['r', 'v', 't']
    .reduce((s, c) => s + Math.abs(media(a, c) - media(b, c)), 0) / 3;
  let separar = 0, juntar = 0;
  for (const c of conds) {
    const mismo = equipoDe.get(c.a) === equipoDe.get(c.b);
    if (c.tipo === 'separar' && mismo) separar++;
    if (c.tipo === 'juntar' && !mismo) juntar++;
  }
  return {
    difMedia, difAtributos, separar, juntar,
    coste: difMedia * COSTE.puntoMedia * f('media')
      + difAtributos * COSTE.puntoAtributo * f('atributos')
      + juntar * COSTE.juntar * f('condicionantes')
      + separar * COSTE.separar,
  };
}

// jugadores: los 16 convocados ({ id, nombre, pos: [pos1, pos2], r, v, t, media }).
// Devuelve las mejores opciones ordenadas de mejor a peor:
// [{ coste, A: [{ pos, id }], B: [{ pos, id }] }]
function generarEquipos(jugadores, condicionantes = [], pesos = PESOS_DEFECTO, nOpciones = 25) {
  const n = jugadores.length;
  if (n !== POR_EQUIPO * 2) throw new Error(`Hacen falta ${POR_EQUIPO * 2} jugadores (hay ${n})`);
  const fPos = (pesos.posiciones ?? PESOS_DEFECTO.posiciones) / 5;
  const costes = jugadores.map(j => POSICIONES.map(p => costePosicion(j, p) * fPos));
  const conds = condicionantesAplicables(condicionantes, new Set(jugadores.map(j => j.id)));

  const mejores = [];
  const equipoDe = new Map();
  // El jugador 0 siempre va en A: así cada reparto se cuenta una sola vez.
  const recorrer = (desde, elegidos) => {
    if (elegidos.length === POR_EQUIPO) { evaluar(elegidos); return; }
    for (let i = desde; i <= n - (POR_EQUIPO - elegidos.length); i++) {
      elegidos.push(i);
      recorrer(i + 1, elegidos);
      elegidos.pop();
    }
  };
  const evaluar = indicesA => {
    const enA = new Array(n).fill(false);
    for (const i of indicesA) enA[i] = true;
    const ia = [], ib = [];
    for (let i = 0; i < n; i++) (enA[i] ? ia : ib).push(i);
    const a = ia.map(i => jugadores[i]), b = ib.map(i => jugadores[i]);
    for (const j of a) equipoDe.set(j.id, 'A');
    for (const j of b) equipoDe.set(j.id, 'B');
    const reparto = costeReparto(a, b, equipoDe, conds, pesos);
    let coste = reparto.coste;
    // Poda: si ya es peor que la peor de las guardadas, no hace falta alinear.
    if (mejores.length === nOpciones && coste >= mejores[nOpciones - 1].coste) return;
    coste += alinear(a, ia.map(i => costes[i])).coste;
    if (mejores.length === nOpciones && coste >= mejores[nOpciones - 1].coste) return;
    coste += alinear(b, ib.map(i => costes[i])).coste;
    if (mejores.length === nOpciones && coste >= mejores[nOpciones - 1].coste) return;
    mejores.push({ coste, ia, ib });
    mejores.sort((x, y) => x.coste - y.coste);
    if (mejores.length > nOpciones) mejores.pop();
  };
  recorrer(1, [0]);

  return mejores.map(({ coste, ia, ib }) => ({
    coste,
    A: alinear(ia.map(i => jugadores[i]), ia.map(i => costes[i]), true).alineacion,
    B: alinear(ib.map(i => jugadores[i]), ib.map(i => costes[i]), true).alineacion,
  }));
}

// Estadísticas de unos equipos ya formados (generados o retocados a mano).
// equipos: { A: [{ pos, id }], B: [...] }, porId: Map id -> jugador.
function analizarEquipos(equipos, porId, condicionantes = []) {
  const equipoDe = new Map();
  const resumen = {};
  for (const lado of ['A', 'B']) {
    const lista = equipos[lado].map(h => porId.get(h.id)).filter(Boolean);
    for (const j of lista) equipoDe.set(j.id, lado);
    resumen[lado] = {
      media: media(lista, 'media'), r: media(lista, 'r'), v: media(lista, 'v'), t: media(lista, 't'),
    };
  }
  const avisos = [];
  for (const lado of ['A', 'B']) {
    for (const h of equipos[lado]) {
      const j = porId.get(h.id);
      if (j && !j.pos.includes(h.pos)) avisos.push({ tipo: 'posicion', lado, jugador: j, pos: h.pos });
    }
  }
  const conds = condicionantesAplicables(condicionantes, new Set(equipoDe.keys()));
  for (const c of conds) {
    const mismo = equipoDe.get(c.a) === equipoDe.get(c.b);
    if ((c.tipo === 'separar' && mismo) || (c.tipo === 'juntar' && !mismo)) {
      avisos.push({ tipo: c.tipo, a: porId.get(c.a), b: porId.get(c.b) });
    }
  }
  return { ...resumen, difMedia: Math.abs(resumen.A.media - resumen.B.media), avisos, condiciones: conds.length };
}
