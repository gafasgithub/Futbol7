"""Descarga los jugadores de fut7-puntuaciones y guarda una copia de respaldo para la web.

La web solo lee la fuente al pulsar "Recargar datos"; esta copia (js/jugadores_respaldo.js)
es la que usa la primera vez que se abre en un navegador. Uso: py actualizar_jugadores.py
"""
import json
import urllib.request
from datetime import datetime
from pathlib import Path

# Misma consulta (pública y de solo lectura) que hace https://cimorales.github.io/fut7-puntuaciones/
URL = "https://vwnpmdstzqjdybxvxhvs.supabase.co/rest/v1/jugadores?select=datos&id=eq.1"
CLAVE = "sb_publishable_SVMtK51bFQgPMBrWEJQgBg_vsqvQgHb"
DESTINO = Path(__file__).parent / "js" / "jugadores_respaldo.js"


def main():
    peticion = urllib.request.Request(URL, headers={"apikey": CLAVE})
    with urllib.request.urlopen(peticion, timeout=30) as respuesta:
        jugadores = json.load(respuesta)[0]["datos"]
    fecha = datetime.now().strftime("%Y-%m-%d")
    DESTINO.write_text(
        "// Copia de respaldo generada por actualizar_jugadores.py. No editar a mano.\n"
        f"window.JUGADORES_RESPALDO = {{ fecha: \"{fecha}\", jugadores: "
        + json.dumps(jugadores, ensure_ascii=False)
        + " };\n",
        encoding="utf-8",
    )
    print(f"{len(jugadores)} jugadores guardados en {DESTINO.name} ({fecha})")


if __name__ == "__main__":
    main()
