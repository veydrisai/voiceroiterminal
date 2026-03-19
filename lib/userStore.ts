import { hashPassword } from './auth'
import { MODULE_IDS, DEFAULT_CLIENT_MODULES, type ModuleId } from './moduleConfig'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

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

const users = new Map<string, User>()
const byEmail = new Map<string, string>()

function getDataPath(): string {
  return join(process.cwd(), 'data', 'users.json')
}

function loadFromFile(): void {
  try {
    const path = getDataPath()
    if (!existsSync(path)) return
    const raw = readFileSync(path, 'utf-8')
    const array = JSON.parse(raw) as User[]
    users.clear()
    byEmail.clear()
    for (const u of array) {
      users.set(u.id, u)
      byEmail.set(u.email.toLowerCase(), u.id)
    }
  } catch {
    // File missing or invalid – start fresh
  }
}

function saveToFile(): void {
  try {
    const path = getDataPath()
    const dir = join(process.cwd(), 'data')
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    const array = Array.from(users.values())
    writeFileSync(path, JSON.stringify(array, null, 2), 'utf-8')
  } catch {
    // Read-only env (e.g. Vercel) – skip persist
  }
}

function generateId(): string {
  return `u_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`
}

function seedAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL ?? (process.env.NODE_ENV === 'production' ? null : 'michael@revenuecs.com')
  const adminPassword = process.env.ADMIN_PASSWORD ?? (process.env.NODE_ENV === 'production' ? null : 'admin')
  if (!adminEmail || !adminPassword) return
  if (byEmail.has(adminEmail.toLowerCase())) return
  const admin: User = {
    id: 'admin',
    email: adminEmail.toLowerCase(),
    passwordHash: hashPassword(adminPassword),
    role: 'admin',
    onboardingComplete: true,
    allowedModules: [...MODULE_IDS],
    createdAt: new Date().toISOString(),
  }
  users.set(admin.id, admin)
  byEmail.set(admin.email.toLowerCase(), admin.id)
}

// Load persisted users, then ensure admin exists
loadFromFile()
seedAdmin()
saveToFile()

export function getUserById(id: string): User | undefined {
  return users.get(id)
}

export function getUserByEmail(email: string): User | undefined {
  const id = byEmail.get(email.toLowerCase())
  return id ? users.get(id) : undefined
}

export function createUser(params: {
  email: string
  password: string
  role: 'client'
  allowedModules?: ModuleId[]
}): User {
  const existing = getUserByEmail(params.email)
  if (existing) throw new Error('User with this email already exists')
  const id = generateId()
  const user: User = {
    id,
    email: params.email.toLowerCase(),
    passwordHash: hashPassword(params.password),
    role: 'client',
    onboardingComplete: false,
    allowedModules: params.allowedModules ?? [...DEFAULT_CLIENT_MODULES],
    createdAt: new Date().toISOString(),
  }
  users.set(id, user)
  byEmail.set(user.email, id)
  saveToFile()
  return user
}

export function listClients(): User[] {
  return Array.from(users.values()).filter((u) => u.role === 'client')
}

export function getAllowedModules(user: User): ModuleId[] {
  if (user.role === 'admin') return [...MODULE_IDS]
  if (user.allowedModules && user.allowedModules.length > 0) return user.allowedModules
  return [...DEFAULT_CLIENT_MODULES]
}

export function setOnboardingComplete(userId: string): void {
  const u = users.get(userId)
  if (u) {
    users.set(userId, { ...u, onboardingComplete: true })
    saveToFile()
  }
}

export function updateUserModules(userId: string, modules: ModuleId[]): User | null {
  const u = users.get(userId)
  if (!u) return null
  const updated = { ...u, allowedModules: modules }
  users.set(userId, updated)
  saveToFile()
  return updated
}
