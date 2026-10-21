import type { Action } from "../../shared/types";
export type Axis = "x" | "y" | null;
export function lockAxis(dx: number, dy: number): Axis {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 10) return null;
  return Math.abs(dx) > Math.abs(dy) * 1.15 ? "x" : "y";
}
export function gestureAction(
  dx: number,
  dy: number,
  velocity: number,
  axis: Axis,
  width: number,
): Action | null {
  const distance = axis === "x" ? dx : dy;
  const threshold = Math.min(110, width * 0.24);
  if (
    Math.abs(distance) < threshold &&
    !(Math.abs(velocity) > 0.65 && Math.abs(distance) > 32)
  )
    return null;
  if (axis === "x") return dx < 0 ? "dismiss" : "save";
  if (axis === "y" && dy < 0) return "share";
  return null;
}
