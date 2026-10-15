// Imagen de la convocatoria para compartir por WhatsApp, en el mismo estilo pixel art que la web.
// Solo nombres por equipo: ni medias ni posiciones.

const IMAGEN = { ancho: 1080, alto: 1350 };

// equipos: [{ nombre, lado: 'A' | 'B', jugadores: ['Nombre', ...] }, ...]. Devuelve un <canvas>.
async function dibujarConvocatoria({ titulo, fecha, equipos, pie }, conSprite = true) {
  // Las letras de la web tienen que estar cargadas antes de dibujar con ellas.
  try {
    await Promise.all([document.fonts.load('40px "Press Start 2P"'), document.fonts.load('40px "VT323"')]);
  } catch (e) { /* sin las letras se dibuja con las de respaldo */ }
  const sprite = conSprite ? await cargarImagen('img/futbolista.gif') : null;

  const lienzo = document.createElement('canvas');
  lienzo.width = IMAGEN.ancho;
  lienzo.height = IMAGEN.alto;
  const c = lienzo.getContext('2d');
  c.imageSmoothingEnabled = false;
  const px = (t, color, x, y, alinear = 'left') => { c.fillStyle = color; c.textAlign = alinear; c.fillText(t, x, y); };

  // Cielo con estrellas.
  c.fillStyle = '#0b0830';
  c.fillRect(0, 0, IMAGEN.ancho, IMAGEN.alto);
  const estrellas = [[60, 50, '#fff'], [210, 140, '#b8b2ff'], [380, 70, '#fff'], [520, 190, '#ffcc33'], [690, 40, '#fff'],
    [820, 120, '#b8b2ff'], [990, 60, '#fff'], [140, 250, '#fff'], [930, 230, '#ffcc33'], [600, 110, '#fff'], [40, 200, '#b8b2ff']];
  for (const [x, y, color] of estrellas) { c.fillStyle = color; c.fillRect(x, y, 6, 6); }

  // Título y fecha.
  c.textBaseline = 'alphabetic';
  c.font = '64px "Press Start 2P", monospace';
  px(titulo, '#3a2fb8', 76, 156);
  px(titulo, '#ffffff', 70, 150);
  c.font = '52px "VT323", monospace';
  px(fecha, '#ffcc33', 72, 220);

  // Césped con el futbolista.
  const suelo = 330;
  for (let x = 0; x < IMAGEN.ancho; x += 64) {
    c.fillStyle = (x / 64) % 2 ? '#37904f' : '#3f9d58';
    c.fillRect(x, suelo, 64, 44);
  }
  c.fillStyle = '#1b1838';
  c.fillRect(0, suelo - 6, IMAGEN.ancho, 6);
  // El GIF (40x32) a 5x; los pies están en la fila 29, así que quedan 145 px por debajo de su borde.
  if (sprite) c.drawImage(sprite, IMAGEN.ancho - 300, suelo + 12 - 145, 200, 160);

  // Dos fichas, una por equipo.
  const margen = 56, hueco = 40, arriba = suelo + 90;
  const anchoFicha = (IMAGEN.ancho - margen * 2 - hueco) / 2;
  const altoFicha = IMAGEN.alto - arriba - 110;
  equipos.forEach((eq, k) => {
    const x = margen + k * (anchoFicha + hueco);
    const amarillo = eq.lado === 'A';
    c.fillStyle = '#000000';
    c.fillRect(x + 14, arriba + 14, anchoFicha, altoFicha);
    c.fillStyle = '#fffaf0';
    c.fillRect(x, arriba, anchoFicha, altoFicha);
    c.fillStyle = amarillo ? '#ffcc33' : '#1b1838';
    c.fillRect(x, arriba, anchoFicha, 110);
    c.strokeStyle = '#1b1838';
    c.lineWidth = 8;
    c.strokeRect(x + 4, arriba + 4, anchoFicha - 8, altoFicha - 8);
    c.fillRect(x, arriba + 106, anchoFicha, 8);

    c.font = '34px "Press Start 2P", monospace';
    px(eq.nombre.toUpperCase(), amarillo ? '#1b1838' : '#ffcc33', x + anchoFicha / 2, arriba + 76, 'center');

    const paso = (altoFicha - 150) / Math.max(eq.jugadores.length, 1);
    eq.jugadores.forEach((nombre, i) => {
      const y = arriba + 150 + paso * i + paso * 0.62;
      // Cuadradito del color del equipo y nombre, encogido si no cabe.
      c.fillStyle = amarillo ? '#ffcc33' : '#1b1838';
      c.fillRect(x + 34, y - 26, 22, 22);
      c.strokeStyle = '#1b1838';
      c.lineWidth = 4;
      c.strokeRect(x + 34, y - 26, 22, 22);
      let tam = 56;
      c.font = `${tam}px "VT323", monospace`;
      while (c.measureText(nombre).width > anchoFicha - 100 && tam > 30) { tam -= 2; c.font = `${tam}px "VT323", monospace`; }
      px(nombre, '#1b1838', x + 74, y);
    });
  });

  c.font = '30px "VT323", monospace';
  px(pie, '#a79fd6', IMAGEN.ancho / 2, IMAGEN.alto - 40, 'center');
  return lienzo;
}

function cargarImagen(ruta) {
  return new Promise(resolver => {
    const img = new Image();
    img.onload = () => resolver(img);
    img.onerror = () => resolver(null);
    img.src = ruta;
  });
}

// PNG de la imagen. Si el navegador no deja exportar el dibujo con el GIF (pasa abriendo el archivo
// con doble clic, sin servidor), se repite sin él.
async function imagenConvocatoria(datos) {
  for (const conSprite of [true, false]) {
    const lienzo = await dibujarConvocatoria(datos, conSprite);
    try {
      const blob = await new Promise((ok, mal) => lienzo.toBlob(b => (b ? ok(b) : mal(new Error('vacía'))), 'image/png'));
      return blob;
    } catch (e) {
      if (!conSprite) throw e;
    }
  }
}
