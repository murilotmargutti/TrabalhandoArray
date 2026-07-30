#!/usr/bin/env python3
"""Gera os ícones que o appinfo.json exige (80x80 e 130x130).

Escrito à mão com zlib em vez de usar Pillow para o projeto não depender de
nada instalado: o objetivo da Fase 0 é reduzir o número de coisas que podem
quebrar entre o código e a TV.
"""

import struct
import zlib
from pathlib import Path

ROSA = (247, 168, 196)
ROSA_ESCURO = (222, 132, 165)
CREME = (255, 247, 240)

APP = Path(__file__).resolve().parent.parent / "app"


def png(width, height, pixels):
    """pixels: função (x, y) -> (r, g, b)."""
    raw = bytearray()
    for y in range(height):
        raw.append(0)  # filtro "none" no começo de cada linha
        for x in range(width):
            raw.extend(pixels(x, y))

    def chunk(tag, data):
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body))

    header = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)  # 8 bits, RGB
    return (b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", header)
            + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
            + chunk(b"IEND", b""))


def desenho(size):
    raio = size * 0.22          # canto arredondado
    margem = size * 0.20
    meio = size / 2

    def pixel(x, y):
        # Fora do canto arredondado devolve rosa escuro; o webOS já recorta o
        # ícone, então isso só evita canto branco feio se ele não recortar.
        for cx, cy in ((raio, raio), (size - raio, raio),
                       (raio, size - raio), (size - raio, size - raio)):
            dentro_x = (x < raio and cx == raio) or (x > size - raio and cx == size - raio)
            dentro_y = (y < raio and cy == raio) or (y > size - raio and cy == size - raio)
            if dentro_x and dentro_y and (x - cx) ** 2 + (y - cy) ** 2 > raio ** 2:
                return ROSA_ESCURO

        # Dois blocos claros deslocados, sugerindo peça sobre peça.
        blocos = [
            (margem, meio - size * 0.06, size * 0.34),
            (meio - size * 0.04, margem, size * 0.34),
        ]
        for bx, by, lado in blocos:
            if bx <= x < bx + lado and by <= y < by + lado:
                # borda mais escura dá volume sem precisar de sombra
                borda = size * 0.045
                na_borda = (x < bx + borda or x >= bx + lado - borda
                            or y < by + borda or y >= by + lado - borda)
                return ROSA_ESCURO if na_borda else CREME

        return ROSA

    return pixel


for size, nome in ((80, "icon80.png"), (130, "icon130.png")):
    destino = APP / nome
    destino.write_bytes(png(size, size, desenho(size)))
    print(f"{destino.relative_to(APP.parent)}  {size}x{size}")
