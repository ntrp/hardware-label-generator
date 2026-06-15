import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { standardsCatalog } from '../data/catalog';

const root = resolve(process.cwd());
const statusPath = resolve(root, 'research/catalog-assets/status.json');
const scriptPath = resolve(root, 'research/catalog-assets/scripts/catalog_assets.py');

interface CatalogAssetStatusEntry {
  catalogId: string;
  category: string;
  standardCodes: Record<string, string>;
  modelStatus: string;
  renderStatus: string;
  candidateSources: Array<Record<string, string>>;
  renderPaths: Record<string, string>;
  boltsparts: {
    collectionId: string;
    classId: string;
    dataPath: string;
    freecadPath: string;
    htmlUrl: string;
  } | null;
}

interface CatalogAssetStatus {
  version: number;
  entries: CatalogAssetStatusEntry[];
}

const readStatus = () => JSON.parse(readFileSync(statusPath, 'utf8')) as CatalogAssetStatus;

describe('catalog asset research status', () => {
  it('tracks every catalog entry by catalog id', () => {
    const status = readStatus();
    expect(status.version).toBe(1);
    expect(status.entries.map((entry) => entry.catalogId).sort()).toEqual(standardsCatalog.map((entry) => entry.id).sort());
  });

  it('keeps candidate source URLs for catalog entries with standard codes', () => {
    const status = readStatus();
    const din1587 = status.entries.find((entry) => entry.catalogId === 'din-1587');
    expect(din1587).toBeDefined();
    expect(din1587?.candidateSources[0]).toMatchObject({
      family: 'DIN',
      number: '1587',
      fastenersUrl: 'https://www.fasteners.eu/standards/DIN/1587/'
    });

    const customInsert = status.entries.find((entry) => entry.catalogId === 'threaded-insert');
    expect(customInsert?.candidateSources).toEqual([]);
  });

  it('mirrors Boltsparts/BOLTS data and FreeCAD generators locally', () => {
    for (const path of [
      'research/catalog-assets/boltsparts/LICENSE',
      'research/catalog-assets/boltsparts/Readme.rst',
      'research/catalog-assets/boltsparts/data/hex.blt',
      'research/catalog-assets/boltsparts/data/hex_socket.blt',
      'research/catalog-assets/boltsparts/data/nut.blt',
      'research/catalog-assets/boltsparts/data/washer.blt',
      'research/catalog-assets/boltsparts/freecad/hex/hex.py',
      'research/catalog-assets/boltsparts/freecad/hex_socket/hex_socket.py',
      'research/catalog-assets/boltsparts/freecad/nut/nut.py',
      'research/catalog-assets/boltsparts/freecad/washer/washer.py'
    ]) {
      expect(existsSync(resolve(root, path)), path).toBe(true);
    }
  });

  it('matches catalog standards to Boltsparts procedural model classes', () => {
    const status = readStatus();
    expect(status.entries.find((entry) => entry.catalogId === 'din-912')?.boltsparts).toMatchObject({
      collectionId: 'hex_socket',
      classId: 'hexsocketheadcap',
      dataPath: 'research/catalog-assets/boltsparts/data/hex_socket.blt'
    });
    expect(status.entries.find((entry) => entry.catalogId === 'din-931')?.boltsparts).toMatchObject({
      collectionId: 'hex',
      classId: 'hexbolt1',
      dataPath: 'research/catalog-assets/boltsparts/data/hex.blt'
    });
    expect(status.entries.find((entry) => entry.catalogId === 'din-934')?.boltsparts).toMatchObject({
      collectionId: 'nut',
      classId: 'hexagonnut1',
      dataPath: 'research/catalog-assets/boltsparts/data/nut.blt'
    });
    expect(status.entries.find((entry) => entry.catalogId === 'din-125')?.boltsparts).toMatchObject({
      collectionId: 'washer',
      classId: 'plainwasher1',
      dataPath: 'research/catalog-assets/boltsparts/data/washer.blt'
    });
  });

  it('can audit the research status without missing referenced files', () => {
    const output = execFileSync('python3', [scriptPath, 'audit'], { cwd: root, encoding: 'utf8' });
    const audit = JSON.parse(output) as { counts: { total: number }; errors: string[] };
    expect(audit.counts.total).toBe(standardsCatalog.length);
    expect(audit.errors).toEqual([]);
  });
});
