import { useState } from 'react';
import { standardsCatalog } from '../data/catalog';
import { useI18n } from '../lib/i18n';
import {
  catalogAssetUrlForEntry,
  missingCatalogAssetDataUrl
} from '../lib/standardImages';
import { combinedStandardCode } from '../lib/standards';
import type { AppState, StandardCatalogEntry } from '../types';

const catalogSearchText = (entry: StandardCatalogEntry, selectedStandards: AppState['selectedStandards'], localizedDescription: string) =>
  [
    entry.id,
    entry.family,
    entry.code,
    combinedStandardCode(entry.standards, selectedStandards),
    ...Object.values(entry.standards),
    entry.category,
    entry.description,
    localizedDescription
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

const catalogStandardsTitle = (entry: StandardCatalogEntry) => combinedStandardCode(entry.standards) || entry.code;

const fuzzyScore = (text: string, query: string) => {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return 1;
  const terms = normalizedQuery.split(/\s+/).filter(Boolean);
  let score = 0;

  for (const term of terms) {
    const index = text.indexOf(term);
    if (index >= 0) {
      score += 100 - Math.min(index, 60);
      continue;
    }

    let cursor = 0;
    let matched = 0;
    for (const character of term) {
      const nextIndex = text.indexOf(character, cursor);
      if (nextIndex === -1) break;
      matched += 1;
      cursor = nextIndex + 1;
    }

    if (matched !== term.length) return 0;
    score += matched * 3;
  }

  return score;
};

const drawingKindForEntry = (entry: StandardCatalogEntry) => {
  const text = `${entry.code} ${entry.description}`.toLowerCase();
  if (entry.category === 'washer') return text.includes('spring') || text.includes('lock') || text.includes('conical') ? 'lock-washer' : 'washer';
  if (entry.category === 'nut') return text.includes('cap') ? 'cap-nut' : text.includes('flange') ? 'flange-nut' : 'nut';
  if (entry.category === 'pin') return text.includes('cotter') || text.includes('split') ? 'cotter-pin' : text.includes('spring') || text.includes('coiled') || text.includes('slotted') ? 'spring-pin' : 'pin';
  if (entry.category === 'rivet') return 'rivet';
  if (entry.category === 'clip') return 'clip';
  if (entry.category === 'anchor') return 'anchor';
  if (entry.category === 'insert') return 'insert';
  if (text.includes('countersunk')) return 'countersunk-screw';
  if (text.includes('button')) return 'button-screw';
  if (text.includes('set screw')) return 'set-screw';
  if (text.includes('hex head') || text.includes('hex cap') || entry.category === 'bolt') return 'hex-bolt';
  return 'socket-screw';
};

const CatalogDrawing = ({ entry, description }: { entry: StandardCatalogEntry; description: string }) => {
  const sideUrl = catalogAssetUrlForEntry(entry, 'side');
  if (sideUrl) {
    return <img className="catalog-drawing" src={sideUrl} alt={`${description} side drawing`} loading="lazy" onError={(event) => { event.currentTarget.src = missingCatalogAssetDataUrl('Side drawing'); }} />;
  }

  const kind = drawingKindForEntry(entry);

  return (
    <svg className="catalog-drawing" viewBox="0 0 80 44" role="img" aria-label={`${description} drawing`}>
      <rect x="0" y="0" width="80" height="44" rx="4" fill="#f8fafb" />
      {kind === 'washer' && (
        <>
          <circle cx="40" cy="22" r="16" fill="none" stroke="#1f2933" strokeWidth="3" />
          <circle cx="40" cy="22" r="7" fill="none" stroke="#1f2933" strokeWidth="3" />
        </>
      )}
      {kind === 'lock-washer' && (
        <>
          <path d="M24 22a16 16 0 1 1 29 9" fill="none" stroke="#1f2933" strokeWidth="3" />
          <path d="M49 12l8-5M24 32l8-5" stroke="#1f2933" strokeWidth="3" strokeLinecap="round" />
        </>
      )}
      {(kind === 'nut' || kind === 'flange-nut' || kind === 'cap-nut') && (
        <>
          {kind === 'flange-nut' && <rect x="18" y="28" width="44" height="5" fill="#1f2933" />}
          <polygon points="25,12 55,12 66,22 55,32 25,32 14,22" fill="none" stroke="#1f2933" strokeWidth="3" />
          <circle cx="40" cy="22" r="7" fill="none" stroke="#1f2933" strokeWidth="3" />
          {kind === 'cap-nut' && <path d="M27 14q13-13 26 0" fill="none" stroke="#1f2933" strokeWidth="3" />}
        </>
      )}
      {(kind === 'pin' || kind === 'spring-pin' || kind === 'cotter-pin') && (
        <>
          <rect x="15" y="17" width="50" height="10" rx="5" fill="none" stroke="#1f2933" strokeWidth="3" />
          {kind === 'spring-pin' && <path d="M24 17v10M35 17v10M46 17v10M57 17v10" stroke="#1f2933" strokeWidth="2" />}
          {kind === 'cotter-pin' && <path d="M58 17q12 5 0 10M22 17v10" fill="none" stroke="#1f2933" strokeWidth="3" />}
        </>
      )}
      {kind === 'rivet' && (
        <>
          <path d="M18 22h36" stroke="#1f2933" strokeWidth="8" strokeLinecap="round" />
          <circle cx="18" cy="22" r="10" fill="none" stroke="#1f2933" strokeWidth="3" />
          <path d="M54 16l12 6-12 6" fill="none" stroke="#1f2933" strokeWidth="3" strokeLinejoin="round" />
        </>
      )}
      {kind === 'clip' && <path d="M24 14h30q8 0 8 8t-8 8H28q-9 0-9-8t9-8" fill="none" stroke="#1f2933" strokeWidth="4" strokeLinecap="round" />}
      {kind === 'anchor' && (
        <>
          <path d="M16 22h48" stroke="#1f2933" strokeWidth="8" strokeLinecap="round" />
          <path d="M31 12l8 20 8-20" fill="none" stroke="#1f2933" strokeWidth="3" />
        </>
      )}
      {kind === 'insert' && (
        <>
          <rect x="24" y="10" width="32" height="24" rx="4" fill="none" stroke="#1f2933" strokeWidth="3" />
          <path d="M30 15h20M30 22h20M30 29h20" stroke="#1f2933" strokeWidth="2" />
        </>
      )}
      {['hex-bolt', 'socket-screw', 'countersunk-screw', 'button-screw', 'set-screw'].includes(kind) && (
        <>
          {kind === 'hex-bolt' && <polygon points="10,14 24,14 30,22 24,30 10,30 4,22" fill="none" stroke="#1f2933" strokeWidth="3" />}
          {kind === 'socket-screw' && <rect x="6" y="12" width="20" height="20" rx="4" fill="none" stroke="#1f2933" strokeWidth="3" />}
          {kind === 'countersunk-screw' && <path d="M6 12h24l-8 20h-8z" fill="none" stroke="#1f2933" strokeWidth="3" />}
          {kind === 'button-screw' && <path d="M6 24q10-18 24 0v6H6z" fill="none" stroke="#1f2933" strokeWidth="3" />}
          {kind === 'set-screw' && <rect x="9" y="16" width="48" height="12" rx="2" fill="none" stroke="#1f2933" strokeWidth="3" />}
          {kind !== 'set-screw' && <rect x="28" y="18" width="42" height="8" fill="none" stroke="#1f2933" strokeWidth="3" />}
          <path d="M37 18v8M46 18v8M55 18v8M64 18v8" stroke="#1f2933" strokeWidth="2" />
        </>
      )}
    </svg>
  );
};

interface CatalogPartPickerProps {
  entries: StandardCatalogEntry[];
  selectedId: string;
  selectedStandards: AppState['selectedStandards'];
  onSelect: (id: string) => void;
  includeCustom?: boolean;
}

export function CatalogPartPicker({ entries, selectedId, selectedStandards, onSelect, includeCustom = false }: CatalogPartPickerProps) {
  const { catalogDescription, categoryLabel, t } = useI18n();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const selectedEntry = standardsCatalog.find((entry) => entry.id === selectedId);
  const selectedDescription = selectedEntry ? catalogDescription(selectedEntry.description) : '';
  const matches = entries
    .map((entry) => {
      const description = catalogDescription(entry.description);
      return { entry, description, score: fuzzyScore(catalogSearchText(entry, selectedStandards, description), query) };
    })
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || left.entry.code.localeCompare(right.entry.code))
    .slice(0, 80);

  return (
    <div className="catalog-picker" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) {
        setOpen(false);
      }
    }}>
      <button type="button" className="catalog-picker-button" onClick={() => setOpen((current) => !current)}>
        {selectedEntry ? <CatalogDrawing entry={selectedEntry} description={selectedDescription} /> : <span className="catalog-custom-drawing">{t('custom')}</span>}
        <span>
          <strong>{selectedEntry ? catalogStandardsTitle(selectedEntry) : t('customItem')}</strong>
          <small>{selectedEntry ? selectedDescription : t('freeTextCompletions')}</small>
        </span>
      </button>
      {open && (
        <div className="catalog-picker-popover">
          <input
            autoFocus
            value={query}
            placeholder={t('searchStandard')}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="catalog-picker-list">
            {includeCustom && (
              <button
                type="button"
                className={!selectedId ? 'catalog-picker-row active' : 'catalog-picker-row'}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onSelect('');
                  setOpen(false);
                  setQuery('');
                }}
              >
                <span className="catalog-custom-drawing">{t('custom')}</span>
                <span>
                  <strong>{t('customItem')}</strong>
                  <small>{t('freeTextCompletions')}</small>
                </span>
              </button>
            )}
            {matches.map(({ entry, description }) => (
              <button
                type="button"
                key={entry.id}
                className={entry.id === selectedId ? 'catalog-picker-row active' : 'catalog-picker-row'}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onSelect(entry.id);
                  setOpen(false);
                  setQuery('');
                }}
              >
                <CatalogDrawing entry={entry} description={description} />
                <span>
                  <strong>{catalogStandardsTitle(entry)}</strong>
                  <small>{description}</small>
                </span>
                <em>{categoryLabel(entry.category)}</em>
              </button>
            ))}
            {matches.length === 0 && <p className="catalog-empty">{t('noCatalogParts')}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
