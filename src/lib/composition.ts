import type {
  Card,
  Caption,
  Layout,
  Parameters,
  Photo,
} from "../../shared/types";
export const WIDTH = 1080,
  HEIGHT = 1440;
export const moodFonts = {
  motivational: { family: "Lora", weight: 600 },
  sarcastic: { family: "Oswald", weight: 600 },
  funny: { family: "Nunito", weight: 800 },
  absurd: { family: "Space Grotesk", weight: 700 },
  dark: { family: "Barlow Condensed", weight: 500 },
  wholesome: { family: "DM Sans", weight: 600 },
};
export function luminance(r: number, g: number, b: number) {
  const f = (v: number) => {
    v /= 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
export function contrastScore(values: number[]) {
  const mean = values.reduce((a, b) => a + b, 0) / (values.length || 1);
  const variance =
    values.reduce((n, v) => n + (v - mean) ** 2, 0) / (values.length || 1);
  return mean + variance * 2;
}
export function wrapText(
  text: string,
  maxWidth: number,
  measure: (s: string) => number,
): string[] | null {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (measure(word) > maxWidth) return null;
    const next = line ? `${line} ${word}` : word;
    if (measure(next) > maxWidth) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}
export function fitText(
  text: string,
  measure: (s: string, size: number) => number,
  maxWidth = 900,
  maxHeight = 490,
) {
  for (let size = 104; size >= 36; size -= 2) {
    const lines = wrapText(text, maxWidth, (s) => measure(s, size));
    if (lines && lines.length * size * 1.18 <= maxHeight)
      return { fontSize: size, lines, lineHeight: size * 1.18 };
  }
  throw new Error("Caption cannot fit safely");
}
async function loadPhoto(photo: Photo): Promise<HTMLImageElement> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.decoding = "async";
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      img.src = "";
      reject(new Error("Photo timed out"));
    }, 7000);
    img.onload = () => {
      clearTimeout(timer);
      resolve();
    };
    img.onerror = () => {
      clearTimeout(timer);
      reject(new Error("Photo unavailable"));
    };
    img.src = photo.url;
  });
  return img;
}
export async function compose(
  caption: Caption,
  photo: Photo,
  params: Parameters,
): Promise<Card> {
  const font = moodFonts[caption.mood];
  await document.fonts.load(`${font.weight} 80px "${font.family}"`);
  const img = await loadPhoto(photo);
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas unavailable");
  const scale = Math.max(WIDTH / img.naturalWidth, HEIGHT / img.naturalHeight);
  const sw = WIDTH / scale,
    sh = HEIGHT / scale;
  const sx = Math.max(
    0,
    Math.min(
      img.naturalWidth - sw,
      (photo.focalPoint?.x ?? 0.5) * img.naturalWidth - sw / 2,
    ),
  );
  const sy = Math.max(
    0,
    Math.min(
      img.naturalHeight - sh,
      (photo.focalPoint?.y ?? 0.5) * img.naturalHeight - sh / 2,
    ),
  );
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, WIDTH, HEIGHT);
  const fitted = fitText(caption.text, (s, size) => {
    ctx.font = `${font.weight} ${size}px "${font.family}"`;
    return ctx.measureText(s).width;
  });
  const blockHeight = fitted.lines.length * fitted.lineHeight;
  const options = [
    { region: "top", y: 300 },
    { region: "middle", y: Math.max(270, (HEIGHT - blockHeight) / 2 - 60) },
    { region: "lower", y: 1110 - blockHeight },
  ];
  const regionScores = options
    .map((o) => {
      const data = ctx.getImageData(
        80,
        Math.round(o.y),
        920,
        Math.ceil(blockHeight),
      ).data;
      const values = [];
      for (let i = 0; i < data.length; i += 4 * 61)
        values.push(luminance(data[i], data[i + 1], data[i + 2]));
      const overlap = (photo.subjectRegions ?? []).reduce((n, r) => {
        const top = (r.y * img.naturalHeight - sy) * scale,
          bottom = ((r.y + r.height) * img.naturalHeight - sy) * scale;
        return n + (o.y < bottom && o.y + blockHeight > top ? 2 : 0);
      }, 0);
      return {
        ...o,
        score:
          contrastScore(values) +
          overlap -
          (caption.compositionHint === o.region ? 0.06 : 0),
        max: Math.max(...values),
      };
    })
    .sort((a, b) => a.score - b.score);
  const selected = regionScores[0];
  // A local dark scrim guarantees readable white type even on a bright sampled region.
  const scrim = Math.max(
    0.48,
    Math.min(0.86, 1 - 0.14 / Math.max(0.2, selected.max)),
  );
  const gradient = ctx.createLinearGradient(
    0,
    selected.y - 130,
    0,
    selected.y + blockHeight + 150,
  );
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(0.2, `rgba(0,0,0,${scrim})`);
  gradient.addColorStop(0.78, `rgba(0,0,0,${scrim})`);
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const alignment =
    caption.mood === "motivational" || caption.mood === "wholesome"
      ? "center"
      : "left";
  const x = alignment === "center" ? WIDTH / 2 : 90;
  ctx.font = `${font.weight} ${fitted.fontSize}px "${font.family}"`;
  ctx.textAlign = alignment;
  ctx.textBaseline = "top";
  ctx.fillStyle = "#fffdf7";
  ctx.shadowColor = "rgba(0,0,0,.6)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;
  fitted.lines.forEach((line, i) =>
    ctx.fillText(line, x, selected.y + i * fitted.lineHeight),
  );
  const blob = await new Promise<Blob>((resolve, reject) => {
    try {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Image export failed"))),
        "image/png",
      );
    } catch (e) {
      reject(e);
    }
  });
  const layout: Layout = {
    font: font.family,
    ...fitted,
    alignment,
    region: selected.region,
    scrim,
    x,
    y: selected.y,
    width: WIDTH,
    height: HEIGHT,
  };
  canvas.width = 1;
  canvas.height = 1;
  return {
    id: crypto.randomUUID(),
    caption,
    photo,
    params,
    layout,
    blob,
    createdAt: Date.now(),
  };
}
