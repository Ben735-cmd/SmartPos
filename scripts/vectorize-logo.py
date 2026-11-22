"""Rebuilds the SmartPOS logo as a clean SVG from the (low-res) supplied artwork.
Traces the shapes at 4x, keeps colours as smooth gradients, so it stays sharp at any size.
Usage: python3 scripts/vectorize-logo.py   ->  public/logo.svg, public/logo-mark.svg
"""
import cv2, numpy as np
from PIL import Image

SRC = "public/logo.png"          # transparent PNG made by make-brand-assets.py
UP = 4

rgba = np.array(Image.open(SRC).convert("RGBA")).astype(np.float32)
H, W = rgba.shape[:2]
alpha = rgba[..., 3] / 255.0
rgb = rgba[..., :3]

# ---- connected components (on the original grid) to split mark / cart / wordmark / tagline
bin0 = (alpha > 0.5).astype(np.uint8)
n, lab, stats, cent = cv2.connectedComponentsWithStats(bin0, 8)
comps = [i for i in range(1, n) if stats[i, cv2.CC_STAT_AREA] > 25]

def band(i):
    x, y, w, h, a = stats[i]
    cy = y + h / 2
    return cy

# wordmark/tagline bands from row occupancy
rows = bin0.sum(1) > 0
runs, start = [], None
for y, v in enumerate(rows):
    if v and start is None: start = y
    if not v and start is not None: runs.append((start, y)); start = None
if start is not None: runs.append((start, H))
runs = [r for r in runs if r[1] - r[0] > 12]
print("row runs", runs)
mark_run, word_run, tag_run = runs[0], runs[-2], runs[-1]
assert len(runs) >= 3

groups = {"mark": [], "cart": [], "smart": [], "pos": [], "tag": []}
# split Smart | POS at the biggest column gap inside the wordmark band near 55%
wy0, wy1 = word_run
cols = bin0[wy0:wy1].sum(0) > 0
gaps, s = [], None
for x, v in enumerate(cols):
    if not v and s is None: s = x
    if v and s is not None: gaps.append((s, x)); s = None
split_x = None
for g0, g1 in gaps:
    if 0.5 * W < (g0 + g1) / 2 < 0.65 * W:
        split_x = (g0 + g1) / 2
if split_x is None:
    split_x = 0.565 * W
print("Smart|POS split at", split_x)

for i in comps:
    x, y, w, h, a = stats[i]
    cx, cy = cent[i]
    if cy < mark_run[1]:
        # cart pieces sit lower-left under the S; everything else is the monogram
        (groups["cart"] if (cx < 0.52 * W and cy > mark_run[0] + 0.45 * (mark_run[1] - mark_run[0])) else groups["mark"]).append(i)
    elif cy < word_run[1]:
        (groups["smart"] if cx < split_x else groups["pos"]).append(i)
    else:
        groups["tag"].append(i)
print({k: len(v) for k, v in groups.items()})

def smooth_path(pts, corner_deg=48.0, tension=0.5):
    """Closed polygon -> smooth cubic path. Sharp turns stay sharp, gentle ones become curves."""
    n = len(pts)
    if n < 3:
        return ""
    P = pts.astype(np.float64)
    corner = np.zeros(n, bool)
    for i in range(n):
        a, b, c = P[i - 1], P[i], P[(i + 1) % n]
        v1, v2 = b - a, c - b
        l1, l2 = np.linalg.norm(v1), np.linalg.norm(v2)
        if l1 < 1e-9 or l2 < 1e-9:
            continue
        ang = np.degrees(np.arccos(np.clip(v1 @ v2 / (l1 * l2), -1, 1)))
        corner[i] = ang > corner_deg
    tang = np.zeros_like(P)
    for i in range(n):
        if not corner[i]:
            tang[i] = (P[(i + 1) % n] - P[i - 1]) * tension / 1.0
    d = [f"M{P[0][0]:.2f} {P[0][1]:.2f}"]
    for i in range(n):
        j = (i + 1) % n
        c1 = P[i] + tang[i] / 3 * 1.0 if not corner[i] else P[i]
        c2 = P[j] - tang[j] / 3 * 1.0 if not corner[j] else P[j]
        d.append(f"C{c1[0]:.2f} {c1[1]:.2f} {c2[0]:.2f} {c2[1]:.2f} {P[j][0]:.2f} {P[j][1]:.2f}")
    return "".join(d) + "Z"

def trace(ids, blur=0.9, eps=2.2):
    m = np.isin(lab, ids).astype(np.float32) * alpha          # soft coverage, only these pieces
    big = cv2.resize(m, (W * UP, H * UP), interpolation=cv2.INTER_CUBIC)
    big = cv2.GaussianBlur(big, (0, 0), UP * blur)
    mask = (big > 0.5).astype(np.uint8)
    cs, hier = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    parts = []
    for c in cs:
        if cv2.contourArea(c) < 12 * UP * UP / 4: continue
        a = cv2.approxPolyDP(c, eps, True).reshape(-1, 2) / UP
        parts.append(smooth_path(a))
    return " ".join(parts)

def fit_gradient(ids):
    m = np.isin(lab, ids) & (alpha > 0.9)
    ys, xs = np.nonzero(m)
    cols = rgb[ys, xs]
    lum = cols @ np.array([0.299, 0.587, 0.114])
    A = np.c_[xs, ys, np.ones_like(xs)].astype(np.float64)
    coef, *_ = np.linalg.lstsq(A, lum, rcond=None)
    g = np.array(coef[:2]); 
    if np.linalg.norm(g) < 1e-6: g = np.array([0.0, 1.0])
    g /= np.linalg.norm(g)
    proj = xs * g[0] + ys * g[1]
    lo, hi = np.percentile(proj, 2), np.percentile(proj, 98)
    def color_at(t0, t1):
        sel = (proj >= t0) & (proj <= t1)
        return cols[sel].mean(0) if sel.any() else cols.mean(0)
    span = hi - lo
    c_lo = color_at(lo, lo + 0.18 * span)
    c_hi = color_at(hi - 0.18 * span, hi)
    p0 = (xs[proj.argmin()], ys[proj.argmin()])
    # gradient line through the bbox centre along g
    cx, cy = xs.mean(), ys.mean()
    t_c = cx * g[0] + cy * g[1]
    x1, y1 = cx + g[0] * (lo - t_c), cy + g[1] * (lo - t_c)
    x2, y2 = cx + g[0] * (hi - t_c), cy + g[1] * (hi - t_c)
    return (x1, y1, x2, y2), c_lo, c_hi

def flat(ids):
    m = np.isin(lab, ids) & (alpha > 0.9)
    return rgb[m].mean(0)

hexc = lambda c: "#%02x%02x%02x" % tuple(int(round(v)) for v in c)


from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

def text_outline(font_file, text, box, tracking_fit=True):
    """Outline `text` in the given font so its ink exactly fills box=(x0,y0,x1,y1)."""
    f = TTFont(font_file)
    gs, cmap, hmtx = f.getGlyphSet(), f.getBestCmap(), f["hmtx"]
    upm = f["head"].unitsPerEm
    names = [cmap[ord(c)] for c in text]
    # ink bounds at size = upm
    x = 0.0; xs = []
    bp = BoundsPen(gs); ys0, ys1 = 1e9, -1e9
    for n in names:
        xs.append(x)
        b = BoundsPen(gs); gs[n].draw(b)
        if b.bounds:
            ys0, ys1 = min(ys0, b.bounds[1]), max(ys1, b.bounds[3])
        x += hmtx[n][0]
    first_b = BoundsPen(gs); gs[names[0]].draw(first_b)
    last_b = BoundsPen(gs); gs[names[-1]].draw(last_b)
    ink_x0 = xs[0] + first_b.bounds[0]
    ink_x1 = xs[-1] + last_b.bounds[2]
    bx0, by0, bx1, by1 = box
    scale = (by1 - by0) / (ys1 - ys0)                 # size from ink height
    natural_w = (ink_x1 - ink_x0) * scale
    extra = ((bx1 - bx0) - natural_w) / max(1, len(names) - 1) if tracking_fit else 0.0
    out = []
    for i, n in enumerate(names):
        pen = SVGPathPen(gs, ntos=lambda v: f"{v:.2f}")
        ox = bx0 + (xs[i] - ink_x0) * scale + extra * i
        oy = by1 + ys0 * scale                          # baseline so ink bottom sits on box bottom
        gs[n].draw(TransformPen(pen, (scale, 0, 0, -scale, ox, oy)))
        out.append(pen.getCommands())
    return " ".join(out), scale, extra

def gbox(ids):
    m = np.isin(lab, ids)
    ys, xs = np.nonzero(m)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1

FONTS = "branding/"

defs, body = [], []
def add_grad(name, ids):
    (x1, y1, x2, y2), a, b = fit_gradient(ids)
    defs.append(
        f'<linearGradient id="{name}" gradientUnits="userSpaceOnUse" x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}">'
        f'<stop offset="0" stop-color="{hexc(a)}"/><stop offset="1" stop-color="{hexc(b)}"/></linearGradient>'
    )

add_grad("gm", groups["mark"]); body.append(f'<path fill="url(#gm)" fill-rule="evenodd" d="{trace(groups["mark"], blur=1.7, eps=3.4)}"/>')
add_grad("gc", groups["cart"]); body.append(f'<path fill="url(#gc)" fill-rule="evenodd" d="{trace(groups["cart"], blur=0.9, eps=2.0)}"/>')
body_word = []
sb, pb, tb = gbox(groups["smart"]), gbox(groups["pos"]), gbox(groups["tag"])
d_smart, sc1, ex1 = text_outline(FONTS + "montserrat-latin-700-normal.woff", "Smart", sb)
d_pos, sc2, ex2 = text_outline(FONTS + "montserrat-latin-600-normal.woff", "POS", pb)
d_tag, sc3, ex3 = text_outline(FONTS + "montserrat-latin-500-normal.woff", "Keep Track. Move Fast. Grow Big.", tb)
print("text fit (scale, tracking):", (round(sc1,4), round(ex1,2)), (round(sc2,4), round(ex2,2)), (round(sc3,4), round(ex3,2)))
body_word.append(f'<path fill="{hexc(flat(groups["smart"]))}" d="{d_smart}"/>')
add_grad("gp", groups["pos"]); body_word.append(f'<path fill="url(#gp)" d="{d_pos}"/>')
tag = f'<path fill="{hexc(flat(groups["tag"]))}" d="{d_tag}"/>'

def svg(vb, inner, title):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" role="img" aria-label="{title}">'
            f'<defs>{"".join(defs)}</defs>{inner}</svg>')

# tight viewBoxes (with a little breathing room)
def bbox(ids):
    m = np.isin(lab, ids)
    ys, xs = np.nonzero(m)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
allm = groups["mark"] + groups["cart"]
mx0, my0, mx1, my1 = bbox(allm)
pad = 6
open("public/logo-mark.svg", "w").write(
    svg(f"{mx0-pad} {my0-pad} {mx1-mx0+2*pad} {my1-my0+2*pad}", "".join(body), "SmartPOS"))
ax0, ay0, ax1, ay1 = bbox(comps)
open("public/logo.svg", "w").write(
    svg(f"{ax0-pad} {ay0-pad} {ax1-ax0+2*pad} {ay1-ay0+2*pad}", "".join(body) + "".join(body_word) + tag,
        "SmartPOS: Keep Track. Move Fast. Grow Big."))
# wordmark only (mark + name, no tagline) for the top bar on wide screens
wx0, wy0_, wx1, wy1_ = bbox([i for i in comps if i not in groups["tag"]])
open("public/logo-nameplate.svg", "w").write(
    svg(f"{wx0-pad} {wy0_-pad} {wx1-wx0+2*pad} {wy1_-wy0_+2*pad}", "".join(body) + "".join(body_word), "SmartPOS"))
print("done")
