export interface MetricThreadPitch {
  size: string;
  name: string;
  value: string;
}

const metricThreadPitchRows: Array<[string, string, string?, string?, string?]> = [
  ['M1', '0.25', '0.20'],
  ['M1.2', '0.25', '0.20'],
  ['M1.4', '0.30', '0.20'],
  ['M1.6', '0.35', '0.20'],
  ['M1.7', '0.35'],
  ['M1.8', '0.35', '0.20'],
  ['M2', '0.40', '0.25'],
  ['M2.2', '0.45', '0.25'],
  ['M2.3', '0.40'],
  ['M2.5', '0.45', '0.35'],
  ['M2.6', '0.45'],
  ['M3', '0.50', '0.35'],
  ['M3.5', '0.60', '0.35'],
  ['M4', '0.70', '0.50'],
  ['M5', '0.80', '0.50'],
  ['M6', '1.00', '0.75'],
  ['M7', '1.00', '0.75'],
  ['M8', '1.25', '1.00', '0.75'],
  ['M9', '1.25', '1.00', '0.75'],
  ['M10', '1.50', '1.25', '1.00', '0.75'],
  ['M11', '1.50', '1.00', '0.75'],
  ['M12', '1.75', '1.50', '1.25', '1.00'],
  ['M14', '2.00', '1.50', '1.25', '1.00'],
  ['M16', '2.00', '1.50', '1.00'],
  ['M18', '2.50', '2.00', '1.50', '1.00'],
  ['M20', '2.50', '2.00', '1.50', '1.00'],
  ['M22', '2.50', '2.00', '1.50', '1.00'],
  ['M24', '3.00', '2.00', '1.50', '1.00'],
  ['M27', '3.00', '2.00', '1.50', '1.00'],
  ['M30', '3.50', '3.00', '2.00', '1.50'],
  ['M33', '3.50', '3.00', '2.00', '1.50'],
  ['M36', '4.00', '3.00', '2.00', '1.50'],
  ['M39', '4.00', '3.00', '2.00', '1.50'],
  ['M42', '4.50', '4.00', '3.00', '2.00'],
  ['M45', '4.50', '4.00', '3.00', '2.00'],
  ['M48', '5.00', '4.00', '3.00', '2.00'],
  ['M52', '5.00', '4.00', '3.00', '2.00'],
  ['M56', '5.50', '4.00', '3.00', '2.00'],
  ['M60', '5.50', '4.00', '3.00', '2.00'],
  ['M64', '6.00', '4.00', '3.00', '2.00'],
  ['M68', '6.00', '4.00', '3.00', '2.00'],
  ['M72', '6.00', '4.00', '3.00', '2.00'],
  ['M80', '6.00', '4.00', '3.00', '2.00'],
  ['M90', '6.00', '4.00', '3.00', '2.00'],
  ['M100', '6.00', '4.00', '3.00', '2.00']
];

const fineNames = ['fine', 'extra fine', 'extra fine 2'];

export const metricThreadSizes = metricThreadPitchRows.map(([size]) => size);

export const metricThreadPitches: MetricThreadPitch[] = metricThreadPitchRows.flatMap(([size, coarse, ...fineValues]) => [
  { size, name: 'coarse', value: coarse },
  ...fineValues.filter(Boolean).map((value, index) => ({
    size,
    name: fineNames[index] ?? `extra fine ${index}`,
    value: value as string
  }))
]);

export const metricThreadPitchesForSize = (size: string) =>
  metricThreadPitches.filter((entry) => entry.size.toLowerCase() === size.trim().toLowerCase());

export const formatMetricThreadPitchOption = (entry: MetricThreadPitch) => `${entry.name} (${entry.value})`;

export const metricThreadPitchNamesForSize = (size: string) =>
  metricThreadPitchesForSize(size).map(formatMetricThreadPitchOption);

export const findMetricThreadPitch = (size: string, nameOrValue: string) =>
  metricThreadPitchesForSize(size).find((entry) => formatMetricThreadPitchOption(entry) === nameOrValue || entry.name === nameOrValue || entry.value === nameOrValue);

export const defaultMetricThreadPitch = (size: string) => metricThreadPitchesForSize(size)[0];
