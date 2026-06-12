import type { StandardCatalogEntry } from '../types';

export const standardsCatalog: StandardCatalogEntry[] = [
  {
    id: 'din-912',
    category: 'screw',
    unitSystem: 'metric',
    family: 'DIN',
    code: 'DIN 912 / ISO 4762',
    standards: { DIN: 'DIN 912', ISO: 'ISO 4762', EN: 'EN ISO 4762' },
    description: 'Socket head cap screw',
    sizes: {
      metric: ['M2', 'M2.5', 'M3', 'M4', 'M5', 'M6', 'M8', 'M10', 'M12'],
      imperial: ['#2', '#3', '#4', '#6', '#8', '#10', '1/4"', '5/16"', '3/8"', '1/2"']
    },
    lengths: {
      metric: ['4', '6', '8', '10', '12', '16', '20', '25', '30', '40', '50'],
      imperial: ['5/32"', '1/4"', '5/16"', '3/8"', '1/2"', '5/8"', '3/4"', '1"', '1-1/4"', '1-1/2"', '2"']
    },
    materials: ['steel', 'alloy steel', 'stainless steel', 'brass'],
    pitches: {
      metric: ['0.4', '0.45', '0.5', '0.7', '0.8', '1.0', '1.25', '1.5', '1.75'],
      imperial: ['64 TPI', '56 TPI', '48 TPI', '40 TPI', '32 TPI', '28 TPI', '24 TPI', '20 TPI', '18 TPI', '16 TPI', '13 TPI']
    },
    specs: {
      materialType: ['plain', 'zinc plated', 'black oxide', 'A2', 'A4'],
      boltClass: ['4.8', '8.8', '10.9', '12.9', 'A2-70', 'A4-70', 'A4-80']
    },
    sourceId: 'iso-fastener-tables'
  },
  {
    id: 'din-933',
    category: 'bolt',
    unitSystem: 'metric',
    family: 'DIN',
    code: 'DIN 933 / ISO 4017',
    standards: { DIN: 'DIN 933', ISO: 'ISO 4017', EN: 'EN ISO 4017' },
    description: 'Hex head screw, full thread',
    sizes: {
      metric: ['M3', 'M4', 'M5', 'M6', 'M8', 'M10', 'M12', 'M16'],
      imperial: ['#4', '#6', '#8', '#10', '1/4"', '5/16"', '3/8"', '1/2"', '5/8"']
    },
    lengths: {
      metric: ['6', '8', '10', '12', '16', '20', '25', '30', '40', '50', '60', '80'],
      imperial: ['1/4"', '5/16"', '3/8"', '1/2"', '5/8"', '3/4"', '1"', '1-1/4"', '1-1/2"', '2"', '2-1/2"', '3"']
    },
    materials: ['steel', 'alloy steel', 'stainless steel'],
    pitches: {
      metric: ['0.5', '0.7', '0.8', '1.0', '1.25', '1.5', '1.75', '2.0'],
      imperial: ['40 TPI', '32 TPI', '24 TPI', '20 TPI', '18 TPI', '16 TPI', '13 TPI', '11 TPI']
    },
    specs: {
      materialType: ['plain', 'zinc plated', 'hot-dip galvanized', 'A2', 'A4'],
      boltClass: ['4.6', '4.8', '5.8', '8.8', '10.9', '12.9', 'A2-70', 'A4-70', 'A4-80']
    },
    sourceId: 'iso-fastener-tables'
  },
  {
    id: 'din-934',
    category: 'nut',
    unitSystem: 'metric',
    family: 'DIN',
    code: 'DIN 934 / ISO 4032',
    standards: { DIN: 'DIN 934', ISO: 'ISO 4032', EN: 'EN ISO 4032' },
    description: 'Hex nut',
    sizes: {
      metric: ['M2', 'M2.5', 'M3', 'M4', 'M5', 'M6', 'M8', 'M10', 'M12', 'M16'],
      imperial: ['#2', '#3', '#4', '#6', '#8', '#10', '1/4"', '5/16"', '3/8"', '1/2"', '5/8"']
    },
    lengths: {
      metric: ['standard'],
      imperial: ['standard']
    },
    materials: ['steel', 'stainless steel', 'brass'],
    pitches: {
      metric: ['0.4', '0.45', '0.5', '0.7', '0.8', '1.0', '1.25', '1.5', '1.75', '2.0'],
      imperial: ['56 TPI', '40 TPI', '32 TPI', '24 TPI', '20 TPI', '18 TPI', '16 TPI', '13 TPI', '11 TPI']
    },
    specs: {
      materialType: ['plain', 'zinc plated', 'hot-dip galvanized', 'A2', 'A4']
    },
    sourceId: 'iso-fastener-tables'
  },
  {
    id: 'din-125',
    category: 'washer',
    unitSystem: 'metric',
    family: 'DIN',
    code: 'DIN 125 / ISO 7089',
    standards: { DIN: 'DIN 125', ISO: 'ISO 7089', EN: 'EN ISO 7089' },
    description: 'Plain washer',
    sizes: {
      metric: ['M2', 'M2.5', 'M3', 'M4', 'M5', 'M6', 'M8', 'M10', 'M12', 'M16'],
      imperial: ['#2', '#3', '#4', '#6', '#8', '#10', '1/4"', '5/16"', '3/8"', '1/2"', '5/8"']
    },
    lengths: {
      metric: ['standard'],
      imperial: ['standard']
    },
    materials: ['steel', 'stainless steel', 'brass', 'nylon'],
    pitches: {
      metric: ['n/a'],
      imperial: ['n/a']
    },
    specs: {
      thickness: {
        metric: ['0.3 mm', '0.5 mm', '0.8 mm', '1 mm', '1.2 mm', '1.6 mm', '2 mm', '2.5 mm', '3 mm'],
        imperial: ['0.02"', '0.03"', '0.05"', '0.06"', '0.08"', '0.10"']
      },
      innerDiameter: {
        metric: ['2.2 mm', '2.7 mm', '3.2 mm', '4.3 mm', '5.3 mm', '6.4 mm', '8.4 mm', '10.5 mm', '13 mm', '17 mm'],
        imperial: ['0.09"', '0.11"', '0.14"', '0.17"', '0.20"', '0.26"', '0.34"', '0.41"', '0.53"', '0.66"']
      },
      outerDiameter: {
        metric: ['5 mm', '6 mm', '7 mm', '9 mm', '10 mm', '12 mm', '16 mm', '20 mm', '24 mm', '30 mm'],
        imperial: ['0.20"', '0.25"', '0.30"', '0.38"', '0.44"', '0.50"', '0.63"', '0.75"', '1"', '1.25"']
      },
      materialType: ['plain', 'zinc plated', 'hot-dip galvanized', 'A2', 'A4', 'natural', 'black']
    },
    sourceId: 'iso-fastener-tables'
  },
  {
    id: 'unc-socket-cap',
    category: 'screw',
    unitSystem: 'imperial',
    family: 'ANSI',
    code: 'ASME B18.3 UNC',
    standards: { ASME: 'ASME B18.3', ASTM: 'ASTM A574', SAE: 'SAE J429' },
    description: 'Socket head cap screw, inch series',
    sizes: {
      metric: ['M2 equivalent', 'M3 equivalent', 'M4 equivalent', 'M5 equivalent', 'M6 equivalent', 'M8 equivalent', 'M10 equivalent', 'M12 equivalent'],
      imperial: ['#2-56', '#4-40', '#6-32', '#8-32', '#10-24', '1/4-20', '5/16-18', '3/8-16', '1/2-13']
    },
    lengths: {
      metric: ['3', '5', '6', '10', '12', '20', '25', '38', '50'],
      imperial: ['1/8"', '3/16"', '1/4"', '3/8"', '1/2"', '3/4"', '1"', '1-1/2"', '2"']
    },
    materials: ['steel', 'alloy steel', 'stainless steel', 'brass'],
    pitches: {
      metric: ['0.45 mm approx', '0.64 mm approx', '0.79 mm approx', '1.06 mm approx', '1.27 mm approx', '1.41 mm approx', '1.59 mm approx', '1.95 mm approx'],
      imperial: ['56 TPI', '40 TPI', '32 TPI', '24 TPI', '20 TPI', '18 TPI', '16 TPI', '13 TPI']
    },
    specs: {
      materialType: ['plain', 'zinc plated', 'black oxide', '18-8', '316'],
      boltClass: ['grade 2', 'grade 5', 'grade 8', 'A2-70', 'A4-70', 'A4-80']
    },
    sourceId: 'asme-thread-reference'
  },
  {
    id: 'blind-rivet',
    category: 'rivet',
    unitSystem: 'metric',
    family: 'DIN',
    code: 'DIN 7337',
    standards: { DIN: 'DIN 7337', ISO: 'ISO 15977', EN: 'EN ISO 15977' },
    description: 'Blind rivet',
    sizes: {
      metric: ['2.4 mm', '3.0 mm', '3.2 mm', '4.0 mm', '4.8 mm', '6.4 mm'],
      imperial: ['3/32"', '1/8"', '5/32"', '3/16"', '1/4"']
    },
    lengths: {
      metric: ['6', '8', '10', '12', '14', '16', '20'],
      imperial: ['1/4"', '5/16"', '3/8"', '1/2"', '9/16"', '5/8"', '3/4"']
    },
    materials: ['aluminum', 'steel', 'stainless steel', 'copper'],
    pitches: {
      metric: ['n/a'],
      imperial: ['n/a']
    },
    specs: {
      gripRange: {
        metric: ['1-3 mm', '3-5 mm', '5-8 mm', '8-12 mm'],
        imperial: ['1/32-1/8"', '1/8-1/4"', '1/4-3/8"', '3/8-1/2"']
      },
      materialType: ['plain', 'zinc plated', 'A2', 'A4', 'natural']
    },
    sourceId: 'iso-fastener-tables'
  },
  {
    id: 'dowel-pin',
    category: 'pin',
    unitSystem: 'metric',
    family: 'ISO',
    code: 'ISO 8734',
    standards: { ISO: 'ISO 8734', DIN: 'DIN 6325', EN: 'EN ISO 8734', JIS: 'JIS B 1354' },
    description: 'Parallel dowel pin',
    sizes: {
      metric: ['2 mm', '3 mm', '4 mm', '5 mm', '6 mm', '8 mm', '10 mm'],
      imperial: ['1/16"', '3/32"', '1/8"', '3/16"', '1/4"', '5/16"', '3/8"']
    },
    lengths: {
      metric: ['6', '8', '10', '12', '16', '20', '24', '30', '40'],
      imperial: ['1/4"', '5/16"', '3/8"', '1/2"', '5/8"', '3/4"', '1"', '1-1/4"', '1-1/2"']
    },
    materials: ['steel', 'alloy steel', 'stainless steel'],
    pitches: {
      metric: ['n/a'],
      imperial: ['n/a']
    },
    specs: {
      materialType: ['plain', 'black oxide', 'zinc plated', 'A2', 'A4']
    },
    sourceId: 'iso-fastener-tables'
  },
  {
    id: 'threaded-insert',
    category: 'insert',
    unitSystem: 'metric',
    family: 'Generic',
    code: 'Heat-set insert',
    standards: {},
    description: 'Brass threaded insert for plastic',
    sizes: {
      metric: ['M2', 'M2.5', 'M3', 'M4', 'M5', 'M6'],
      imperial: ['#2', '#3', '#4', '#6', '#8', '#10', '1/4"']
    },
    lengths: {
      metric: ['3', '4', '5', '6', '8', '10', '12'],
      imperial: ['1/8"', '5/32"', '3/16"', '1/4"', '5/16"', '3/8"', '1/2"']
    },
    materials: ['brass', 'stainless steel'],
    pitches: {
      metric: ['0.4', '0.45', '0.5', '0.7', '0.8', '1.0'],
      imperial: ['56 TPI', '48 TPI', '40 TPI', '32 TPI', '24 TPI', '20 TPI']
    },
    specs: {
      materialType: ['plain', 'A2', 'A4']
    },
    sourceId: 'manufacturer-catalogs'
  },
  {
    id: 'wall-anchor',
    category: 'anchor',
    unitSystem: 'metric',
    family: 'Generic',
    code: 'Wall anchor',
    standards: {},
    description: 'Expansion wall anchor',
    sizes: {
      metric: ['5 mm', '6 mm', '8 mm', '10 mm'],
      imperial: ['#6', '#8', '#10', '1/4"', '5/16"', '3/8"']
    },
    lengths: {
      metric: ['20', '25', '30', '40', '50', '60'],
      imperial: ['3/4"', '1"', '1-1/4"', '1-1/2"', '2"', '2-1/2"']
    },
    materials: ['nylon', 'steel', 'stainless steel'],
    pitches: {
      metric: ['n/a'],
      imperial: ['n/a']
    },
    specs: {
      materialType: ['plain', 'natural', 'black', 'zinc plated', 'A2', 'A4']
    },
    sourceId: 'manufacturer-catalogs'
  },
  {
    id: 'retaining-clip',
    category: 'clip',
    unitSystem: 'metric',
    family: 'Generic',
    code: 'Retaining clip',
    standards: {},
    description: 'Assorted retaining and spring clips',
    sizes: {
      metric: ['small', 'medium', 'large', '3 mm', '6 mm', '8 mm', '10 mm'],
      imperial: ['small', 'medium', 'large', '1/8"', '1/4"', '3/8"']
    },
    lengths: {
      metric: ['standard'],
      imperial: ['standard']
    },
    materials: ['steel', 'stainless steel'],
    pitches: {
      metric: ['n/a'],
      imperial: ['n/a']
    },
    specs: {
      materialType: ['plain', 'zinc plated', 'black oxide', 'A2', 'A4']
    },
    sourceId: 'manufacturer-catalogs'
  }
];
