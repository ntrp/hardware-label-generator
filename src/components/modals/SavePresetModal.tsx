import type { Dispatch, SetStateAction } from 'react';
import { Save, X } from 'lucide-react';
import { uniqueValues } from '../../lib/labelLayout';
import { useI18n } from '../../lib/i18n';
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
  const { categoryLabel, t } = useI18n();

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
            <h2 id="preset-modal-title">{t('savePreset')}</h2>
          </div>
          <button type="button" className="icon-button small" title={t('closeSavePreset')} onClick={onClose}>
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
            {t('presetName')}
            <input value={presetName} onChange={(event) => onSetPresetName(event.target.value)} autoFocus />
          </label>
          <fieldset className="category-checks">
            <legend>{t('categories')}</legend>
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
                {categoryLabel(category)}
              </label>
            ))}
          </fieldset>
          <div className="modal-actions">
            <button type="button" className="secondary" onClick={onClose}>
              {t('cancel')}
            </button>
            <button type="submit" disabled={!presetName.trim()}>
              <Save size={16} /> {t('savePreset')}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
