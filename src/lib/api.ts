import { NextResponse } from "next/server";
import { DatabaseNotConfiguredError } from "@/db";
import { UnauthorizedError } from "./auth";

export function ok<T>(data: T, init?: number) {
  return NextResponse.json(data, { status: init ?? 200 });
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Wraps a route handler so auth/config failures become clean JSON responses. */
export async function handle<T>(fn: () => Promise<T>) {
  try {
    const result = await fn();
    // File downloads return a plain Response; only wrap real payloads.
    // NextResponse extends Response, so this covers both.
    return result instanceof Response ? result : ok(result);
  } catch (error) {
    if (error instanceof UnauthorizedError) return fail("Not signed in", 401);
    if (error instanceof DatabaseNotConfiguredError) {
      return fail(error.message, 503);
    }
    const message =
      error instanceof Error ? error.message : "Something went wrong";
    console.error("[api]", error);
    return fail(message, 500);
  }
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new Error("Invalid JSON body");
  }
}
