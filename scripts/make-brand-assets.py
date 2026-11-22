"""
Builds SmartPOS brand assets from branding/smartpos-logo-original.jpg.
Requires: pip install pillow numpy
Run from the repo root:  python3 scripts/make-brand-assets.py

Outputs: public/logo.png, public/logo-mark.png, app icons, favicon, and the social share image.
If you get a higher-resolution or transparent logo later, replace the original and re-run.
"""
import numpy as np
from PIL import Image

SRC = "branding/smartpos-logo-original.jpg"
BG = np.array([235.0, 229.7, 225.8])  # the paper-texture background colour of the original

im = Image.open(SRC).convert("RGB")
a = np.asarray(im).astype(np.float32)

# 1. Cut the logo out of the textured background (background-colour keying with a soft edge).
raw = np.clip((BG - a) / BG, 0, 1).max(axis=2)
alpha = np.clip((raw - 0.08) / (0.30 - 0.08), 0, 1)
alpha = alpha * alpha * (3 - 2 * alpha)

# Ignore paper-texture smudges: only keep the area around the clearly coloured/dark logo pixels.
strong = ((a.max(axis=2) - a.min(axis=2)) > 45) | (a.mean(axis=2) < 150)
sy, sx = np.where(strong)
margin = 14
window = np.zeros(alpha.shape, dtype=bool)
window[max(sy.min() - margin, 0): sy.max() + margin, max(sx.min() - margin, 0): sx.max() + margin] = True
alpha = np.where(window, alpha, 0)
al = alpha[..., None]
fg = np.where(al >= 0.999, a, np.clip((a - (1 - al) * BG) / np.maximum(al, 1e-3), 0, 255))
rgba = Image.fromarray(np.dstack([fg, alpha * 255]).astype(np.uint8), "RGBA")

# 2. Crop to the logo.
sub = np.asarray(rgba)[..., 3] > 12
ys, xs = np.where(sub)
pad = 6
box = (max(xs.min() - pad, 0), max(ys.min() - pad, 0), min(xs.max() + pad, rgba.width), min(ys.max() + pad, rgba.height))
full = rgba.crop(box)

# 3. Find the empty row between the icon mark and the "SmartPOS" wordmark.
fa = np.asarray(full)[..., 3]
rows = (fa > 12).sum(axis=1)
h = full.height
start = int(h * 0.35)
split = None
for y in range(start, int(h * 0.80)):
    if rows[y] == 0:
        split = y
        break
split = split or int(h * 0.55)
mark = full.crop((0, 0, full.width, split))
mx = np.where((np.asarray(mark)[..., 3] > 12).any(axis=0))[0]
my = np.where((np.asarray(mark)[..., 3] > 12).any(axis=1))[0]
mark = mark.crop((max(mx.min() - pad, 0), max(my.min() - pad, 0), min(mx.max() + pad, mark.width), min(my.max() + pad, mark.height)))

def up(img, f):
    return img.resize((round(img.width * f), round(img.height * f)), Image.LANCZOS)

full2 = up(full, 2)
mark4 = up(mark, 4)
full2.save("public/logo.png", optimize=True)
mark4.save("public/logo-mark.png", optimize=True)

# 4. App icons: the mark centred on white.
def icon(size, scale, mode="RGBA"):
    canvas = Image.new("RGBA", (size, size), (255, 255, 255, 255))
    ratio = size * scale / max(mark.size)
    m = mark.resize((round(mark.width * ratio), round(mark.height * ratio)), Image.LANCZOS)
    canvas.alpha_composite(m, ((size - m.width) // 2, (size - m.height) // 2))
    return canvas.convert("RGB") if mode == "RGB" else canvas

icon(192, 0.72).save("public/icon-192.png", optimize=True)
icon(512, 0.72).save("public/icon-512.png", optimize=True)
icon(512, 0.56).save("public/icon-maskable-512.png", optimize=True)  # extra margin: Android crops maskable icons
icon(180, 0.72, "RGB").save("public/apple-touch-icon.png", optimize=True)

# 5. Favicon (transparent).
fav = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
r = 60 / max(mark.size)
m = mark.resize((round(mark.width * r), round(mark.height * r)), Image.LANCZOS)
fav.alpha_composite(m, ((64 - m.width) // 2, (64 - m.height) // 2))
fav.save("public/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])

# 6. Link-preview image (WhatsApp, Facebook, etc.).
og = Image.new("RGB", (1200, 630), (244, 241, 238))
lr = 360 / full.height
lg = full.resize((round(full.width * lr), round(full.height * lr)), Image.LANCZOS)
og_rgba = og.convert("RGBA")
og_rgba.alpha_composite(lg, ((1200 - lg.width) // 2, (630 - lg.height) // 2))
og_rgba.convert("RGB").save("app/opengraph-image.png", optimize=True)

print("full logo", full.size, "-> 2x", full2.size, "| mark", mark.size, "-> 4x", mark4.size)
