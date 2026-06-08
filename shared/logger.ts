function scope(name: string) {
  return {
    info: (...args: unknown[]) => console.log(`[${name}]`, ...args),
    warn: (...args: unknown[]) => console.warn(`[${name}]`, ...args),
    error: (...args: unknown[]) => console.error(`[${name}]`, ...args),
  }
}

export const logger = { scope }
