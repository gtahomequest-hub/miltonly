// MH-013: where on the preview a green computed colour still comes from (DOM path of each element).
// node scratchpad/mh013/probe-green.mjs <url>
import puppeteer from "puppeteer";
const b = await puppeteer.launch({ headless: true, executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const p = await b.newPage();
await p.goto(process.argv[2], { waitUntil: "load", timeout: 180000 });
const r = await p.evaluate(() => {
  const hsl = (r, g, bb) => { r /= 255; g /= 255; bb /= 255; const M = Math.max(r, g, bb), m = Math.min(r, g, bb); let h = 0, s = 0; const l = (M + m) / 2; if (M !== m) { const d = M - m; s = l > 0.5 ? d / (2 - M - m) : d / (M + m); h = M === r ? (g - bb) / d + (g < bb ? 6 : 0) : M === g ? (bb - r) / d + 2 : (r - g) / d + 4; h *= 60; } return [h, s]; };
  const green = (v) => [...String(v).matchAll(/rgba?\(([\d.]+),?\s*([\d.]+),?\s*([\d.]+)(?:[,/]\s*([\d.]+))?\)/g)].some((m) => { if (m[4] !== undefined && +m[4] === 0) return false; const [h, s] = hsl(+m[1], +m[2], +m[3]); return h >= 70 && h <= 175 && s > 0.15; });
  const out = [];
  for (const el of document.querySelectorAll("body *")) {
    const cs = getComputedStyle(el);
    const props = ["color", "backgroundColor", "borderTopColor", "boxShadow", "backgroundImage", "outlineColor", "fill", "stroke", "accentColor"].filter((k) => green(cs[k]));
    if (!props.length) continue;
    const path = [];
    for (let e = el; e && path.length < 9; e = e.parentElement) path.push(e.tagName.toLowerCase() + (e.id ? "#" + e.id : "") + (e.className && typeof e.className === "string" ? "." + e.className.split(" ").slice(0, 2).join(".") : ""));
    out.push({ props: props.map((k) => `${k}=${String(cs[k]).slice(0, 60)}`), text: el.textContent.trim().slice(0, 40), path: path.join(" < ") });
  }
  return out;
});
console.log(JSON.stringify(r, null, 1));
await b.close();
