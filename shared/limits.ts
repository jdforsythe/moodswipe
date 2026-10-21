// Inference runs behind the immediately usable local feed. Twelve structured
// captions took 31 seconds in the live provider check; retries share this budget.
export const GENERATION_TIMEOUT_MS = 45000;
export const CLIENT_GENERATION_TIMEOUT_MS = GENERATION_TIMEOUT_MS + 5000;
export const DEFAULT_DAILY_AI_CALLS = 500;
export const MAX_DAILY_AI_CALLS = 10000;
export const GENERATION_INTERVAL_MS = 15000;
