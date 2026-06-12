export const materialTreatmentOptions = {
  steel: [
    'plain',
    'zinc plated',
    'yellow zinc plated',
    'hot-dip galvanized',
    'mechanically galvanized',
    'zinc flake',
    'black oxide',
    'phosphate',
    'nickel plated',
    'chrome plated',
    'cadmium plated'
  ],
  'alloy steel': ['plain', 'black oxide', 'zinc plated', 'phosphate', 'zinc flake'],
  'stainless steel': ['A1', 'A2', 'A4', '18-8', '304', '316', '410', 'passivated', 'plain'],
  brass: ['plain', 'nickel plated', 'chrome plated'],
  bronze: ['plain', 'silicon bronze', 'phosphor bronze'],
  copper: ['plain', 'nickel plated'],
  aluminum: ['plain', 'anodized', 'clear anodized', 'black anodized'],
  titanium: ['plain', 'grade 2', 'grade 5', 'anodized'],
  nylon: ['plain', 'natural', 'black'],
  pom: ['plain', 'natural', 'black'],
  ptfe: ['plain', 'natural'],
  polypropylene: ['plain', 'natural', 'black']
} as const;

export type BaseMaterial = keyof typeof materialTreatmentOptions;

export const baseMaterials = Object.keys(materialTreatmentOptions) as BaseMaterial[];

export const getMaterialTreatmentOptions = (material: string) =>
  materialTreatmentOptions[material.toLowerCase() as BaseMaterial] ? [...materialTreatmentOptions[material.toLowerCase() as BaseMaterial]] : [];

export const defaultMaterialTreatment = (material: string) => getMaterialTreatmentOptions(material)[0] ?? '';

export const isValidMaterialTreatment = (material: string, treatment: string) => {
  if (!treatment) return true;
  return getMaterialTreatmentOptions(material).some((option) => option === treatment);
};
