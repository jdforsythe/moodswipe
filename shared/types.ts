export const MOODS = [
  "motivational",
  "sarcastic",
  "funny",
  "absurd",
  "dark",
  "wholesome",
] as const;
export type Mood = (typeof MOODS)[number];
export const TOPICS = [
  "Everyday",
  "Work/Burnout",
  "Relationships",
  "Existential",
  "Self-Improvement",
  "Social",
  "Technology",
  "Surprise Me",
] as const;
export const AESTHETICS = [
  "Cinematic",
  "Nature",
  "Urban",
  "Abstract",
  "Minimal",
  "Surreal-looking photography",
] as const;
export type Parameters = {
  mood: Mood;
  topic: (typeof TOPICS)[number];
  intensity: 1 | 2 | 3 | 4 | 5;
  aesthetic: (typeof AESTHETICS)[number];
  random: boolean;
};
export const moodLabels: Record<Mood, string> = {
  motivational: "Motivational",
  sarcastic: "Sarcastic",
  funny: "Funny",
  absurd: "Absurd",
  dark: "Dark Humor",
  wholesome: "Wholesome",
};
export const DEFAULT_PARAMS: Parameters = {
  mood: "sarcastic",
  topic: "Everyday",
  intensity: 3,
  aesthetic: "Nature",
  random: false,
};
export type Source = "llm" | "salvage" | "remix" | "local";
export type Caption = {
  id: string;
  text: string;
  mood: Mood;
  topic: string;
  intensity: number;
  technique: string;
  visualKeywords: string[];
  visualAesthetic: string;
  compositionHint?: "top" | "middle" | "lower";
  source: Source;
  createdAt: number;
  conceptTags?: string[];
};
export type Photo = {
  id: string;
  url: string;
  source: string;
  sourceUrl: string;
  creator?: string;
  license: string;
  licenseUrl: string;
  width: number;
  height: number;
  cacheAllowed: boolean;
  categories: string[];
  aesthetics: string[];
  focalPoint?: { x: number; y: number };
  subjectRegions?: { x: number; y: number; width: number; height: number }[];
};
export type Layout = {
  font: string;
  fontSize: number;
  alignment: "left" | "center" | "right";
  region: string;
  scrim: number;
  lines: string[];
  x: number;
  y: number;
  lineHeight: number;
  width: number;
  height: number;
};
export type Card = {
  id: string;
  caption: Caption;
  photo: Photo;
  params: Parameters;
  layout: Layout;
  createdAt: number;
  blob: Blob;
};
export type ReadyCard = Card & { url: string; file: File };
export type Action = "dismiss" | "save" | "share";
export function validParams(value: unknown): value is Parameters {
  if (!value || typeof value !== "object") return false;
  const p = value as Parameters;
  return (
    MOODS.includes(p.mood) &&
    TOPICS.includes(p.topic) &&
    AESTHETICS.includes(p.aesthetic) &&
    Number.isInteger(p.intensity) &&
    p.intensity >= 1 &&
    p.intensity <= 5 &&
    typeof p.random === "boolean"
  );
}
