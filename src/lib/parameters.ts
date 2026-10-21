import { AESTHETICS, MOODS, TOPICS, type Parameters } from "../../shared/types";
function varied<T>(values: readonly T[], recent: T[], random: () => number): T {
  const weights = values.map(
    (v) => 1 / (1 + recent.filter((x) => x === v).length * 3),
  );
  let n = random() * weights.reduce((a, b) => a + b, 0);
  return values[weights.findIndex((w) => (n -= w) < 0)] ?? values[0];
}
export function randomize(
  recent: Parameters[] = [],
  random = Math.random,
): Parameters {
  return {
    mood: varied(
      MOODS,
      recent.map((p) => p.mood),
      random,
    ),
    topic: varied(
      TOPICS.slice(0, -1),
      recent.map((p) => p.topic),
      random,
    ),
    aesthetic: varied(
      AESTHETICS,
      recent.map((p) => p.aesthetic),
      random,
    ),
    intensity: (1 + Math.floor(random() * 5)) as Parameters["intensity"],
    random: true,
  };
}
export const paramKey = (p: Parameters) => JSON.stringify(p);
