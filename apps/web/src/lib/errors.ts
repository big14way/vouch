import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { ZodError } from "zod";

/** Every error says what happened and what to do next (spec §8.5). */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly next?: string,
    public readonly retryable = false,
    public readonly extra?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }

  toResponse(): NextResponse {
    return NextResponse.json(
      { error: { code: this.code, message: this.message, next: this.next, retryable: this.retryable, ...this.extra } },
      { status: this.status },
    );
  }
}

export const errors = {
  unauthorized: (next = "Sign in, or send a valid API key in the Authorization header.") =>
    new ApiError(401, "unauthorized", "You are not signed in.", next),
  forbidden: (what = "do that") => new ApiError(403, "forbidden", `You are not allowed to ${what}.`, "Check you are using the right account for this job."),
  notFound: (what = "job") => new ApiError(404, "not_found", `That ${what} does not exist.`, "Check the link and try again."),
  badRequest: (message: string, next?: string) => new ApiError(400, "bad_request", message, next),
  conflict: (message: string, next?: string) => new ApiError(409, "conflict", message, next),
  rateLimited: () => new ApiError(429, "rate_limited", "Too many requests.", "Wait a minute and try again.", true),
  chain: (message: string) => new ApiError(502, "chain_error", message, "The network did not confirm the transaction. Retry in a few seconds.", true),
  internal: () => new ApiError(500, "internal", "Something went wrong on our side.", "Retry. If it keeps happening, report the problem from the job page.", true),
  wrongState: (state: string, allowed: string) =>
    new ApiError(409, "wrong_state", `This job is ${state}.`, `This action is only possible when the job is ${allowed}.`),
};

type Handler<T> = (req: Request, ctx: T) => Promise<Response>;

/** Wrap a route handler: zod → 400, ApiError → its status, anything else → 500 + Sentry. */
export function withErrors<T>(handler: Handler<T>): Handler<T> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status >= 500) Sentry.captureException(e);
        return e.toResponse();
      }
      if (e instanceof ZodError) {
        const first = e.issues[0];
        const path = first?.path.join(".") || "input";
        return new ApiError(400, "invalid_input", `${path}: ${first?.message ?? "invalid"}`, "Fix the highlighted field and resend.").toResponse();
      }
      console.error("[api] unhandled", e);
      Sentry.captureException(e);
      return errors.internal().toResponse();
    }
  };
}
