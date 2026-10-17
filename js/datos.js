// Carga de jugadores desde fut7-puntuaciones (https://cimorales.github.io/fut7-puntuaciones/).
// Esa web guarda sus datos en Supabase; aquí se leen con la misma consulta pública que usa
// ella, solo lectura, y solo al pulsar "Recargar datos". Cada lectura buena se guarda en el navegador y
// es la que se usa al abrir la web; sin copia guardada se parte de js/jugadores_respaldo.js.

const FUENTE = {
  url: 'https://vwnpmdstzqjdybxvxhvs.supabase.co/rest/v1/jugadores?select=datos&id=eq.1',
  clave: 'sb_publishable_SVMtK51bFQgPMBrWEJQgBg_vsqvQgHb',
  web: 'https://cimorales.github.io/fut7-puntuaciones/',
};

const JUECES = ['Agus', 'Tora', 'Lino', 'Reta', 'Neft'];

// Pasa un jugador del formato de la fuente al de esta web: cada atributo es la media de lo
// que puntúan los jueces que le han puntuado, y la media es la de los tres atributos.
function normalizarJugador(bruto) {
  const notas = JUECES.map(j => bruto.scores?.[j]).filter(Boolean);
  const promedio = campo => notas.length
    ? notas.reduce((s, n) => s + Number(n[campo] ?? 0), 0) / notas.length
    : 0;
  const r = promedio('r'), v = promedio('v'), t = promedio('t');
  const pos1 = POSICIONES.includes(bruto.pos1) ? bruto.pos1 : 'Medio';
  const pos2 = POSICIONES.includes(bruto.pos2) ? bruto.pos2 : pos1;
  return {
    id: bruto.id,
    nombre: String(bruto.name ?? '').trim(),
    pos: [pos1, pos2],
    r, v, t,
    media: (r + v + t) / 3,
    jueces: notas.length,
    notas: bruto.scores ?? {},
  };
}

const CLAVE_COPIA_JUGADORES = 'futbol7.jugadores';

// Jugadores guardados en este navegador. La primera vez se toma js/jugadores_respaldo.js y se guarda,
// para que los datos no cambien solos (por ejemplo, al publicar la web) hasta pulsar "Recargar datos".
// Devuelve { jugadores, fecha }: fecha (ISO) es cuándo se leyeron de la fuente.
function leerJugadoresGuardados() {
  try {
    const guardada = JSON.parse(localStorage.getItem(CLAVE_COPIA_JUGADORES) || 'null');
    if (guardada?.jugadores?.length) return { jugadores: guardada.jugadores.map(normalizarJugador), fecha: guardada.fecha };
  } catch (e) { /* copia corrupta o sin almacenamiento */ }
  const { fecha, jugadores } = window.JUGADORES_RESPALDO;
  try { localStorage.setItem(CLAVE_COPIA_JUGADORES, JSON.stringify({ fecha, jugadores })); } catch (e) { /* sin almacenamiento */ }
  return { jugadores: jugadores.map(normalizarJugador), fecha };
}

// Lee los jugadores de fut7-puntuaciones y los guarda. Devuelve { jugadores, fecha } o null si falla.
async function descargarJugadores() {
  try {
    const control = new AbortController();
    const espera = setTimeout(() => control.abort(), 8000);
    const respuesta = await fetch(FUENTE.url, { headers: { apikey: FUENTE.clave }, signal: control.signal, cache: 'no-store' });
    clearTimeout(espera);
    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
    const filas = await respuesta.json();
    const datos = filas?.[0]?.datos;
    if (!Array.isArray(datos) || !datos.length) throw new Error('respuesta vacía');
    const fecha = new Date().toISOString();
    try { localStorage.setItem(CLAVE_COPIA_JUGADORES, JSON.stringify({ fecha, jugadores: datos })); } catch (e) { /* sin almacenamiento */ }
    return { jugadores: datos.map(normalizarJugador), fecha };
  } catch (error) {
    console.warn('No se pudo leer fut7-puntuaciones.', error);
    return null;
  }
}
