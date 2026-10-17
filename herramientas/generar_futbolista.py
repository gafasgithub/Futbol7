"""Genera img/futbolista.gif: un futbolista pixel art (camiseta amarilla) corriendo con el balón.

Sin librerías externas: dibuja cada fotograma en una matriz de colores y escribe el GIF a mano.
El cuerpo se monta con "huesos" (cadera, rodilla, pie...) que cambian en cada fotograma, y cada
parte lleva su propio contorno oscuro, como en el pixel art clásico.

Uso: py herramientas/generar_futbolista.py [--muestra]
  --muestra  guarda además img/futbolista_muestra.png con los fotogramas ampliados.
"""
import math
import struct
import sys
import zlib
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
ANCHO, ALTO = 40, 32
FOTOGRAMAS = 8
ESPERA = 9  # centésimas de segundo por fotograma
SUELO = 29

PALETA = [
    None,          # 0: transparente
    (27, 24, 56),  # 1: contorno
    (241, 194, 125),  # 2: piel
    (205, 152, 92),   # 3: piel sombra
    (59, 36, 20),     # 4: pelo
    (255, 204, 51),   # 5: camiseta amarilla
    (214, 160, 0),    # 6: camiseta sombra
    (38, 35, 56),     # 7: pantalón negro
    (255, 255, 255),  # 8: blanco (medias, balón)
    (229, 72, 77),    # 9: botas rojas
    (200, 200, 210),  # 10: blanco sombra
    (30, 110, 52),    # 11: sombra en el césped
    (24, 22, 40),     # 12: pantalón sombra
    (0, 0, 0), (0, 0, 0), (0, 0, 0),
]
C = dict(contorno=1, piel=2, piel2=3, pelo=4, amarillo=5, amarillo2=6, negro=7, blanco=8,
         bota=9, blanco2=10, sombra=11, negro2=12)

CABEZA = [
    "..pppp..",
    ".ppppppp",
    "pppppsss",
    "ppppssss",
    "pppsssos",
    "ppssssss",
    ".ssssss.",
    "..sss...",
]


class Capa:
    def __init__(self):
        self.m = [[0] * ANCHO for _ in range(ALTO)]

    def punto(self, x, y, color):
        x, y = int(round(x)), int(round(y))
        if 0 <= x < ANCHO and 0 <= y < ALTO:
            self.m[y][x] = color

    def rect(self, x0, y0, x1, y1, color):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.punto(x, y, color)

    def segmento(self, a, b, color, grosor=2):
        pasos = int(max(abs(b[0] - a[0]), abs(b[1] - a[1])) * 2) + 1
        for i in range(pasos + 1):
            t = i / pasos
            x = a[0] + (b[0] - a[0]) * t
            y = a[1] + (b[1] - a[1]) * t
            for dx in range(grosor):
                for dy in range(grosor):
                    self.punto(math.floor(x) + dx, math.floor(y) + dy, color)

    def con_contorno(self):
        """Devuelve una copia con un borde oscuro alrededor de lo dibujado."""
        nueva = Capa()
        for y in range(ALTO):
            for x in range(ANCHO):
                nueva.m[y][x] = self.m[y][x]
        for y in range(ALTO):
            for x in range(ANCHO):
                if self.m[y][x]:
                    continue
                vecinos = [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
                if any(0 <= vx < ANCHO and 0 <= vy < ALTO and self.m[vy][vx] for vx, vy in vecinos):
                    nueva.m[y][x] = C["contorno"]
        return nueva


def encima(base, capa):
    for y in range(ALTO):
        for x in range(ANCHO):
            if capa.m[y][x]:
                base.m[y][x] = capa.m[y][x]


def pierna(cadera, angulo_muslo, flexion, oscura):
    """Muslo (pantalón), espinilla (media) y bota. Ángulos en grados; 0 = vertical, positivo = adelante."""
    muslo, espinilla = 4.0, 4.6
    a = math.radians(angulo_muslo)
    rodilla = (cadera[0] + muslo * math.sin(a), cadera[1] + muslo * math.cos(a))
    b = a - math.radians(flexion)
    pie = (rodilla[0] + espinilla * math.sin(b), rodilla[1] + espinilla * math.cos(b))
    capa = Capa()
    capa.segmento(rodilla, pie, C["blanco2"] if oscura else C["blanco"])
    mitad = ((cadera[0] + rodilla[0]) / 2, (cadera[1] + rodilla[1]) / 2)
    capa.segmento(mitad, rodilla, C["piel2"] if oscura else C["piel"])
    capa.segmento(cadera, mitad, C["negro2"] if oscura else C["negro"])
    # La bota apunta hacia delante desde el pie.
    px, py = math.floor(pie[0]), math.floor(pie[1])
    capa.rect(px, py + 1, px + 2, py + 2, C["bota"])
    return capa, (px, py + 2)


def brazo(hombro, angulo, oscuro):
    superior, antebrazo = 3.2, 3.6
    a = math.radians(angulo)
    codo = (hombro[0] + superior * math.sin(a), hombro[1] + superior * math.cos(a))
    b = a + math.radians(70)  # codo doblado hacia delante, como al correr
    mano = (codo[0] + antebrazo * math.sin(b), codo[1] + antebrazo * math.cos(b))
    capa = Capa()
    capa.segmento(codo, mano, C["piel2"] if oscuro else C["piel"])
    capa.segmento(hombro, codo, C["amarillo2"] if oscuro else C["amarillo"])
    return capa


def balon(capa, x, y):
    forma = [".bbb.", "bbkbb", "bkkkb", "bbkbb", ".bbb."]
    for j, fila in enumerate(forma):
        for i, c in enumerate(fila):
            if c == "b":
                capa.punto(x + i, y + j, C["blanco"])
            elif c == "k":
                capa.punto(x + i, y + j, C["contorno"])


def fotograma(n):
    fase = n / FOTOGRAMAS * 2 * math.pi
    # Rebote: el cuerpo sube cuando las piernas se cruzan (dos veces por zancada).
    bote = -round(abs(math.sin(fase)) * 1.2)
    cx = 14
    cadera = (cx, 17 + bote)
    hombro = (cx, 11 + bote)

    def angulos(f):
        muslo = 38 * math.sin(f)
        # La rodilla se dobla más cuando la pierna vuelve hacia delante.
        flexion = 15 + 55 * max(0.0, math.sin(f - math.pi / 2)) ** 1.2
        return muslo, flexion

    capas = []
    # Pierna y brazo de atrás (más oscuros), cuerpo, y pierna y brazo de delante.
    m, f = angulos(fase + math.pi)
    trasera, _ = pierna(cadera, m, f, True)
    capas.append(trasera.con_contorno())
    capas.append(brazo((hombro[0] - 1, hombro[1] + 1), -30 * math.sin(fase + math.pi) * -1, True).con_contorno())

    cuerpo = Capa()
    cuerpo.rect(cx - 3, 10 + bote, cx + 2, 15 + bote, C["amarillo"])
    cuerpo.rect(cx - 3, 10 + bote, cx - 3, 15 + bote, C["amarillo2"])
    cuerpo.rect(cx - 1, 10 + bote, cx, 10 + bote, C["amarillo2"])  # cuello de la camiseta
    cuerpo.rect(cx - 3, 16 + bote, cx + 2, 17 + bote, C["negro"])  # pantalón
    for j, fila in enumerate(CABEZA):
        for i, c in enumerate(fila):
            color = {"p": C["pelo"], "s": C["piel"], "o": C["contorno"]}.get(c)
            if color:
                cuerpo.punto(cx - 4 + i, 2 + bote + j, color)
    capas.append(cuerpo.con_contorno())

    m, f = angulos(fase)
    delantera, pie = pierna(cadera, m, f, False)
    capas.append(delantera.con_contorno())
    capas.append(brazo((hombro[0] + 1, hombro[1] + 1), -30 * math.sin(fase), False).con_contorno())

    figura = Capa()
    for capa in capas:
        encima(figura, capa)
    abajo = max(y for y in range(ALTO) for x in range(ANCHO) if figura.m[y][x])
    desplazar = SUELO - abajo
    if desplazar:
        movida = Capa()
        for y in range(ALTO):
            if 0 <= y - desplazar < ALTO:
                movida.m[y] = figura.m[y - desplazar][:]
        figura = movida

    final = Capa()
    # Sombra en el suelo.
    final.rect(cx - 5, SUELO + 1, cx + 5, SUELO + 1, C["sombra"])
    final.rect(cx - 3, SUELO + 2, cx + 3, SUELO + 2, C["sombra"])
    encima(final, figura)

    # El balón va por delante: lo toca en el fotograma 0, se aleja y vuelve.
    avance = [0, 2, 4, 5, 5, 4, 3, 1][n]
    salto = [0, 1, 1, 0, 0, 0, 0, 0][n]
    bal = Capa()
    balon(bal, 23 + avance, SUELO - 4 - salto)
    bal = bal.con_contorno()
    sombra_balon = Capa()
    sombra_balon.rect(23 + avance, SUELO + 1, 27 + avance, SUELO + 1, C["sombra"])
    encima(final, sombra_balon)
    encima(final, bal)
    return final.m


# ---------- GIF ----------

def lzw(indices, minimo):
    """Compresión LZW del formato GIF."""
    limpiar, fin = 1 << minimo, (1 << minimo) + 1
    bits = minimo + 1
    tabla = {(i,): i for i in range(limpiar)}
    siguiente = fin + 1
    salida, acumulado, n_bits = bytearray(), 0, 0

    def emitir(codigo):
        nonlocal acumulado, n_bits
        acumulado |= codigo << n_bits
        n_bits += bits
        while n_bits >= 8:
            salida.append(acumulado & 0xFF)
            acumulado >>= 8
            n_bits -= 8

    emitir(limpiar)
    actual = (indices[0],)
    for k in indices[1:]:
        candidato = actual + (k,)
        if candidato in tabla:
            actual = candidato
            continue
        emitir(tabla[actual])
        if siguiente < 4096:
            tabla[candidato] = siguiente
            siguiente += 1
            if siguiente > (1 << bits) and bits < 12:
                bits += 1
        else:
            emitir(limpiar)
            tabla = {(i,): i for i in range(limpiar)}
            siguiente, bits = fin + 1, minimo + 1
        actual = (k,)
    emitir(tabla[actual])
    emitir(fin)
    if n_bits:
        salida.append(acumulado & 0xFF)
    return bytes(salida)


def escribir_gif(ruta, fotogramas):
    datos = bytearray(b"GIF89a")
    datos += struct.pack("<HHBBB", ANCHO, ALTO, 0b11110011, 0, 0)  # tabla global de 16 colores
    for color in PALETA:
        datos += bytes(color or (0, 0, 0))
    datos += b"\x21\xFF\x0BNETSCAPE2.0\x03\x01\x00\x00\x00"  # repetir siempre
    for m in fotogramas:
        # Control: borrar antes del siguiente (2), color 0 transparente.
        datos += b"\x21\xF9\x04" + struct.pack("<BHBB", (2 << 2) | 1, ESPERA, 0, 0)
        datos += b"\x2C" + struct.pack("<HHHHB", 0, 0, ANCHO, ALTO, 0)
        comprimido = lzw([c for fila in m for c in fila], 4)
        datos.append(4)
        for i in range(0, len(comprimido), 255):
            trozo = comprimido[i:i + 255]
            datos.append(len(trozo))
            datos += trozo
        datos.append(0)
    datos.append(0x3B)
    ruta.write_bytes(bytes(datos))


def escribir_muestra(ruta, fotogramas, escala=8):
    """PNG con todos los fotogramas en fila, ampliados y sobre césped, para revisarlos."""
    ancho = (ANCHO * len(fotogramas) + len(fotogramas) - 1) * escala
    filas = []
    for y in range(ALTO * escala):
        fila = bytearray([0])
        for k, m in enumerate(fotogramas):
            if k:
                fila += bytes((255, 0, 255)) * escala
            for x in range(ANCHO):
                c = m[y // escala][x]
                fila += bytes(PALETA[c] if c else (63, 157, 88)) * escala
        filas.append(bytes(fila))
    crudo = b"".join(filas)

    def trozo(tipo, contenido):
        return struct.pack(">I", len(contenido)) + tipo + contenido + struct.pack(">I", zlib.crc32(tipo + contenido))

    png = b"\x89PNG\r\n\x1a\n" + trozo(b"IHDR", struct.pack(">IIBBBBB", ancho, ALTO * escala, 8, 2, 0, 0, 0))
    png += trozo(b"IDAT", zlib.compress(crudo, 9)) + trozo(b"IEND", b"")
    ruta.write_bytes(png)


def main():
    fotogramas = [fotograma(n) for n in range(FOTOGRAMAS)]
    destino = RAIZ / "img"
    destino.mkdir(exist_ok=True)
    escribir_gif(destino / "futbolista.gif", fotogramas)
    print(f"img/futbolista.gif: {FOTOGRAMAS} fotogramas de {ANCHO}x{ALTO}")
    if "--muestra" in sys.argv:
        escribir_muestra(destino / "futbolista_muestra.png", fotogramas)
        print("img/futbolista_muestra.png")


if __name__ == "__main__":
    main()
