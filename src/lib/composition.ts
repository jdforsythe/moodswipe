import type {
  Card,
  Caption,
  Layout,
  Parameters,
  Photo,
  Mood,
} from "../../shared/types";
export const WIDTH = 1080,
  HEIGHT = 1440;
const SAFE_TOP = 190,
  SAFE_BOTTOM = 1130,
  MARGIN = 90;
export type Presentation = Pick<
  Layout,
  "font" | "alignment" | "region" | "style"
>;
type TypeStyle = {
  id: string;
  family: string;
  weight: number;
  italic?: boolean;
  maxSize: number;
  width: number;
  leading: number;
  alignment: Layout["alignment"];
};
export const typeStyles: TypeStyle[] = [
  {
    id: "poster",
    family: "Barlow Condensed",
    weight: 700,
    maxSize: 154,
    width: 840,
    leading: 1.02,
    alignment: "left",
  },
  {
    id: "headline",
    family: "Oswald",
    weight: 600,
    maxSize: 136,
    width: 900,
    leading: 1.12,
    alignment: "center",
  },
  {
    id: "editorial",
    family: "Lora",
    weight: 600,
    maxSize: 110,
    width: 880,
    leading: 1.15,
    alignment: "left",
  },
  {
    id: "aside",
    family: "Lora",
    weight: 600,
    italic: true,
    maxSize: 104,
    width: 800,
    leading: 1.14,
    alignment: "center",
  },
  {
    id: "statement",
    family: "DM Sans",
    weight: 800,
    maxSize: 126,
    width: 860,
    leading: 1.08,
    alignment: "left",
  },
  {
    id: "punchline",
    family: "Nunito",
    weight: 800,
    maxSize: 120,
    width: 890,
    leading: 1.07,
    alignment: "center",
  },
  {
    id: "offset",
    family: "Space Grotesk",
    weight: 700,
    maxSize: 118,
    width: 780,
    leading: 1.08,
    alignment: "right",
  },
];
const palettes: Record<Mood, string[]> = {
  dark: ["poster", "headline", "statement", "editorial", "offset"],
  sarcastic: ["headline", "poster", "statement", "offset", "editorial"],
  funny: ["punchline", "statement", "poster", "offset"],
  absurd: ["offset", "poster", "punchline", "aside"],
  motivational: ["editorial", "aside", "statement", "headline"],
  wholesome: ["aside", "punchline", "editorial", "statement"],
};
export function selectTypeStyle(
  mood: Mood,
  recent: Presentation[],
  random = Math.random,
) {
  const allowed = typeStyles.filter((s) => palettes[mood].includes(s.id));
  const fresh = allowed.filter(
    (s) => !recent.slice(-2).some((r) => r.font === s.family),
  );
  const pool = fresh.length ? fresh : allowed;
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
}
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
  // Balance adjacent lines without changing the text or leaving a tiny orphan.
  for (let i = lines.length - 1; i > 0; i--) {
    let prior = lines[i - 1].split(" ");
    while (prior.length > 1) {
      const next = `${prior.at(-1)} ${lines[i]}`;
      const remainder = prior.slice(0, -1).join(" ");
      if (
        measure(next) > maxWidth ||
        Math.abs(measure(remainder) - measure(next)) >=
          Math.abs(measure(lines[i - 1]) - measure(lines[i]))
      )
        break;
      lines[i] = next;
      lines[i - 1] = remainder;
      prior = remainder.split(" ");
    }
  }
  return lines;
}
export function fitText(
  text: string,
  measure: (s: string, size: number) => number,
  maxWidth = 900,
  maxHeight = 490,
  maxSize = 104,
  leading = 1.18,
) {
  for (let size = maxSize; size >= 36; size -= 2) {
    const lines = wrapText(text, maxWidth, (s) => measure(s, size));
    if (lines && lines.length * size * leading <= maxHeight)
      return { fontSize: size, lines, lineHeight: size * leading };
  }
  throw new Error("Caption cannot fit safely");
}
const quantile = (values: number[], q: number) =>
  values[Math.min(values.length - 1, Math.floor(values.length * q))] ?? 0;
const WHITE = luminance(255, 253, 247),
  INK = luminance(23, 27, 27);
export function chooseContrast(samples: [number, number, number][]) {
  const levels = samples.map((p) => luminance(...p)).sort((a, b) => a - b);
  const whiteRatio = (WHITE + 0.05) / (quantile(levels, 0.92) + 0.05);
  const inkRatio = (quantile(levels, 0.08) + 0.05) / (INK + 0.05);
  // Large, heavy display type: target >3:1 across at least 92% of sampled
  // glyph pixels. Outlines protect against small highlights / texture.
  if (whiteRatio >= 3.5)
    return {
      color: "#fffdf7",
      scrim: 0,
      stroke: whiteRatio < 4.5 ? 2 : 0,
      contrast: whiteRatio,
    };
  if (inkRatio >= 3.5)
    return {
      color: "#171b1b",
      scrim: 0,
      stroke: inkRatio < 4.5 ? 2 : 0,
      contrast: inkRatio,
    };
  for (let step = 1; step <= 18; step++) {
    const alpha = step * 0.04;
    const adjusted = samples
      .map((p) =>
        luminance(p[0] * (1 - alpha), p[1] * (1 - alpha), p[2] * (1 - alpha)),
      )
      .sort((a, b) => a - b);
    const contrast = (WHITE + 0.05) / (quantile(adjusted, 0.92) + 0.05);
    if (contrast >= 3.5)
      return { color: "#fffdf7", scrim: alpha, stroke: 2.5, contrast };
  }
  return { color: "#fffdf7", scrim: 0.72, stroke: 3, contrast: 3.5 };
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
  recent: Presentation[] = [],
): Promise<Card> {
  const style = selectTypeStyle(caption.mood, recent);
  const fontAt = (size: number) =>
    `${style.italic ? "italic " : ""}${style.weight} ${size}px "${style.family}"`;
  await document.fonts.load(fontAt(80));
  const img = await loadPhoto(photo);
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
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
  const fitted = fitText(
    caption.text,
    (s, size) => {
      ctx.font = fontAt(size);
      return ctx.measureText(s).width;
    },
    style.width,
    570,
    style.maxSize,
    style.leading,
  );
  const blockHeight = fitted.lines.length * fitted.lineHeight;
  // Analyse a small, separate canvas; the exported canvas stays at full quality.
  const sample = document.createElement("canvas");
  sample.width = 108;
  sample.height = 144;
  const analysis = sample.getContext("2d", { willReadFrequently: true })!;
  analysis.drawImage(canvas, 0, 0, 108, 144);
  const pixels = analysis.getImageData(0, 0, 108, 144).data;
  const mask = document.createElement("canvas");
  mask.width = 108;
  mask.height = 144;
  const ink = mask.getContext("2d", { willReadFrequently: true })!;
  const positions = [
    { region: "top", y: SAFE_TOP },
    { region: "middle", y: (SAFE_TOP + SAFE_BOTTOM - blockHeight) / 2 },
    { region: "lower", y: SAFE_BOTTOM - blockHeight },
  ];
  const alignments = [
    ...new Set([style.alignment, "left", "center", "right"]),
  ] as Layout["alignment"][];
  const options = positions.flatMap((position) =>
    alignments.map((alignment) => {
      const x =
        alignment === "center"
          ? WIDTH / 2
          : alignment === "right"
            ? WIDTH - MARGIN
            : MARGIN;
      ink.clearRect(0, 0, 108, 144);
      ink.font = fontAt(fitted.fontSize / 10);
      ink.textAlign = alignment;
      ink.textBaseline = "top";
      ink.fillStyle = "white";
      fitted.lines.forEach((line, i) =>
        ink.fillText(line, x / 10, (position.y + i * fitted.lineHeight) / 10),
      );
      const glyphs = ink.getImageData(0, 0, 108, 144).data;
      const samples: [number, number, number][] = [];
      for (let i = 0; i < glyphs.length; i += 4)
        if (glyphs[i + 3] > 40)
          samples.push([pixels[i], pixels[i + 1], pixels[i + 2]]);
      const treatment = chooseContrast(samples);
      const left =
        alignment === "left"
          ? x
          : alignment === "center"
            ? x - style.width / 2
            : x - style.width;
      const overlap = (photo.subjectRegions ?? []).reduce((n, r) => {
        const top = (r.y * img.naturalHeight - sy) * scale,
          bottom = ((r.y + r.height) * img.naturalHeight - sy) * scale;
        const rleft = (r.x * img.naturalWidth - sx) * scale,
          right = ((r.x + r.width) * img.naturalWidth - sx) * scale;
        return (
          n +
          (position.y < bottom &&
          position.y + blockHeight > top &&
          left < right &&
          left + style.width > rleft
            ? 1.2
            : 0)
        );
      }, 0);
      const repetition = recent
        .slice(-3)
        .reduce(
          (n, r, i) =>
            n +
            (r.region === position.region ? 0.12 + i * 0.04 : 0) +
            (r.alignment === alignment ? 0.04 : 0),
          0,
        );
      return {
        ...position,
        ...treatment,
        x,
        alignment,
        score:
          treatment.scrim * 2.5 +
          overlap +
          repetition +
          (alignment !== style.alignment ? 0.1 : 0) -
          (caption.compositionHint === position.region ? 0.04 : 0) +
          Math.random() * 0.035,
      };
    }),
  );
  const selected = options.sort((a, b) => a.score - b.score)[0];
  if (selected.scrim > 0) {
    const start = selected.y - 110,
      end = selected.y + blockHeight + 110;
    const gradient = ctx.createLinearGradient(0, start, 0, end);
    const fade = 90 / (end - start);
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(fade, `rgba(0,0,0,${selected.scrim})`);
    gradient.addColorStop(1 - fade, `rgba(0,0,0,${selected.scrim})`);
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, start, WIDTH, end - start);
  }
  ctx.font = fontAt(fitted.fontSize);
  ctx.textAlign = selected.alignment;
  ctx.textBaseline = "top";
  ctx.fillStyle = selected.color;
  const light = selected.color === "#fffdf7";
  ctx.strokeStyle = light ? "rgba(13,18,18,.75)" : "rgba(255,253,247,.8)";
  ctx.lineJoin = "round";
  ctx.lineWidth = selected.stroke;
  ctx.shadowColor = light ? "rgba(0,0,0,.32)" : "rgba(255,255,255,.25)";
  ctx.shadowBlur = 3;
  ctx.shadowOffsetY = 1;
  fitted.lines.forEach((line, i) => {
    const y = selected.y + i * fitted.lineHeight;
    if (selected.stroke) ctx.strokeText(line, selected.x, y);
    ctx.fillText(line, selected.x, y);
  });
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
    font: style.family,
    fontWeight: style.weight,
    fontStyle: style.italic ? "italic" : "normal",
    style: style.id,
    ...fitted,
    alignment: selected.alignment,
    region: selected.region,
    scrim: selected.scrim,
    color: selected.color,
    stroke: selected.stroke,
    contrast: selected.contrast,
    x: selected.x,
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
