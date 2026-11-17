import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './UndoToast.css';

const SHOW_MS = 6000;

/** 底部的一行提示；整理操作后带「撤销」，6 秒后自己消失 */
export default function UndoToast({ toast, onUndo, onDismiss }) {
  // 父组件每次渲染都会给新的 onDismiss，用 ref 拿最新的，计时只跟着 toast 走
  const dismissRef = useRef(onDismiss);
  useEffect(() => {
    dismissRef.current = onDismiss;
  });

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => dismissRef.current(), toast.snapshot ? SHOW_MS : 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;

  return createPortal(
    <div className="undo-toast" key={toast.id} role="status" aria-live="polite">
      <span>{toast.message}</span>
      {toast.snapshot && (
        <button type="button" onClick={onUndo}>撤销</button>
      )}
    </div>,
    document.body
  );
}
