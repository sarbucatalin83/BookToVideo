/**
 * Run once to generate binary fixtures:
 *   npx tsx tests/fixtures/create.ts
 *
 * Produces:
 *   tests/fixtures/sample.epub   — valid EPUB 2.0, title "Python Fundamentals", author "Jane Smith"
 *   tests/fixtures/sample.pdf    — valid PDF 1.4 with matching metadata + code content
 *   tests/fixtures/corrupted.epub — .epub extension, invalid content (triggers server 500)
 */

import fs from 'fs'
import path from 'path'
import { promisify } from 'util'
import zlib from 'zlib'

const deflateRaw = promisify(zlib.deflateRaw)

const OUT = path.join(import.meta.dirname, '')

// ─── ZIP / EPUB ────────────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const t: number[] = []
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[i] = c
  }
  return t
})()

function crc32(buf: Buffer): number {
  let crc = 0xffffffff
  for (const b of buf) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ b) & 0xff]
  return (crc ^ 0xffffffff) >>> 0
}

function u16(n: number) {
  const b = Buffer.alloc(2); b.writeUInt16LE(n); return b
}
function u32(n: number) {
  const b = Buffer.alloc(4); b.writeUInt32LE(n); return b
}

async function buildZip(files: Array<{ name: string; text: string; store?: boolean }>): Promise<Buffer> {
  const locals: Buffer[] = []
  const central: Buffer[] = []
  const meta: Array<{ name: Buffer; crc: number; csize: number; usize: number; offset: number; method: number }> = []
  let offset = 0

  for (const f of files) {
    const data = Buffer.from(f.text, 'utf8')
    const method = f.store ? 0 : 8
    const compressed = f.store ? data : (await deflateRaw(data) as Buffer)
    const crc = crc32(data)
    const nameBytes = Buffer.from(f.name, 'utf8')

    const local = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      u16(20), u16(0), u16(method), u16(0), u16(0),
      u32(crc), u32(compressed.length), u32(data.length),
      u16(nameBytes.length), u16(0),
      nameBytes, compressed,
    ])

    meta.push({ name: nameBytes, crc, csize: compressed.length, usize: data.length, offset, method })
    locals.push(local)
    offset += local.length
  }

  const cdStart = offset
  for (const m of meta) {
    central.push(Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x01, 0x02]),
      u16(20), u16(20), u16(0), u16(m.method), u16(0), u16(0),
      u32(m.crc), u32(m.csize), u32(m.usize),
      u16(m.name.length), u16(0), u16(0), u16(0), u16(0),
      u32(0), u32(m.offset),
      m.name,
    ]))
  }

  const cdData = Buffer.concat(central)
  const eocd = Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x05, 0x06]),
    u16(0), u16(0), u16(meta.length), u16(meta.length),
    u32(cdData.length), u32(cdStart), u16(0),
  ])

  return Buffer.concat([...locals, cdData, eocd])
}

// ─── EPUB content ─────────────────────────────────────────────────────────────

const CONTAINER = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`

const OPF = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="BookId">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
    <dc:title>Python Fundamentals</dc:title>
    <dc:creator opf:role="aut">Jane Smith</dc:creator>
    <dc:identifier id="BookId">urn:uuid:test-python-fundamentals-001</dc:identifier>
    <dc:language>en</dc:language>
  </metadata>
  <manifest>
    <item id="ncx"  href="toc.ncx"  media-type="application/x-dtbncx+xml"/>
    <item id="ch1"  href="ch1.html" media-type="application/xhtml+xml"/>
    <item id="ch2"  href="ch2.html" media-type="application/xhtml+xml"/>
    <item id="ch3"  href="ch3.html" media-type="application/xhtml+xml"/>
  </manifest>
  <spine toc="ncx">
    <itemref idref="ch1"/>
    <itemref idref="ch2"/>
    <itemref idref="ch3"/>
  </spine>
</package>`

const NCX = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE ncx PUBLIC "-//NISO//DTD ncx 2005-1//EN" "http://www.daisy.org/z3986/2005/ncx-2005-1.dtd">
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head><meta name="dtb:uid" content="urn:uuid:test-python-fundamentals-001"/></head>
  <docTitle><text>Python Fundamentals</text></docTitle>
  <navMap>
    <navPoint id="ch1" playOrder="1">
      <navLabel><text>Introduction to Python</text></navLabel>
      <content src="ch1.html"/>
    </navPoint>
    <navPoint id="ch2" playOrder="2">
      <navLabel><text>Variables and Data Types</text></navLabel>
      <content src="ch2.html"/>
    </navPoint>
    <navPoint id="ch3" playOrder="3">
      <navLabel><text>Functions and Modules</text></navLabel>
      <content src="ch3.html"/>
    </navPoint>
  </navMap>
</ncx>`

const CH1 = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Introduction to Python</title></head>
<body>
<h1>Introduction to Python</h1>
<p>Python is a high-level, interpreted programming language prized for its clarity and expressiveness.
It is widely used in data science, web development, automation, and scientific computing.</p>
<pre><code class="language-python">def greet(name):
    print(f"Hello, {name}!")

greet("World")
</code></pre>
<p>Python uses indentation to delimit blocks rather than braces, enforcing readable code by design.</p>
</body>
</html>`

const CH2 = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Variables and Data Types</title></head>
<body>
<h1>Variables and Data Types</h1>
<p>Python is dynamically typed, meaning variable types are inferred at runtime. The language provides
rich built-in types: integers, floats, strings, lists, tuples, sets, and dictionaries.</p>
<pre><code class="language-python">x = 42
name = "Alice"
items = [1, 2, 3]
mapping = {"key": "value"}
print(type(x))
</code></pre>
</body>
</html>`

const CH3 = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Functions and Modules</title></head>
<body>
<h1>Functions and Modules</h1>
<p>Functions are first-class objects in Python. The standard library ships hundreds of modules
that cover everything from math to networking.</p>
<pre><code class="language-python">import math

def calculate_area(radius):
    return math.pi * radius ** 2

result = calculate_area(5)
print(f"Area: {result:.2f}")
</code></pre>
</body>
</html>`

async function writeEpub() {
  const buf = await buildZip([
    { name: 'mimetype',              text: 'application/epub+zip', store: true },
    { name: 'META-INF/container.xml', text: CONTAINER },
    { name: 'OEBPS/content.opf',     text: OPF },
    { name: 'OEBPS/toc.ncx',         text: NCX },
    { name: 'OEBPS/ch1.html',        text: CH1 },
    { name: 'OEBPS/ch2.html',        text: CH2 },
    { name: 'OEBPS/ch3.html',        text: CH3 },
  ])
  fs.writeFileSync(path.join(OUT, 'sample.epub'), buf)
  console.log('✓ sample.epub')
}

// ─── PDF ──────────────────────────────────────────────────────────────────────

function buildPdf(title: string, author: string, bodyText: string): Buffer {
  // bodyText lines become separate Tj operators; we escape (, ), \
  const escape = (s: string) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')

  const lines = bodyText.split('\n')
  let stream = 'BT\n/F1 11 Tf\n72 720 Td\n12 TL\n'
  for (const line of lines) {
    stream += `(${escape(line)}) Tj T*\n`
  }
  stream += 'ET'

  const streamBytes = Buffer.from(stream, 'latin1')

  const parts: Buffer[] = []
  const offsets: number[] = [0, 0, 0, 0, 0, 0, 0]
  let pos = 0

  function emit(s: string) {
    const b = Buffer.from(s, 'latin1')
    parts.push(b)
    pos += b.length
  }

  emit('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n')

  offsets[1] = pos
  emit(`1 0 obj\n<</Type /Catalog /Pages 2 0 R>>\nendobj\n`)

  offsets[2] = pos
  emit(`2 0 obj\n<</Type /Pages /Kids [3 0 R] /Count 1>>\nendobj\n`)

  offsets[3] = pos
  emit(`3 0 obj\n<</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]\n  /Contents 4 0 R /Resources <</Font <</F1 5 0 R>>>>>>\nendobj\n`)

  offsets[4] = pos
  emit(`4 0 obj\n<</Length ${streamBytes.length}>>\nstream\n`)
  parts.push(streamBytes); pos += streamBytes.length
  emit(`\nendstream\nendobj\n`)

  offsets[5] = pos
  emit(`5 0 obj\n<</Type /Font /Subtype /Type1 /BaseFont /Helvetica>>\nendobj\n`)

  offsets[6] = pos
  emit(`6 0 obj\n<</Title (${escape(title)}) /Author (${escape(author)})>>\nendobj\n`)

  const xrefPos = pos
  let xref = `xref\n0 7\n0000000000 65535 f \n`
  for (let i = 1; i <= 6; i++) xref += offsets[i].toString().padStart(10, '0') + ' 00000 n \n'
  emit(xref)
  emit(`trailer\n<</Size 7 /Root 1 0 R /Info 6 0 R>>\nstartxref\n${xrefPos}\n%%EOF\n`)

  return Buffer.concat(parts)
}

function writePdf() {
  const body = [
    'Python Fundamentals',
    'by Jane Smith',
    '',
    'Chapter 1',
    '',
    'Python is a high-level interpreted programming language with dynamic typing.',
    'It is widely used for scripting, data analysis, and backend web services.',
    '',
    '    def greet(name):',
    '        print(name)',
    '    return name',
    '',
    'Chapter 2',
    '',
    'Variables and data types in Python do not require explicit type declarations.',
    '',
    '    x = 42',
    '    name = "Alice"',
    '    items = [1, 2, 3]',
    '    print(type(x))',
    '',
    'Chapter 3',
    '',
    'Functions are first-class objects in Python, enabling functional patterns.',
    '',
    '    import math',
    '    def calculate_area(radius):',
    '        return math.pi * radius ** 2',
    '    result = calculate_area(5)',
    '    print(result)',
  ].join('\n')

  const buf = buildPdf('Python Fundamentals', 'Jane Smith', body)
  fs.writeFileSync(path.join(OUT, 'sample.pdf'), buf)
  console.log('✓ sample.pdf')
}

function writeCorrupted() {
  fs.writeFileSync(path.join(OUT, 'corrupted.epub'), Buffer.from('this is not a valid epub file at all'))
  console.log('✓ corrupted.epub')
}

async function main() {
  await writeEpub()
  writePdf()
  writeCorrupted()
}

main().catch((e) => { console.error(e); process.exit(1) })
