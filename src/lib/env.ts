export function requiredEnv(name: string): string {
  const v = (process.env as Record<string, string | undefined>)[name]?.trim()
  if (!v) throw new Error(`${name} environment variable is not set`)
  return v
}

export function optionalEnv(name: string): string | null {
  const v = (process.env as Record<string, string | undefined>)[name]?.trim()
  return v ? v : null
}

