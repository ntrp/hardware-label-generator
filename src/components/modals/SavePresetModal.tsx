import type { Dispatch, SetStateAction } from 'react';
import { Save, X } from 'lucide-react';
import { uniqueValues } from '../../lib/labelLayout';
import { hardwareCategories } from '../hardware/hardwareConstants';
import type { HardwareCategory } from '../../types';

interface SavePresetModalProps {
  presetCategories: HardwareCategory[];
  presetName: string;
  onClose: () => void;
  onSave: () => void;
  onSetPresetCategories: Dispatch<SetStateAction<HardwareCategory[]>>;
  onSetPresetName: Dispatch<SetStateAction<string>>;
}

export function SavePresetModal({
  presetCategories,
  presetName,
  onClose,
  onSave,
  onSetPresetCategories,
  onSetPresetName
}: SavePresetModalProps) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal-panel preset-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="preset-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div className="panel-title-main">
            <Save size={18} />
            <h2 id="preset-modal-title">Save preset</h2>
          </div>
          <button type="button" className="icon-button small" title="Close save preset" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSave();
          }}
        >
          <label>
            Preset name
            <input value={presetName} onChange={(event) => onSetPresetName(event.target.value)} autoFocus />
          </label>
          <fieldset className="category-checks">
            <legend>Categories</legend>
            {hardwareCategories.map((category) => (
              <label key={category}>
                <input
                  type="checkbox"
                  checked={presetCategories.includes(category)}
                  onChange={(event) =>
                    onSetPresetCategories((current) =>
                      event.target.checked ? uniqueValues([...current, category]) as HardwareCategory[] : current.filter((entry) => entry !== category)
                    )
                  }
                />
                {category}
              </label>
            ))}
          </fieldset>
          <div className="modal-actions">
            <button type="button" className="secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" disabled={!presetName.trim()}>
              <Save size={16} /> Save preset
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
