import type { Caption, Mood, Parameters } from "../../shared/types";
// Hand-authored complete captions, never assembled from templates.
const library: Record<Mood, string[]> = {
  sarcastic: [
    "I came. I saw. I needed a minute.",
    "A beautiful day to put my phone down. After this.",
    "My five-year plan has entered its experimental phase.",
    "Taking the scenic route because the direct route had responsibilities.",
    "The meeting could have been a quiet walk in opposite directions.",
    "My inbox and I have agreed to see other people.",
    "Very available emotionally. Between 2:15 and 2:17.",
    "I have reached the age where a canceled plan feels like a tax refund.",
    "The universe has a plan. Its calendar permissions are terrible.",
    "Personal growth is inconveniently personal.",
    "My screen-time report should arrive with a lawyer.",
    "Networking, but with trees. Much better listeners.",
    "I am the calm before another browser tab.",
    "My comfort zone recently installed better seating.",
    "Finding myself. Apparently I left myself on mute.",
    "Work-life balance, photographed during its annual appearance.",
  ],
  funny: [
    "Went outside. Graphics are incredible. No skip button, though.",
    "My brain has 47 tabs open and one of them is playing a kazoo.",
    "I packed snacks for a journey of personal discovery.",
    "If standing here counts as hiking, I am an athlete.",
    "My calendar just asked for some space.",
    "The coffee is doing its best. Please respect its boundaries.",
    "My love language is sending you something instead of answering your question.",
    "Group chat archaeologists will study my unread messages.",
    "An entire planet and I keep losing things in one room.",
    "Becoming my best self, pending a snack.",
    "My password hint is now a cry for technical support.",
    "Social battery: enough for one enthusiastic wave.",
    "Nature has excellent wallpaper and terrible charging ports.",
    "I would like to unsubscribe from knowing what time it is.",
    "Today has strong practice-round energy.",
    "Somewhere, a pigeon thinks I am the weird one.",
  ],
  motivational: [
    "A small step still changes where you stand.",
    "You can begin before you feel like a beginning.",
    "Leave room for the version of you that has not arrived yet.",
    "Some progress looks like learning when to rest.",
    "Let your next hour be smaller than your whole future.",
    "You are allowed to outgrow a goal you once needed.",
    "The right people make room for your unfinished sentences.",
    "Connection starts with one honest hello.",
    "You do not need to solve your life to live this afternoon.",
    "Try again with what the last try taught you.",
    "Close the tab. Open the possibility.",
    "Your pace is allowed to belong to you.",
    "Even a long way home is made of ordinary steps.",
    "Quiet effort leaves a mark, too.",
    "The view changes when you give yourself another day.",
    "Make one thing easier for tomorrow’s you.",
  ],
  absurd: [
    "The trees have formed a committee. The wind is under review.",
    "I am three small weather systems in a coat.",
    "Somewhere a mountain is late for a very slow meeting.",
    "The horizon is just the earth refusing to elaborate.",
    "My out-of-office reply has developed a rich inner life.",
    "I have appointed this coffee interim director of consciousness.",
    "Our relationship has the structural integrity of a very ambitious cloud.",
    "The group chat has elected a decorative spoon as mayor.",
    "Time is soup. Tuesday is the fork.",
    "My future self keeps forwarding my emails to a lighthouse.",
    "The algorithm thinks I am a divorced aquarium.",
    "A cloud just looked at me like I owe it money.",
    "Please hold. My personality is migrating south.",
    "This rock has declined to comment on the economy.",
    "I brought a tiny clipboard to supervise the ocean.",
    "Reality is currently being assembled by unsupervised moss.",
  ],
  dark: [
    "It turns out “this too shall pass” also applies to paychecks.",
    "The bank believes in my future. That's why it wants thirty years of it.",
    "I've done the inner work. Unfortunately, the landlord wants money.",
    "Cleaned the apartment in case something happens to me. Still can't have people judging.",
    "I asked about job security. They sent me a password reset.",
    "My company calls us family. Apparently I'm the relative they can replace on Monday.",
    "We promised we'd grow old together. Neither of us budgeted for who we'd become.",
    "Being an emergency contact is a lot of responsibility for someone who screens calls.",
    "The afterlife can wait. I still need to cancel a free trial.",
    "My therapist says I need boundaries. My bank says I've reached them.",
    "My phone made a montage of my year. Even the algorithm couldn't find a plot.",
    "Got a “we miss you” email from a shop. Nice to know my absence has a price.",
    "Bought a lifetime warranty. For once, a company and I agree on the odds.",
    "My retirement plan is to become a cautionary tale with a garden.",
    "We stayed together for the dog. The dog has since moved on emotionally.",
    "The good news is I won't remember most of this. The bad news is I'm taking notes.",
  ],
  wholesome: [
    "Someone’s ordinary day got better because you were in it.",
    "You do not have to earn a quiet afternoon.",
    "A little light is still a little light.",
    "May your next small surprise be a good one.",
    "You are more than what you finished today.",
    "Even the busiest day has room for a softer moment.",
    "Home can be a person who lets you finish your story.",
    "Send the photo. They like hearing from you.",
    "There is no wrong time to notice something beautiful.",
    "Be a place where your own mind can rest.",
    "A message that just says “made me think of you.” That is enough.",
    "Somebody remembers a kindness you have forgotten.",
    "There are still new favorite places waiting for you.",
    "Small joys are full-size joys.",
    "Your company counts, even on the quiet days.",
    "Today, let enough be enough.",
  ],
};
const topics = [
  "Everyday",
  "Everyday",
  "Self-Improvement",
  "Everyday",
  "Work/Burnout",
  "Work/Burnout",
  "Relationships",
  "Social",
  "Existential",
  "Self-Improvement",
  "Technology",
  "Social",
  "Everyday",
  "Existential",
  "Relationships",
  "Everyday",
];
export const localCaptions: Caption[] = Object.entries(library).flatMap(
  ([mood, lines]) =>
    lines.map((text, i) => ({
      id: `local-${mood}-${mood === "dark" ? "v2-" : ""}${i}`,
      text,
      mood: mood as Mood,
      topic: topics[i],
      intensity: 1 + (i % 5),
      technique: "curated observation",
      visualKeywords:
        i % 3 === 0
          ? ["nature", "quiet"]
          : i % 3 === 1
            ? ["work", "city"]
            : ["space", "water"],
      visualAesthetic: "Cinematic",
      source: "local",
      createdAt: 0,
    })),
);
export function pickLocal(params: Parameters, recent: string[]): Caption {
  const all = localCaptions.filter((c) => c.mood === params.mood);
  const candidates = all.filter((c) => !recent.includes(c.id));
  const pool = candidates.length ? candidates : all;
  return [...pool].sort((a, b) => score(b) - score(a))[0];
  function score(c: Caption) {
    return (
      (c.topic === params.topic ? 10 : 0) -
      Math.abs(c.intensity - params.intensity) +
      Math.random() * 2
    );
  }
}
