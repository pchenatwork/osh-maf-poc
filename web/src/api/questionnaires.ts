import type { Questionnaire, QuestionnaireResponse } from "../item-controls/contract";

const FHIR_JSON = "application/fhir+json";

/**
 * Origin of the FHIR API.
 *
 * Empty in development, so every request stays same-origin and is forwarded by
 * the Vite proxy in vite.config.ts. In a deployed build the site and the API
 * live on different hosts (Azure Static Web Apps and Render), so this carries
 * the API's origin and the request becomes cross-origin — which is why the API
 * must name this site in Cors:AllowedOrigins.
 *
 * Read at BUILD time, not at run time: Vite inlines import.meta.env into the
 * bundle. Changing the API URL therefore means a rebuild, not a restart.
 */
const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");

/**
 * A failed API response, carrying the HTTP status.
 *
 * The status is what lets the retry policy in main.tsx tell a cold start (5xx
 * from the host while the service boots — worth waiting out) from a real
 * answer (404: that definition is not published — retrying cannot help).
 */
export class ApiError extends Error {
  // Declared and assigned separately rather than as a constructor parameter
  // property: tsconfig sets erasableSyntaxOnly, which bans the shorthand.
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function fetchQuestionnaire(
  url: string,
  version?: string,
): Promise<Questionnaire> {
  const qs = new URLSearchParams({ url });
  if (version) qs.set("version", version);

  const res = await fetch(`${API_BASE}/fhir/Questionnaire?${qs}`, {
    headers: { Accept: FHIR_JSON },
  });

  if (!res.ok) {
    // The API returns an OperationOutcome on error.
    const outcome = await res.json().catch(() => null);
    throw new ApiError(
      outcome?.issue?.[0]?.diagnostics ?? `Fetch failed: ${res.status}`,
      res.status,
    );
  }
  return res.json();
}

/** Used from Lab 5 onward. Returns [ok, body]. */
export async function submitResponse(
  response: QuestionnaireResponse,
): Promise<[boolean, unknown]> {
  const res = await fetch(`${API_BASE}/fhir/QuestionnaireResponse`, {
    method: "POST",
    headers: { "Content-Type": FHIR_JSON, Accept: FHIR_JSON },
    body: JSON.stringify(response),
  });
  return [res.ok, await res.json()];
}
