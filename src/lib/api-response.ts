import { NextResponse } from "next/server";
import type { ZodIssue } from "zod";

export function apiError(error: string, code: string, status = 400, details?: ZodIssue[]) {
  return NextResponse.json({ error, code, details }, { status });
}

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}
