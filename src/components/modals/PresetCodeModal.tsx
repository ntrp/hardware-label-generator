import { Code2, Copy, X } from 'lucide-react';

interface PresetCodeModalProps {
  presetCode: string;
  onClose: () => void;
  onCopy: () => void | Promise<void>;
}

export function PresetCodeModal({ presetCode, onClose, onCopy }: PresetCodeModalProps) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal-panel preset-code-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="preset-code-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div className="panel-title-main">
            <Code2 size={18} />
            <h2 id="preset-code-modal-title">Preset code</h2>
          </div>
          <button type="button" className="icon-button small" title="Close preset code" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <textarea className="code-export-textarea" readOnly value={presetCode} aria-label="Built-in preset TypeScript code" />
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onClose}>
            Close
          </button>
          <button type="button" onClick={() => void onCopy()}>
            <Copy size={16} /> Copy
          </button>
        </div>
      </section>
    </div>
  );
}
