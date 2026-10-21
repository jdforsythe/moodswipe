import { writeFile, mkdir, copyFile } from "node:fs/promises";
import sharp from "sharp";
await mkdir("public/photos", { recursive: true });
const photos = {
  forest: "1441974231531-c6227db76b6e",
  lake: "1470770841072-f978cf4d019e",
  peaks: "1464822759023-fed622ff2c3b",
  city: "1519501025264-65ba15a82390",
  dunes: "1509316785289-025f5b846b35",
  ocean: "1518837695005-2083093ee35b",
  coffee: "1495474472287-4d71bcdd2085",
  stairs: "1487958449943-2429e8be8625",
};
await Promise.all(
  Object.entries(photos).map(async ([name, id]) => {
    const r = await fetch(
      `https://images.unsplash.com/photo-${id}?w=1200&h=1600&fit=crop&q=80&fm=webp`,
    );
    if (!r.ok) throw new Error(`${name}: ${r.status}`);
    const b = Buffer.from(await r.arrayBuffer());
    await writeFile(`public/photos/${name}.webp`, b);
    console.log(name, b.length);
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
