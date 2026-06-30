/**
 * Generate PNG extension icons from SVG templates.
 *   node scripts/generate-icons.js
 *
 * Chrome's chrome.action.setIcon() has spotty SVG support across
 * versions, so we rasterise to PNG at 16×16, 48×48, and 128×128.
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ICONS_DIR = path.join(__dirname, '..', 'icons');
const SIZES = [16, 48, 128];

// Minimal, self-contained SVG template — pure geometry, no fonts.
// {{color}} is replaced at build time.
const SVG = (color) => `<svg xmlns="http://www.w3.org/2000/svg"
  width="128" height="128" viewBox="0 0 128 128">
  <rect x="7" y="7" width="114" height="114" rx="26" fill="${color}"/>
  <rect x="52" y="32" width="12" height="70" rx="4" fill="white"/>
  <rect x="40" y="32" width="38" height="12" rx="4" fill="white"/>
  <rect x="44" y="62" width="30" height="10" rx="4" fill="white"/>
</svg>`;

async function main() {
  fs.mkdirSync(ICONS_DIR, { recursive: true });

  const variants = [
    { name: 'icon-active',   color: '#10a37f' },
    { name: 'icon-inactive', color: '#6b7280' }
  ];

  for (const { name, color } of variants) {
    const svg = Buffer.from(SVG(color));
    for (const size of SIZES) {
      const outPath = path.join(ICONS_DIR, `${name}-${size}.png`);
      await sharp(svg)
        .resize(size, size)
        .png()
        .toFile(outPath);
      console.log(`  ${outPath}  (${size}×${size})`);
    }
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
