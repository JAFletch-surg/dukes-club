/**
 * One-off asset optimiser. Run with: node scripts/optimize-assets.mjs
 *
 * These files were committed at their original export dimensions — the event
 * banners were 2000x1545 PNGs (2.4MB each) rendered into a 96px-wide card on
 * mobile. This resizes each one to roughly twice its largest on-screen size and
 * re-encodes it.
 *
 * Deliberately edits in place, keeping every filename and extension unchanged.
 * The event banners are offered as presets in the admin event editor
 * (app/admin/events/page.tsx), so their paths are stored in `events` rows in
 * the database — renaming them or switching to .webp would break every event
 * already using one. The delivery-side format conversion is next/image's job;
 * this script only stops the source being enormous.
 *
 * Palette PNGs are used for the illustrations and logos because they are
 * flat-ish artwork with limited colour ranges, where 256-colour quantisation is
 * visually indistinguishable at a fraction of the size. Re-running is safe:
 * anything already at or below its target width is skipped.
 *
 * sharp comes in via Next's image optimiser, so there is nothing to install.
 */
import sharp from 'sharp'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/** width: target max width, chosen as ~2x the largest rendered size. */
const TARGETS = [
  // Home page event cards: aspect-[4/3] in a 3-column grid, ~420px at most.
  { file: 'public/images/events/awr-yellow.png', width: 1000, encode: palettePng },
  { file: 'public/images/events/ibd-yellow.png', width: 1000, encode: palettePng },
  { file: 'public/images/events/robot.png', width: 1000, encode: palettePng },

  // Navbar h-10, footer h-12, members sidebar max-w-[180px].
  { file: 'public/images/logo-white.png', width: 400, encode: palettePng },
  // Hero logo, up to h-44 (176px tall) on large screens.
  { file: 'public/images/logo-hero.png', width: 960, encode: palettePng },
  // Contact page, h-32 (128px tall).
  { file: 'public/images/logo-contact.png', width: 640, encode: palettePng },

  // About page card background, rendered at opacity-0.12 behind card content.
  { file: 'public/images/card-bg.png', width: 800, encode: palettePng },

  // Footer background, full-bleed behind bg-navy/80 on every public page.
  { file: 'public/images/footer-abstract.jpg', width: 1600, encode: jpeg },
]

function palettePng(pipeline) {
  return pipeline.png({ palette: true, quality: 88, effort: 10 })
}

function jpeg(pipeline) {
  return pipeline.jpeg({ quality: 72, mozjpeg: true })
}

const kb = (bytes) => `${(bytes / 1024).toFixed(0)} KB`

let before = 0
let after = 0

for (const { file, width, encode } of TARGETS) {
  const path = join(root, file)

  let original
  try {
    original = await readFile(path)
  } catch {
    console.log(`${file.padEnd(42)} missing — skipped`)
    continue
  }

  const meta = await sharp(original).metadata()
  if (meta.width <= width) {
    console.log(`${file.padEnd(42)} already ${meta.width}px wide — skipped`)
    before += original.length
    after += original.length
    continue
  }

  const optimised = await encode(sharp(original).resize({ width })).toBuffer()

  // Never make a file bigger than it started.
  if (optimised.length >= original.length) {
    console.log(`${file.padEnd(42)} re-encode was larger — kept original`)
    before += original.length
    after += original.length
    continue
  }

  await writeFile(path, optimised)
  before += original.length
  after += optimised.length

  const saved = (100 * (1 - optimised.length / original.length)).toFixed(0)
  console.log(
    `${file.padEnd(42)} ${meta.width}px ${kb(original.length)} → ${width}px ${kb(optimised.length)}  (-${saved}%)`
  )
}

console.log(`\ntotal: ${kb(before)} → ${kb(after)}  (-${(100 * (1 - after / before)).toFixed(0)}%)`)
