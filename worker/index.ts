import type { Env } from "./env";
import { allowedOrigin, boundedJson } from "./security";
import { validParams } from "../shared/types";
import { getPhotos, validPhotoRequest } from "./photos";
export { CandidatePool } from "./pool";
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    const headers = new Headers({
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
      "X-Content-Type-Options": "nosniff",
      Vary: "Origin",
    });
    const json = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), { status, headers });
    if (url.pathname === "/api/health" && request.method === "GET")
      return json({
        ok: true,
        ai: env.AI_ENABLED === "true" && !!env.AI ? "configured" : "disabled",
        photos:
          env.PHOTOS_ENABLED === "true" && !!env.PEXELS_API_KEY
            ? "configured"
            : "disabled",
        fallback: "bundled",
        version: 1,
      });
    if (!allowedOrigin(request, env.ALLOWED_ORIGINS))
      return json({ error: "origin_not_allowed" }, 403);
    headers.set("Access-Control-Allow-Origin", request.headers.get("Origin")!);
    if (request.method === "OPTIONS") {
      headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      headers.set("Access-Control-Allow-Headers", "Content-Type");
      return new Response(null, { status: 204, headers });
    }
    if (request.method !== "POST")
      return json({ error: "method_not_allowed" }, 405);
    if (!request.headers.get("Content-Type")?.startsWith("application/json"))
      return json({ error: "json_required" }, 415);
    if (!["/api/generate", "/api/photos"].includes(url.pathname))
      return json({ error: "not_found" }, 404);
    let body: unknown;
    try {
      body = await boundedJson(request);
    } catch {
      return json({ error: "invalid_body" }, 400);
    }
    if (url.pathname === "/api/photos") {
      if (!validPhotoRequest(body))
        return json({ error: "invalid_photo_parameters" }, 400);
      try {
        return json(await getPhotos(body, env, request));
      } catch {
        return json({ photos: [] });
      }
    }
    if (
      !body ||
      typeof body !== "object" ||
      Object.keys(body).some((k) => k !== "params") ||
      !validParams((body as { params: unknown }).params)
    )
      return json({ error: "invalid_parameters" }, 400);
    try {
      const stub = env.POOL.get(env.POOL.idFromName("global-v1"));
      const response = await stub.fetch(
        new Request("https://pool/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Client-IP": request.headers.get("CF-Connecting-IP") || "unknown",
          },
          body: JSON.stringify(body),
        }),
      );
      if (response.headers.has("Retry-After"))
        headers.set("Retry-After", response.headers.get("Retry-After")!);
      return new Response(response.body, { status: response.status, headers });
    } catch {
      return json({ captions: [], mode: "local", retryAfter: 900 }, 503);
    }
  },
};
