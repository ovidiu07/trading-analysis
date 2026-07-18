import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import process from 'node:process'

const root = new URL('..', import.meta.url).pathname
const strict = process.argv.includes('--strict')
const resources = {
  en: JSON.parse(readFileSync(join(root, 'src/i18n/en.json'), 'utf8')),
  ro: JSON.parse(readFileSync(join(root, 'src/i18n/ro.json'), 'utf8'))
}

const flatten = (value, prefix = '', output = {}) => {
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (child && typeof child === 'object' && !Array.isArray(child)) flatten(child, path, output)
    else output[path] = child
  }
  return output
}

const en = flatten(resources.en)
const ro = flatten(resources.ro)
const missingRo = Object.keys(en).filter((key) => !(key in ro))
const missingEn = Object.keys(ro).filter((key) => !(key in en))

const walk = (directory, output = []) => {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name)
    if (statSync(path).isDirectory()) walk(path, output)
    else if (/\.(tsx|jsx)$/.test(name) && !name.includes('.test.')) output.push(path)
  }
  return output
}

const candidates = []
const literalPatterns = [
  { name: 'JSX text', expression: />\s*([A-Z][A-Za-z][^<{\n]*)</g },
  { name: 'user-facing attribute', expression: /\b(?:aria-label|placeholder|title|label|helperText)="([A-Za-z][^"]+)"/g }
]
const allow = [
  /^(EN|RO|TradeJAudit|OANDA|CSV|USD|EUR|GBP|Promise)$/,
  /^x+$/,
  /^[A-Z][A-Z0-9_/@.+ -]*$/
]

for (const path of walk(join(root, 'src'))) {
  const source = readFileSync(path, 'utf8')
  const lines = source.split('\n')
  for (const { name, expression } of literalPatterns) {
    expression.lastIndex = 0
    for (const match of source.matchAll(expression)) {
      const value = match[1].trim()
      if (!value || allow.some((pattern) => pattern.test(value))) continue
      const line = source.slice(0, match.index).split('\n').length
      candidates.push({ file: relative(root, path), line, kind: name, value, sourceLine: lines[line - 1].trim() })
    }
  }
}

console.log(`English keys: ${Object.keys(en).length}`)
console.log(`Romanian keys: ${Object.keys(ro).length}`)
console.log(`Missing in Romanian: ${missingRo.length}`)
console.log(`Missing in English: ${missingEn.length}`)
console.log(`Hardcoded UI candidates: ${candidates.length}`)

for (const item of candidates.slice(0, 120)) {
  console.log(`${item.file}:${item.line} [${item.kind}] ${item.value}`)
}
if (candidates.length > 120) console.log(`…and ${candidates.length - 120} more candidates`)

if (strict && (missingRo.length || missingEn.length || candidates.length)) process.exitCode = 1
