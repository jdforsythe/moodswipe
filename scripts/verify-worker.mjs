import assert from "node:assert/strict";
const base = process.argv[2] || "http://127.0.0.1:8787";
const payload = {
  params: {
    mood: "sarcastic",
    topic: "Everyday",
    intensity: 3,
    aesthetic: "Nature",
    random: false,
  },
};
const headers = {
  Origin: base,
  "Content-Type": "application/json",
  "CF-Connecting-IP": "198.51.100.98",
};
const health = await fetch(`${base}/api/health`).then((r) => r.json());
assert.equal(health.ok, true);
assert.equal(health.ai, "disabled");
assert.equal(
  (
    await fetch(`${base}/api/generate`, {
      method: "POST",
      headers: { ...headers, Origin: "https://untrusted.example" },
      body: JSON.stringify(payload),
    })
  ).status,
  403,
);
assert.equal(
  (
    await fetch(`${base}/api/generate`, {
      method: "POST",
      headers,
      body: "x".repeat(3000),
    })
  ).status,
  400,
);
const statuses = [];
for (let i = 0; i < 7; i++) {
  const response = await fetch(`${base}/api/generate`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  statuses.push(response.status);
  if (response.ok) assert.deepEqual((await response.json()).captions, []);
}
assert.deepEqual(statuses, [200, 200, 200, 200, 200, 200, 429]);
const shell = await fetch(base);
assert.equal(shell.status, 200);
assert.match(
  shell.headers.get("Content-Security-Policy"),
  /frame-ancestors 'none'/,
);
console.log(
  "Local Worker runtime: health, origin rejection, bounded input, real Durable Object rate limiting, no-key fallback and static security headers passed.",
);
