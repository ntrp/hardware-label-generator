import type { StandardCatalogEntry } from '../types';
import { metricThreadSizes } from '../lib/metricThreads';

const metricMachineSizes = metricThreadSizes;
const metricStructuralSizes = metricThreadSizes.filter((size) => !['M1', 'M1.2', 'M1.4', 'M1.6', 'M1.7', 'M1.8', 'M2', 'M2.2', 'M2.3', 'M2.5', 'M2.6', 'M3', 'M3.5', 'M4'].includes(size));
const metricLengths = ['4', '5', '6', '8', '10', '12', '16', '20', '25', '30', '35', '40', '45', '50', '60', '70', '80', '100', '120', '160'];
const metricShortLengths = ['3', '4', '5', '6', '8', '10', '12', '16', '20', '25', '30', '35', '40'];
const metricCoarsePitches = ['0.35', '0.4', '0.45', '0.5', '0.7', '0.8', '1.0', '1.25', '1.5', '1.75', '2.0', '2.5', '3.0'];
const metricFinePitches = ['0.35', '0.5', '0.75', '1.0', '1.25', '1.5', '2.0', '3.0', '4.0'];
const inchMachineSizes = ['#0-80', '#1-64', '#2-56', '#3-48', '#4-40', '#5-40', '#6-32', '#8-32', '#10-24', '1/4-20', '5/16-18', '3/8-16', '1/2-13'];
const inchFineSizes = ['#0-80', '#1-72', '#2-64', '#3-56', '#4-48', '#5-44', '#6-40', '#8-36', '#10-32', '1/4-28', '5/16-24', '3/8-24', '1/2-20'];
const inchLengths = ['1/8"', '3/16"', '1/4"', '5/16"', '3/8"', '1/2"', '5/8"', '3/4"', '1"', '1-1/4"', '1-1/2"', '2"', '2-1/2"', '3"', '4"'];
const inchPitches = ['80 TPI', '72 TPI', '64 TPI', '56 TPI', '48 TPI', '44 TPI', '40 TPI', '36 TPI', '32 TPI', '28 TPI', '24 TPI', '20 TPI', '18 TPI', '16 TPI', '13 TPI'];
const steelStainlessMaterials = ['steel', 'alloy steel', 'stainless steel'];
const nonferrousFastenerMaterials = ['steel', 'stainless steel', 'brass', 'aluminum', 'bronze', 'nylon'];
const metricBoltClassOptions = ['4.6', '4.8', '5.8', '8.8', '10.9', '12.9', 'A2-70', 'A4-70', 'A4-80'];
const saeBoltClassOptions = ['grade 2', 'grade 5', 'grade 8', 'A2-70', 'A4-70', 'A4-80'];
const steelStainlessMaterialTypes = ['plain', 'zinc plated', 'yellow zinc plated', 'hot-dip galvanized', 'black oxide', 'phosphate', 'zinc flake', 'A2', 'A4', '18-8', '316'];
const washerMaterials = ['steel', 'stainless steel', 'brass', 'bronze', 'nylon', 'pom'];
const washerMaterialTypes = ['plain', 'zinc plated', 'hot-dip galvanized', 'black oxide', 'A2', 'A4', '18-8', '316', 'natural', 'black'];
const noPitch = { metric: ['n/a'], imperial: ['n/a'] };

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
      metric: metricMachineSizes,
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
      metric: metricStructuralSizes,
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
  },
  {
    id: 'din-931',
    category: 'bolt',
    unitSystem: 'metric',
    family: 'DIN',
    code: 'DIN 931 / ISO 4014',
    standards: { DIN: 'DIN 931', ISO: 'ISO 4014', EN: 'EN ISO 4014' },
    description: 'Hex head bolt, partial thread',
    sizes: { metric: metricStructuralSizes, imperial: inchMachineSizes },
    lengths: { metric: metricLengths, imperial: inchLengths },
    materials: steelStainlessMaterials,
    pitches: { metric: metricCoarsePitches, imperial: inchPitches },
    specs: { materialType: steelStainlessMaterialTypes, boltClass: metricBoltClassOptions },
    sourceId: 'din-iso-public-standard-index'
  },
  {
    id: 'din-960',
    category: 'bolt',
    unitSystem: 'metric',
    family: 'DIN',
    code: 'DIN 960 / ISO 8765',
    standards: { DIN: 'DIN 960', ISO: 'ISO 8765', EN: 'EN ISO 8765' },
    description: 'Hex head bolt, partial thread, fine pitch',
    sizes: { metric: metricStructuralSizes, imperial: inchFineSizes },
    lengths: { metric: metricLengths, imperial: inchLengths },
    materials: steelStainlessMaterials,
    pitches: { metric: metricFinePitches, imperial: inchPitches },
    specs: { materialType: steelStainlessMaterialTypes, boltClass: metricBoltClassOptions },
    sourceId: 'din-iso-public-standard-index'
  },
  {
    id: 'din-961',
    category: 'bolt',
    unitSystem: 'metric',
    family: 'DIN',
    code: 'DIN 961 / ISO 8676',
    standards: { DIN: 'DIN 961', ISO: 'ISO 8676', EN: 'EN ISO 8676' },
    description: 'Hex head screw, full thread, fine pitch',
    sizes: { metric: metricStructuralSizes, imperial: inchFineSizes },
    lengths: { metric: metricLengths, imperial: inchLengths },
    materials: steelStainlessMaterials,
    pitches: { metric: metricFinePitches, imperial: inchPitches },
    specs: { materialType: steelStainlessMaterialTypes, boltClass: metricBoltClassOptions },
    sourceId: 'din-iso-public-standard-index'
  },
  {
    id: 'din-7991',
    category: 'screw',
    unitSystem: 'metric',
    family: 'DIN',
    code: 'DIN 7991 / ISO 10642',
    standards: { DIN: 'DIN 7991', ISO: 'ISO 10642', EN: 'EN ISO 10642' },
    description: 'Hex socket countersunk head screw',
    sizes: { metric: metricMachineSizes, imperial: inchMachineSizes },
    lengths: { metric: metricShortLengths, imperial: inchLengths },
    materials: steelStainlessMaterials,
    pitches: { metric: metricCoarsePitches, imperial: inchPitches },
    specs: { materialType: steelStainlessMaterialTypes, boltClass: metricBoltClassOptions },
    sourceId: 'din-iso-public-standard-index'
  },
  {
    id: 'din-7984',
    category: 'screw',
    unitSystem: 'metric',
    family: 'DIN',
    code: 'DIN 7984',
    standards: { DIN: 'DIN 7984' },
    description: 'Low head hex socket cap screw',
    sizes: { metric: metricMachineSizes, imperial: inchMachineSizes },
    lengths: { metric: metricShortLengths, imperial: inchLengths },
    materials: steelStainlessMaterials,
    pitches: { metric: metricCoarsePitches, imperial: inchPitches },
    specs: { materialType: steelStainlessMaterialTypes, boltClass: metricBoltClassOptions },
    sourceId: 'din-public-standard-index'
  },
  {
    id: 'iso-7380',
    category: 'screw',
    unitSystem: 'metric',
    family: 'ISO',
    code: 'ISO 7380',
    standards: { ISO: 'ISO 7380' },
    description: 'Hex socket button head screw',
    sizes: { metric: metricMachineSizes, imperial: inchMachineSizes },
    lengths: { metric: metricShortLengths, imperial: inchLengths },
    materials: steelStainlessMaterials,
    pitches: { metric: metricCoarsePitches, imperial: inchPitches },
    specs: { materialType: steelStainlessMaterialTypes, boltClass: metricBoltClassOptions },
    sourceId: 'iso-public-standard-index'
  },
  {
    id: 'din-913',
    category: 'screw',
    unitSystem: 'metric',
    family: 'DIN',
    code: 'DIN 913 / ISO 4026',
    standards: { DIN: 'DIN 913', ISO: 'ISO 4026' },
    description: 'Hex socket set screw, flat point',
    sizes: { metric: metricMachineSizes, imperial: inchMachineSizes },
    lengths: { metric: metricShortLengths, imperial: inchLengths },
    materials: ['steel', 'alloy steel', 'stainless steel', 'brass'],
    pitches: { metric: metricCoarsePitches, imperial: inchPitches },
    specs: { materialType: steelStainlessMaterialTypes, boltClass: ['14H', '22H', '33H', '45H', 'A2-70', 'A4-70'] },
    sourceId: 'din-iso-public-standard-index'
  },
  {
    id: 'din-914',
    category: 'screw',
    unitSystem: 'metric',
    family: 'DIN',
    code: 'DIN 914 / ISO 4027',
    standards: { DIN: 'DIN 914', ISO: 'ISO 4027' },
    description: 'Hex socket set screw, cone point',
    sizes: { metric: metricMachineSizes, imperial: inchMachineSizes },
    lengths: { metric: metricShortLengths, imperial: inchLengths },
    materials: ['steel', 'alloy steel', 'stainless steel', 'brass'],
    pitches: { metric: metricCoarsePitches, imperial: inchPitches },
    specs: { materialType: steelStainlessMaterialTypes, boltClass: ['14H', '22H', '33H', '45H', 'A2-70', 'A4-70'] },
    sourceId: 'din-iso-public-standard-index'
  },
  {
    id: 'din-915',
    category: 'screw',
    unitSystem: 'metric',
    family: 'DIN',
    code: 'DIN 915 / ISO 4028',
    standards: { DIN: 'DIN 915', ISO: 'ISO 4028' },
    description: 'Hex socket set screw, dog point',
    sizes: { metric: metricMachineSizes, imperial: inchMachineSizes },
    lengths: { metric: metricShortLengths, imperial: inchLengths },
    materials: ['steel', 'alloy steel', 'stainless steel', 'brass'],
    pitches: { metric: metricCoarsePitches, imperial: inchPitches },
    specs: { materialType: steelStainlessMaterialTypes, boltClass: ['14H', '22H', '33H', '45H', 'A2-70', 'A4-70'] },
    sourceId: 'din-iso-public-standard-index'
  },
  {
    id: 'din-916',
    category: 'screw',
    unitSystem: 'metric',
    family: 'DIN',
    code: 'DIN 916 / ISO 4029',
    standards: { DIN: 'DIN 916', ISO: 'ISO 4029' },
    description: 'Hex socket set screw, cup point',
    sizes: { metric: metricMachineSizes, imperial: inchMachineSizes },
    lengths: { metric: metricShortLengths, imperial: inchLengths },
    materials: ['steel', 'alloy steel', 'stainless steel', 'brass'],
    pitches: { metric: metricCoarsePitches, imperial: inchPitches },
    specs: { materialType: steelStainlessMaterialTypes, boltClass: ['14H', '22H', '33H', '45H', 'A2-70', 'A4-70'] },
    sourceId: 'din-iso-public-standard-index'
  },
  {
    id: 'din-963',
    category: 'screw',
    unitSystem: 'metric',
    family: 'DIN',
    code: 'DIN 963 / ISO 2009',
    standards: { DIN: 'DIN 963', ISO: 'ISO 2009' },
    description: 'Slotted countersunk head machine screw',
    sizes: { metric: metricMachineSizes, imperial: inchMachineSizes },
    lengths: { metric: metricShortLengths, imperial: inchLengths },
    materials: nonferrousFastenerMaterials,
    pitches: { metric: metricCoarsePitches, imperial: inchPitches },
    specs: { materialType: ['plain', 'zinc plated', 'nickel plated', 'chrome plated', 'A2', 'A4', 'natural', 'black'], boltClass: metricBoltClassOptions },
    sourceId: 'din-iso-public-standard-index'
  },
  {
    id: 'din-965',
    category: 'screw',
    unitSystem: 'metric',
    family: 'DIN',
    code: 'DIN 965 / ISO 7046',
    standards: { DIN: 'DIN 965', ISO: 'ISO 7046' },
    description: 'Cross recessed countersunk head machine screw',
    sizes: { metric: metricMachineSizes, imperial: inchMachineSizes },
    lengths: { metric: metricShortLengths, imperial: inchLengths },
    materials: nonferrousFastenerMaterials,
    pitches: { metric: metricCoarsePitches, imperial: inchPitches },
    specs: { materialType: ['plain', 'zinc plated', 'nickel plated', 'chrome plated', 'A2', 'A4', 'natural', 'black'], boltClass: metricBoltClassOptions },
    sourceId: 'din-iso-public-standard-index'
  },
  {
    id: 'din-7985',
    category: 'screw',
    unitSystem: 'metric',
    family: 'DIN',
    code: 'DIN 7985 / ISO 7045',
    standards: { DIN: 'DIN 7985', ISO: 'ISO 7045' },
    description: 'Cross recessed pan head machine screw',
    sizes: { metric: metricMachineSizes, imperial: inchMachineSizes },
    lengths: { metric: metricShortLengths, imperial: inchLengths },
    materials: nonferrousFastenerMaterials,
    pitches: { metric: metricCoarsePitches, imperial: inchPitches },
    specs: { materialType: ['plain', 'zinc plated', 'nickel plated', 'chrome plated', 'A2', 'A4', 'natural', 'black'], boltClass: metricBoltClassOptions },
    sourceId: 'din-iso-public-standard-index'
  },
  {
    id: 'din-7500',
    category: 'screw',
    unitSystem: 'metric',
    family: 'DIN',
    code: 'DIN 7500',
    standards: { DIN: 'DIN 7500' },
    description: 'Thread forming screw for metric thread',
    sizes: { metric: metricMachineSizes, imperial: inchMachineSizes },
    lengths: { metric: metricShortLengths, imperial: inchLengths },
    materials: ['steel', 'stainless steel'],
    pitches: { metric: metricCoarsePitches, imperial: inchPitches },
    specs: { materialType: ['zinc plated', 'black oxide', 'A2', 'A4'], boltClass: ['10.9', 'A2-70', 'A4-70'] },
    sourceId: 'din-public-standard-index'
  },
  {
    id: 'din-7504',
    category: 'screw',
    unitSystem: 'metric',
    family: 'DIN',
    code: 'DIN 7504 / ISO 15480-15483',
    standards: { DIN: 'DIN 7504', ISO: 'ISO 15480' },
    description: 'Self-drilling screw',
    sizes: { metric: ['ST2.9', 'ST3.5', 'ST3.9', 'ST4.2', 'ST4.8', 'ST5.5', 'ST6.3'], imperial: ['#6', '#8', '#10', '#12', '1/4"'] },
    lengths: { metric: ['9.5', '13', '16', '19', '25', '32', '38', '50', '63', '75'], imperial: ['3/8"', '1/2"', '5/8"', '3/4"', '1"', '1-1/4"', '1-1/2"', '2"', '2-1/2"', '3"'] },
    materials: ['steel', 'stainless steel'],
    pitches: { metric: ['self-drilling'], imperial: ['self-drilling'] },
    specs: { materialType: ['zinc plated', 'zinc flake', 'A2', 'A4'], boltClass: [''] },
    sourceId: 'din-iso-public-standard-index'
  },
  {
    id: 'din-439',
    category: 'nut',
    unitSystem: 'metric',
    family: 'DIN',
    code: 'DIN 439 / ISO 4035',
    standards: { DIN: 'DIN 439', ISO: 'ISO 4035' },
    description: 'Hex thin nut / jam nut',
    sizes: { metric: metricMachineSizes, imperial: inchMachineSizes },
    lengths: { metric: ['standard'], imperial: ['standard'] },
    materials: ['steel', 'stainless steel', 'brass'],
    pitches: { metric: metricCoarsePitches, imperial: inchPitches },
    specs: { materialType: ['plain', 'zinc plated', 'hot-dip galvanized', 'A2', 'A4', 'nickel plated'], boltClass: ['04', '05', 'A2-70', 'A4-70'] },
    sourceId: 'din-iso-public-standard-index'
  },
  {
    id: 'din-982',
    category: 'nut',
    unitSystem: 'metric',
    family: 'DIN',
    code: 'DIN 982 / ISO 7040',
    standards: { DIN: 'DIN 982', ISO: 'ISO 7040' },
    description: 'Prevailing torque hex nut, non-metallic insert, high type',
    sizes: { metric: metricMachineSizes, imperial: inchMachineSizes },
    lengths: { metric: ['standard'], imperial: ['standard'] },
    materials: ['steel', 'stainless steel'],
    pitches: { metric: metricCoarsePitches, imperial: inchPitches },
    specs: { materialType: ['zinc plated', 'plain', 'A2', 'A4'], boltClass: ['8', '10', 'A2-70', 'A4-70'] },
    sourceId: 'din-iso-public-standard-index'
  },
  {
    id: 'din-985',
    category: 'nut',
    unitSystem: 'metric',
    family: 'DIN',
    code: 'DIN 985 / ISO 10511',
    standards: { DIN: 'DIN 985', ISO: 'ISO 10511' },
    description: 'Prevailing torque hex nut, non-metallic insert, low type',
    sizes: { metric: metricMachineSizes, imperial: inchMachineSizes },
    lengths: { metric: ['standard'], imperial: ['standard'] },
    materials: ['steel', 'stainless steel'],
    pitches: { metric: metricCoarsePitches, imperial: inchPitches },
    specs: { materialType: ['zinc plated', 'plain', 'A2', 'A4'], boltClass: ['8', '10', 'A2-70', 'A4-70'] },
    sourceId: 'din-iso-public-standard-index'
  },
  {
    id: 'din-1587',
    category: 'nut',
    unitSystem: 'metric',
    family: 'DIN',
    code: 'DIN 1587',
    standards: { DIN: 'DIN 1587' },
    description: 'Hex cap nut, domed',
    sizes: { metric: metricMachineSizes, imperial: inchMachineSizes },
    lengths: { metric: ['standard'], imperial: ['standard'] },
    materials: ['steel', 'stainless steel', 'brass'],
    pitches: { metric: metricCoarsePitches, imperial: inchPitches },
    specs: { materialType: ['plain', 'zinc plated', 'chrome plated', 'A2', 'A4', 'nickel plated'], boltClass: ['6', '8', 'A2-70', 'A4-70'] },
    sourceId: 'din-public-standard-index'
  },
  {
    id: 'din-6923',
    category: 'nut',
    unitSystem: 'metric',
    family: 'DIN',
    code: 'DIN 6923 / EN 1661',
    standards: { DIN: 'DIN 6923', EN: 'EN 1661' },
    description: 'Hex flange nut',
    sizes: { metric: metricMachineSizes, imperial: inchMachineSizes },
    lengths: { metric: ['standard'], imperial: ['standard'] },
    materials: ['steel', 'stainless steel'],
    pitches: { metric: metricCoarsePitches, imperial: inchPitches },
    specs: { materialType: ['plain', 'zinc plated', 'hot-dip galvanized', 'A2', 'A4'], boltClass: ['8', '10', 'A2-70', 'A4-70'] },
    sourceId: 'din-en-public-standard-index'
  },
  {
    id: 'din-9021',
    category: 'washer',
    unitSystem: 'metric',
    family: 'DIN',
    code: 'DIN 9021 / ISO 7093',
    standards: { DIN: 'DIN 9021', ISO: 'ISO 7093' },
    description: 'Large diameter flat washer',
    sizes: { metric: metricMachineSizes, imperial: ['#2', '#4', '#6', '#8', '#10', '1/4"', '5/16"', '3/8"', '1/2"', '5/8"'] },
    lengths: { metric: ['standard'], imperial: ['standard'] },
    materials: washerMaterials,
    pitches: noPitch,
    specs: {
      thickness: { metric: ['0.5 mm', '0.8 mm', '1 mm', '1.6 mm', '2 mm', '2.5 mm', '3 mm', '4 mm', '5 mm'], imperial: ['0.03"', '0.05"', '0.06"', '0.08"', '0.10"', '0.13"', '0.16"'] },
      innerDiameter: { metric: ['2.2 mm', '3.2 mm', '4.3 mm', '5.3 mm', '6.4 mm', '8.4 mm', '10.5 mm', '13 mm', '17 mm', '21 mm'], imperial: ['0.09"', '0.14"', '0.17"', '0.20"', '0.26"', '0.34"', '0.41"', '0.53"', '0.66"', '0.81"'] },
      outerDiameter: { metric: ['6 mm', '9 mm', '12 mm', '15 mm', '18 mm', '24 mm', '30 mm', '37 mm', '50 mm', '60 mm'], imperial: ['0.25"', '0.38"', '0.50"', '0.63"', '0.75"', '1"', '1.25"', '1.5"', '2"'] },
      materialType: washerMaterialTypes
    },
    sourceId: 'din-iso-public-standard-index'
  },
  {
    id: 'din-127',
    category: 'washer',
    unitSystem: 'metric',
    family: 'DIN',
    code: 'DIN 127',
    standards: { DIN: 'DIN 127' },
    description: 'Split spring lock washer',
    sizes: { metric: metricMachineSizes, imperial: ['#2', '#4', '#6', '#8', '#10', '1/4"', '5/16"', '3/8"', '1/2"'] },
    lengths: { metric: ['standard'], imperial: ['standard'] },
    materials: ['steel', 'stainless steel', 'bronze'],
    pitches: noPitch,
    specs: { thickness: ['standard'], innerDiameter: ['standard'], outerDiameter: ['standard'], materialType: washerMaterialTypes },
    sourceId: 'din-public-standard-index'
  },
  {
    id: 'din-6796',
    category: 'washer',
    unitSystem: 'metric',
    family: 'DIN',
    code: 'DIN 6796',
    standards: { DIN: 'DIN 6796' },
    description: 'Conical spring washer for bolted connections',
    sizes: { metric: ['M2', 'M2.5', 'M3', 'M4', 'M5', 'M6', 'M8', 'M10', 'M12', 'M16', 'M20', 'M24', 'M30'], imperial: ['#2', '#4', '#6', '#8', '#10', '1/4"', '5/16"', '3/8"', '1/2"'] },
    lengths: { metric: ['standard'], imperial: ['standard'] },
    materials: ['steel', 'stainless steel'],
    pitches: noPitch,
    specs: { thickness: ['standard'], innerDiameter: ['standard'], outerDiameter: ['standard'], materialType: washerMaterialTypes },
    sourceId: 'din-public-standard-index'
  },
  {
    id: 'din-7349',
    category: 'washer',
    unitSystem: 'metric',
    family: 'DIN',
    code: 'DIN 7349',
    standards: { DIN: 'DIN 7349' },
    description: 'Heavy washer for bolts with heavy clamping sleeves',
    sizes: { metric: ['M5', 'M6', 'M8', 'M10', 'M12', 'M16', 'M20', 'M24', 'M30'], imperial: ['#10', '1/4"', '5/16"', '3/8"', '1/2"', '5/8"', '3/4"', '1"'] },
    lengths: { metric: ['standard'], imperial: ['standard'] },
    materials: washerMaterials,
    pitches: noPitch,
    specs: { thickness: ['standard'], innerDiameter: ['standard'], outerDiameter: ['standard'], materialType: washerMaterialTypes },
    sourceId: 'din-public-standard-index'
  },
  {
    id: 'din-7',
    category: 'pin',
    unitSystem: 'metric',
    family: 'DIN',
    code: 'DIN 7 / ISO 2338',
    standards: { DIN: 'DIN 7', ISO: 'ISO 2338' },
    description: 'Parallel dowel pin, unhardened',
    sizes: { metric: ['1 mm', '1.5 mm', '2 mm', '2.5 mm', '3 mm', '4 mm', '5 mm', '6 mm', '8 mm', '10 mm', '12 mm'], imperial: ['1/16"', '3/32"', '1/8"', '3/16"', '1/4"', '5/16"', '3/8"', '1/2"'] },
    lengths: { metric: metricShortLengths, imperial: inchLengths },
    materials: ['steel', 'stainless steel', 'brass'],
    pitches: noPitch,
    specs: { materialType: ['plain', 'zinc plated', 'A2', 'A4', 'nickel plated'] },
    sourceId: 'din-iso-public-standard-index'
  },
  {
    id: 'din-94',
    category: 'pin',
    unitSystem: 'metric',
    family: 'DIN',
    code: 'DIN 94 / ISO 1234',
    standards: { DIN: 'DIN 94', ISO: 'ISO 1234' },
    description: 'Split cotter pin',
    sizes: { metric: ['1 mm', '1.2 mm', '1.6 mm', '2 mm', '2.5 mm', '3.2 mm', '4 mm', '5 mm', '6.3 mm', '8 mm'], imperial: ['1/32"', '3/64"', '1/16"', '5/64"', '3/32"', '1/8"', '5/32"', '3/16"', '1/4"'] },
    lengths: { metric: ['6', '8', '10', '12', '16', '20', '25', '32', '40', '50', '63', '80'], imperial: ['1/4"', '3/8"', '1/2"', '5/8"', '3/4"', '1"', '1-1/4"', '1-1/2"', '2"', '2-1/2"', '3"'] },
    materials: ['steel', 'stainless steel', 'brass'],
    pitches: noPitch,
    specs: { materialType: ['plain', 'zinc plated', 'A2', 'A4', 'nickel plated'] },
    sourceId: 'din-iso-public-standard-index'
  },
  {
    id: 'din-1481',
    category: 'pin',
    unitSystem: 'metric',
    family: 'DIN',
    code: 'DIN 1481 / ISO 8752',
    standards: { DIN: 'DIN 1481', ISO: 'ISO 8752' },
    description: 'Slotted spring pin, heavy duty',
    sizes: { metric: ['1.5 mm', '2 mm', '2.5 mm', '3 mm', '4 mm', '5 mm', '6 mm', '8 mm', '10 mm', '12 mm'], imperial: ['1/16"', '3/32"', '1/8"', '3/16"', '1/4"', '5/16"', '3/8"', '1/2"'] },
    lengths: { metric: metricShortLengths, imperial: inchLengths },
    materials: ['steel', 'stainless steel'],
    pitches: noPitch,
    specs: { materialType: ['plain', 'zinc plated', 'phosphate', 'A2', 'A4'] },
    sourceId: 'din-iso-public-standard-index'
  },
  {
    id: 'din-7343',
    category: 'pin',
    unitSystem: 'metric',
    family: 'DIN',
    code: 'DIN 7343 / ISO 8750',
    standards: { DIN: 'DIN 7343', ISO: 'ISO 8750' },
    description: 'Coiled spring pin, standard duty',
    sizes: { metric: ['1.5 mm', '2 mm', '2.5 mm', '3 mm', '4 mm', '5 mm', '6 mm', '8 mm', '10 mm', '12 mm'], imperial: ['1/16"', '3/32"', '1/8"', '3/16"', '1/4"', '5/16"', '3/8"', '1/2"'] },
    lengths: { metric: metricShortLengths, imperial: inchLengths },
    materials: ['steel', 'stainless steel'],
    pitches: noPitch,
    specs: { materialType: ['plain', 'zinc plated', 'phosphate', 'A2', 'A4'] },
    sourceId: 'din-iso-public-standard-index'
  },
  {
    id: 'asme-b18-2-1-hex-cap',
    category: 'bolt',
    unitSystem: 'imperial',
    family: 'SAE',
    code: 'ASME B18.2.1 / SAE J429',
    standards: { ASME: 'ASME B18.2.1', SAE: 'SAE J429' },
    description: 'Inch hex cap screw / hex bolt',
    sizes: { metric: metricStructuralSizes, imperial: ['1/4-20', '5/16-18', '3/8-16', '7/16-14', '1/2-13', '5/8-11', '3/4-10', '7/8-9', '1-8'] },
    lengths: { metric: metricLengths, imperial: inchLengths },
    materials: ['steel', 'alloy steel', 'stainless steel'],
    pitches: { metric: metricCoarsePitches, imperial: inchPitches },
    specs: { materialType: ['plain', 'zinc plated', 'yellow zinc plated', 'hot-dip galvanized', 'black oxide', '18-8', '316'], boltClass: saeBoltClassOptions },
    sourceId: 'asme-sae-public-reference'
  },
  {
    id: 'asme-b18-6-3-machine-screw',
    category: 'screw',
    unitSystem: 'imperial',
    family: 'SAE',
    code: 'ASME B18.6.3',
    standards: { ASME: 'ASME B18.6.3', SAE: 'SAE J933' },
    description: 'Inch machine screw',
    sizes: { metric: metricMachineSizes, imperial: [...inchMachineSizes, ...inchFineSizes] },
    lengths: { metric: metricShortLengths, imperial: inchLengths },
    materials: nonferrousFastenerMaterials,
    pitches: { metric: metricCoarsePitches, imperial: inchPitches },
    specs: { materialType: ['plain', 'zinc plated', 'nickel plated', 'chrome plated', 'black oxide', '18-8', '316', 'natural'], boltClass: saeBoltClassOptions },
    sourceId: 'asme-sae-public-reference'
  },
  {
    id: 'asme-b18-6-4-tapping-screw',
    category: 'screw',
    unitSystem: 'imperial',
    family: 'SAE',
    code: 'ASME B18.6.4',
    standards: { ASME: 'ASME B18.6.4', SAE: 'SAE J933' },
    description: 'Inch tapping screw',
    sizes: { metric: ['ST2.2', 'ST2.9', 'ST3.5', 'ST4.2', 'ST4.8', 'ST5.5', 'ST6.3'], imperial: ['#2', '#4', '#6', '#8', '#10', '#12', '1/4"'] },
    lengths: { metric: metricShortLengths, imperial: inchLengths },
    materials: ['steel', 'stainless steel', 'brass'],
    pitches: { metric: ['tapping'], imperial: ['tapping'] },
    specs: { materialType: ['zinc plated', 'black oxide', 'nickel plated', '18-8', '316'], boltClass: [''] },
    sourceId: 'asme-sae-public-reference'
  },
  {
    id: 'asme-b18-2-2-hex-nut',
    category: 'nut',
    unitSystem: 'imperial',
    family: 'SAE',
    code: 'ASME B18.2.2 / SAE J995',
    standards: { ASME: 'ASME B18.2.2', SAE: 'SAE J995' },
    description: 'Inch hex nut',
    sizes: { metric: metricStructuralSizes, imperial: ['1/4-20', '5/16-18', '3/8-16', '7/16-14', '1/2-13', '5/8-11', '3/4-10', '7/8-9', '1-8'] },
    lengths: { metric: ['standard'], imperial: ['standard'] },
    materials: ['steel', 'stainless steel', 'brass'],
    pitches: { metric: metricCoarsePitches, imperial: inchPitches },
    specs: { materialType: ['plain', 'zinc plated', 'yellow zinc plated', 'hot-dip galvanized', '18-8', '316', 'nickel plated'], boltClass: ['grade 2', 'grade 5', 'grade 8', 'A2-70', 'A4-70'] },
    sourceId: 'asme-sae-public-reference'
  },
  {
    id: 'asme-b18-21-1-washer',
    category: 'washer',
    unitSystem: 'imperial',
    family: 'SAE',
    code: 'ASME B18.21.1',
    standards: { ASME: 'ASME B18.21.1', SAE: 'SAE washer pattern' },
    description: 'Inch flat washer, SAE pattern',
    sizes: { metric: metricMachineSizes, imperial: ['#2', '#4', '#6', '#8', '#10', '1/4"', '5/16"', '3/8"', '7/16"', '1/2"', '5/8"', '3/4"', '7/8"', '1"'] },
    lengths: { metric: ['standard'], imperial: ['standard'] },
    materials: washerMaterials,
    pitches: noPitch,
    specs: { thickness: ['standard'], innerDiameter: ['standard'], outerDiameter: ['standard'], materialType: washerMaterialTypes },
    sourceId: 'asme-sae-public-reference'
  },
  {
    id: 'asme-b18-8-1-cotter-pin',
    category: 'pin',
    unitSystem: 'imperial',
    family: 'SAE',
    code: 'ASME B18.8.1',
    standards: { ASME: 'ASME B18.8.1', SAE: 'SAE cotter pin' },
    description: 'Inch cotter pin',
    sizes: { metric: ['1 mm', '1.6 mm', '2 mm', '2.5 mm', '3.2 mm', '4 mm', '5 mm', '6.3 mm'], imperial: ['1/32"', '3/64"', '1/16"', '5/64"', '3/32"', '1/8"', '5/32"', '3/16"', '1/4"'] },
    lengths: { metric: metricShortLengths, imperial: ['1/4"', '3/8"', '1/2"', '5/8"', '3/4"', '1"', '1-1/4"', '1-1/2"', '2"', '2-1/2"', '3"'] },
    materials: ['steel', 'stainless steel', 'brass'],
    pitches: noPitch,
    specs: { materialType: ['plain', 'zinc plated', '18-8', '316', 'nickel plated'] },
    sourceId: 'asme-sae-public-reference'
  },
  {
    id: 'asme-b18-8-2-dowel-pin',
    category: 'pin',
    unitSystem: 'imperial',
    family: 'SAE',
    code: 'ASME B18.8.2',
    standards: { ASME: 'ASME B18.8.2', SAE: 'SAE dowel pin' },
    description: 'Inch dowel pin',
    sizes: { metric: ['1.5 mm', '2 mm', '3 mm', '4 mm', '5 mm', '6 mm', '8 mm', '10 mm'], imperial: ['1/16"', '3/32"', '1/8"', '3/16"', '1/4"', '5/16"', '3/8"', '1/2"', '5/8"', '3/4"'] },
    lengths: { metric: metricShortLengths, imperial: inchLengths },
    materials: ['steel', 'alloy steel', 'stainless steel'],
    pitches: noPitch,
    specs: { materialType: ['plain', 'black oxide', '18-8', '316'] },
    sourceId: 'asme-sae-public-reference'
  }
];
