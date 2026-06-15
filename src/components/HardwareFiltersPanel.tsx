import { useState } from 'react';
import { ChevronDown, ChevronRight, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { standardsCatalog } from '../data/catalog';
import { useAppState } from '../app/AppStateContext';
import { uniqueValues } from '../lib/labelLayout';
import { catalogMatchesSelectedFilters, standardFamilies } from '../lib/standards';
import { hardwareCategories } from './hardware/hardwareConstants';
import type { AppState, HardwareCategory, StandardFamily } from '../types';

const catalogCategoryOptions = hardwareCategories.filter((category) =>
  standardsCatalog.some((entry) => entry.category === category)
);

const categoryLabel = (category: HardwareCategory) => category[0].toUpperCase() + category.slice(1);

export function HardwareFiltersPanel() {
  const { setState, state } = useAppState();
  const [collapsed, setCollapsed] = useState(() => state.selectedStandards.length === 0 && state.selectedCategories.length === 0);
  const filteredCount = standardsCatalog.filter((entry) =>
    catalogMatchesSelectedFilters(entry, state.selectedStandards, state.selectedCategories)
  ).length;
  const activeFilterCount = state.selectedStandards.length + state.selectedCategories.length;

  const updateFilters = (buildFilters: (current: AppState) => Pick<AppState, 'selectedStandards' | 'selectedCategories'>) => {
    setState((current) => {
      const { selectedStandards, selectedCategories } = buildFilters(current);

      return {
        ...current,
        selectedStandards,
        selectedCategories
      };
    });
  };

  const updateStandardFilter = (family: StandardFamily, checked: boolean) => {
    updateFilters((current) => ({
      selectedStandards: checked
        ? uniqueValues([...current.selectedStandards, family]) as AppState['selectedStandards']
        : current.selectedStandards.filter((entry) => entry !== family),
      selectedCategories: current.selectedCategories
    }));
  };

  const updateCategoryFilter = (category: HardwareCategory, checked: boolean) => {
    updateFilters((current) => ({
      selectedStandards: current.selectedStandards,
      selectedCategories: checked
        ? uniqueValues([...current.selectedCategories, category]) as AppState['selectedCategories']
        : current.selectedCategories.filter((entry) => entry !== category)
    }));
  };

  const clearFilters = () => updateFilters(() => ({ selectedStandards: [], selectedCategories: [] }));

  return (
    <section className={collapsed ? 'panel editor-panel filter-panel collapsed' : 'panel editor-panel filter-panel'}>
      <div className="panel-title filter-panel-title">
        <span className="panel-title-main">
          <SlidersHorizontal size={18} />
          <h2>Filters</h2>
        </span>
        <span className="filter-title-actions">
          <span className="filter-count">{activeFilterCount > 0 ? `${filteredCount} parts` : 'All parts'}</span>
          <button
            type="button"
            className="icon-button small"
            title={collapsed ? 'Expand filters' : 'Collapse filters'}
            aria-label={collapsed ? 'Expand filters' : 'Collapse filters'}
            aria-expanded={!collapsed}
            aria-controls="hardware-filter-controls"
            onClick={() => setCollapsed((current) => !current)}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
          </button>
        </span>
      </div>

      {!collapsed && (
        <div id="hardware-filter-controls" className="filter-panel-body">
          <div className="filter-grid">
            <fieldset className="filter-group">
              <legend>Standards</legend>
              <div className="filter-options">
                {standardFamilies.map((family) => (
                  <label key={family} className="filter-option">
                    <input
                      type="checkbox"
                      checked={state.selectedStandards.includes(family)}
                      onChange={(event) => updateStandardFilter(family, event.target.checked)}
                    />
                    <span>{family}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="filter-group">
              <legend>Categories</legend>
              <div className="filter-options">
                {catalogCategoryOptions.map((category) => (
                  <label key={category} className="filter-option">
                    <input
                      type="checkbox"
                      checked={state.selectedCategories.includes(category)}
                      onChange={(event) => updateCategoryFilter(category, event.target.checked)}
                    />
                    <span>{categoryLabel(category)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          {activeFilterCount > 0 && (
            <div className="filter-actions">
              <button type="button" className="secondary compact-button" onClick={clearFilters}>
                <RotateCcw size={15} /> Clear filters
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
