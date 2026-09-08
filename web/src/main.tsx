import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "./api/questionnaires";
import App from "./App";

/**
 * The retry policy exists for one deployment fact: the API runs on Render's
 * free tier, which stops the service when idle. The first request after that
 * either hangs while the container boots or is answered with a 5xx by the host
 * — and the boot can take roughly 50 seconds.
 *
 * React Query's defaults (3 tries, exponential backoff) give up after about
 * seven seconds, which would surface "Could not load" while the service is
 * still starting perfectly normally. Retrying on a fixed 3s beat for ~75s
 * covers the cold start with room to spare.
 *
 * 4xx is excluded deliberately: a 404 means the definition is not published,
 * which is a real answer. Retrying it would only delay an honest error.
 */
const client = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) =>
        failureCount < 25 && !(error instanceof ApiError && error.status < 500),
      retryDelay: 3000,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
