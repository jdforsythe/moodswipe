export interface Env {
  ASSETS: Fetcher;
  POOL: DurableObjectNamespace;
  AI?: {
    run: (model: string, input: Record<string, unknown>) => Promise<unknown>;
  };
  AI_ENABLED?: string;
  AI_MODEL?: string;
  DAILY_AI_CALLS?: string;
  ALLOWED_ORIGINS?: string;
  PEXELS_API_KEY?: string;
  PHOTOS_ENABLED?: string;
  DAILY_PHOTO_CALLS?: string;
}
