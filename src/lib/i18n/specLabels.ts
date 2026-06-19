import type { AppLocale, HardwareSpecKey } from '../../types';

export const specLabels: Record<AppLocale, Record<HardwareSpecKey, string>> = {
  en: {
    size: 'Size',
    length: 'Length',
    threadPitchName: 'Pitch name',
    threadPitch: 'Thread pitch',
    threadPitchUnit: 'Pitch unit',
    material: 'Material',
    materialType: 'Material type',
    finish: 'Finish',
    boltClass: 'Bolt class',
    thickness: 'Thickness',
    innerDiameter: 'ID',
    outerDiameter: 'OD',
    gripRange: 'Grip range'
  },
  it: {
    size: 'Misura',
    length: 'Lunghezza',
    threadPitchName: 'Nome passo',
    threadPitch: 'Passo filettatura',
    threadPitchUnit: 'Unità passo',
    material: 'Materiale',
    materialType: 'Tipo materiale',
    finish: 'Finitura',
    boltClass: 'Classe bullone',
    thickness: 'Spessore',
    innerDiameter: 'DI',
    outerDiameter: 'DE',
    gripRange: 'Campo presa'
  },
  de: {
    size: 'Größe',
    length: 'Länge',
    threadPitchName: 'Steigungsname',
    threadPitch: 'Gewindesteigung',
    threadPitchUnit: 'Steigungseinheit',
    material: 'Material',
    materialType: 'Materialtyp',
    finish: 'Oberfläche',
    boltClass: 'Festigkeitsklasse',
    thickness: 'Dicke',
    innerDiameter: 'ID',
    outerDiameter: 'AD',
    gripRange: 'Klemmbereich'
  },
  fr: {
    size: 'Taille',
    length: 'Longueur',
    threadPitchName: 'Nom du pas',
    threadPitch: 'Pas de filetage',
    threadPitchUnit: 'Unité du pas',
    material: 'Matériau',
    materialType: 'Type de matériau',
    finish: 'Finition',
    boltClass: 'Classe du boulon',
    thickness: 'Épaisseur',
    innerDiameter: 'DI',
    outerDiameter: 'DE',
    gripRange: 'Plage de serrage'
  },
  es: {
    size: 'Tamaño',
    length: 'Longitud',
    threadPitchName: 'Nombre del paso',
    threadPitch: 'Paso de rosca',
    threadPitchUnit: 'Unidad del paso',
    material: 'Material',
    materialType: 'Tipo de material',
    finish: 'Acabado',
    boltClass: 'Clase del perno',
    thickness: 'Espesor',
    innerDiameter: 'DI',
    outerDiameter: 'DE',
    gripRange: 'Rango de agarre'
  }
};
