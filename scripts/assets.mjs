import { writeFile, mkdir, copyFile, readFile } from "node:fs/promises";
import sharp from "sharp";
await mkdir("public/photos", { recursive: true });
const photos = JSON.parse(
  await readFile("src/data/photo-manifest.json", "utf8"),
);
await Promise.all(
  photos.map(async ({ id, sourceId }) => {
    const r = await fetch(
      `https://images.unsplash.com/${sourceId}?w=1200&h=1600&fit=crop&q=80&fm=webp`,
    );
    if (!r.ok) throw new Error(`${id}: ${r.status}`);
    const b = await sharp(Buffer.from(await r.arrayBuffer()))
      .resize(1200, 1600, { fit: "cover" })
      .webp({ quality: 64, effort: 5 })
      .toBuffer();
    await writeFile(`public/photos/${id}.webp`, b);
    console.log(id, b.length);
  }),
);
const svg =
  '<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg"><rect width="512" height="512" rx="112" fill="#131815"/><path d="M128 325V187h45l83 87 83-87h45v138h-48v-69l-80 81-80-81v69z" fill="#c5e5a4"/><circle cx="384" cy="133" r="24" fill="#c5e5a4"/></svg>';
for (const size of [192, 512])
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(`public/icons/icon-${size}.png`);
await copyFile("public/icons/icon-512.png", "public/icons/maskable-512.png");
for (const font of [
  "dm-sans",
  "lora",
  "oswald",
  "nunito",
  "space-grotesk",
  "barlow-condensed",
])
  await copyFile(
    `node_modules/@fontsource/${font}/LICENSE`,
    `public/licenses/${font}.txt`,
  );
