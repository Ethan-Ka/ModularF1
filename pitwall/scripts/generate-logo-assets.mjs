#!/usr/bin/env node

import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, '..')
const BRANDING_DIR = path.join(ROOT_DIR, 'public', 'branding')
const SOURCE_HTML_PATH = path.join(BRANDING_DIR, 'logo-source.html')
const RENDER_HTML_PATH = path.join(os.tmpdir(), 'pitwall-logo-source.render.html')
const FONT_DIR = path.join(BRANDING_DIR, 'fonts')
const FONT_PATH = path.join(FONT_DIR, 'BarlowCondensed-ExtraBold.ttf')

const WORDMARK_PNG = path.join(BRANDING_DIR, 'pitwall-wordmark.png')
const MONOGRAM_PNG = path.join(BRANDING_DIR, 'pitwall-monogram-256.png')
const MONOGRAM_ICO = path.join(BRANDING_DIR, 'pitwall-monogram.ico')
const WORDMARK_SVG = path.join(BRANDING_DIR, 'pitwall-wordmark.svg')
const MONOGRAM_SVG = path.join(BRANDING_DIR, 'pitwall-monogram.svg')

const WORDMARK_WIDTH = 500
const WORDMARK_HEIGHT = 150
const MONOGRAM_SIZE = 256

const FONT_DOWNLOAD_URL = 'https://github.com/google/fonts/raw/main/ofl/barlowcondensed/BarlowCondensed-ExtraBold.ttf'

function toFileUrl(p) {
  return `file:///${p.replace(/\\/g, '/').replace(/ /g, '%20')}`
}

function ensureOk(result, context) {
  if (result.status === 0) return
  const stderr = result.stderr ? String(result.stderr) : ''
  const stdout = result.stdout ? String(result.stdout) : ''
  throw new Error(`${context} failed.\n${stderr || stdout}`)
}

function findEdgeExecutable() {
  const candidates = [
    process.env.PITWALL_EDGE_PATH,
    process.env['PROGRAMFILES(X86)'] ? path.join(process.env['PROGRAMFILES(X86)'], 'Microsoft', 'Edge', 'Application', 'msedge.exe') : null,
    process.env.PROGRAMFILES ? path.join(process.env.PROGRAMFILES, 'Microsoft', 'Edge', 'Application', 'msedge.exe') : null,
  ].filter(Boolean)

  for (const candidate of candidates) {
    try {
      const result = spawnSync('powershell', ['-NoProfile', '-Command', `if (Test-Path '${candidate.replace(/'/g, "''")}') { exit 0 } else { exit 1 }`], { encoding: 'utf8' })
      if (result.status === 0) return candidate
    } catch {
      // try next candidate
    }
  }

  const whereResult = spawnSync('powershell', ['-NoProfile', '-Command', '(Get-Command msedge -ErrorAction SilentlyContinue).Source'], { encoding: 'utf8' })
  if (whereResult.status === 0 && whereResult.stdout && whereResult.stdout.trim().length > 0) {
    return whereResult.stdout.trim().split(/\r?\n/)[0]
  }

  throw new Error('Could not find Microsoft Edge executable. Set PITWALL_EDGE_PATH to msedge.exe and retry.')
}

async function ensureFontFile() {
  await mkdir(FONT_DIR, { recursive: true })
  try {
    await access(FONT_PATH)
    return
  } catch {
    // download below
  }

  const res = await fetch(FONT_DOWNLOAD_URL)
  if (!res.ok) {
    throw new Error(`Failed to download font: ${FONT_DOWNLOAD_URL} (${res.status})`)
  }

  const bytes = new Uint8Array(await res.arrayBuffer())
  await writeFile(FONT_PATH, bytes)
}

function renderWithEdge(edgePath, url, outputPngPath, width, height) {
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--virtual-time-budget=4000',
    '--default-background-color=00000000',
    `--window-size=${width},${height}`,
    `--screenshot=${outputPngPath}`,
    url,
  ]

  const result = spawnSync(edgePath, args, { encoding: 'utf8' })
  ensureOk(result, `Screenshot render (${path.basename(outputPngPath)})`)
}

function injectEmbeddedFont(sourceHtml, fontDataUri) {
  const marker = "src: url('./fonts/BarlowCondensed-ExtraBold.ttf') format('truetype');"
  if (!sourceHtml.includes(marker)) {
    return sourceHtml
  }

  return sourceHtml.replace(marker, `${marker}\n        src: url('${fontDataUri}') format('truetype');`)
}

async function writeSvgAssets() {
  const svgFontFace = "src: url('./fonts/BarlowCondensed-ExtraBold.ttf') format('truetype');"

  const wordmarkSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WORDMARK_WIDTH} ${WORDMARK_HEIGHT}" role="img" aria-label="PITWALL wordmark">\n  <title>PITWALL</title>\n  <style>\n    @font-face {\n      font-family: 'Barlow Condensed Local';\n      ${svgFontFace}\n      font-style: normal;\n      font-weight: 800;\n      font-display: block;\n    }\n    .w { font-family: 'Barlow Condensed Local', 'Barlow Condensed', 'Arial Narrow', sans-serif; font-weight: 800; letter-spacing: -0.02em; text-anchor: middle; }\n  </style>\n  <rect width="100%" height="100%" fill="none"/>\n  <text class="w" x="250" y="75" dy="0.35em" font-size="118" fill="#F2F0EB">PIT<tspan fill="#E8132B">W</tspan>ALL</text>\n</svg>\n`

  const monogramSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" role="img" aria-label="PITWALL monogram">\n  <title>PITWALL monogram</title>\n  <style>\n    @font-face {\n      font-family: 'Barlow Condensed Local';\n      ${svgFontFace}\n      font-style: normal;\n      font-weight: 800;\n      font-display: block;\n    }\n    .m { font-family: 'Barlow Condensed Local', 'Barlow Condensed', 'Arial Narrow', sans-serif; font-weight: 800; letter-spacing: -0.02em; text-anchor: middle; }\n  </style>\n  <rect width="256" height="256" fill="#0B0B0C"/>\n  <text class="m" x="128" y="202" font-size="212" fill="#F2F0EB">P<tspan fill="#E8132B">W</tspan></text>\n</svg>\n`

  await writeFile(WORDMARK_SVG, wordmarkSvg, 'utf8')
  await writeFile(MONOGRAM_SVG, monogramSvg, 'utf8')

  return { wordmarkSvg, monogramSvg }
}

async function renderPngFromSvg(svg, pngPath, width) {
  const resvg = new Resvg(svg, {
    fitTo: {
      mode: 'width',
      value: width,
    },
    font: {
      fontFiles: [FONT_PATH],
      loadSystemFonts: true,
    },
  })

  const png = resvg.render().asPng()
  await writeFile(pngPath, png)
}

async function writeWordmarkSvgFromPng() {
  const png = await readFile(WORDMARK_PNG)
  const dataUri = `data:image/png;base64,${png.toString('base64')}`

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WORDMARK_WIDTH} ${WORDMARK_HEIGHT}" role="img" aria-label="PITWALL wordmark">\n  <title>PITWALL</title>\n  <image href="${dataUri}" width="${WORDMARK_WIDTH}" height="${WORDMARK_HEIGHT}" preserveAspectRatio="xMidYMid meet"/>\n</svg>\n`

  await writeFile(WORDMARK_SVG, svg, 'utf8')
}

async function writeIcoFromPng(pngPath, icoPath) {
  const png = await readFile(pngPath)

  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(1, 4)

  const dirEntry = Buffer.alloc(16)
  dirEntry.writeUInt8(0, 0) // 256 px
  dirEntry.writeUInt8(0, 1) // 256 px
  dirEntry.writeUInt8(0, 2)
  dirEntry.writeUInt8(0, 3)
  dirEntry.writeUInt16LE(1, 4)
  dirEntry.writeUInt16LE(32, 6)
  dirEntry.writeUInt32LE(png.length, 8)
  dirEntry.writeUInt32LE(22, 12)

  await writeFile(icoPath, Buffer.concat([header, dirEntry, png]))
}

async function main() {
  await mkdir(BRANDING_DIR, { recursive: true })
  await ensureFontFile()

  const fontBytes = await readFile(FONT_PATH)
  const fontDataUri = `data:font/ttf;base64,${fontBytes.toString('base64')}`
  const sourceHtml = await readFile(SOURCE_HTML_PATH, 'utf8')
  await writeFile(RENDER_HTML_PATH, injectEmbeddedFont(sourceHtml, fontDataUri), 'utf8')

  const { wordmarkSvg, monogramSvg } = await writeSvgAssets()

  await renderPngFromSvg(wordmarkSvg, WORDMARK_PNG, WORDMARK_WIDTH)
  await renderPngFromSvg(monogramSvg, MONOGRAM_PNG, MONOGRAM_SIZE)
  await writeWordmarkSvgFromPng()

  await writeIcoFromPng(MONOGRAM_PNG, MONOGRAM_ICO)

  console.log('Generated assets from HTML source:')
  console.log('- public/branding/pitwall-wordmark.png')
  console.log('- public/branding/pitwall-wordmark.svg')
  console.log('- public/branding/pitwall-monogram-256.png')
  console.log('- public/branding/pitwall-monogram.svg')
  console.log('- public/branding/pitwall-monogram.ico')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
