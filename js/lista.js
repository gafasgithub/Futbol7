// Interpreta una lista de convocados pegada (por ejemplo, el mensaje de WhatsApp) y busca a cada
// uno entre los jugadores de la web. Sin DOM, para poder probarlo aparte.

// "Ángel" -> "angel", "Piñe" -> "pine".
const sinTildes = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const compacto = s => sinTildes(s).replace(/[^a-z0-9]/g, '');
const fuera = s => compacto(sinTildes(s).replace(/\(.*?\)/g, ''));              // sin lo que va entre paréntesis
const dentro = s => (sinTildes(s).match(/\(([^)]*)\)/g) || []).map(compacto);   // lo que va entre paréntesis
const palabras = s => sinTildes(s).replace(/[()]/g, ' ').split(/[^a-z0-9]+/).filter(Boolean);

// Saca los nombres del texto. Si hay líneas numeradas ("1. Reta", "2) Charly"), solo esas: así se
// ignoran el título y las reservas. Si no, cada línea con texto (o cada nombre separado por comas).
function nombresDeLista(texto) {
  const lineas = String(texto).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const numeradas = lineas.map(l => l.match(/^\d{1,2}\s*[.)\-:]\s*(.*)$/)).filter(Boolean).map(m => m[1]);
  const nombres = numeradas.length ? numeradas : lineas.filter(l => !l.endsWith(':')).flatMap(l => l.split(','));
  return nombres.map(n => n.replace(/^[-*•·\s]+/, '').trim()).filter(n => /[a-zñáéíóúü]/i.test(n));
}

function distancia(a, b) {
  let previa = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const fila = [i];
    for (let j = 1; j <= b.length; j++) {
      fila[j] = Math.min(previa[j] + 1, fila[j - 1] + 1, previa[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previa = fila;
  }
  return previa[b.length];
}

// Cuánto se parece lo escrito al nombre de un jugador (0 = nada, 100 = igual).
function parecido(escrito, nombre) {
  const e = compacto(escrito), n = compacto(nombre);
  if (!e || !n) return 0;
  if (e === n) return 100;                                          // "Antonio(baena)" = "Antonio (Baena)"
  const eFuera = fuera(escrito), nFuera = fuera(nombre);
  if (eFuera && eFuera === nFuera) return 90;                       // "Jose" = "Jose (Portero)"
  if (dentro(nombre).includes(e)) return 75;                        // "Nieva" = "Sergio A. (Nieva)"
  const pe = palabras(escrito), pn = palabras(nombre);
  if (pe.length && pe.every(p => pn.includes(p))) return 70;        // "Javi" en "Javi alto"
  if (pe[0] && pe[0] === pn[0]) return 60;
  let puntos = 0;
  if (Math.min(e.length, nFuera.length) >= 3 && (e.startsWith(nFuera) || nFuera.startsWith(e))) puntos = 50;
  const similitud = 1 - distancia(e, n) / Math.max(e.length, n.length);
  if (similitud >= 0.6) puntos = Math.max(puntos, Math.round(55 * similitud));
  let comun = 0;
  while (comun < Math.min(e.length, nFuera.length) && e[comun] === nFuera[comun]) comun++;
  if (comun >= 3) puntos = Math.max(puntos, 30 + comun);            // "Nefbappe" -> "Neft"
  return puntos;
}

const PARECIDO_MINIMO = 30;

// Devuelve [{ texto, id, puntos }] en el orden del texto; id es null si no se reconoce a nadie.
// Cada jugador se asigna como mucho una vez, empezando por los parecidos más claros.
function interpretarLista(texto, jugadores) {
  const nombres = nombresDeLista(texto);
  const parejas = [];
  nombres.forEach((t, i) => jugadores.forEach(j => {
    const puntos = parecido(t, j.nombre);
    if (puntos >= PARECIDO_MINIMO) parejas.push({ i, id: j.id, puntos });
  }));
  parejas.sort((x, y) => y.puntos - x.puntos || x.i - y.i);
  const filas = nombres.map(t => ({ texto: t, id: null, puntos: 0 }));
  const usados = new Set();
  for (const p of parejas) {
    if (filas[p.i].id !== null || usados.has(p.id)) continue;
    filas[p.i].id = p.id;
    filas[p.i].puntos = p.puntos;
    usados.add(p.id);
  }
  return filas;
}

// Fecha "05/10" o "5-10" del texto como 'AAAA-MM-DD' si está entre las fechas posibles, o null.
function fechaDeLista(texto, posibles) {
  const m = String(texto).match(/\b(\d{1,2})[/\-.](\d{1,2})\b/);
  if (!m) return null;
  const dia = m[1].padStart(2, '0'), mes = m[2].padStart(2, '0');
  return posibles.find(f => f.slice(5) === `${mes}-${dia}`) ?? null;
}
