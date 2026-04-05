#!/usr/bin/env node

import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const OPENF1_BASE = 'https://api.openf1.org/v1'
const FLAG_BASE = 'https://flagcdn.com'
const FORMULA1_BASE = 'https://www.formula1.com'
const NUMBER_FONT_URL = 'https://cdn.jsdelivr.net/npm/@fontsource/teko/files/teko-latin-600-normal.woff2'
const FORMULA1_HEADERS = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36',
  accept: 'text/html,application/xhtml+xml',
}

const NATIONALITY_TO_COUNTRY_CODE = {
  argentine: 'AR',
  australian: 'AU',
  brazilian: 'BR',
  british: 'GB',
  canadian: 'CA',
  dutch: 'NL',
  finnish: 'FI',
  french: 'FR',
  german: 'DE',
  italian: 'IT',
  monegasque: 'MC',
  mexican: 'MX',
  new_zealander: 'NZ',
  'new zealander': 'NZ',
  spanish: 'ES',
  thai: 'TH',
}

const DRIVER_SLUG_OVERRIDES = {
  andant01: ['kimi-antonelli'],
  carsai01: ['carlos-sainz'],
}

function getArgValue(name, fallback) {
  const inline = process.argv.find((arg) => arg.startsWith(`--${name}=`))
  if (inline) return inline.slice(name.length + 3)

  const idx = process.argv.indexOf(`--${name}`)
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1]

  return fallback
}

function normalizeHex(color, fallback = '#6B6B70') {
  if (!color || typeof color !== 'string') return fallback
  const cleaned = color.trim().replace(/^#/, '')
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) return fallback
  return `#${cleaned.toUpperCase()}`
}

function hexToRgb(hex) {
  const normalized = normalizeHex(hex).replace('#', '')
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ]
}

function darkenHex(hex, ratio = 0.25) {
  const [r, g, b] = hexToRgb(hex)
  const clamped = Math.max(0, Math.min(1, ratio))
  const next = [r, g, b].map((channel) => Math.round(channel * (1 - clamped)))
  return `#${next.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()}`
}

function relativeLuma(hex) {
  const [r, g, b] = hexToRgb(hex).map((n) => n / 255)
  const [R, G, B] = [r, g, b].map((channel) => (
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  ))
  return 0.2126 * R + 0.7152 * G + 0.0722 * B
}

function chooseNumberTextColor(teamHex) {
  return relativeLuma(teamHex) > 0.33 ? '#10151E' : '#F5F8FF'
}

function toCountryCode(countryCode, nationality) {
  if (countryCode && /^[a-z]{2}$/i.test(countryCode)) return countryCode.toUpperCase()
  if (!nationality) return undefined
  return NATIONALITY_TO_COUNTRY_CODE[nationality.toLowerCase()]
}

function slugifyName(input) {
  return String(input ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function titleCaseWords(input) {
  return String(input ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
}

function candidateDriverSlugs(driver) {
  const full = slugifyName(driver.name)
  const cleanedWords = titleCaseWords(driver.name)
    .filter((word) => !['Jr', 'Sr', 'Ii', 'Iii', 'Iv', 'V'].includes(word))
  const firstLast = cleanedWords.length >= 2
    ? slugifyName(`${cleanedWords[0]} ${cleanedWords[cleanedWords.length - 1]}`)
    : ''
  const middleLast = cleanedWords.length >= 3
    ? slugifyName(`${cleanedWords[cleanedWords.length - 2]} ${cleanedWords[cleanedWords.length - 1]}`)
    : ''
  const overrides = DRIVER_SLUG_OVERRIDES[String(driver.ref ?? '').toLowerCase()] ?? []

  return [...new Set([full, firstLast, middleLast, ...overrides].filter(Boolean))]
}

function normalizeExtractedUrl(url) {
  return String(url)
    .replace(/\\\//g, '/')
    .replace(/[)\\"'`,;]+$/g, '')
}

function extractNumberImageUrlsFromFormulaPage(html) {
  const escapedImageRegex = new RegExp(String.raw`\\"img\\":\\"(https:\\/\\/[^\"]+?\\.(webp|png|svg)[^\"]*)\\"`, 'g')
  const escapedMatches = Array.from(
    html.matchAll(escapedImageRegex)
  ).map((m) => normalizeExtractedUrl(m[1]))

  const plainMatches = Array.from(
    html.matchAll(/https:\/\/[^"\s<>]+?\.(webp|png|svg)[^"\s<>]*/g)
  ).map((m) => normalizeExtractedUrl(m[0]))

  return [...new Set([...escapedMatches, ...plainMatches])]
}

function isLikelyDriverNumberAsset(url) {
  const lowered = url.toLowerCase()
  if (!lowered.includes('formula1.com/image/upload')) return false
  if (!/(\.webp|\.png|\.svg)(\?|$)/.test(lowered)) return false

  const excludeTokens = [
    'f1_logo',
    'footer',
    'facebook',
    'instagram',
    'youtube',
    'app-store',
    'google-play',
    'nwp-navigation',
  ]
  if (excludeTokens.some((token) => lowered.includes(token))) return false

  return lowered.includes('number')
}

function selectBestNumberAssetUrl(urls, driver) {
  if (!urls.length) return null

  const ref = String(driver.ref ?? '').toLowerCase().trim()
  if (!ref) return null

  const refNeedle = `/${ref}/`
  const refMatched = urls.filter((url) => {
    const lowered = url.toLowerCase()
    return isLikelyDriverNumberAsset(lowered) && lowered.includes(refNeedle)
  })

  if (refMatched.length > 0) {
    const numberNeedle = `/${String(driver.number)}.`
    const exactNumber = refMatched.find((url) => url.includes(numberNeedle))
    if (exactNumber) return exactNumber
    return refMatched[0]
  }

  return null
}

function inferImageExtensionFromUrl(url) {
  const cleaned = String(url).split('?')[0].toLowerCase()
  if (cleaned.endsWith('.webp')) return 'webp'
  if (cleaned.endsWith('.png')) return 'png'
  if (cleaned.endsWith('.svg')) return 'svg'
  return 'webp'
}

async function discoverDriverNumberSvgUrl(driver) {
  for (const slug of candidateDriverSlugs(driver)) {
    const pageUrl = `${FORMULA1_BASE}/en/drivers/${slug}`
    try {
      const res = await fetch(pageUrl, { headers: FORMULA1_HEADERS })
      if (!res.ok) continue
      const html = await res.text()
      const assetUrls = extractNumberImageUrlsFromFormulaPage(html)
      const selected = selectBestNumberAssetUrl(assetUrls, driver)
      if (selected) return selected
    } catch {
      // Keep trying alternative slug candidates.
    }
  }

  return null
}

function headshotCandidates(headshotUrl) {
  if (!headshotUrl) return []
  const out = []

  if (/\.transform\/[^/]+\/image\.png$/i.test(headshotUrl)) {
    out.push(headshotUrl.replace(/\.transform\/[^/]+\/image\.png$/i, '.png'))
  }

  if (headshotUrl.includes('/1col/')) {
    out.push(headshotUrl.replace('/1col/', '/4col/'))
    out.push(headshotUrl.replace('/1col/', '/2col/'))
  }

  out.push(headshotUrl)
  return [...new Set(out)]
}

async function fetchJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed request ${res.status}: ${url}`)
  return res.json()
}

async function downloadBinary(url, destinationPath) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed download ${res.status}: ${url}`)
  const bytes = new Uint8Array(await res.arrayBuffer())
  await writeFile(destinationPath, bytes)
  return bytes.byteLength
}

async function downloadWithFallback(urls, destinationPath, minSizeBytes = 1024) {
  for (const url of urls) {
    try {
      const size = await downloadBinary(url, destinationPath)
      if (size >= minSizeBytes) return { url, size }
    } catch {
      // try next
    }
  }
  return null
}

async function run() {
  const year = Number.parseInt(getArgValue('year', '2026'), 10)
  if (!Number.isFinite(year)) {
    throw new Error('Invalid --year value')
  }

  const rootDir = process.cwd()
  const seasonDir = path.join(rootDir, 'public', 'seasons', String(year))
  const manifestPath = path.join(seasonDir, 'manifest.json')

  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  const gridRelPath = manifest.assets?.driverGrid ?? 'drivers/grid.json'
  const teamColorsRelPath = manifest.assets?.teamColors ?? 'teams/colors.json'

  const gridPath = path.join(seasonDir, ...gridRelPath.split('/'))
  const teamColorsPath = path.join(seasonDir, ...teamColorsRelPath.split('/'))

  const drivers = JSON.parse(await readFile(gridPath, 'utf8'))
  const teamColors = JSON.parse(await readFile(teamColorsPath, 'utf8'))

  const headshotsRelDir = 'drivers/headshots'
  const flagsRelDir = 'drivers/flags'
  const numberFontsRelDir = 'drivers/number-fonts'
  const numberSvgsRelDir = 'drivers/number-svgs'

  const headshotsDir = path.join(seasonDir, ...headshotsRelDir.split('/'))
  const flagsDir = path.join(seasonDir, ...flagsRelDir.split('/'))
  const numberFontsDir = path.join(seasonDir, ...numberFontsRelDir.split('/'))
  const numberSvgsDir = path.join(seasonDir, ...numberSvgsRelDir.split('/'))

  await mkdir(headshotsDir, { recursive: true })
  await mkdir(flagsDir, { recursive: true })
  await mkdir(numberFontsDir, { recursive: true })
  await mkdir(numberSvgsDir, { recursive: true })

  const fontFileName = 'teko-latin-600-normal.woff2'
  const fontPath = path.join(numberFontsDir, fontFileName)
  await downloadBinary(NUMBER_FONT_URL, fontPath)

  const latestSessions = await fetchJson(`${OPENF1_BASE}/sessions?session_key=latest`)
  const latestSession = latestSessions?.[0]
  if (!latestSession?.session_key) {
    throw new Error('Could not resolve latest OpenF1 session')
  }

  const apiDrivers = await fetchJson(`${OPENF1_BASE}/drivers?session_key=${latestSession.session_key}`)
  const apiDriverByNumber = new Map(apiDrivers.map((driver) => [Number(driver.driver_number), driver]))

  let headshotsDownloaded = 0
  let flagsDownloaded = 0
  let numberAssetsDownloaded = 0
  const missingHeadshots = []
  const missingNumberSvgs = []
  const seenFlagCodes = new Set()

  const updatedDrivers = drivers.map((driver) => {
    const next = { ...driver }
    const number = Number(driver.number)
    const ref = typeof driver.ref === 'string' && driver.ref.trim().length > 0
      ? driver.ref.trim()
      : `${number}-${String(driver.code ?? '').toLowerCase()}`

    const apiDriver = apiDriverByNumber.get(number)

    if (apiDriver?.headshot_url) {
      const fileName = `${ref}.png`
      const destination = path.join(headshotsDir, fileName)
      const resultPromise = downloadWithFallback(headshotCandidates(apiDriver.headshot_url), destination, 12_000)
      next.__headshotDownloadPromise = resultPromise
      next.headshot = `${headshotsRelDir}/${fileName}`
    }

    const code = toCountryCode(driver.countryCode, driver.nationality)
    if (code) {
      next.countryCode = code
      const flagLower = code.toLowerCase()
      next.flag = `${flagsRelDir}/${flagLower}.svg`
      if (!seenFlagCodes.has(flagLower)) {
        seenFlagCodes.add(flagLower)
        const flagDest = path.join(flagsDir, `${flagLower}.svg`)
        next.__flagDownloadPromise = downloadWithFallback([
          `${FLAG_BASE}/${flagLower}.svg`,
        ], flagDest, 200)
      }
    }

    const teamHex = normalizeHex(teamColors?.[driver.team]?.primary)
    next.numberTextColor = next.numberTextColor ?? chooseNumberTextColor(teamHex)
    next.numberOutlineColor = next.numberOutlineColor ?? darkenHex(teamHex, 0.36)

    const numberSvgPath = typeof next.numberSvg === 'string' ? next.numberSvg : ''
    const numberSvgMatchesRef = numberSvgPath.toLowerCase().includes(`/${ref.toLowerCase()}.`)
    const numberSvgExists = numberSvgPath
      ? existsSync(path.join(seasonDir, ...numberSvgPath.split('/')))
      : false
    const shouldResolveNumberAsset = !numberSvgPath || !numberSvgMatchesRef || !numberSvgExists

    if (!numberSvgMatchesRef) {
      delete next.numberSvg
    }

    if (shouldResolveNumberAsset) {
      next.__numberSvgDownloadPromise = discoverDriverNumberSvgUrl(driver)
        .then(async (assetUrl) => {
          if (!assetUrl) return null
          const extension = inferImageExtensionFromUrl(assetUrl)
          const fileName = `${ref}.${extension}`
          const destination = path.join(numberSvgsDir, fileName)
          const result = await downloadWithFallback([assetUrl], destination, 120)
          if (!result) return null
          return { ...result, relativePath: `${numberSvgsRelDir}/${fileName}` }
        })
    }

    return next
  })

  const allPromises = []
  for (const driver of updatedDrivers) {
    if (driver.__headshotDownloadPromise) {
      allPromises.push(
        driver.__headshotDownloadPromise.then((result) => {
          if (result) {
            headshotsDownloaded += 1
          } else {
            missingHeadshots.push(driver.ref || driver.code || String(driver.number))
            delete driver.headshot
          }
        })
      )
    }

    if (driver.__flagDownloadPromise) {
      allPromises.push(
        driver.__flagDownloadPromise.then((result) => {
          if (result) flagsDownloaded += 1
        })
      )
    }

    if (driver.__numberSvgDownloadPromise) {
      allPromises.push(
        driver.__numberSvgDownloadPromise.then((result) => {
          if (result) {
            numberAssetsDownloaded += 1
            driver.numberSvg = result.relativePath
          } else {
            missingNumberSvgs.push(driver.ref || driver.code || String(driver.number))
            delete driver.numberSvg
          }
        })
      )
    }
  }

  await Promise.all(allPromises)

  for (const driver of updatedDrivers) {
    delete driver.__headshotDownloadPromise
    delete driver.__flagDownloadPromise
    delete driver.__numberSvgDownloadPromise
  }

  manifest.assets = {
    ...(manifest.assets ?? {}),
    drivers: headshotsRelDir,
    driverFlags: flagsRelDir,
    driverNumberFont: `${numberFontsRelDir}/${fontFileName}`,
    driverNumberSvgs: numberSvgsRelDir,
  }

  await writeFile(gridPath, `${JSON.stringify(updatedDrivers, null, 2)}\n`, 'utf8')
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

  console.log(`Synced season ${year} assets`)
  console.log(`Session key: ${latestSession.session_key}`)
  console.log(`Headshots downloaded: ${headshotsDownloaded}`)
  console.log(`Flags downloaded: ${flagsDownloaded}`)
  console.log(`Driver number assets downloaded: ${numberAssetsDownloaded}`)
  if (missingHeadshots.length > 0) {
    console.log(`Missing headshots: ${missingHeadshots.join(', ')}`)
  }
  if (missingNumberSvgs.length > 0) {
    console.log(`Missing driver number assets: ${missingNumberSvgs.join(', ')}`)
  }
  console.log('Done')
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
