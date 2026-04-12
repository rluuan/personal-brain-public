// Run with Node.js to generate PNG icons (requires canvas package)
// Usage: node generate-icons.js
// Or just use any 16x16, 48x48, 128x128 PNG files named icon16.png etc.

// If you don't have canvas, you can use any PNG icons and rename them.
// A simple way: use this SVG as a reference and export at each size.

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#1e1e2e"/>
  <polygon points="64,20 104,44 104,84 64,108 24,84 24,44" fill="none" stroke="#3b82f6" stroke-width="8"/>
  <circle cx="64" cy="64" r="12" fill="#3b82f6"/>
</svg>`

console.log('SVG icon content:')
console.log(SVG)
console.log('\nSave this as icon.svg and convert to PNG at sizes 16, 48, 128px')
console.log('Tools: Inkscape, ImageMagick, or online converters')
