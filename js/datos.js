// Carga de jugadores desde fut7-puntuaciones (https://cimorales.github.io/fut7-puntuaciones/).
// Esa web guarda sus datos en Supabase; aquí se leen con la misma consulta pública que usa
// ella, solo lectura. Si no responde, se usa la copia de js/jugadores_respaldo.js.

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

async function cargarJugadores() {
  try {
    const control = new AbortController();
    const espera = setTimeout(() => control.abort(), 8000);
    const respuesta = await fetch(FUENTE.url, { headers: { apikey: FUENTE.clave }, signal: control.signal });
    clearTimeout(espera);
    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
    const filas = await respuesta.json();
    const datos = filas?.[0]?.datos;
    if (!Array.isArray(datos) || !datos.length) throw new Error('respuesta vacía');
    return { jugadores: datos.map(normalizarJugador), vivo: true };
  } catch (error) {
    console.warn('No se pudo leer fut7-puntuaciones; se usa la copia de respaldo.', error);
    const respaldo = window.JUGADORES_RESPALDO;
    return { jugadores: respaldo.jugadores.map(normalizarJugador), vivo: false, fecha: respaldo.fecha };
  }
}
