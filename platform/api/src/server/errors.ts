// ApiError: the one error type routes throw. The error handler (app.ts) turns it into ApiErrorBody.
import { ERRORS, type ApiErrorBody, type ErrorCode } from "../../../shared/src/errors.ts";

export { ERRORS, type ErrorCode, type ApiErrorBody };

export class ApiError extends Error {
  code: ErrorCode;
  status: number;
  details?: Record<string, unknown>;
  constructor(code: ErrorCode, message?: string, details?: Record<string, unknown>) {
    super(message ?? ERRORS[code].description);
    this.name = "ApiError";
    this.code = code;
    this.status = ERRORS[code].status;
    this.details = details;
  }
  toBody(): ApiErrorBody {
    return {
      error: { code: this.code, message: this.message, retryable: ERRORS[this.code].retryable, ...(this.details ? { details: this.details } : {}) },
    };
  }
}
