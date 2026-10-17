# FUTBOL7

Web estática (HTML + CSS + JS sin compilación ni dependencias) para hacer convocatorias de fútbol 7
(16 jugadores) y repartirlos en dos equipos 1-2-4-1. Ver README.md.

## Estructura

- `js/equipos.js`: generador puro (sin DOM). Prueba los 6.435 repartos y alinea cada equipo con
  programación dinámica. Pesos y costes en `PESOS_DEFECTO` y `COSTE`. Formación en `FORMACION`.
- `js/datos.js`: lee los jugadores de fut7-puntuaciones (consulta REST pública a su Supabase, solo
  lectura; nunca escribir ahí) y los normaliza. Solo se consulta al pulsar "Recargar datos"; cada
  lectura buena se guarda en `localStorage` (`futbol7.jugadores`) y es lo que se usa al abrir la web.
  Sin copia guardada se usa `js/jugadores_respaldo.js` y se guarda, para que no cambie al publicar.
- Condicionantes: `separar` y `juntar` (parejas `a`/`b`) y `equipo` (`a` siempre en `lado` 'A' Amarillo
  o 'B' Negro). `separar` y `equipo` son casi obligatorios (coste 1000). Con reglas `equipo` el
  generador prueba cada reparto en las dos orientaciones.
- `datos/condicionantes.js`: condicionantes y criterios compartidos (`window.CONDICIONANTES`). La web
  no puede escribirlo: los cambios hechos en la web quedan en `localStorage` (`cambiosLocales`) hasta
  que se descarga el fichero y se sube al repo. Al cargar, si coinciden con el fichero, dejan de estar pendientes.
- `js/lista.js`: interpreta la lista pegada (solo líneas numeradas si las hay) y asigna cada nombre
  a un jugador por parecido (`parecido`, de 0 a 100), sin repetir jugador. Por debajo de 90 se marca "revisar".
- `js/app.js`: interfaz. Estado en `localStorage` (clave `futbol7.v1`). `#jugadores`, `#equipos` o
  `#condicionantes` en la URL abren esa pestaña. Las variables con `let` no son
  propiedades de `window` (en las pruebas se leen con `w.eval(...)`).
- Estilo pixel art como TIPSTER (Press Start 2P + VT323, bordes de 3px y sombras sólidas). La letra
  pixelada no tiene tildes en mayúsculas: los textos en esa letra van sin tilde (FUTBOL, MIERCOLES).
- `img/futbolista.gif` se genera con `py herramientas/generar_futbolista.py` (sin librerías: dibuja el
  sprite por "huesos" y escribe el GIF a mano). `--muestra` deja `img/futbolista_muestra.png` ampliada
  para revisarlo (no se sube). Mostrar el GIF siempre a un múltiplo exacto de 40x32.
- Scripts clásicos (no módulos) para que funcione abriendo `index.html` con doble clic.

## Probar cambios

- `pruebas/equipos.html` y `pruebas/interaccion.html` muestran "TODO OK" o los fallos. Sin abrir
  ventanas: Edge headless con `--dump-dom` (la de interacción necesita `--allow-file-access-from-files`
  y un `--user-data-dir` propio). Ejecutar Edge desde PowerShell: desde Git Bash no sale la salida.
- `pruebas/demo.html?p=equipos|jugadores|condicionantes` deja datos de ejemplo y abre la web
  (útil para capturas con `--screenshot`). Ojo: sobrescribe lo guardado en ese navegador.
- En Windows se usa `py`, no `python`. No hay Node instalado.

## Pendiente

- Pestaña para gestionar las puntuaciones aquí mismo (ahora vienen de fut7-puntuaciones).
- Guardar los condicionantes directamente desde la web (ahora hay que descargar y subir el fichero).
