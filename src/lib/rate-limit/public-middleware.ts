import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { clientKeyFromRequest, rateLimit } from "./memory";

/** Rate-limit public server functions (per IP). */
export const publicRateLimit = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const request = getRequest();
  const key = clientKeyFromRequest(request, "public-fn");
  const result = rateLimit({
    key,
    limit: Number(process.env["PUBLIC_API_RATE_LIMIT"] ?? 60),
    windowMs: Number(process.env["PUBLIC_API_RATE_WINDOW_MS"] ?? 60_000),
  });
  if (!result.allowed) {
    throw new Error(`Rate limit exceeded. Retry after ${result.retryAfterSec}s.`);
  }
  return next();
});
