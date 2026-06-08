export function extractIntroText(lines: string[]): string {
  const meaningful = lines
    .map((l) => l.trim())
    .filter((l) => l.length > 30)
    .join(' ')
  return meaningful.slice(0, 1500)
}
