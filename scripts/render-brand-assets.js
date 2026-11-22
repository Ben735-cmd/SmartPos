// Renders the clean SVG logos into every PNG the app needs. Run after scripts/vectorize-logo.py.
// Usage: node scripts/render-brand-assets.js
const { chromium } = require("playwright");
const fs = require("fs");
const read = (f) => fs.readFileSync(f, "utf8");
const mark = read("public/logo-mark.svg");
const full = read("public/logo.svg");
const ratio = (svg) => { const v = svg.match(/viewBox="([^"]+)"/)[1].split(" ").map(Number); return v[2] / v[3]; };

async function shot(browser, { svg, w, h, bg, inner, out, transparent }) {
  // Place the SVG inside a w×h canvas, scaled to fit `inner` (fraction of the canvas), centred.
  const r = ratio(svg);
  let sw = w * inner, sh = sw / r;
  if (sh > h * inner) { sh = h * inner; sw = sh * r; }
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.setContent(
    `<body style="margin:0;width:${w}px;height:${h}px;background:${bg};display:flex;align-items:center;justify-content:center">` +
      svg.replace("<svg ", `<svg width="${sw}" height="${sh}" `) + "</body>"
  );
  await page.screenshot({ path: out, omitBackground: !!transparent });
  await page.close();
}

(async () => {
  const b = await chromium.launch();
  const W = "#ffffff";
  await shot(b, { svg: mark, w: 192, h: 192, bg: W, inner: 0.72, out: "public/icon-192.png" });
  await shot(b, { svg: mark, w: 512, h: 512, bg: W, inner: 0.72, out: "public/icon-512.png" });
  await shot(b, { svg: mark, w: 512, h: 512, bg: W, inner: 0.56, out: "public/icon-maskable-512.png" });
  await shot(b, { svg: mark, w: 180, h: 180, bg: W, inner: 0.72, out: "public/apple-touch-icon.png" });
  for (const s of [16, 32, 48, 64]) await shot(b, { svg: mark, w: s, h: s, bg: "transparent", inner: 0.94, out: `/tmp/fav-${s}.png`, transparent: true });
  await shot(b, { svg: full, w: 1564, h: Math.round(1564 / ratio(full)), bg: "transparent", inner: 1, out: "public/logo.png", transparent: true });
  await shot(b, { svg: mark, w: 1200, h: Math.round(1200 / ratio(mark)), bg: "transparent", inner: 1, out: "public/logo-mark.png", transparent: true });
  await shot(b, { svg: full, w: 1200, h: 630, bg: "#f3f6f2", inner: 0.8, out: "app/opengraph-image.png" });
  await b.close();
})();
