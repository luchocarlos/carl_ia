"""Verifica contraste WCAG AA de los tokens de Carl."""

from __future__ import annotations

import json
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
TOKENS = RAIZ / "design" / "tokens.json"


def canal(valor: int) -> float:
    proporcion = valor / 255
    if proporcion <= 0.03928:
        return proporcion / 12.92
    return ((proporcion + 0.055) / 1.055) ** 2.4


def luminancia(color: str) -> float:
    hexa = color.lstrip("#")
    if len(hexa) != 6:
        raise ValueError(f"Color inválido: {color}")
    rojo, verde, azul = (int(hexa[i : i + 2], 16) for i in (0, 2, 4))
    return 0.2126 * canal(rojo) + 0.7152 * canal(verde) + 0.0722 * canal(azul)


def contraste(fondo: str, texto: str) -> float:
    l1 = luminancia(fondo)
    l2 = luminancia(texto)
    claro, oscuro = max(l1, l2), min(l1, l2)
    return (claro + 0.05) / (oscuro + 0.05)


def main() -> int:
    datos = json.loads(TOKENS.read_text(encoding="utf-8"))
    colores = datos["colors"]
    fallos = 0

    print(f"Contraste WCAG AA — {datos['name']} {datos.get('version', '')}".strip())
    print("-" * 62)

    for par in datos["pairs"]:
        fg = colores[par["fg"]]
        bg = colores[par["bg"]]
        minimo = float(par.get("min", 4.5))
        razon = contraste(bg, fg)
        cumple = razon >= minimo
        estado = "OK   " if cumple else "FALLA"
        uso = f"  ({par['usage']})" if par.get("usage") else ""
        print(
            f"{estado} {par['fg']:<12} sobre {par['bg']:<12} "
            f"{razon:5.2f}:1  mín {minimo:.1f}{uso}"
        )
        if not cumple:
            fallos += 1

    print("-" * 62)
    if fallos:
        print(f"{fallos} combinación(es) por debajo del mínimo.")
        return 1

    print("Todas las combinaciones cumplen AA.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
