import { useState } from 'react';
import Modal from './Modal';
import './ConfirmSheet.css';

/** 需要用户点头的操作（合并去向 / 细分）。关闭动画期间保留最后的内容 */
export default function ConfirmSheet({ request, onClose }) {
  const [last, setLast] = useState(request);
  if (request && request !== last) setLast(request);
  const shown = request || last;

  return (
    <Modal open={!!request} title={shown?.title || ''} onClose={onClose}>
      {shown && (
        <div className="confirm-sheet">
          <p>{shown.body}</p>
          <div className="confirm-sheet-actions">
            <button type="button" className="confirm-sheet-cancel" onClick={onClose}>取消</button>
            <button
              type="button"
              className="confirm-sheet-ok"
              onClick={() => {
                shown.onConfirm();
                onClose();
              }}
            >
              {shown.confirmLabel || '确定'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
