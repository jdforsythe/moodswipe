import type { ReadyCard } from "../../shared/types";
export type ExportResult = "shared" | "downloaded" | "canceled" | "open";
export function supportsFiles(file: File) {
  try {
    return !!navigator.share && !!navigator.canShare?.({ files: [file] });
  } catch {
    return false;
  }
}
export function download(card: ReadyCard): ExportResult {
  const a = document.createElement("a");
  if (!("download" in a)) return "open";
  a.href = card.url;
  a.download = `moodswipe-${card.id.slice(0, 8)}.png`;
  a.style.display = "none";
  document.body.append(a);
  try {
    a.click();
  } finally {
    a.remove();
  }
  return "downloaded";
}
// Deliberately no rendering or awaiting before navigator.share: retain user activation.
export async function exportCard(
  card: ReadyCard,
  action: "save" | "share",
): Promise<ExportResult> {
  const ios =
    /iP(ad|hone|od)/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if ((action === "share" || ios) && supportsFiles(card.file)) {
    try {
      await navigator.share({
        files: [card.file],
        title: "MoodSwipe",
        text: card.caption.text,
      });
      return "shared";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError")
        return "canceled";
      throw e;
    }
  }
  if (ios) return "open";
  return download(card);
}
