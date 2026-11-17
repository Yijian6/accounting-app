// 把生成好的文件交给当前环境里最可靠的保存方式。
//
// - 安卓 App（Capacitor 壳）：WebView 不处理 <a download>，改走原生 FileExport 插件，
//   弹出系统「另存为」，由用户选位置。
// - iPhone / iPad：主屏幕 App 里 <a download> 不可靠，优先用系统分享面板（可存到「文件」）。
// - 其它浏览器：沿用 <a download>。
//
// 返回值：
//   'saved'      已确认写入（安卓另存为成功 / iOS 分享面板完成）
//   'downloaded' 已交给浏览器下载，无法确认是否落盘
//   'cancelled'  用户主动取消
// 失败时抛出 Error。

export const SAVE_RESULT = {
  SAVED: 'saved',
  DOWNLOADED: 'downloaded',
  CANCELLED: 'cancelled',
};

function getCapacitor() {
  return typeof window !== 'undefined' ? window.Capacitor : undefined;
}

function isAndroidApp() {
  const capacitor = getCapacitor();
  return !!capacitor
    && capacitor.isNativePlatform?.() === true
    && capacitor.getPlatform?.() === 'android'
    && typeof capacitor.nativePromise === 'function';
}

function isAppleMobile() {
  const ua = window.navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua)
    || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error || new Error('读取文件内容失败'));
    reader.readAsDataURL(blob);
  });
}

async function saveWithAndroidApp(blob, filename) {
  const data = await blobToBase64(blob);
  const result = await getCapacitor().nativePromise('FileExport', 'save', {
    filename,
    mimeType: blob.type || 'application/octet-stream',
    data,
  });
  return result?.saved ? SAVE_RESULT.SAVED : SAVE_RESULT.CANCELLED;
}

function downloadWithAnchor(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  // Safari 在 click 之后才开始读取 blob，立刻 revoke 会让下载落空
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export async function saveFile(blob, filename) {
  if (isAndroidApp()) {
    return saveWithAndroidApp(blob, filename);
  }

  if (isAppleMobile() && typeof File === 'function' && navigator.canShare) {
    const file = new File([blob], filename, { type: blob.type });
    if (navigator.canShare({ files: [file] })) {
      // navigator.share 必须在用户点击的同步调用链里发起，前面不能有 await
      try {
        await navigator.share({ files: [file], title: filename });
        return SAVE_RESULT.SAVED;
      } catch (error) {
        if (error?.name === 'AbortError') return SAVE_RESULT.CANCELLED;
        // 分享面板不可用时退回普通下载
      }
    }
  }

  downloadWithAnchor(blob, filename);
  return SAVE_RESULT.DOWNLOADED;
}
