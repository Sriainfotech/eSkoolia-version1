/**
 * Matches config/exception_handler.py's response shape:
 *   { success: false, status?, error: { code, message, field? }, field_errors? }
 * so the bot's fallbacks read the real error code instead of inventing a
 * second error format.
 */
export interface BackendErrorShape {
  success: false;
  status?: number;
  error: { code: string; message: string; field?: string };
  field_errors?: Record<string, unknown>;
}

function isBackendErrorShape(x: unknown): x is BackendErrorShape {
  return !!x && typeof x === 'object' && (x as Record<string, unknown>).success === false
    && typeof (x as Record<string, unknown>).error === 'object';
}

const FRIENDLY_BY_CODE: Record<string, string> = {
  database_unavailable: "The database is temporarily unavailable — please try again in a few seconds.",
  database_schema_error: "Something's misconfigured on our end. Please contact your administrator.",
  not_found: "I couldn't find that record — it may have been deleted. Try searching again.",
  validation_error: "That request wasn't valid — check the details and try again.",
  already_exists: "A record like that already exists.",
  missing_required_field: "A required field is missing — please contact your administrator.",
  integrity_error: "That request conflicts with existing data.",
  internal_server_error: "Something went wrong on our end. Please try again shortly.",
};

/** Turn a failed fetch Response (or thrown error) into one natural-language
 *  sentence for the bot to show, instead of a silent failure or a generic
 *  "something went wrong". */
export async function describeBotFetchError(resOrError: Response | unknown, fallbackSubject = 'that'): Promise<string> {
  if (resOrError instanceof Response) {
    let body: unknown = null;
    try { body = await resOrError.json(); } catch { /* not JSON */ }
    if (isBackendErrorShape(body)) {
      return FRIENDLY_BY_CODE[body.error.code] ?? body.error.message;
    }
    if (resOrError.status >= 500) {
      return `I'm having trouble reaching ${fallbackSubject} right now. Please try again shortly.`;
    }
    if (resOrError.status === 401 || resOrError.status === 403) {
      return "You don't have permission to do that.";
    }
    return `I couldn't complete that (server said ${resOrError.status}). Please try again.`;
  }
  return `I'm having trouble reaching ${fallbackSubject} right now. Please try again in a moment.`;
}
