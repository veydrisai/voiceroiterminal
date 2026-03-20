/**
 * User store — backed by Neon PostgreSQL (app_users table).
 * Replaces the previous file-based data/users.json approach so users
 * survive redeploys and work correctly across serverless instances.
 *
 * All functions are async. The login route and admin routes must await them.
 */
import { hashPassword } from './auth'
import { getSql } from './db'
import { MODULE_IDS, DEFAULT_CLIENT_MODULES, type ModuleId } from './moduleConfig'

export type User = {
  id: string
  email: string
  passwordHash: string
  role: 'admin' | 'client'
  onboardingComplete: boolean
  allowedModules?: ModuleId[]
  createdAt: string
}

export { MODULE_IDS, DEFAULT_CLIENT_MODULES }
export type { ModuleId }

type DbRow = {
  id: string
  email: string
  password_hash: string
  role: string
  onboarding_complete: boolean
  allowed_modules: string[] | null
  created_at: Date | string
}

function generateId(): string {
  return `u_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`
}

function rowToUser(row: DbRow): User {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role as 'admin' | 'client',
    onboardingComplete: row.onboarding_complete,
    allowedModules: (row.allowed_modules ?? [...DEFAULT_CLIENT_MODULES]) as ModuleId[],
    createdAt: typeof row.created_at === 'string' ? row.created_at : (row.created_at as Date).toISOString(),
  }
}

export async function getUserById(id: string): Promise<User | undefined> {
  const sql = getSql()
  const rows = await sql`SELECT * FROM app_users WHERE id = ${id} LIMIT 1`
  const row = (rows as DbRow[])[0]
  return row ? rowToUser(row) : undefined
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const sql = getSql()
  const rows = await sql`SELECT * FROM app_users WHERE email = ${email.toLowerCase()} LIMIT 1`
  const row = (rows as DbRow[])[0]
  return row ? rowToUser(row) : undefined
}

export async function createUser(params: {
  email: string
  password: string
  role: 'client'
  allowedModules?: ModuleId[]
}): Promise<User> {
  const existing = await getUserByEmail(params.email)
  if (existing) throw new Error('User with this email already exists')

  const sql = getSql()
  const id = generateId()
  const passwordHash = hashPassword(params.password)
  const modules = params.allowedModules ?? [...DEFAULT_CLIENT_MODULES]

  const rows = await sql`
    INSERT INTO app_users (id, email, password_hash, role, onboarding_complete, allowed_modules)
    VALUES (${id}, ${params.email.toLowerCase()}, ${passwordHash}, 'client', false, ${modules})
    RETURNING *`
  return rowToUser((rows as DbRow[])[0])
}

/** Ensures the admin account exists in the DB. Call once at startup or per-request. */
export async function ensureAdminExists(): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL ?? (
    process.env.NODE_ENV === 'production' ? null : 'michael@revenuecs.com'
  )
  const adminPassword = process.env.ADMIN_PASSWORD ?? (
    process.env.NODE_ENV === 'production' ? null : 'admin'
  )
  if (!adminEmail || !adminPassword) return

  const sql = getSql()
  const existing = await sql`SELECT id FROM app_users WHERE id = 'admin' LIMIT 1`
  if ((existing as { id: string }[]).length > 0) return

  const passwordHash = hashPassword(adminPassword)
  await sql`
    INSERT INTO app_users (id, email, password_hash, role, onboarding_complete, allowed_modules)
    VALUES ('admin', ${adminEmail.toLowerCase()}, ${passwordHash}, 'admin', true, ${[...MODULE_IDS]})
    ON CONFLICT (id) DO NOTHING`
}

export async function listClients(): Promise<User[]> {
  const sql = getSql()
  const rows = await sql`SELECT * FROM app_users WHERE role = 'client' ORDER BY created_at DESC`
  return (rows as DbRow[]).map(rowToUser)
}

export function getAllowedModules(user: User): ModuleId[] {
  if (user.role === 'admin') return [...MODULE_IDS]
  if (user.allowedModules && user.allowedModules.length > 0) return user.allowedModules
  return [...DEFAULT_CLIENT_MODULES]
}

export async function setOnboardingComplete(userId: string): Promise<void> {
  const sql = getSql()
  await sql`UPDATE app_users SET onboarding_complete = true WHERE id = ${userId}`
}

export async function updateUserModules(userId: string, modules: ModuleId[]): Promise<User | null> {
  const sql = getSql()
  const rows = await sql`
    UPDATE app_users SET allowed_modules = ${modules} WHERE id = ${userId} RETURNING *`
  const row = (rows as DbRow[])[0]
  return row ? rowToUser(row) : null
}
