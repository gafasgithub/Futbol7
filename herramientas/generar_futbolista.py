"""Genera img/futbolista.gif: un futbolista pixel art (camiseta amarilla) que avanza regateando
hacia una portería, dispara y celebra el gol.

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
ANCHO, ALTO = 80, 32
SUELO = 29
PORTERIA_X = 66  # palo delantero

PALETA = [
    None,          # 0: transparente
    (27, 24, 56),  # 1: contorno
    (241, 194, 125),  # 2: piel
    (205, 152, 92),   # 3: piel sombra
    (59, 36, 20),     # 4: pelo
    (255, 204, 51),   # 5: camiseta amarilla
    (214, 160, 0),    # 6: camiseta sombra
    (38, 35, 56),     # 7: pantalón negro
    (255, 255, 255),  # 8: blanco (medias, balón, portería)
    (229, 72, 77),    # 9: botas rojas
    (200, 200, 210),  # 10: blanco sombra (red)
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
    return capa


def brazo(hombro, angulo, oscuro, doblez=70):
    """Ángulo del brazo (0 = colgando, positivo = adelante) y del codo respecto al brazo."""
    superior, antebrazo = 3.2, 3.6
    a = math.radians(angulo)
    codo = (hombro[0] + superior * math.sin(a), hombro[1] + superior * math.cos(a))
    b = a + math.radians(doblez)
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


def zancada(fase):
    """(muslo, flexión de rodilla) de una pierna al correr.

    El muslo va hacia delante mientras cos(fase) > 0. La rodilla se dobla sobre todo al traer la
    pierna de atrás hacia delante (el talón sube) y va casi estirada mientras el pie empuja el suelo
    hacia atrás: así se ve que avanza hacia la derecha y no hacia atrás.
    """
    muslo = 38 * math.sin(fase)
    flexion = 10 + 80 * max(0.0, math.cos(fase + math.pi / 3)) ** 1.5
    return muslo, flexion


def jugador(cx, postura, bote=0):
    """Jugador mirando a la derecha. `postura` tiene las piernas como (muslo, flexión) y los brazos
    como (ángulo, doblez), cada uno atrás (más oscuro) y delante."""
    cadera = (cx, 17 + bote)
    hombro = (cx, 11 + bote)
    capas = [
        pierna(cadera, *postura["pierna_atras"], True).con_contorno(),
        brazo((hombro[0] - 1, hombro[1] + 1), *postura["brazo_atras"], True).con_contorno(),
    ]
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
    capas.append(pierna(cadera, *postura["pierna_delante"], False).con_contorno())
    capas.append(brazo((hombro[0] + 1, hombro[1] + 1), *postura["brazo_delante"], False).con_contorno())

    figura = Capa()
    for capa in capas:
        encima(figura, capa)
    return figura


def apoyar(figura, saltar=0):
    """Baja la figura hasta que el pie más bajo toque el suelo (o quede `saltar` píxeles por encima)."""
    abajo = max(y for y in range(ALTO) for x in range(ANCHO) if figura.m[y][x])
    desplazar = SUELO - saltar - abajo
    movida = Capa()
    for y in range(ALTO):
        if 0 <= y - desplazar < ALTO:
            movida.m[y] = figura.m[y - desplazar][:]
    return movida


def porteria(red_hinchada=False):
    """Portería vista de lado a la derecha: palo delantero, larguero que se va al fondo y red.
    Con `red_hinchada` la red se abomba hacia fuera (acaba de entrar el balón)."""
    capa = Capa()
    palo, fondo, arriba = PORTERIA_X, ANCHO - 3, 9
    bolsa = lambda y: 1 if red_hinchada and 14 <= y <= 24 else 0
    for y in range(arriba + 1, SUELO + 1):
        techo = arriba + 3  # el larguero baja hacia el fondo
        limite = fondo + bolsa(y) if y >= techo else palo + 4 * (y - arriba)
        for x in range(palo + 2, limite):
            if (x + y) % 3 == 0:
                capa.punto(x, y, C["blanco2"])
    for x in range(palo, fondo + 1):
        capa.punto(x, arriba + (x - palo) // 4, C["blanco"])
    for y in range(arriba + 3, SUELO + 1):
        capa.punto(fondo + bolsa(y), y, C["blanco2"])
    capa.rect(palo, arriba, palo + 1, SUELO, C["blanco"])
    return capa


def escena(cx, postura, bola, bote=0, saltar=0, red_hinchada=False):
    final = Capa()
    encima(final, porteria(red_hinchada).con_contorno())
    if not saltar:
        final.rect(cx - 5, SUELO + 1, cx + 5, SUELO + 1, C["sombra"])
        final.rect(cx - 3, SUELO + 2, cx + 3, SUELO + 2, C["sombra"])
    else:
        final.rect(cx - 3, SUELO + 1, cx + 3, SUELO + 1, C["sombra"])
    encima(final, apoyar(jugador(cx, postura, bote), saltar))
    bx, by = bola
    if by >= SUELO - 10:
        final.rect(bx, SUELO + 1, bx + 4, SUELO + 1, C["sombra"])
    b = Capa()
    balon(b, bx, by)
    encima(final, b.con_contorno())
    return final.m


def carrera(n):
    """Postura y bote de la carrera en el fotograma n (8 por zancada)."""
    fase = n / 8 * 2 * math.pi
    postura = {
        "pierna_atras": zancada(fase + math.pi),
        "pierna_delante": zancada(fase),
        "brazo_atras": (30 * math.sin(fase), 70),
        "brazo_delante": (-30 * math.sin(fase), 70),
    }
    return postura, -round(abs(math.sin(fase)) * 1.2)


def guion():
    """Fotogramas de la animación como (matriz, espera en centésimas de segundo)."""
    lista = []
    pie = SUELO - 4

    # 1) Avanza regateando. 2,5 px por fotograma es lo que recorre hacia atrás el pie apoyado,
    #    así que el pie no patina sobre el césped.
    pasos = 14
    for n in range(pasos):
        cx = round(6 + 2.5 * n)
        postura, bote = carrera(n)
        toque = [0, 2, 4, 5, 5, 4, 3, 1][n % 8]
        lista.append((escena(cx, postura, (cx + 7 + toque, pie), bote), 8))
    cx = round(6 + 2.5 * pasos)

    # 2) Prepara el disparo (pierna atrás, brazos abiertos), golpea y acompaña.
    preparar = {"pierna_atras": (6, 12), "pierna_delante": (-45, 100),
                "brazo_atras": (50, 20), "brazo_delante": (-60, 30)}
    golpe = {"pierna_atras": (-4, 8), "pierna_delante": (35, 15),
             "brazo_atras": (70, 20), "brazo_delante": (-45, 30)}
    remate = {"pierna_atras": (-8, 10), "pierna_delante": (75, 5),
              "brazo_atras": (80, 20), "brazo_delante": (-35, 30)}
    lista.append((escena(cx, preparar, (cx + 7, pie)), 14))
    lista.append((escena(cx, golpe, (cx + 7, pie)), 6))

    # 3) El balón vuela en parábola hasta la red.
    destino_x, destino_y = ANCHO - 9, 16
    vuelo = 4
    for i in range(1, vuelo + 1):
        t = i / vuelo
        bx = cx + 7 + (destino_x - cx - 7) * t
        by = pie + (destino_y - pie) * t - 5 * math.sin(math.pi * t)
        lista.append((escena(cx, remate, (round(bx), round(by))), 5))

    # 4) ¡Gol! La red se abomba, el balón cae dentro y el jugador salta con los brazos arriba.
    quieto = {"pierna_atras": (-4, 5), "pierna_delante": (4, 5),
              "brazo_atras": (-140, -10), "brazo_delante": (140, 10)}
    salto = {"pierna_atras": (-15, 40), "pierna_delante": (15, 40),
             "brazo_atras": (-150, -10), "brazo_delante": (150, 10)}
    lista.append((escena(cx, remate, (destino_x + 1, destino_y), red_hinchada=True), 12))
    lista.append((escena(cx, quieto, (destino_x, pie - 3)), 10))
    for _ in range(2):
        lista.append((escena(cx, salto, (destino_x, pie), saltar=3), 14))
        lista.append((escena(cx, quieto, (destino_x, pie)), 14))
    lista.append((escena(cx, quieto, (destino_x, pie)), 60))
    return lista


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
    for m, espera in fotogramas:
        # Control: borrar antes del siguiente (2), color 0 transparente.
        datos += b"\x21\xF9\x04" + struct.pack("<BHBB", (2 << 2) | 1, espera, 0, 0)
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


def escribir_muestra(ruta, fotogramas, escala=4, por_fila=4):
    """PNG con los fotogramas en rejilla, ampliados y sobre césped, para revisarlos."""
    separador = bytes((255, 0, 255))
    ancho = (ANCHO * por_fila + por_fila - 1) * escala
    filas = []
    for k in range(0, len(fotogramas), por_fila):
        grupo = fotogramas[k:k + por_fila]
        if k:
            filas += [b"\x00" + separador * ancho] * escala
        for y in range(ALTO * escala):
            fila = bytearray([0])
            for j in range(por_fila):
                if j:
                    fila += separador * escala
                for x in range(ANCHO):
                    c = grupo[j][y // escala][x] if j < len(grupo) else 0
                    fila += bytes(PALETA[c] if c else (63, 157, 88)) * escala
            filas.append(bytes(fila))
    crudo = b"".join(filas)

    def trozo(tipo, contenido):
        return struct.pack(">I", len(contenido)) + tipo + contenido + struct.pack(">I", zlib.crc32(tipo + contenido))

    png = b"\x89PNG\r\n\x1a\n" + trozo(b"IHDR", struct.pack(">IIBBBBB", ancho, len(filas), 8, 2, 0, 0, 0))
    png += trozo(b"IDAT", zlib.compress(crudo, 9)) + trozo(b"IEND", b"")
    ruta.write_bytes(png)


def main():
    fotogramas = guion()
    destino = RAIZ / "img"
    destino.mkdir(exist_ok=True)
    escribir_gif(destino / "futbolista.gif", fotogramas)
    print(f"img/futbolista.gif: {len(fotogramas)} fotogramas de {ANCHO}x{ALTO}")
    if "--muestra" in sys.argv:
        escribir_muestra(destino / "futbolista_muestra.png", [m for m, _ in fotogramas])
        print("img/futbolista_muestra.png")


if __name__ == "__main__":
    main()
