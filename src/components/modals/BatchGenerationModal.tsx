import { Archive, Plus, X } from 'lucide-react';
import { parseList } from '../../lib/format';
import { CatalogPartPicker } from '../CatalogPartPicker';
import type { AppState, HardwareSpecKey, StandardCatalogEntry } from '../../types';

interface SpecDefinition {
  key: HardwareSpecKey;
  label: string;
}

interface BatchGenerationModalProps {
  batchCatalogEntry: StandardCatalogEntry;
  batchCombinationSpecDefinitions: SpecDefinition[];
  batchSpecDefinitions: SpecDefinition[];
  batchSpecs: AppState['batchSpecs'];
  filteredCatalog: StandardCatalogEntry[];
  selectedStandards: AppState['selectedStandards'];
  onBatchWasherDimensionValue: (key: HardwareSpecKey) => string;
  onClose: () => void;
  onCreateBatch: () => void;
  onIsBatchReadonlyWasherDimension: (key: HardwareSpecKey) => boolean;
  onUpdateBatchCatalog: (entryId: string) => void;
  onUpdateBatchSpec: (key: HardwareSpecKey, value: string) => void;
}

export function BatchGenerationModal({
  batchCatalogEntry,
  batchCombinationSpecDefinitions,
  batchSpecDefinitions,
  batchSpecs,
  filteredCatalog,
  selectedStandards,
  onBatchWasherDimensionValue,
  onClose,
  onCreateBatch,
  onIsBatchReadonlyWasherDimension,
  onUpdateBatchCatalog,
  onUpdateBatchSpec
}: BatchGenerationModalProps) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="batch-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div className="panel-title-main">
            <Archive size={18} />
            <h2 id="batch-modal-title">Batch generation</h2>
          </div>
          <button type="button" className="icon-button small" title="Close batch generation" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="batch-grid">
          <label>
            Catalog
            <CatalogPartPicker
              entries={filteredCatalog}
              selectedId={batchCatalogEntry.id}
              selectedStandards={selectedStandards}
              onSelect={onUpdateBatchCatalog}
            />
          </label>
          {batchSpecDefinitions.map((definition) => {
            const readonlyDimension = onIsBatchReadonlyWasherDimension(definition.key);
            return (
              <label key={definition.key}>
                {definition.label}
                <textarea
                  value={readonlyDimension ? onBatchWasherDimensionValue(definition.key) : batchSpecs[definition.key] ?? ''}
                  readOnly={readonlyDimension}
                  onChange={(event) => onUpdateBatchSpec(definition.key, event.target.value)}
                />
              </label>
            );
          })}
        </div>
        <p className="storage-note">
          {batchCombinationSpecDefinitions
            .map((definition) => `${parseList(batchSpecs[definition.key] ?? '').length || 1} ${definition.label.toLowerCase()}`)
            .join(' × ')}{' '}
          ={' '}
          {batchCombinationSpecDefinitions.reduce(
            (total, definition) => total * Math.max(1, parseList(batchSpecs[definition.key] ?? '').length),
            1
          )}{' '}
          labels
        </p>
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" onClick={onCreateBatch}>
            <Plus size={16} /> Generate combinations
          </button>
        </div>
      </section>
    </div>
  );
}
