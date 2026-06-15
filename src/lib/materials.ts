export const materialTreatmentOptions = {
  steel: ['low carbon', 'medium carbon', 'high carbon'],
  'carbon steel': ['low carbon', 'medium carbon', 'high carbon'],
  'alloy steel': ['alloy steel'],
  'spring steel': ['spring steel'],
  'weathering steel': ['plain', 'type 3'],
  'tool steel': ['tool steel'],
  'stainless steel': ['A1', 'A2', 'A4', '18-8', '304', '316', '410'],
  brass: ['plain'],
  bronze: ['silicon bronze', 'phosphor bronze', 'aluminum bronze'],
  'silicon bronze': ['plain'],
  'phosphor bronze': ['plain'],
  'aluminum bronze': ['plain'],
  copper: ['plain'],
  'beryllium copper': ['plain'],
  'copper nickel': ['plain', '90-10', '70-30'],
  aluminum: ['plain', '6061', '7075'],
  titanium: ['grade 2', 'grade 5'],
  nickel: ['plain', '200', '201'],
  'nickel alloy': ['plain', 'inconel', 'monel', 'hastelloy', 'incoloy'],
  inconel: ['plain', '600', '625', '686', '718', 'x-750'],
  monel: ['plain', '400', '405', 'k-500'],
  hastelloy: ['plain', 'c-22', 'c-276'],
  incoloy: ['plain', '800', '825'],
  'a-286': ['plain', 'passivated'],
  waspaloy: ['plain'],
  mp35n: ['plain'],
  zirconium: ['plain', '702', '705'],
  tantalum: ['plain'],
  niobium: ['plain'],
  molybdenum: ['plain'],
  nylon: ['nylon'],
  'nylon 6': ['nylon 6'],
  'nylon 6/6': ['nylon 6/6'],
  pom: ['pom'],
  acetal: ['acetal'],
  ptfe: ['ptfe'],
  pfa: ['pfa'],
  pvdf: ['pvdf'],
  peek: ['peek'],
  pps: ['pps'],
  polycarbonate: ['polycarbonate'],
  polypropylene: ['polypropylene'],
  polyethylene: ['polyethylene'],
  pvc: ['pvc'],
  abs: ['abs'],
  phenolic: ['phenolic'],
  fiberglass: ['plain', 'g10', 'fr4'],
  'carbon fiber': ['plain'],
  ceramic: ['plain', 'alumina', 'zirconia', 'silicon nitride'],
  rubber: ['plain', 'neoprene', 'epdm', 'silicone'],
  fiber: ['plain'],
  felt: ['plain'],
  leather: ['plain'],
  mica: ['plain']
} as const;

export type BaseMaterial = keyof typeof materialTreatmentOptions;

export const baseMaterials = Object.keys(materialTreatmentOptions) as BaseMaterial[];

export const materialFinishOptions: Record<BaseMaterial, string[]> = {
  steel: ['plain', 'zinc plated', 'yellow zinc plated', 'hot-dip galvanized', 'mechanically galvanized', 'zinc flake', 'black oxide', 'phosphate', 'nickel plated', 'chrome plated', 'cadmium plated'],
  'carbon steel': ['plain', 'zinc plated', 'yellow zinc plated', 'hot-dip galvanized', 'mechanically galvanized', 'zinc flake', 'black oxide', 'phosphate', 'nickel plated', 'chrome plated', 'cadmium plated'],
  'alloy steel': ['plain', 'black oxide', 'zinc plated', 'phosphate', 'zinc flake'],
  'spring steel': ['plain', 'zinc plated', 'phosphate', 'black oxide'],
  'weathering steel': ['plain'],
  'tool steel': ['plain', 'black oxide'],
  'stainless steel': ['plain', 'passivated', 'black oxide'],
  brass: ['plain', 'nickel plated', 'chrome plated'],
  bronze: ['plain', 'nickel plated'],
  'silicon bronze': ['plain'],
  'phosphor bronze': ['plain'],
  'aluminum bronze': ['plain'],
  copper: ['plain', 'nickel plated'],
  'beryllium copper': ['plain'],
  'copper nickel': ['plain'],
  aluminum: ['plain', 'anodized', 'clear anodized', 'black anodized'],
  titanium: ['plain', 'anodized'],
  nickel: ['plain'],
  'nickel alloy': ['plain'],
  inconel: ['plain', 'passivated'],
  monel: ['plain'],
  hastelloy: ['plain'],
  incoloy: ['plain'],
  'a-286': ['plain', 'passivated'],
  waspaloy: ['plain'],
  mp35n: ['plain'],
  zirconium: ['plain'],
  tantalum: ['plain'],
  niobium: ['plain'],
  molybdenum: ['plain'],
  nylon: ['natural', 'black'],
  'nylon 6': ['natural', 'black'],
  'nylon 6/6': ['natural', 'black'],
  pom: ['natural', 'black'],
  acetal: ['natural', 'black'],
  ptfe: ['natural'],
  pfa: ['natural'],
  pvdf: ['natural'],
  peek: ['natural', 'black'],
  pps: ['natural', 'black'],
  polycarbonate: ['clear', 'black'],
  polypropylene: ['natural', 'black'],
  polyethylene: ['natural', 'black'],
  pvc: ['natural', 'gray'],
  abs: ['natural', 'black'],
  phenolic: ['natural'],
  fiberglass: ['plain'],
  'carbon fiber': ['plain'],
  ceramic: ['plain'],
  rubber: ['black'],
  fiber: ['plain'],
  felt: ['plain'],
  leather: ['plain'],
  mica: ['plain']
};

export const getMaterialTreatmentOptions = (material: string) =>
  materialTreatmentOptions[material.toLowerCase() as BaseMaterial] ? [...materialTreatmentOptions[material.toLowerCase() as BaseMaterial]] : [];

export const defaultMaterialTreatment = (material: string) => getMaterialTreatmentOptions(material)[0] ?? '';

export const isValidMaterialTreatment = (material: string, treatment: string) => {
  if (!treatment) return true;
  return getMaterialTreatmentOptions(material).some((option) => option === treatment);
};

export const getFinishOptions = (material: string) =>
  materialFinishOptions[material.toLowerCase() as BaseMaterial] ? [...materialFinishOptions[material.toLowerCase() as BaseMaterial]] : ['plain'];

export const getAllFinishOptions = () => [...new Set(Object.values(materialFinishOptions).flat())];

export const defaultFinish = (material: string) => getFinishOptions(material)[0] ?? '';

export const isValidFinish = (material: string, finish: string) => {
  if (!finish) return true;
  return getFinishOptions(material).some((option) => option === finish);
};
