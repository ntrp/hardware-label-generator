export interface ImperialThreadPitch {
  size: string;
  series: 'UNC' | 'UNF';
  tpi: string;
}

const imperialThreadPitchRows: Array<[string, string | undefined, string | undefined]> = [
  ['#0', undefined, '80'],
  ['#1', '64', '72'],
  ['#2', '56', '64'],
  ['#3', '48', '56'],
  ['#4', '40', '48'],
  ['#5', '40', '44'],
  ['#6', '32', '40'],
  ['#8', '32', '36'],
  ['#10', '24', '32'],
  ['#12', '24', '28'],
  ['1/4"', '20', '28'],
  ['5/16"', '18', '24'],
  ['3/8"', '16', '24'],
  ['7/16"', '14', '20'],
  ['1/2"', '13', '20'],
  ['9/16"', '12', '18'],
  ['5/8"', '11', '18'],
  ['3/4"', '10', '16'],
  ['7/8"', '9', '14'],
  ['1"', '8', '12'],
  ['1-1/8"', '7', '12'],
  ['1-1/4"', '7', '12'],
  ['1-3/8"', '6', '12'],
  ['1-1/2"', '6', '12']
];

export const imperialThreadPitches: ImperialThreadPitch[] = imperialThreadPitchRows.flatMap(([size, unc, unf]) => [
  ...(unc ? [{ size, series: 'UNC' as const, tpi: unc }] : []),
  ...(unf ? [{ size, series: 'UNF' as const, tpi: unf }] : [])
]);

export const isUnifiedImperialThreadPitchList = (pitches: string[]) => pitches.some((value) => /\bTPI\b/i.test(value));

const normalizeImperialNominalSize = (value: string) => {
  const trimmed = value.trim();
  const withoutPitch = trimmed.match(/^(.+)-(\d+)$/)?.[1] ?? trimmed;
  if (withoutPitch.startsWith('#')) return withoutPitch;
  return withoutPitch.endsWith('"') ? withoutPitch : `${withoutPitch}"`;
};

const exactImperialTpi = (value: string) => value.trim().match(/^.+-(\d+)$/)?.[1];

export const imperialThreadPitchesForSize = (size: string) => {
  const nominalSize = normalizeImperialNominalSize(size);
  const exactTpi = exactImperialTpi(size);
  return imperialThreadPitches.filter((entry) => entry.size === nominalSize && (!exactTpi || entry.tpi === exactTpi));
};

export const formatImperialThreadPitchOption = (entry: ImperialThreadPitch) => `${entry.series} (${entry.tpi} TPI)`;

export const imperialThreadPitchNamesForSize = (size: string) =>
  imperialThreadPitchesForSize(size).map(formatImperialThreadPitchOption);

export const findImperialThreadPitch = (size: string, nameOrValue: string) => {
  const normalized = nameOrValue.trim().toUpperCase();
  return imperialThreadPitchesForSize(size).find(
    (entry) =>
      formatImperialThreadPitchOption(entry).toUpperCase() === normalized ||
      entry.series === normalized ||
      entry.tpi === normalized ||
      `${entry.tpi} TPI` === normalized
  );
};

export const defaultImperialThreadPitch = (size: string) => imperialThreadPitchesForSize(size)[0];
