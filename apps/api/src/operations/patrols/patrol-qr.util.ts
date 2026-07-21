import * as QRCode from 'qrcode'

/**
 * Générateur de "badge" QR de marque SAGARD SÉCURITÉ — style « Badge sombre premium ».
 *
 * Chaque point de contrôle (PatrolPoint) possède un `code` unique (ex: 9F2A1C4B7E01).
 * Le QR encode ce code brut : l'agent le scanne depuis l'app mobile → POST /patrols/:id/scan
 * avec { pointCode }, ce que le backend résout déjà sur PatrolPoint.code.
 *
 * Rendu 100% SVG vectoriel (impression nette, sans dépendance de rastérisation) :
 *   - entête sombre #0F172A + bouclier jaune #C8D400 + wordmark
 *   - QR à modules arrondis, yeux (finder patterns) stylisés
 *   - logo bouclier au centre du QR (knockout blanc) — niveau de correction H (30%)
 *   - pied : désignation du point, site · poste, filet jaune, code en mono
 */

const BRAND = {
  dark: '#0F172A',
  dark2: '#1E293B',
  ink: '#0F172A',
  yellow: '#C8D400',
  yellowDark: '#A5AF00',
  muted: '#64748B',
  faint: '#94A3B8',
  panel: '#F8FAFC',
  line: '#E7EAF0',
  panelLine: '#EEF1F5',
}

// Chemin du bouclier de marque (viewBox 24×24) — cf. public/shield.svg
const SHIELD_PATH = 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'

const BADGE_W = 340
const BADGE_H = 462

export interface BadgeOptions {
  code: string
  name: string
  siteName?: string
  sequence?: number
}

function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function truncate(s: string, max: number): string {
  const v = String(s ?? '').trim()
  return v.length > max ? v.slice(0, max - 1).trimEnd() + '…' : v
}

/** Bouclier plein, positionné/mis à l'échelle depuis un viewBox 24×24. */
function shield(x: number, y: number, sizePx: number, fill: string, opacity = 1): string {
  const s = sizePx / 24
  return `<path d="${SHIELD_PATH}" transform="translate(${x} ${y}) scale(${s.toFixed(4)})" fill="${fill}" opacity="${opacity}"/>`
}

/**
 * Bouclier centré dans une boîte carrée [boxX,boxY,boxSize].
 * Le tracé n'est pas centré dans son viewBox 24×24 : bbox ≈ x[4,20], y[2,22], centre (12,12),
 * hauteur ~20u. `heightFrac` = hauteur du bouclier en fraction de boxSize.
 */
function centeredShield(boxX: number, boxY: number, boxSize: number, heightFrac: number, fill: string): string {
  const s = (boxSize * heightFrac) / 20
  const tx = boxX + boxSize / 2 - 12 * s
  const ty = boxY + boxSize / 2 - 12 * s
  return `<path d="${SHIELD_PATH}" transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${s.toFixed(4)})" fill="${fill}"/>`
}

/**
 * Rend le QR (data → matrice de modules) en markup SVG stylisé, dans un carré `sizePx`.
 * Origine locale (0,0). Modules arrondis + yeux stylisés + zone centrale réservée au logo.
 */
function renderQr(data: string, sizePx: number): string {
  const qr = QRCode.create(data, { errorCorrectionLevel: 'H' })
  const count = qr.modules.size
  const bits = qr.modules.data // Uint8Array, row-major (row * size + col)
  const get = (r: number, c: number): boolean => !!bits[r * count + c]

  const quiet = 2 // modules de marge (zone silencieuse)
  const total = count + quiet * 2
  const m = sizePx / total // taille d'un module en px
  const off = quiet * m

  const isFinderOrigin = (r: number, c: number) =>
    (r === 0 && c === 0) ||
    (r === 0 && c === count - 7) ||
    (r === count - 7 && c === 0)

  const inFinder = (r: number, c: number) => {
    const zones: Array<[number, number]> = [[0, 0], [0, count - 7], [count - 7, 0]]
    return zones.some(([r0, c0]) => r >= r0 && r < r0 + 7 && c >= c0 && c < c0 + 7)
  }

  // Zone centrale réservée au logo (correction H tolère ~30% ; on efface ~25% de la largeur).
  const clearHalf = Math.round(count * 0.12)
  const center = (count - 1) / 2
  const inLogo = (r: number, c: number) =>
    Math.abs(r - center) <= clearHalf && Math.abs(c - center) <= clearHalf

  const parts: string[] = []

  // — Modules de données (dots arrondis) —
  const dot = m * 0.92
  const pad = (m - dot) / 2
  const rx = dot * 0.32
  let path = ''
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (!get(r, c)) continue
      if (inFinder(r, c) || inLogo(r, c)) continue
      const x = off + c * m + pad
      const y = off + r * m + pad
      path += `M${(x + rx).toFixed(2)} ${y.toFixed(2)}h${(dot - 2 * rx).toFixed(2)}a${rx.toFixed(2)} ${rx.toFixed(2)} 0 0 1 ${rx.toFixed(2)} ${rx.toFixed(2)}v${(dot - 2 * rx).toFixed(2)}a${rx.toFixed(2)} ${rx.toFixed(2)} 0 0 1 -${rx.toFixed(2)} ${rx.toFixed(2)}h-${(dot - 2 * rx).toFixed(2)}a${rx.toFixed(2)} ${rx.toFixed(2)} 0 0 1 -${rx.toFixed(2)} -${rx.toFixed(2)}v-${(dot - 2 * rx).toFixed(2)}a${rx.toFixed(2)} ${rx.toFixed(2)} 0 0 1 ${rx.toFixed(2)} -${rx.toFixed(2)}z`
    }
  }
  parts.push(`<path d="${path}" fill="${BRAND.ink}"/>`)

  // — Yeux (finder patterns) stylisés —
  const roundedRect = (x: number, y: number, w: number, h: number, r: number, fill: string) =>
    `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" rx="${r.toFixed(2)}" fill="${fill}"/>`

  for (const [r0, c0] of [[0, 0], [0, count - 7], [count - 7, 0]] as Array<[number, number]>) {
    if (!isFinderOrigin(r0, c0)) continue
    const x = off + c0 * m
    const y = off + r0 * m
    parts.push(roundedRect(x, y, 7 * m, 7 * m, 2.1 * m, BRAND.ink))           // anneau externe
    parts.push(roundedRect(x + m, y + m, 5 * m, 5 * m, 1.5 * m, '#ffffff'))   // creux blanc
    parts.push(roundedRect(x + 2 * m, y + 2 * m, 3 * m, 3 * m, 1.05 * m, BRAND.ink)) // pupille
  }

  // — Logo central : plaque blanche (gap) → chip sombre → bouclier jaune (haut contraste) —
  const logoBox = (2 * clearHalf + 1) * m
  const lx = off + (center - clearHalf) * m
  const ly = off + (center - clearHalf) * m
  // plaque blanche : sépare nettement le logo des modules
  const plate = logoBox * 1.16
  parts.push(roundedRect(lx - (plate - logoBox) / 2, ly - (plate - logoBox) / 2, plate, plate, plate * 0.27, '#ffffff'))
  // chip sombre
  const chip = logoBox * 0.98
  const chx = lx + (logoBox - chip) / 2
  const chy = ly + (logoBox - chip) / 2
  parts.push(roundedRect(chx, chy, chip, chip, chip * 0.28, BRAND.dark))
  // bouclier jaune centré sur le chip (le tracé occupe ~20u de haut dans un viewBox 24×24)
  parts.push(centeredShield(chx, chy, chip, 0.62, BRAND.yellow))

  return `<g>${parts.join('')}</g>`
}

/** Markup interne d'un badge (0,0 → BADGE_W×BADGE_H). `shadowId` = id du filtre partagé. */
function badgeMarkup(opts: BadgeOptions, shadowId: string): string {
  const name = esc(truncate(opts.name || 'Point de contrôle', 24))
  const site = opts.siteName ? esc(truncate(opts.siteName, 30)) : ''
  const seq = opts.sequence != null ? `Poste N°${opts.sequence}` : ''
  const sub = [site, seq].filter(Boolean).join('  ·  ')
  const code = esc(opts.code)

  const pad = 16
  const cardX = pad, cardY = pad
  const cardW = BADGE_W - pad * 2
  const cardH = BADGE_H - pad * 2
  const r = 24
  const headerH = 74

  // Entête sombre avec coins hauts arrondis uniquement
  const header = `M${cardX} ${cardY + headerH} V${cardY + r} A${r} ${r} 0 0 1 ${cardX + r} ${cardY} H${cardX + cardW - r} A${r} ${r} 0 0 1 ${cardX + cardW} ${cardY + r} V${cardY + headerH} Z`

  // QR panel
  const qrPanel = 214
  const qrPanelX = cardX + (cardW - qrPanel) / 2
  const qrPanelY = cardY + headerH + 20
  const qrInset = 14
  const qrSize = qrPanel - qrInset * 2

  const footY = qrPanelY + qrPanel + 30
  const cx = cardX + cardW / 2

  return `
  <rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="${r}" fill="#ffffff" stroke="${BRAND.line}" filter="url(#${shadowId})"/>

  <path d="${header}" fill="${BRAND.dark}"/>
  ${shield(cardX + 22, cardY + 22, 30, BRAND.yellow)}
  <text x="${cardX + 62}" y="${cardY + 34}" font-family="Inter, Helvetica, Arial, sans-serif" font-size="17" font-weight="800" fill="#ffffff" letter-spacing="0.3">SAGARD SÉCURITÉ</text>
  <text x="${cardX + 62}" y="${cardY + 53}" font-family="Inter, Helvetica, Arial, sans-serif" font-size="10.5" font-weight="700" fill="${BRAND.yellow}" letter-spacing="2.4">POINT DE CONTRÔLE</text>

  <rect x="${qrPanelX}" y="${qrPanelY}" width="${qrPanel}" height="${qrPanel}" rx="18" fill="${BRAND.panel}" stroke="${BRAND.panelLine}"/>
  <g transform="translate(${qrPanelX + qrInset} ${qrPanelY + qrInset})">${renderQr(opts.code, qrSize)}</g>

  <text x="${cx}" y="${footY}" text-anchor="middle" font-family="Inter, Helvetica, Arial, sans-serif" font-size="18" font-weight="800" fill="${BRAND.ink}">${name}</text>
  ${sub ? `<text x="${cx}" y="${footY + 20}" text-anchor="middle" font-family="Inter, Helvetica, Arial, sans-serif" font-size="12" font-weight="600" fill="${BRAND.muted}">${sub}</text>` : ''}
  <rect x="${cx - 26}" y="${footY + 32}" width="52" height="4" rx="2" fill="${BRAND.yellow}"/>
  <text x="${cx}" y="${footY + 60}" text-anchor="middle" font-family="'JetBrains Mono', ui-monospace, monospace" font-size="15" font-weight="700" fill="${BRAND.ink}" letter-spacing="2">${code}</text>
  <text x="${cx}" y="${footY + 76}" text-anchor="middle" font-family="Inter, Helvetica, Arial, sans-serif" font-size="9" font-weight="700" fill="${BRAND.faint}" letter-spacing="3">CODE DU POINT</text>
  `
}

const SHADOW_DEF = (id: string) =>
  `<filter id="${id}" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#0F172A" flood-opacity="0.10"/></filter>`

/** SVG autonome d'un badge QR pour un point de contrôle. */
export function generatePatrolPointBadgeSvg(opts: BadgeOptions): string {
  const shadowId = 'sh'
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${BADGE_W}" height="${BADGE_H}" viewBox="0 0 ${BADGE_W} ${BADGE_H}" font-family="Inter, Helvetica, Arial, sans-serif"><defs>${SHADOW_DEF(shadowId)}</defs>${badgeMarkup(opts, shadowId)}</svg>`
}

/**
 * Planche imprimable (A4 portrait) : grille de badges QR pour tous les points d'un site.
 * 2 colonnes ; pagination verticale simple (le contenu déborde sur plusieurs pages à l'impression).
 */
export function generatePatrolPointsSheetSvg(points: BadgeOptions[], siteName?: string): string {
  const shadowId = 'sh'
  const cols = 2
  const gap = 8
  const marginX = 24
  const marginTop = 70
  const pageW = 794 // ~A4 @96dpi
  const cellW = (pageW - marginX * 2 - gap * (cols - 1)) / cols
  const scale = cellW / BADGE_W
  const cellH = BADGE_H * scale
  const rows = Math.ceil(points.length / cols)
  const pageH = Math.max(1123, marginTop + rows * (cellH + gap) + 24)

  const badges = points
    .map((p, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      const x = marginX + col * (cellW + gap)
      const y = marginTop + row * (cellH + gap)
      return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${scale.toFixed(4)})">${badgeMarkup(p, shadowId)}</g>`
    })
    .join('')

  const title = siteName ? esc(`Points de contrôle — ${truncate(siteName, 48)}`) : 'Points de contrôle de ronde'

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${pageW}" height="${pageH}" viewBox="0 0 ${pageW} ${pageH}" font-family="Inter, Helvetica, Arial, sans-serif">
  <defs>${SHADOW_DEF(shadowId)}</defs>
  <rect width="${pageW}" height="${pageH}" fill="#ffffff"/>
  ${shield(marginX, 26, 26, BRAND.yellowDark)}
  <text x="${marginX + 36}" y="${46}" font-size="20" font-weight="800" fill="${BRAND.ink}">${title}</text>
  <text x="${pageW - marginX}" y="${46}" text-anchor="end" font-size="12" font-weight="600" fill="${BRAND.muted}">${points.length} point(s) · SAGARD SÉCURITÉ</text>
  <line x1="${marginX}" y1="58" x2="${pageW - marginX}" y2="58" stroke="${BRAND.line}"/>
  ${badges}
</svg>`
}
