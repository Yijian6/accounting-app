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
const sourceIconPath = join(__dirname, 'assets', 'theme-icon-source.png');
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

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h /= 6;
  }

  return { h, s, l };
}

function hueToRgb(p, q, t) {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

function hslToRgb(h, s, l) {
  if (s === 0) {
    const value = Math.round(l * 255);
    return { r: value, g: value, b: value };
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: Math.round(hueToRgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hueToRgb(p, q, h) * 255),
    b: Math.round(hueToRgb(p, q, h - 1 / 3) * 255),
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
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

async function buildThemeBuffer(theme) {
  const source = sharp(sourceIconPath)
    .resize(1024, 1024, { fit: 'cover' })
    .ensureAlpha();
  const { data, info } = await source.raw().toBuffer({ resolveWithObject: true });
  const targetHue = rgbToHsl(...Object.values(hexToRgb(theme.accent))).h;

  for (let i = 0; i < data.length; i += info.channels) {
    const alpha = data[i + 3];
    if (alpha === 0) continue;

    const original = {
      r: data[i],
      g: data[i + 1],
      b: data[i + 2],
    };
    const hsl = rgbToHsl(original.r, original.g, original.b);

    // Preserve near-white glass highlights while recoloring all tinted enamel.
    if (hsl.s < 0.05 && hsl.l > 0.86) continue;

    const tintStrength = clamp((hsl.s - 0.02) / 0.45, 0, 1);
    const highlightProtection = clamp((hsl.l - 0.78) / 0.22, 0, 1);
    const newSaturation = clamp(hsl.s * 0.92 + 0.08 * tintStrength, 0, 0.86);
    const newLightness = clamp(hsl.l + (0.02 * highlightProtection), 0, 1);
    const rgb = hslToRgb(
      hsl.h + (targetHue - hsl.h) * clamp(tintStrength + 0.16, 0, 1),
      newSaturation,
      newLightness,
    );

    data[i] = rgb.r;
    data[i + 1] = rgb.g;
    data[i + 2] = rgb.b;
  }

  return sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: info.channels,
    },
  }).png().toBuffer();
}

async function writePwaAssets(theme, sourceBuffer) {
  for (const size of PWA_SIZES) {
    await sharp(sourceBuffer)
      .resize(size, size)
      .png()
      .toFile(join(themeIconDir, `${theme.id}-${size}.png`));
  }

  await sharp(sourceBuffer)
    .resize(180, 180)
    .png()
    .toFile(join(themeIconDir, `${theme.id}-apple-touch.png`));

  await writeFile(
    join(themeManifestDir, `${theme.id}.json`),
    `${JSON.stringify(buildThemeManifest(theme), null, 2)}\n`,
    'utf8',
  );
}

async function writeDefaultPwaAssets(sourceBuffer) {
  for (const size of PWA_SIZES) {
    await sharp(sourceBuffer)
      .resize(size, size)
      .png()
      .toFile(join(publicDir, `icon-${size}.png`));
  }

  await sharp(sourceBuffer)
    .resize(180, 180)
    .png()
    .toFile(join(publicDir, 'apple-touch-icon.png'));

  await sharp(sourceBuffer)
    .resize(512, 512)
    .png()
    .toFile(join(publicDir, 'favicon.png'));
}

async function writeAndroidAssets(theme, sourceBuffer, isDefault) {
  if (!existsSync(androidResDir)) return;

  for (const { dir, size } of ANDROID_MIPMAPS) {
    const mipmapDir = join(androidResDir, dir);
    await mkdir(mipmapDir, { recursive: true });

    const iconBuffer = await sharp(sourceBuffer).resize(size, size).png().toBuffer();
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
  const iconBuffer = await buildThemeBuffer(theme);
  await writePwaAssets(theme, iconBuffer);
  await writeAndroidAssets(theme, iconBuffer, theme.id === DEFAULT_THEME.id);
  console.log(`Generated themed icon assets for ${theme.id}`);

  if (theme.id === DEFAULT_THEME.id) {
    await writeDefaultPwaAssets(iconBuffer);
  }
}
