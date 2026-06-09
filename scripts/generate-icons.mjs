import { mkdir, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const publicDir = join(rootDir, 'public');
const themeIconDir = join(publicDir, 'theme-icons');
const themeManifestDir = join(publicDir, 'theme-manifests');
const androidResDir = join(rootDir, 'android', 'app', 'src', 'main', 'res');

export const THEMES = [
  { id: 'nightsakura', name: '夜樱', accent: '#f2b5c8' },
  { id: 'inkgold', name: '墨金', accent: '#d4b078' },
  { id: 'deepsea', name: '深海', accent: '#6cc4e8' },
  { id: 'moss', name: '苔', accent: '#a8cc88' },
  { id: 'dawn', name: '拂晓', accent: '#c88a7a' },
  { id: 'frostmoon', name: '霜月', accent: '#7a9eb8' },
  { id: 'cloudpaper', name: '云笺', accent: '#a088b8' },
  { id: 'whitepeach', name: '白桃', accent: '#d4889e' },
];

const DEFAULT_THEME = THEMES[0];
const PWA_SIZES = [192, 512];
const ANDROID_MIPMAPS = [
  { dir: 'mipmap-mdpi', size: 48 },
  { dir: 'mipmap-hdpi', size: 72 },
  { dir: 'mipmap-xhdpi', size: 96 },
  { dir: 'mipmap-xxhdpi', size: 144 },
  { dir: 'mipmap-xxxhdpi', size: 192 },
];

function hexToRgb(hex) {
  const value = hex.replace('#', '');
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }) {
  const channel = (value) => Math.round(value).toString(16).padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}`;
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

function iconColors(accent) {
  return {
    background: mix(accent, '#ffffff', 0.08),
    petal: mix(accent, '#fffafc', 0.88),
    petalCore: mix(accent, '#ffffff', 0.80),
    center: mix(accent, '#3a2230', 0.24),
  };
}

function buildFlowerSvg(theme) {
  const colors = iconColors(theme.accent);
  const petals = [0, 72, 144, 216, 288]
    .map((angle) => (
      `<ellipse cx="0" cy="-68" rx="42" ry="104" fill="${colors.petal}" opacity="0.94" transform="rotate(${angle})"/>`
    ))
    .join('\n    ');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="${colors.background}"/>
  <g transform="translate(256,256)">
    ${petals}
    <circle cx="0" cy="0" r="50" fill="${colors.petalCore}" opacity="0.32"/>
    <circle cx="0" cy="0" r="28" fill="${colors.center}"/>
  </g>
</svg>
`;
}

function buildThemeManifest(theme) {
  return {
    name: '拾序记账',
    short_name: '拾序',
    description: '从每一笔消费中拾起生活的秩序',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#16121a',
    theme_color: '#16121a',
    orientation: 'portrait',
    categories: ['finance', 'lifestyle'],
    icons: [
      {
        src: `/theme-icons/${theme.id}.svg`,
        type: 'image/svg+xml',
        sizes: 'any',
        purpose: 'any',
      },
      {
        src: `/theme-icons/${theme.id}-192.png`,
        type: 'image/png',
        sizes: '192x192',
        purpose: 'any maskable',
      },
      {
        src: `/theme-icons/${theme.id}-512.png`,
        type: 'image/png',
        sizes: '512x512',
        purpose: 'any maskable',
      },
    ],
  };
}

async function writePwaAssets(theme, svg) {
  const svgPath = join(themeIconDir, `${theme.id}.svg`);
  await writeFile(svgPath, svg, 'utf8');

  for (const size of PWA_SIZES) {
    await sharp(Buffer.from(svg))
      .resize(size, size)
      .png()
      .toFile(join(themeIconDir, `${theme.id}-${size}.png`));
  }

  await sharp(Buffer.from(svg))
    .resize(180, 180)
    .png()
    .toFile(join(themeIconDir, `${theme.id}-apple-touch.png`));

  await writeFile(
    join(themeManifestDir, `${theme.id}.json`),
    `${JSON.stringify(buildThemeManifest(theme), null, 2)}\n`,
    'utf8',
  );
}

async function writeDefaultPwaAssets(svg) {
  await writeFile(join(publicDir, 'icon.svg'), svg, 'utf8');
  await writeFile(join(publicDir, 'favicon.svg'), svg, 'utf8');

  for (const size of PWA_SIZES) {
    await sharp(Buffer.from(svg))
      .resize(size, size)
      .png()
      .toFile(join(publicDir, `icon-${size}.png`));
  }

  await sharp(Buffer.from(svg))
    .resize(180, 180)
    .png()
    .toFile(join(publicDir, 'apple-touch-icon.png'));

  await sharp(Buffer.from(svg))
    .resize(512, 512)
    .png()
    .toFile(join(publicDir, 'favicon.png'));
}

async function writeAndroidAssets(theme, svg, isDefault) {
  if (!existsSync(androidResDir)) return;

  for (const { dir, size } of ANDROID_MIPMAPS) {
    const mipmapDir = join(androidResDir, dir);
    await mkdir(mipmapDir, { recursive: true });

    const iconBuffer = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
    await writeFile(join(mipmapDir, `ic_launcher_${theme.id}.png`), iconBuffer);
    await writeFile(join(mipmapDir, `ic_launcher_${theme.id}_round.png`), iconBuffer);

    if (isDefault) {
      await writeFile(join(mipmapDir, 'ic_launcher.png'), iconBuffer);
      await writeFile(join(mipmapDir, 'ic_launcher_round.png'), iconBuffer);
      await writeFile(join(mipmapDir, 'ic_launcher_foreground.png'), iconBuffer);
    }
  }
}

await mkdir(themeIconDir, { recursive: true });
await mkdir(themeManifestDir, { recursive: true });

for (const theme of THEMES) {
  const svg = buildFlowerSvg(theme);
  await writePwaAssets(theme, svg);
  await writeAndroidAssets(theme, svg, theme.id === DEFAULT_THEME.id);
  console.log(`Generated themed icon assets for ${theme.id}`);

  if (theme.id === DEFAULT_THEME.id) {
    await writeDefaultPwaAssets(svg);
  }
}
