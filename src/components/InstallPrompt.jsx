import { useEffect, useRef, useState } from 'react';
import './InstallPrompt.css';

const INSTALL_DISMISSED_KEY = 'shiyu_install_dismissed';
const INSTALL_DELAY_MS = 3000;

function isStandaloneMode() {
  return window.matchMedia?.('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}

function isIosSafari() {
  const ua = window.navigator.userAgent;
  const isIos = /iphone|ipad|ipod/i.test(ua)
    || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
  const isWebKit = /safari/i.test(ua);
  const isOtherIosBrowser = /crios|fxios|edgios/i.test(ua);
  return isIos && isWebKit && !isOtherIosBrowser;
}

function hasDismissedInstallPrompt() {
  return window.localStorage.getItem(INSTALL_DISMISSED_KEY) === 'true';
}

function dismissInstallPrompt() {
  window.localStorage.setItem(INSTALL_DISMISSED_KEY, 'true');
}

export default function InstallPrompt() {
  const [mode, setMode] = useState(null);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState(null);
  const updateWorkerRef = useRef(null);

  useEffect(() => {
    if (isStandaloneMode()) return undefined;

    const showInstallPrompt = (nextMode) => {
      if (!hasDismissedInstallPrompt()) {
        setMode((current) => (current === 'update' ? current : nextMode));
      }
    };

    const installTimer = window.setTimeout(() => {
      if (isIosSafari()) {
        showInstallPrompt('manual');
      }
    }, INSTALL_DELAY_MS);

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredInstallPrompt(event);
      window.clearTimeout(installTimer);
      window.setTimeout(() => showInstallPrompt('install'), INSTALL_DELAY_MS);
    };

    const handleAppInstalled = () => {
      dismissInstallPrompt();
      setMode(null);
      setDeferredInstallPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.clearTimeout(installTimer);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    const handleUpdateReady = (event) => {
      updateWorkerRef.current = event.detail?.worker || null;
      setMode('update');
    };

    window.addEventListener('shiyu:pwa-update-ready', handleUpdateReady);
    return () => window.removeEventListener('shiyu:pwa-update-ready', handleUpdateReady);
  }, []);

  const closePrompt = () => {
    if (mode === 'install' || mode === 'manual') {
      dismissInstallPrompt();
    }
    setMode(null);
  };

  const installApp = async () => {
    if (!deferredInstallPrompt) return;
    dismissInstallPrompt();
    setMode(null);
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice.catch(() => null);
    setDeferredInstallPrompt(null);
  };

  const refreshApp = () => {
    updateWorkerRef.current?.postMessage({ type: 'SKIP_WAITING' });
    setMode(null);
  };

  if (!mode) return null;

  const isUpdate = mode === 'update';
  const isManual = mode === 'manual';
  const title = isUpdate ? '有新版本可用' : '添加到主屏幕';
  const body = isUpdate
    ? '拾序已经准备好新的版本。刷新后即可使用。'
    : isManual
      ? '点击分享按钮，再选择“添加到主屏幕”。像原生应用一样使用拾序，更快、更安静。'
      : '像原生应用一样使用拾序，更快、更安静。';
  const primaryLabel = isUpdate ? '刷 新' : isManual ? '知 道' : '安 装';
  const primaryAction = isUpdate ? refreshApp : isManual ? closePrompt : installApp;

  return (
    <aside className="install-prompt" aria-live="polite">
      <button className="install-prompt-close" type="button" onClick={closePrompt} aria-label="稍后">
        ×
      </button>
      <div className="install-prompt-mark" aria-hidden="true">拾</div>
      <div className="install-prompt-copy">
        <span>{isUpdate ? 'UPDATE' : 'PWA'}</span>
        <strong>{title}</strong>
        <p>{body}</p>
      </div>
      <button className="install-prompt-primary" type="button" onClick={primaryAction}>
        {primaryLabel}
      </button>
    </aside>
  );
}
