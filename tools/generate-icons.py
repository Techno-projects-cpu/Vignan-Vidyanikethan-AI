#!/usr/bin/env python3
"""Generate simple PWA PNG icons without third-party dependencies."""

import math
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "icons"
OUT.mkdir(parents=True, exist_ok=True)


def blend(dst, src, alpha):
    return tuple(round(dst[i] * (1 - alpha) + src[i] * alpha) for i in range(3))


def distance_to_segment(px, py, x1, y1, x2, y2):
    dx, dy = x2 - x1, y2 - y1
    length = dx * dx + dy * dy
    t = 0 if length == 0 else max(0, min(1, ((px - x1) * dx + (py - y1) * dy) / length))
    return math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))


def make_icon(size):
    scale = 2
    s = size * scale
    pixels = [[(7, 19, 39) for _ in range(s)] for _ in range(s)]
    radius = s * 0.22
    stroke = s * 0.055

    for y in range(s):
        for x in range(s):
            # Rounded square background with a subtle blue radial glow.
            dx = max(radius - x, 0, x - (s - radius - 1))
            dy = max(radius - y, 0, y - (s - radius - 1))
            corner = math.hypot(dx, dy)
            if corner > radius:
                pixels[y][x] = (255, 255, 255)
                continue
            glow = max(0, 1 - math.hypot(x - s * 0.5, y - s * 0.42) / (s * 0.75))
            base = blend((7, 19, 39), (20, 70, 125), glow * 0.65)

            # A white V made of two rounded strokes.
            d1 = distance_to_segment(x, y, s * 0.30, s * 0.36, s * 0.50, s * 0.70)
            d2 = distance_to_segment(x, y, s * 0.70, s * 0.36, s * 0.50, s * 0.70)
            d = min(d1, d2)
            if d < stroke:
                pixels[y][x] = blend(base, (255, 255, 255), min(1, (stroke - d) / (scale * 1.5)))
            else:
                pixels[y][x] = base

    # Downsample (2x supersampling).
    rows = []
    for y in range(size):
        row = bytearray([0])  # PNG filter type 0
        for x in range(size):
            r = g = b = 0
            for oy in range(scale):
                for ox in range(scale):
                    pr, pg, pb = pixels[y * scale + oy][x * scale + ox]
                    r += pr
                    g += pg
                    b += pb
            total = scale * scale
            row += bytes((r // total, g // total, b // total, 255))
        rows.append(bytes(row))
    raw = b"".join(rows)

    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")
    return png


for dimension in (192, 512):
    (OUT / f"icon-{dimension}.png").write_bytes(make_icon(dimension))
    print(f"wrote icon-{dimension}.png")
