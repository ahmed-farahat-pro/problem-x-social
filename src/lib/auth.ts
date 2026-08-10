import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { can, isRole, type Role } from "./permissions";
import type { SessionUser } from "./types";

const COOKIE = "px_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 16) {
    throw new Error(
      "AUTH_SECRET is missing or too short. Set a random 32+ character string.",
    );
  }
  return new TextEncoder().encode(value);
}

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

export async function createSession(user: SessionUser) {
  const token = await new SignJWT({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());

  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function getSession(): Promise<SessionUser | null> {
  try {
    const store = await cookies();
    const token = store.get(COOKIE)?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub) return null;
    const role = isRole(payload.role) ? payload.role : "content_creator";
    return {
      id: String(payload.sub),
      email: String(payload.email ?? ""),
      name: String(payload.name ?? ""),
      role,
    };
  } catch {
    return null;
  }
}

/** Throws a 401-shaped error for API routes. */
export class UnauthorizedError extends Error {
  constructor() {
    super("Not signed in");
    this.name = "UnauthorizedError";
  }
}

/** Thrown when the signed-in user lacks permission for an action. */
export class ForbiddenError extends Error {
  constructor() {
    super("You don't have permission to do that");
    this.name = "ForbiddenError";
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) throw new UnauthorizedError();
  return user;
}

/** Require a specific capability, returning the user if allowed. */
export async function requireCan(
  action: Parameters<typeof can>[1],
  resource: Parameters<typeof can>[2],
): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user.role, action, resource)) throw new ForbiddenError();
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") throw new ForbiddenError();
  return user;
}

export function roleOf(user: SessionUser): Role {
  return user.role;
}

export async function countUsers(): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.users);
  return row?.count ?? 0;
}

export async function findUserByEmail(email: string) {
  const rows = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email.toLowerCase().trim()))
    .limit(1);
  return rows[0] ?? null;
}
