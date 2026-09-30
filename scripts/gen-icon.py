#!/usr/bin/env python3
"""Generates public/icon-192.png and public/icon-512.png with no external deps
(pure stdlib: struct + zlib) — a briefcase glyph on the web UI's pastel
diagonal gradient, for the PWA manifest / "Add to Home Screen" icon.
"""
import os
import struct
import zlib

BG_A = (0xDB, 0xE7, 0xFD)     # --bg-a
BG_C = (0xFC, 0xE3, 0xF3)     # --bg-c
ACCENT = (0xD9, 0x77, 0x57)   # --accent
WHITE = (0xFF, 0xFF, 0xFF)


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def in_rrect(x, y, x0, y0, x1, y1, r):
    if not (x0 <= x <= x1 and y0 <= y <= y1):
        return False
    cx = min(max(x, x0 + r), x1 - r)
    cy = min(max(y, y0 + r), y1 - r)
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r


def make_png(path: str, size: int) -> None:
    s = size
    pixels = [[lerp(BG_A, BG_C, (x + y) / (2 * (s - 1))) for x in range(s)] for y in range(s)]

    for y in range(s):
        for x in range(s):
            # handle: rounded ring on top of the case
            outer = in_rrect(x, y, s * 0.36, s * 0.20, s * 0.64, s * 0.40, s * 0.05)
            inner = in_rrect(x, y, s * 0.42, s * 0.26, s * 0.58, s * 0.40, s * 0.02)
            if outer and not inner:
                pixels[y][x] = ACCENT
            # body
            if in_rrect(x, y, s * 0.22, s * 0.34, s * 0.78, s * 0.74, s * 0.06):
                pixels[y][x] = ACCENT
                # clasp band across the middle
                if s * 0.51 <= y <= s * 0.54:
                    pixels[y][x] = WHITE
                if in_rrect(x, y, s * 0.46, s * 0.47, s * 0.54, s * 0.58, s * 0.015):
                    pixels[y][x] = WHITE

    raw = bytearray()
    for row in pixels:
        raw.append(0)  # filter type: none
        for (r, g, b) in row:
            raw.extend((r, g, b))

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    ihdr = struct.pack(">IIBBBBB", s, s, 8, 2, 0, 0, 0)  # 8-bit RGB
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b"")

    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(png)


if __name__ == "__main__":
    make_png("public/icon-192.png", 192)
    make_png("public/icon-512.png", 512)
    print("wrote public/icon-192.png and public/icon-512.png")
