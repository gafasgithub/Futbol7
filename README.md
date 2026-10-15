# Fútbol 7

Web para organizar el fútbol 7 de los lunes y miércoles: elegir a los 16 convocados y sacar dos
equipos equilibrados de 8 (1 portero, 2 defensas, 4 medios y 1 delantero).

## Qué tiene

- **Jugadores**: todos los futbolistas con su resistencia, velocidad, técnica y media, y sus dos
  posiciones. Se seleccionan 16 y se pulsa **Crear convocatoria**.
- **Equipos**: los dos equipos sobre el campo, con la media de cada uno y avisos si alguien juega
  fuera de sus posiciones o no se cumple un condicionante. Tocando un jugador y luego otro se
  intercambian (de posición o de equipo); también se puede sustituir a un convocado por otro jugador.
  **Otra opción** enseña el siguiente mejor reparto y **Copiar para WhatsApp** copia las alineaciones.
- **Condicionantes**: "X no puede ir con Y" y "X debe ir, si es posible, con Y", y cuánto pesa cada
  criterio del reparto.

## De dónde salen los jugadores

De [fut7-puntuaciones](https://cimorales.github.io/fut7-puntuaciones/), donde puntúan Agus, Tora,
Lino, Reta y Neft. Cada atributo es la media de los cinco jueces y la media del jugador es la de
sus tres atributos. La web lee los datos en vivo (solo lectura); si la fuente no responde usa
`js/jugadores_respaldo.js`, que se refresca con:

```
py actualizar_jugadores.py
```

## Cómo se hacen los equipos

Con 16 jugadores hay 6.435 formas de partirlos en dos equipos de 8, y se prueban **todas**. Para
cada equipo se busca la mejor alineación 1-2-4-1, y cada reparto se puntúa por:

1. la diferencia de media entre los dos equipos,
2. los jugadores fuera de su posición favorita (la segunda posición penaliza menos),
3. los condicionantes incumplidos ("no puede ir con" solo se incumple si no hay otra forma),
4. la diferencia en resistencia, velocidad y técnica.

El peso de cada punto se ajusta en la pestaña Condicionantes. El cálculo está en `js/equipos.js`.

## Aspecto

Estilo pixel art, con modo claro y oscuro (botón de la cabecera). El futbolista animado de la
cabecera (`img/futbolista.gif`) se genera con `py herramientas/generar_futbolista.py`.

## Uso local

Basta con abrir `index.html` en el navegador. Pruebas: abrir `pruebas/equipos.html` (generador)
y `pruebas/interaccion.html` (interfaz).

La convocatoria se guarda en el navegador de cada uno.

## Condicionantes

Los condicionantes y los criterios del reparto están en `datos/condicionantes.js`, y la web los lee
de ahí, así que todos ven los mismos. Para cambiarlos:

1. En la pestaña Condicionantes se añaden, se quitan o se ajustan los criterios. Mientras no se
   suba el fichero, esos cambios solo se ven en ese navegador y la web lo avisa.
2. **Descargar fichero** baja el `condicionantes.js` nuevo.
3. Se sube a la carpeta `datos` del repositorio (en GitHub: *Add file → Upload files*) sustituyendo
   al anterior. Al hacer push la web se vuelve a publicar con él.

También se puede editar el fichero a mano: cada regla lleva el id del jugador en
fut7-puntuaciones y su nombre (si el id deja de existir, se busca por nombre).

## Publicación

`.github/workflows/publicar.yml` publica la web en GitHub Pages en cada push a `main`.
