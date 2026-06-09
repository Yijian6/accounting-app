export const THEME_ICON_ACCENTS = {
  nightsakura: '#f2b5c8',
  inkgold: '#d4b078',
  deepsea: '#6cc4e8',
  moss: '#a8cc88',
  dawn: '#c88a7a',
  frostmoon: '#7a9eb8',
  cloudpaper: '#a088b8',
  whitepeach: '#d4889e',
};

const DEFAULT_THEME = 'nightsakura';
const THEME_IDS = Object.keys(THEME_ICON_ACCENTS);

function normalizeTheme(theme) {
  return THEME_IDS.includes(theme) ? theme : DEFAULT_THEME;
}

function isStandaloneDisplay() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function ensureLink(selector, rel) {
  let link = document.querySelector(selector);
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', rel);
    document.head.appendChild(link);
  }
  return link;
}

export function getThemeIconPaths(theme) {
  const id = normalizeTheme(theme);
  return {
    id,
    accent: THEME_ICON_ACCENTS[id],
    svg: `/theme-icons/${id}.svg`,
    icon192: `/theme-icons/${id}-192.png`,
    icon512: `/theme-icons/${id}-512.png`,
    appleTouch: `/theme-icons/${id}-apple-touch.png`,
    manifest: `/theme-manifests/${id}.json`,
  };
}

export function syncDocumentThemeIcons(theme) {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  const paths = getThemeIconPaths(theme);
  const favicon = ensureLink('link[rel="icon"]', 'icon');
  favicon.setAttribute('href', paths.svg);
  favicon.setAttribute('type', 'image/svg+xml');

  const appleTouch = ensureLink('link[rel="apple-touch-icon"]', 'apple-touch-icon');
  appleTouch.setAttribute('href', paths.appleTouch);

  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) {
    const bg = window.getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    themeColor.setAttribute('content', bg || '#16121a');
  }

  const manifest = document.querySelector('link[rel="manifest"]');
  if (manifest && !isStandaloneDisplay()) {
    manifest.setAttribute('href', paths.manifest);
  }
}

export async function syncNativeLauncherIcon(theme) {
  if (typeof window === 'undefined') return;

  const capacitor = window.Capacitor;
  if (!capacitor || capacitor.getPlatform?.() !== 'android') return;

  const id = normalizeTheme(theme);
  try {
    if (capacitor.Plugins?.LauncherIcon?.setThemeIcon) {
      await capacitor.Plugins.LauncherIcon.setThemeIcon({ theme: id });
      return;
    }
    if (typeof capacitor.nativePromise === 'function') {
      await capacitor.nativePromise('LauncherIcon', 'setThemeIcon', { theme: id });
    }
  } catch {
    // Launcher icon changes are best-effort across Android launchers.
  }
}
