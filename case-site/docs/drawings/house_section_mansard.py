#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
РАЗРЕЗ 1-1 / 2-2 — двухэтажный дом с жилой мансардой под односкатной кровлей.

Сравнение двух вариантов ширины (8500 и 5700 мм) для одной и той же
планировочной концепции. Ташкент, сейсмика MSK-64 8 баллов.

Вся геометрия считается снизу вверх из набора параметров: ни одна отметка
не задана вручную, поэтому размерные цепочки не могут разойтись с чертежом.

Ключевая идея: внутренняя высота у высокой стены мансарды (3600 мм) —
ФИКСИРОВАННАЯ цель, одинаковая для обоих вариантов. Поэтому оба дома
выходят на одну и ту же абсолютную отметку верха кровли, а меняется только
уклон.

Результат: PNG 300 dpi + SVG.

Запуск:  python3 house_section_mansard.py [-o КАТАЛОГ]
"""

from __future__ import annotations

import argparse
import math
import os
from dataclasses import dataclass

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
from matplotlib.patches import Arc, Polygon, Rectangle, Wedge

# ---------------------------------------------------------------------------
# 1. ИСХОДНЫЕ ПАРАМЕТРЫ (метры)
# ---------------------------------------------------------------------------

OUTER_WALL_THICKNESS = 0.590
FOUNDATION_STRIP_DEPTH = 0.500      # ниже чистого пола подвала
BASEMENT_CLEAR_HEIGHT = 2.800
SLAB_TOTAL_THICKNESS = 0.330        # плита + пол, одинаково на всех уровнях
FLOOR1_CLEAR_HEIGHT = 3.120
FLOOR2_CLEAR_HEIGHT = 3.120
LOW_WALL_CLEAR_HEIGHT = 1.500       # h0 — низкая стена мансарды
ROOF_BUILDUP_THICKNESS = 0.300      # по вертикали, постоянная
PARAPET_HEIGHT_LOW_SIDE = 0.600     # выше верха кровли, только низкая сторона
TARGET_HIGH_WALL_HEIGHT = 3.600     # фиксированная цель, одна для обоих домов
COMFORT_HEIGHT = 2.500
WALKABLE_HEIGHT = 2.000

Z_FLOOR1 = 0.380                    # произвольная привязка, чистый пол 1 этажа
Z_GROUND = 0.000                    # уровень земли

HOUSES = (("A", 8.500, "1-1"), ("B", 5.700, "2-2"))

# состав кровельного пирога снизу вверх (сумма == ROOF_BUILDUP_THICKNESS)
ROOF_LAYERS = (
    (0.030, "настил / подшивка"),
    (0.220, "утеплитель + стропила"),
    (0.050, "покрытие (фальц / мембрана)"),
)

# ---------------------------------------------------------------------------
# 2. ВЫСОТНАЯ МОДЕЛЬ — считается один раз, снизу вверх
# ---------------------------------------------------------------------------


def build_elevation_model() -> dict:
    z_floor1 = Z_FLOOR1
    z_slab1_bottom = z_floor1 - SLAB_TOTAL_THICKNESS
    z_basement = z_slab1_bottom - BASEMENT_CLEAR_HEIGHT
    z_foundation = z_basement - FOUNDATION_STRIP_DEPTH
    z_floor2 = z_floor1 + FLOOR1_CLEAR_HEIGHT + SLAB_TOTAL_THICKNESS
    z_mansard = z_floor2 + FLOOR2_CLEAR_HEIGHT + SLAB_TOTAL_THICKNESS
    z_wall_top_low = z_mansard + LOW_WALL_CLEAR_HEIGHT
    z_roof_top_low = z_wall_top_low + ROOF_BUILDUP_THICKNESS
    z_parapet_top = z_roof_top_low + PARAPET_HEIGHT_LOW_SIDE
    rise = TARGET_HIGH_WALL_HEIGHT - LOW_WALL_CLEAR_HEIGHT
    z_wall_top_high = z_wall_top_low + rise
    z_roof_top_high = z_wall_top_high + ROOF_BUILDUP_THICKNESS
    return dict(
        z_foundation=z_foundation,
        z_basement=z_basement,
        z_ground=Z_GROUND,
        z_slab1_bottom=z_slab1_bottom,
        z_floor1=z_floor1,
        z_slab2_bottom=z_floor2 - SLAB_TOTAL_THICKNESS,
        z_floor2=z_floor2,
        z_slabm_bottom=z_mansard - SLAB_TOTAL_THICKNESS,
        z_mansard=z_mansard,
        z_wall_top_low=z_wall_top_low,
        z_roof_top_low=z_roof_top_low,
        z_parapet_top=z_parapet_top,
        rise=rise,
        z_wall_top_high=z_wall_top_high,
        z_roof_top_high=z_roof_top_high,
    )


Z = build_elevation_model()


@dataclass
class House:
    """Геометрия одного варианта. x0 — наружная грань НИЗКОЙ (левой) стены."""

    key: str
    outer_width: float
    section_no: str
    x0: float

    def __post_init__(self) -> None:
        t = OUTER_WALL_THICKNESS
        self.x_lo_out = self.x0
        self.x_lo_in = self.x0 + t
        self.x_hi_in = self.x0 + self.outer_width - t
        self.x_hi_out = self.x0 + self.outer_width
        self.internal_width = self.outer_width - 2 * t
        self.angle = math.atan(Z["rise"] / self.internal_width)
        self.angle_deg = math.degrees(self.angle)
        self.tan_a = math.tan(self.angle)
        self.x_walk = self.x_at_height(WALKABLE_HEIGHT)
        self.x_comfort = self.x_at_height(COMFORT_HEIGHT)
        self.zone3_width = self.internal_width - self.x_comfort
        self.zone3_pct = self.zone3_width / self.internal_width * 100.0

    def x_at_height(self, h: float) -> float:
        """Отступ от внутренней грани низкой стены, где потолок достигает h."""
        return (h - LOW_WALL_CLEAR_HEIGHT) / self.tan_a

    def ceiling_z(self, x: float) -> float:
        """Низ кровли. Плоско над толщиной стен, наклон только в пролёте."""
        if x <= self.x_lo_in:
            return Z["z_wall_top_low"]
        if x >= self.x_hi_in:
            return Z["z_wall_top_high"]
        return Z["z_wall_top_low"] + (x - self.x_lo_in) * self.tan_a

    def roof_underside(self) -> list[tuple[float, float]]:
        return [
            (self.x_lo_out, Z["z_wall_top_low"]),
            (self.x_lo_in, Z["z_wall_top_low"]),
            (self.x_hi_in, Z["z_wall_top_high"]),
            (self.x_hi_out, Z["z_wall_top_high"]),
        ]


# ---------------------------------------------------------------------------
# 3. КОМПОНОВКА ЛИСТА (данные в метрах, масштаб общий по обеим осям)
# ---------------------------------------------------------------------------

GAP = 7.60                                   # разрыв между домами под отметки
X_A = 0.0
X_B = X_A + HOUSES[0][1] + GAP

X_MIN, X_MAX = -3.40, 23.45
Y_MIN, Y_MAX = -7.55, 12.95
SCALE_IN_PER_M = 20.0 / (X_MAX - X_MIN)      # ~0.72 дюйма на метр

DIM_X_A = X_A - 1.05                         # вертикальная цепочка дома A слева
DIM_X_B = X_B + HOUSES[1][1] + 1.05          # ... дома B справа

X_RED = 9.35                                 # красная суммарная цепочка
X_LEVEL_0 = 9.85                             # начало штриховых линий отметок
X_LEVEL_1 = 15.95                            # конец
X_ELEV_MARK = 11.95                          # знак отметки
X_ELEV_TEXT = X_ELEV_MARK + 0.16

Z_HDIM_1 = -3.95                             # 590 | пролёт | 590
Z_HDIM_2 = -4.65                             # общая ширина
Z_CAPTION_1 = -5.40
Z_CAPTION_2 = -5.80
Z_TITLE = 12.40
Z_BREAKLABEL = 11.70
Z_CREDIT = -7.20

# ---------------------------------------------------------------------------
# 4. ПАЛИТРА
# ---------------------------------------------------------------------------

C_INK = "#1A1A1A"
C_THIN = "#6E6E6E"
C_MASONRY = "#CBBFAE"
C_CONCRETE = "#B6BBBE"
C_SHEATHING = "#D8D0C4"
C_INSULATION = "#E6DAA6"
C_ROOFING = "#6C7073"
C_GROUND = "#8C8C8C"
C_ZONE1 = "#EADFCB"
C_ZONE2 = "#D9C89B"
C_ZONE3 = "#BFCDB4"
C_ACCENT = "#A91D20"

LW_STRUCT = 1.15
LW_THIN = 0.55
LW_DIM = 0.7

BBOX_W = dict(facecolor="white", edgecolor="none", pad=0.8)

# ---------------------------------------------------------------------------
# 5. ПРИМИТИВЫ ЧЕРЧЕНИЯ
# ---------------------------------------------------------------------------


def rect(ax, x0, z0, x1, z1, fc, ec=C_INK, lw=LW_STRUCT, z=3, hatch=None):
    ax.add_patch(
        Rectangle(
            (x0, z0),
            x1 - x0,
            z1 - z0,
            facecolor=fc,
            edgecolor=ec,
            linewidth=lw,
            hatch=hatch,
            zorder=z,
        )
    )


def poly(ax, pts, fc, ec=C_INK, lw=LW_STRUCT, z=3, alpha=1.0):
    ax.add_patch(
        Polygon(pts, closed=True, facecolor=fc, edgecolor=ec, linewidth=lw,
                zorder=z, alpha=alpha)
    )


def line(ax, x0, z0, x1, z1, color=C_INK, lw=LW_THIN, ls="-", z=4, **kw):
    ax.plot([x0, x1], [z0, z1], color=color, lw=lw, ls=ls, zorder=z,
            solid_capstyle="butt", **kw)


def tick(ax, x, z, vertical, size=0.13, color=C_INK, lw=0.9, zo=6):
    """Засечка размерной линии под 45° (архитектурный стиль)."""
    d = size / 2
    if vertical:
        ax.plot([x - d, x + d], [z - d, z + d], color=color, lw=lw, zorder=zo)
    else:
        ax.plot([x - d, x + d], [z - d, z + d], color=color, lw=lw, zorder=zo)


def leader(ax, tip, text_xy, text, ha="left", va="center", size=6.8,
           color=C_INK, elbow=None, weight="normal"):
    """Выноска: полка -> текст, без поворота."""
    pts = [tip] + ([elbow] if elbow else []) + [text_xy]
    for a, b in zip(pts, pts[1:]):
        ax.plot([a[0], b[0]], [a[1], b[1]], color=C_THIN, lw=LW_DIM, zorder=6)
    ax.plot(*tip, marker="o", ms=1.9, color=C_INK, zorder=6)
    dx = 0.07 if ha == "left" else (-0.07 if ha == "right" else 0.0)
    ax.text(text_xy[0] + dx, text_xy[1], text, ha=ha, va=va, fontsize=size,
            color=color, weight=weight, zorder=7, bbox=BBOX_W)


def vdim_chain(ax, x_dim, x_ref, segments, side, size=7.5):
    """Вертикальная размерная цепочка с повёрнутыми подписями.

    side = -1: цепочка слева от стены, +1: справа.
    segments = [(z0, z1, 'подпись'), ...]
    """
    z_lo = min(s[0] for s in segments)
    z_hi = max(s[1] for s in segments)
    line(ax, x_dim, z_lo - 0.15, x_dim, z_hi + 0.15, color=C_INK, lw=LW_DIM, z=6)
    seen = set()
    for z0, z1, label in segments:
        for zz in (z0, z1):
            if round(zz, 4) not in seen:
                seen.add(round(zz, 4))
                line(ax, x_ref, zz, x_dim + side * 0.17, zz,
                     color=C_THIN, lw=LW_DIM, ls=(0, (5, 3)), z=5)
                tick(ax, x_dim, zz, vertical=True)
        ax.text(x_dim + side * 0.11, (z0 + z1) / 2, label, rotation=90,
                ha="center", va="center", fontsize=size, zorder=7,
                color=C_INK, bbox=BBOX_W)


def hdim_chain(ax, z_dim, z_ref, stations, labels, size=7.5, weight="normal",
               color=C_INK, ext=True):
    """Горизонтальная размерная цепочка."""
    line(ax, stations[0] - 0.15, z_dim, stations[-1] + 0.15, z_dim,
         color=color, lw=LW_DIM, z=6)
    for x in stations:
        if ext:
            line(ax, x, z_ref, x, z_dim - 0.17, color=C_THIN, lw=LW_DIM,
                 ls=(0, (5, 3)), z=5)
        tick(ax, x, z_dim, vertical=False, color=color)
    for (a, b), lab in zip(zip(stations, stations[1:]), labels):
        ax.text((a + b) / 2, z_dim + 0.10, lab, ha="center", va="bottom",
                fontsize=size, weight=weight, color=color, zorder=7,
                bbox=BBOX_W)


def break_line_vertical(ax, x, z0, z1, positions, amp=0.11, h=0.30):
    """Линия обрыва (зигзаг): элемент продолжается за пределы чертежа."""
    pts = [(x, z0)]
    for p in sorted(positions):
        pts += [(x, p - h), (x + amp, p - h / 3.0), (x - amp, p + h / 3.0),
                (x, p + h)]
    pts.append((x, z1))
    ax.plot([p[0] for p in pts], [p[1] for p in pts], color=C_INK,
            lw=LW_STRUCT, zorder=5, solid_joinstyle="miter")


def ticks_along(ax, p0, p1, n, length, nx, ny, color=C_INK, lw=0.9, zo=6):
    """Гребёнка коротких засечек вдоль отрезка — условный знак парапета."""
    for i in range(n):
        f = (i + 0.5) / n
        x = p0[0] + (p1[0] - p0[0]) * f
        y = p0[1] + (p1[1] - p0[1]) * f
        ax.plot([x, x + nx * length], [y, y + ny * length], color=color,
                lw=lw, zorder=zo)


def fmt_elev(z: float) -> str:
    if abs(z) < 1e-9:
        return "±" + "0.000"
    return f"{z:+.3f}"


# ---------------------------------------------------------------------------
# 6. ОТРИСОВКА ОДНОГО ДОМА
# ---------------------------------------------------------------------------


def draw_house(ax, h: House, dim_x: float, dim_side: int) -> None:
    t = OUTER_WALL_THICKNESS
    z = Z

    # --- грунт ---------------------------------------------------------
    for x_from, x_to in ((h.x_lo_out - 1.35, h.x_lo_out),
                         (h.x_hi_out, h.x_hi_out + 1.35)):
        ax.add_patch(
            Rectangle((x_from, -0.95), x_to - x_from, 0.95, facecolor="none",
                      edgecolor=C_GROUND, hatch="///", linewidth=0.0, zorder=1)
        )
        line(ax, x_from, z["z_ground"], x_to, z["z_ground"], color=C_INK,
             lw=1.3, z=4)

    # --- фундаментная лента --------------------------------------------
    foot = 0.16
    rect(ax, h.x_lo_out - foot, z["z_foundation"], h.x_lo_in + foot,
         z["z_basement"], C_CONCRETE)
    rect(ax, h.x_hi_in - foot, z["z_foundation"], h.x_hi_out + foot,
         z["z_basement"], C_CONCRETE)

    # --- пол подвала ----------------------------------------------------
    rect(ax, h.x_lo_in, z["z_basement"] - 0.15, h.x_hi_in, z["z_basement"],
         C_CONCRETE, lw=0.8)

    # --- стены: бетон ниже отметки земли, кладка выше --------------------
    for x_a, x_b in ((h.x_lo_out, h.x_lo_in), (h.x_hi_in, h.x_hi_out)):
        rect(ax, x_a, z["z_basement"], x_b, z["z_ground"], C_CONCRETE)
    rect(ax, h.x_lo_out, z["z_ground"], h.x_lo_in, z["z_wall_top_low"], C_MASONRY)
    rect(ax, h.x_hi_in, z["z_ground"], h.x_hi_out, z["z_wall_top_high"], C_MASONRY)

    # --- перекрытия: сплошные, без проёмов, во всю ширину ----------------
    for z_bot, z_top in ((z["z_slab1_bottom"], z["z_floor1"]),
                         (z["z_slab2_bottom"], z["z_floor2"]),
                         (z["z_slabm_bottom"], z["z_mansard"])):
        rect(ax, h.x_lo_out, z_bot, h.x_hi_out, z_top, C_CONCRETE)

    # --- названия уровней (без лестниц, дверей и окон — это массинг) ------
    x_mid = (h.x_lo_in + h.x_hi_in) / 2
    for zz, name in (((z["z_basement"] + z["z_slab1_bottom"]) / 2, "ПОДВАЛ"),
                     ((z["z_floor1"] + z["z_slab2_bottom"]) / 2, "1 ЭТАЖ"),
                     ((z["z_floor2"] + z["z_slabm_bottom"]) / 2, "2 ЭТАЖ")):
        ax.text(x_mid, zz, name, ha="center", va="center", fontsize=8.6,
                color="#B0AAA2", zorder=3)
    ax.text(h.x_lo_in + (h.x_comfort + h.internal_width) / 2,
            z["z_mansard"] + 1.25, "МАНСАРДА", ha="center", va="center",
            fontsize=8.6, color="#8E9A86", zorder=4)

    # --- зоны мансарды по высоте ----------------------------------------
    zones = (
        (0.0, h.x_walk, C_ZONE1, "< 2000 мм", "мебель"),
        (h.x_walk, h.x_comfort, C_ZONE2, "2000–2500 мм", "ходить"),
        (h.x_comfort, h.internal_width, C_ZONE3, "≥ 2500 мм", "комната"),
    )
    for a, b, color, lab1, lab2 in zones:
        xa, xb = h.x_lo_in + a, h.x_lo_in + b
        poly(ax, [(xa, z["z_mansard"]), (xb, z["z_mansard"]),
                  (xb, h.ceiling_z(xb)), (xa, h.ceiling_z(xa))],
             color, ec="none", lw=0, z=2)
        line(ax, xb, z["z_mansard"], xb, h.ceiling_z(xb), color="#FFFFFF",
             lw=0.9, z=2.5)
        ax.text((xa + xb) / 2, z["z_mansard"] + 0.52, lab1, ha="center",
                va="bottom", fontsize=7, color="#3A3A3A", zorder=4)
        ax.text((xa + xb) / 2, z["z_mansard"] + 0.24, lab2, ha="center",
                va="bottom", fontsize=6.2, color="#6A6A6A", zorder=4)

    # --- линия рекомендуемой комфортной высоты ---------------------------
    z_comf = z["z_mansard"] + COMFORT_HEIGHT
    x_c0 = h.x_lo_in + h.x_comfort
    x_c1 = h.x_hi_in - 0.50
    line(ax, x_c0, z_comf, x_c1, z_comf, color=C_ACCENT, lw=1.0,
         ls=(0, (6, 3)), z=5)
    # подпись — ПОД линией: над ней скат «съедает» место у левого края зоны 3
    ax.text((x_c0 + x_c1) / 2, z_comf - 0.08, "рекомендуемая комфортная высота",
            ha="center", va="top", fontsize=6.0, color=C_ACCENT, zorder=6,
            bbox=BBOX_W)

    # --- кровельный пирог: три полосы постоянной толщины ------------------
    under = h.roof_underside()
    off = 0.0
    for thick, _name in ROOF_LAYERS:
        lo = [(x, zz + off) for x, zz in under]
        hi = [(x, zz + off + thick) for x, zz in under][::-1]
        fc = {0.030: C_SHEATHING, 0.220: C_INSULATION, 0.050: C_ROOFING}[thick]
        poly(ax, lo + hi, fc, lw=0.8, z=3)
        off += thick
    # общий контур пирога
    poly(ax, [(x, zz) for x, zz in under]
         + [(x, zz + ROOF_BUILDUP_THICKNESS) for x, zz in under][::-1],
         "none", lw=LW_STRUCT, z=4)

    # --- парапет (только низкая, наружная сторона) ------------------------
    p_w = 0.38
    rect(ax, h.x_lo_out, z["z_roof_top_low"], h.x_lo_out + p_w,
         z["z_parapet_top"], C_MASONRY)
    rect(ax, h.x_lo_out - 0.05, z["z_parapet_top"], h.x_lo_out + p_w + 0.05,
         z["z_parapet_top"] + 0.065, C_CONCRETE, lw=0.9)   # парапетная крышка

    # внутренний водосток: лоток + стояк в теле стены (без наружной трубы)
    xg0, xg1 = h.x_lo_out + p_w + 0.05, h.x_lo_out + p_w + 0.37
    z_g = z["z_roof_top_low"] - 0.10
    ax.plot([xg0, xg0, xg1, xg1], [z_g + 0.15, z_g, z_g, z_g + 0.15],
            color=C_ACCENT, lw=1.3, zorder=6, solid_joinstyle="miter")
    x_pipe = h.x_lo_out + 0.27
    line(ax, xg0, z_g, x_pipe, z_g, color=C_ACCENT, lw=1.1, z=6)
    line(ax, x_pipe, z_g, x_pipe, z["z_floor1"], color=C_ACCENT, lw=1.1,
         ls=(0, (4, 2.5)), z=6)
    ax.plot(x_pipe, z["z_floor1"], marker="o", ms=2.4, color=C_ACCENT, zorder=6)
    leader(ax, (x_pipe, 5.60), (h.x_lo_in + 0.30, 5.60),
           "внутренний водосток:\nворонка + стояк в стене", size=6.2,
           color=C_ACCENT)

    # подписи над кровлей: отметка по высоте подбирается так, чтобы подпись
    # гарантированно проходила выше ската (у узкого дома скат круче)
    z_roof_lbl = max(10.30, h.ceiling_z(min(h.x_lo_in + 2.75, h.x_hi_in))
                     + ROOF_BUILDUP_THICKNESS + 0.34)
    leader(ax, (h.x_lo_out + 0.19, z["z_parapet_top"] - 0.10),
           (h.x_lo_out + 0.30, z_roof_lbl + 0.45),
           "парапет — наружная сторона", size=6.8)

    # --- высокая сторона: смежная (общая) стена с зеркальным домом --------
    break_line_vertical(ax, h.x_hi_out, z["z_ground"] - 0.35,
                        z["z_roof_top_high"], positions=(2.0, 5.6, 9.2))
    leader(ax, (h.x_hi_out - 0.26, 10.30), (h.x_hi_out - 0.10, Z_BREAKLABEL),
           "смежная стена — зеркальный дом,\nпарапет не нужен", ha="right",
           va="bottom", size=6.8)

    # --- угол уклона -----------------------------------------------------
    r = 1.15 if h.internal_width > 6.0 else 0.95
    cx, cz = h.x_lo_in, z["z_wall_top_low"]
    ax.add_patch(Wedge((cx, cz), r, 0, h.angle_deg, facecolor=C_ACCENT,
                       edgecolor="none", alpha=0.12, zorder=4))
    ax.add_patch(Arc((cx, cz), 2 * r, 2 * r, theta1=0, theta2=h.angle_deg,
                     edgecolor=C_ACCENT, lw=1.1, zorder=5))
    line(ax, cx, cz, cx + r * 1.30, cz, color=C_ACCENT, lw=0.8,
         ls=(0, (4, 3)), z=5)
    ax.text(cx + r * 1.15, cz - 0.20, f"{h.angle_deg:.1f}°", ha="center",
            va="top", fontsize=8, weight="bold", color=C_ACCENT, zorder=6,
            bbox=BBOX_W)

    # --- внутренняя высота у высокой стены (3600) -------------------------
    # линия ставится вплотную к внутренней грани: левее потолок уже ниже 3600
    x_h = h.x_hi_in - 0.15
    line(ax, x_h, z["z_mansard"], x_h, z["z_wall_top_high"],
         color=C_INK, lw=LW_DIM, z=6)
    for zz in (z["z_mansard"], z["z_wall_top_high"]):
        tick(ax, x_h, zz, vertical=True)
        line(ax, x_h, zz, h.x_hi_in, zz, color=C_THIN, lw=LW_DIM, z=6)
    ax.text(x_h - 0.11, (z["z_mansard"] + z["z_wall_top_high"]) / 2,
            f"{TARGET_HIGH_WALL_HEIGHT * 1000:.0f}", rotation=90, ha="center",
            va="center", fontsize=7.5, zorder=7, bbox=BBOX_W)

    # --- вертикальная размерная цепочка -----------------------------------
    x_ref = h.x_lo_out if dim_side < 0 else h.x_hi_out
    vdim_chain(ax, dim_x, x_ref, [
        (z["z_foundation"], z["z_basement"], f"{FOUNDATION_STRIP_DEPTH*1000:.0f}"),
        (z["z_basement"], z["z_slab1_bottom"], f"{BASEMENT_CLEAR_HEIGHT*1000:.0f}"),
        (z["z_floor1"], z["z_slab2_bottom"], f"{FLOOR1_CLEAR_HEIGHT*1000:.0f}"),
        (z["z_floor2"], z["z_slabm_bottom"], f"{FLOOR2_CLEAR_HEIGHT*1000:.0f}"),
        (z["z_mansard"], z["z_wall_top_low"], f"{LOW_WALL_CLEAR_HEIGHT*1000:.0f}"),
    ], side=dim_side)

    # --- мелкие размеры выносками (сегменты < 500 мм не влезают в цепочку) --
    leader(ax, (h.x_lo_in + 0.34, (z["z_slab2_bottom"] + z["z_floor2"]) / 2),
           (h.x_lo_in + 0.55, z["z_floor2"] + 0.34),
           f"{SLAB_TOTAL_THICKNESS*1000:.0f} — плита + пол  ×3 уровня",
           size=6.8)
    leader(ax, (h.x_lo_in + 0.95,
                h.ceiling_z(h.x_lo_in + 0.95) + ROOF_BUILDUP_THICKNESS / 2),
           (h.x_lo_in + 1.20, z_roof_lbl),
           f"{ROOF_BUILDUP_THICKNESS*1000:.0f} — кровельный пирог", size=6.8)
    leader(ax, (h.x_lo_out + 0.19, (z["z_roof_top_low"] + z["z_parapet_top"]) / 2),
           (h.x_lo_out - 0.15, 10.05),
           f"{PARAPET_HEIGHT_LOW_SIDE*1000:.0f} — парапет", ha="right", size=6.8)

    # --- горизонтальные цепочки ------------------------------------------
    hdim_chain(ax, Z_HDIM_1, z["z_foundation"] - 0.10,
               [h.x_lo_out, h.x_lo_in, h.x_hi_in, h.x_hi_out],
               [f"{OUTER_WALL_THICKNESS*1000:.0f}",
                f"{h.internal_width*1000:.0f}",
                f"{OUTER_WALL_THICKNESS*1000:.0f}"])
    hdim_chain(ax, Z_HDIM_2, Z_HDIM_1 - 0.10, [h.x_lo_out, h.x_hi_out],
               [f"{h.outer_width*1000:.0f}"], size=9.5, weight="bold",
               ext=False)
    for x in (h.x_lo_out, h.x_hi_out):
        line(ax, x, Z_HDIM_1 - 0.10, x, Z_HDIM_2 - 0.17, color=C_THIN,
             lw=LW_DIM, ls=(0, (5, 3)), z=5)

    # --- заголовок и подписи ---------------------------------------------
    xc = (h.x_lo_out + h.x_hi_out) / 2
    ax.text(xc, Z_TITLE,
            f"РАЗРЕЗ {h.section_no} · дом {h.outer_width*1000:.0f} · "
            f"уклон {h.angle_deg:.1f}°",
            ha="center", va="bottom", fontsize=12.5, weight="bold", zorder=7)
    ax.text(xc, Z_CAPTION_1,
            f"Комфортная зона ≥ 2500 мм: {h.zone3_width*1000:.0f} мм — "
            f"{h.zone3_pct:.0f}% ширины мансарды",
            ha="center", va="center", fontsize=7.8, weight="bold", zorder=7)
    ax.text(xc, Z_CAPTION_2,
            "Ходить можно от 2000 мм, полноценная комната — от 2500 мм",
            ha="center", va="center", fontsize=6.9, color="#4A4A4A", zorder=7)


# ---------------------------------------------------------------------------
# 7. ОБЩАЯ КОЛОНКА ОТМЕТОК + КРАСНАЯ СУММАРНАЯ ЦЕПОЧКА
# ---------------------------------------------------------------------------

ELEVATIONS = (
    ("z_foundation", "низ фундаментной ленты"),
    ("z_basement", "чистый пол подвала"),
    ("z_ground", "уровень земли"),
    ("z_floor1", "чистый пол 1 этажа"),
    ("z_floor2", "чистый пол 2 этажа"),
    ("z_mansard", "чистый пол мансарды"),
    ("z_wall_top_low", "низ кровли, низкая сторона"),
    ("z_roof_top_low", "верх кровли, низкая сторона"),
    ("z_parapet_top", "верх парапета"),
    ("z_wall_top_high", "низ кровли, высокая сторона"),
    ("z_roof_top_high", "верх кровли, высокая сторона"),
)


def draw_shared_elevations(ax, a: House, b: House) -> None:
    ax.text((X_LEVEL_0 + X_LEVEL_1) / 2, Z_TITLE - 0.15,
            "ОТМЕТКИ — ОБЩИЕ\nДЛЯ ОБОИХ ВАРИАНТОВ", ha="center", va="bottom",
            fontsize=8.2, weight="bold", color="#3A3A3A", zorder=7,
            linespacing=1.35)

    for key, name in ELEVATIONS:
        zz = Z[key]
        line(ax, X_LEVEL_0, zz, X_LEVEL_1, zz, color=C_THIN, lw=LW_DIM,
             ls=(0, (5, 3)), z=5)
        # знак отметки по ГОСТ: «галочка» на линии
        d = 0.13
        ax.plot([X_ELEV_MARK - d, X_ELEV_MARK, X_ELEV_MARK + d],
                [zz + d, zz, zz + d], color=C_INK, lw=1.0, zorder=6)
        ax.text(X_ELEV_TEXT, zz + 0.06, f"{fmt_elev(zz)}   {name}", ha="left",
                va="bottom", fontsize=7.0, zorder=7, bbox=BBOX_W)

    # --- красная суммарная цепочка ---------------------------------------
    z_top = Z["z_roof_top_high"]
    z_bot = Z["z_foundation"]
    for zz, x_from in ((z_top, a.x_hi_out), (Z["z_ground"], a.x_hi_out),
                       (z_bot, a.x_hi_out + 0.16)):
        line(ax, x_from, zz, X_RED + 0.20, zz, color=C_ACCENT, lw=0.6,
             ls=(0, (4, 3)), z=5)

    for z0, z1, label in ((Z["z_ground"], z_top, f"{(z_top)*1000:.0f}"),
                          (z_bot, Z["z_ground"], f"{(-z_bot)*1000:.0f}")):
        line(ax, X_RED, z0 - 0.12, X_RED, z1 + 0.12, color=C_ACCENT, lw=1.5, z=6)
        for zz in (z0, z1):
            tick(ax, X_RED, zz, vertical=True, color=C_ACCENT, lw=1.5)
        ax.text(X_RED - 0.13, (z0 + z1) / 2, label, rotation=90, ha="center",
                va="center", fontsize=9.0, weight="bold", color=C_ACCENT,
                zorder=7, bbox=BBOX_W)

    ax.text(X_RED - 0.13, z_top + 0.30, "полная высота\nот земли", rotation=0,
            ha="center", va="bottom", fontsize=6.4, color=C_ACCENT, zorder=7)


# ---------------------------------------------------------------------------
# 8. ВРЕЗКА: СХЕМА ПАРАПЕТОВ В ПЛАНЕ
# ---------------------------------------------------------------------------


def draw_plan_inset(ax) -> None:
    ix, iy, w, hh = -3.25, -6.28, 1.50, 1.875        # 4:5

    ax.text(ix, iy + hh + 0.26, "Схема парапетов · план",
            ha="left", va="bottom", fontsize=7.4, weight="bold", zorder=7)

    rect(ax, ix, iy, ix + w, iy + hh, "#F2EFEA", ec="none", lw=0, z=2)

    # три стороны с парапетом: два торца + наружная длинная сторона
    for p0, p1, nx, ny in (((ix, iy), (ix + w, iy), 0, -1),                  # торец
                           ((ix, iy + hh), (ix + w, iy + hh), 0, 1),         # торец
                           ((ix, iy), (ix, iy + hh), -1, 0)):                # длинная
        line(ax, p0[0], p0[1], p1[0], p1[1], color=C_INK, lw=1.4, z=4)
        n = 7 if nx else 6
        ticks_along(ax, p0, p1, n, 0.085, nx, ny)

    # смежная длинная сторона — штриховая, без парапета
    line(ax, ix + w, iy, ix + w, iy + hh, color=C_INK, lw=1.2,
         ls=(0, (4.5, 3)), z=4)

    ax.text(ix + w / 2, iy + hh / 2, "дом", ha="center", va="center",
            fontsize=6.4, color="#7A7A7A", zorder=4)

    leader(ax, (ix + w, iy + hh / 2), (ix + w + 0.36, iy + hh / 2),
           "смежная —\nзеркальный дом\n(парапет не нужен)", size=5.9,
           elbow=(ix + w + 0.20, iy + hh / 2))

    ax.text(ix, iy - 0.32,
            "┴  парапет — 3 стороны: 2 торца + наружная длинная",
            ha="left", va="center", fontsize=6.2, zorder=7)
    ax.text(ix, iy - 0.60,
            "– –  смежная стена — общая с зеркальным домом",
            ha="left", va="center", fontsize=6.2, zorder=7)


# ---------------------------------------------------------------------------
# 9. УСЛОВНЫЕ ОБОЗНАЧЕНИЯ
# ---------------------------------------------------------------------------


def draw_legend(ax) -> None:
    """Условные обозначения — в свободном поле по центру листа, под отметками."""
    lz = -4.15
    ax.text(X_LEVEL_0 - 0.30, lz, "Условные обозначения", ha="left",
            va="center", fontsize=7.4, weight="bold", zorder=7)
    columns = (
        (X_LEVEL_0 - 0.30, (
            (C_MASONRY, "кладка (сейсмоблок)"),
            (C_CONCRETE, "монолитный железобетон"),
            (C_SHEATHING, "настил / подшивка"),
            (C_INSULATION, "утеплитель + стропила"),
        )),
        (X_LEVEL_0 + 3.15, (
            (C_ROOFING, "покрытие кровли"),
            (C_ZONE1, "мансарда  < 2000 мм"),
            (C_ZONE2, "мансарда  2000–2500 мм"),
            (C_ZONE3, "мансарда  ≥ 2500 мм"),
        )),
    )
    for lx, rows in columns:
        for i, (color, label) in enumerate(rows):
            zz = lz - 0.45 * (i + 1)
            rect(ax, lx, zz - 0.095, lx + 0.36, zz + 0.095, color, lw=0.7, z=6)
            ax.text(lx + 0.46, zz, label, ha="left", va="center", fontsize=6.8,
                    zorder=7)


# ---------------------------------------------------------------------------
# 10. ПРОВЕРОЧНАЯ ТАБЛИЦА
# ---------------------------------------------------------------------------


def verify(houses: list[House]) -> None:
    bar = "=" * 78
    print(bar)
    print("ПРОВЕРКА ГЕОМЕТРИИ — разрез дома с мансардой (односкатная кровля)")
    print(bar)

    print("\nВЫСОТНЫЕ ОТМЕТКИ (общие для обоих вариантов)")
    print(f"  {'отметка':>10}  описание")
    for key, name in ELEVATIONS:
        print(f"  {fmt_elev(Z[key]):>10}  {name}")
    print(f"  {'':>10}  промежуточные (низ плит):")
    for key, name in (("z_slab1_bottom", "низ плиты 1 этажа"),
                      ("z_slab2_bottom", "низ плиты 2 этажа"),
                      ("z_slabm_bottom", "низ плиты мансарды")):
        print(f"  {fmt_elev(Z[key]):>10}  {name}")

    print("\nКОНТРОЛЬ ЦЕПОЧЕК (мм) — размер на чертеже == расстояние по модели")
    checks = (
        ("фундамент 500", FOUNDATION_STRIP_DEPTH,
         Z["z_basement"] - Z["z_foundation"]),
        ("подвал 2800", BASEMENT_CLEAR_HEIGHT,
         Z["z_slab1_bottom"] - Z["z_basement"]),
        ("1 этаж 3120", FLOOR1_CLEAR_HEIGHT, Z["z_slab2_bottom"] - Z["z_floor1"]),
        ("2 этаж 3120", FLOOR2_CLEAR_HEIGHT, Z["z_slabm_bottom"] - Z["z_floor2"]),
        ("низкая стена 1500", LOW_WALL_CLEAR_HEIGHT,
         Z["z_wall_top_low"] - Z["z_mansard"]),
        ("плита 330", SLAB_TOTAL_THICKNESS, Z["z_floor1"] - Z["z_slab1_bottom"]),
        ("кровля 300", ROOF_BUILDUP_THICKNESS,
         Z["z_roof_top_low"] - Z["z_wall_top_low"]),
        ("парапет 600", PARAPET_HEIGHT_LOW_SIDE,
         Z["z_parapet_top"] - Z["z_roof_top_low"]),
        ("высокая стена 3600", TARGET_HIGH_WALL_HEIGHT,
         Z["z_wall_top_high"] - Z["z_mansard"]),
        ("итого от земли 11180", Z["z_roof_top_high"],
         Z["z_roof_top_high"] - Z["z_ground"]),
        ("итого вниз 3250", -Z["z_foundation"],
         Z["z_ground"] - Z["z_foundation"]),
    )
    ok_all = True
    for name, want, got in checks:
        ok = abs(want - got) < 1e-9
        ok_all &= ok
        print(f"  {name:<24} задано {want*1000:8.1f}   по модели {got*1000:8.1f}"
              f"   {'OK' if ok else 'РАСХОЖДЕНИЕ'}")

    print(f"\n  сумма слоёв кровли: "
          f"{sum(t for t, _ in ROOF_LAYERS)*1000:.1f} мм == "
          f"{ROOF_BUILDUP_THICKNESS*1000:.1f} мм  "
          f"{'OK' if abs(sum(t for t, _ in ROOF_LAYERS) - ROOF_BUILDUP_THICKNESS) < 1e-9 else 'РАСХОЖДЕНИЕ'}")

    print("\nПО ВАРИАНТАМ")
    hdr = (f"  {'вариант':<9}{'ширина':>9}{'в свету':>10}{'уклон':>9}"
           f"{'x(2000)':>10}{'x(2500)':>10}{'зона ≥2500':>13}{'%':>7}")
    print(hdr)
    for h in houses:
        print(f"  дом {h.key:<5}{h.outer_width*1000:>9.0f}"
              f"{h.internal_width*1000:>10.0f}{h.angle_deg:>8.1f}°"
              f"{h.x_walk*1000:>10.0f}{h.x_comfort*1000:>10.0f}"
              f"{h.zone3_width*1000:>13.0f}{h.zone3_pct:>6.1f}%")

    print("\n  контроль угла: h0 + ширина_в_свету · tg(α) == 3600 мм")
    for h in houses:
        got = LOW_WALL_CLEAR_HEIGHT + h.internal_width * h.tan_a
        ok = abs(got - TARGET_HIGH_WALL_HEIGHT) < 1e-9
        ok_all &= ok
        print(f"    дом {h.key}: {got*1000:8.3f} мм   {'OK' if ok else 'РАСХОЖДЕНИЕ'}")

    print("\n  контроль доли комфортной зоны: 1 − (2500 − 1500)/rise, "
          "от ширины НЕ зависит")
    analytic = (1 - (COMFORT_HEIGHT - LOW_WALL_CLEAR_HEIGHT) / Z["rise"]) * 100
    print(f"    аналитически: {analytic:.2f}%")
    for h in houses:
        ok = abs(h.zone3_pct - analytic) < 1e-9
        ok_all &= ok
        print(f"    дом {h.key}: {h.zone3_pct:.2f}%   {'OK' if ok else 'РАСХОЖДЕНИЕ'}")

    print("\n  КЛЮЧЕВАЯ ПРОВЕРКА — верх кровли одинаков у обоих вариантов:")
    tops = {h.key: Z["z_roof_top_high"] for h in houses}
    same = len(set(round(v, 9) for v in tops.values())) == 1
    ok_all &= same
    for h in houses:
        print(f"    дом {h.key}: низ кровли {fmt_elev(Z['z_wall_top_high'])}, "
              f"верх кровли {fmt_elev(Z['z_roof_top_high'])}")
    print(f"    -> {'ИДЕНТИЧНО, OK' if same else 'РАСХОЖДЕНИЕ'}")

    print(f"\n{bar}\nИТОГ: {'все проверки пройдены' if ok_all else 'ЕСТЬ РАСХОЖДЕНИЯ'}\n{bar}")
    if not ok_all:
        raise SystemExit("Геометрия несогласована — чертёж не построен.")


# ---------------------------------------------------------------------------
# 11. СБОРКА ЛИСТА
# ---------------------------------------------------------------------------


def render(houses: list[House], out_dir: str) -> tuple[str, str]:
    plt.rcParams.update({
        "font.family": "DejaVu Sans",
        "hatch.linewidth": 0.5,
        "svg.fonttype": "path",
        "axes.linewidth": 0.0,
    })

    fig_w = (X_MAX - X_MIN) * SCALE_IN_PER_M
    fig_h = (Y_MAX - Y_MIN) * SCALE_IN_PER_M
    fig = plt.figure(figsize=(fig_w, fig_h), facecolor="white")
    ax = fig.add_axes((0, 0, 1, 1))
    ax.set_xlim(X_MIN, X_MAX)
    ax.set_ylim(Y_MIN, Y_MAX)
    ax.set_aspect("equal")
    ax.axis("off")

    a, b = houses
    draw_house(ax, a, DIM_X_A, dim_side=-1)
    draw_house(ax, b, DIM_X_B, dim_side=+1)
    draw_shared_elevations(ax, a, b)
    draw_plan_inset(ax)
    draw_legend(ax)

    ax.text((X_MIN + X_MAX) / 2, Z_CREDIT,
            "Размеры — мм, отметки — м.   CASE Advisory · 12.08.2026",
            ha="center", va="center", fontsize=7.2, color="#5A5A5A", zorder=7)

    os.makedirs(out_dir, exist_ok=True)
    png = os.path.join(out_dir, "house_section_mansard.png")
    svg = os.path.join(out_dir, "house_section_mansard.svg")
    fig.savefig(png, dpi=300, facecolor="white")
    fig.savefig(svg, facecolor="white")
    plt.close(fig)
    return png, svg


def main() -> None:
    ap = argparse.ArgumentParser(description="Разрез дома с мансардой, 2 варианта")
    ap.add_argument("-o", "--out", default=os.path.dirname(os.path.abspath(__file__)),
                    help="каталог для PNG и SVG")
    args = ap.parse_args()

    houses = [House("A", HOUSES[0][1], HOUSES[0][2], X_A),
              House("B", HOUSES[1][1], HOUSES[1][2], X_B)]

    verify(houses)
    png, svg = render(houses, args.out)
    print(f"PNG (300 dpi): {png}")
    print(f"SVG          : {svg}")


if __name__ == "__main__":
    main()
