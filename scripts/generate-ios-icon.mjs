// 生成 iOS App 图标（1024×1024，全出血正方形，无 alpha——App Store 硬性要求）
// 图形与 generate-icons.mjs 的花朵一致，默认主题夜樱。
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const outPath = join(rootDir, 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset', 'AppIcon-512@2x.png');

const ACCENT = '#f2b5c8'; // 夜樱

function hexToRgb(hex) {
  const v = hex.replace('#', '');
  return { r: parseInt(v.slice(0, 2), 16), g: parseInt(v.slice(2, 4), 16), b: parseInt(v.slice(4, 6), 16) };
}
function rgbToHex({ r, g, b }) {
  const c = (x) => Math.round(x).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}
function mix(hexA, hexB, amount) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  return rgbToHex({
    r: a.r + (b.r - a.r) * amount,
    g: a.g + (b.g - a.g) * amount,
    b: a.b + (b.b - a.b) * amount,
  });
}

const colors = {
  background: mix(ACCENT, '#ffffff', 0.08),
  petal: mix(ACCENT, '#fffafc', 0.88),
  petalCore: mix(ACCENT, '#ffffff', 0.80),
  center: mix(ACCENT, '#3a2230', 0.24),
};

const petals = [0, 72, 144, 216, 288]
  .map((angle) => `<ellipse cx="0" cy="-68" rx="42" ry="104" fill="${colors.petal}" opacity="0.94" transform="rotate(${angle})"/>`)
  .join('\n    ');

// 全出血方形背景（无 rx），iOS 系统自行裁切圆角
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${colors.background}"/>
  <g transform="translate(256,256)">
    ${petals}
    <circle cx="0" cy="0" r="50" fill="${colors.petalCore}" opacity="0.32"/>
    <circle cx="0" cy="0" r="28" fill="${colors.center}"/>
  </g>
</svg>
`;

await sharp(Buffer.from(svg), { density: 300 })
  .resize(1024, 1024)
  .flatten({ background: colors.background })
  .removeAlpha()
  .png()
  .toFile(outPath);

console.log(`iOS icon written: ${outPath}`);
