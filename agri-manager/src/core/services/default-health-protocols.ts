import type { HealthProtocol, HealthProtocolEvent } from '../../shared/types'

type ProtocolTemplate = Omit<HealthProtocol, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>

function evt(
  id: string,
  name: string,
  eventType: HealthProtocolEvent['eventType'],
  dayOffset: number,
  product?: string,
  dosage?: string,
  route?: string,
  notes?: string,
): HealthProtocolEvent {
  return { id, name, eventType, dayOffset, product, dosage, route, notes }
}

export const DEFAULT_PROTOCOLS: ProtocolTemplate[] = [
  // ── Broilers ────────────────────────────────────────────────────────────────
  {
    name: 'Standard Broiler Vaccination Program',
    enterpriseType: 'broilers',
    isDefault: true,
    events: [
      evt('b-vit-1',   'Vitamin & Electrolytes Supplement',       'vitamin',     1,  'Vitamin/Electrolyte Mix', '1g/L water', 'drinking water'),
      evt('b-nd-1',    'Newcastle + Infectious Bronchitis Vaccine','vaccination', 7,  'ND-IB (LaSota + M41)',    '1 drop/eye', 'eye drop / drinking water'),
      evt('b-gum-1',   'Gumboro (IBD) Vaccine',                   'vaccination', 14, 'Lukert or D78 strain',    '1 dose',     'drinking water'),
      evt('b-nd-2',    'Newcastle Disease Booster',               'vaccination', 21, 'ND LaSota',               '1 dose',     'drinking water'),
      evt('b-gum-2',   'Gumboro Booster',                         'vaccination', 28, 'IBD strain',              '1 dose',     'drinking water'),
      evt('b-dew-1',   'Deworming',                               'deworming',   28, 'Levamisole or Fenbendazole', 'per label', 'drinking water'),
    ],
  },

  // ── Layers ──────────────────────────────────────────────────────────────────
  {
    name: 'Standard Layer Vaccination Program',
    enterpriseType: 'layers',
    isDefault: true,
    events: [
      evt('l-mar-1',   "Marek's Disease Vaccine",                 'vaccination', 1,   "Marek's HVT",             'in-ovo / day-old', 'subcutaneous injection'),
      evt('l-nd-1',    'Newcastle + IB Vaccine',                  'vaccination', 7,   'ND-IB (LaSota + M41)',    '1 drop/eye', 'eye drop'),
      evt('l-gum-1',   'Gumboro (IBD) Vaccine',                   'vaccination', 14,  'Lukert or D78 strain',    '1 dose',     'drinking water'),
      evt('l-nd-2',    'Newcastle Booster',                       'vaccination', 21,  'ND LaSota',               '1 dose',     'drinking water'),
      evt('l-fp-1',    'Fowlpox Vaccine',                         'vaccination', 42,  'Pigeon pox strain',       '1 dose',     'wing web stab'),
      evt('l-ilt-1',   'ILT Vaccine',                             'vaccination', 56,  'ILT modified live',       '1 dose',     'eye drop'),
      evt('l-nd-3',    'Newcastle + IB Booster',                  'vaccination', 84,  'ND-IB killed oil emulsion','1 dose',    'subcutaneous injection'),
      evt('l-nd-4',    'Pre-Lay Booster',                         'vaccination', 112, 'ND-IB+EDS killed vaccine', '1 dose',    'subcutaneous injection'),
      evt('l-dew-1',   'Deworming',                               'deworming',   56,  'Fenbendazole',            'per label', 'drinking water'),
    ],
  },

  // ── Cattle ──────────────────────────────────────────────────────────────────
  {
    name: 'Standard Cattle Health Program',
    enterpriseType: 'cattle_dairy',
    isDefault: true,
    events: [
      evt('c-fmd-1',   'FMD Vaccine',                             'vaccination', 14,  'Bivalent FMD',           '2 mL',      'subcutaneous injection'),
      evt('c-brd-1',   'BRD Respiratory Vaccine',                 'vaccination', 21,  'Bovishield or Cattlemaster','2 mL',   'intramuscular injection'),
      evt('c-blk-1',   'Blackleg / Clostridial Vaccine',          'vaccination', 30,  '7-way or 8-way clostridial','2 mL',  'subcutaneous injection'),
      evt('c-bru-1',   'Brucellosis Vaccine (heifers)',           'vaccination', 60,  'Strain 19 or RB51',      '2 mL',     'subcutaneous injection', 'Heifers only, 4–12 months'),
      evt('c-dew-1',   'Deworming',                               'deworming',   90,  'Ivermectin or Fenbendazole','per label','subcutaneous / oral'),
    ],
  },
  {
    name: 'Standard Cattle Health Program',
    enterpriseType: 'cattle_beef',
    isDefault: true,
    events: [
      evt('cb-fmd-1',  'FMD Vaccine',                             'vaccination', 14,  'Bivalent FMD',           '2 mL',     'subcutaneous injection'),
      evt('cb-brd-1',  'BRD Respiratory Vaccine',                 'vaccination', 21,  'Bovishield or Cattlemaster','2 mL',  'intramuscular injection'),
      evt('cb-blk-1',  'Blackleg / Clostridial Vaccine',          'vaccination', 30,  '7-way or 8-way clostridial','2 mL', 'subcutaneous injection'),
      evt('cb-dew-1',  'Deworming',                               'deworming',   60,  'Ivermectin or Fenbendazole','per label','subcutaneous / oral'),
    ],
  },

  // ── Pigs ────────────────────────────────────────────────────────────────────
  {
    name: 'Standard Pig Health Program',
    enterpriseType: 'pigs_growfinish',
    isDefault: true,
    events: [
      evt('p-ery-1',   'Erysipelas + PCV2 Vaccine',               'vaccination', 7,   'Ery+PCV2 combined',      '2 mL',     'intramuscular injection'),
      evt('p-fmd-1',   'FMD Vaccine',                             'vaccination', 21,  'Bivalent FMD',           '2 mL',     'intramuscular injection'),
      evt('p-pcv-2',   'PCV2 Booster',                            'vaccination', 28,  'Circovac or Ingelvac',   '2 mL',     'intramuscular injection'),
      evt('p-dew-1',   'Deworming',                               'deworming',   60,  'Fenbendazole or Ivermectin','per label','oral / subcutaneous'),
    ],
  },
  {
    name: 'Standard Pig Breeding Health Program',
    enterpriseType: 'pigs_breeding',
    isDefault: true,
    events: [
      evt('pb-ery-1',  'Erysipelas Vaccine',                      'vaccination', 7,   'Ery live/killed',        '2 mL',     'intramuscular injection'),
      evt('pb-fmd-1',  'FMD Vaccine',                             'vaccination', 21,  'Bivalent FMD',           '2 mL',     'intramuscular injection'),
      evt('pb-pcv-1',  'PCV2 Vaccine',                            'vaccination', 28,  'Ingelvac CircoFlex',     '2 mL',     'intramuscular injection'),
      evt('pb-dew-1',  'Deworming',                               'deworming',   60,  'Ivermectin',             'per label','subcutaneous'),
    ],
  },

  // ── Fish ────────────────────────────────────────────────────────────────────
  {
    name: 'Standard Fish Health Program',
    enterpriseType: 'fish',
    isDefault: true,
    events: [
      evt('f-wq-1',    'Water Quality Test & Treatment',           'test',        14,  'Water quality kit',      undefined,  undefined, 'Test pH, DO, ammonia; treat if needed'),
      evt('f-par-1',   'Antiparasitic Treatment',                  'treatment',   30,  'Salt bath or Potassium permanganate','per label','bath treatment'),
      evt('f-dew-1',   'Deworming / Health Inspection',            'deworming',   60,  'Praziquantel',           'per label', 'medicated feed', 'Inspect for signs of disease'),
    ],
  },

  // ── Rabbits ─────────────────────────────────────────────────────────────────
  {
    name: 'Standard Rabbit Health Program',
    enterpriseType: 'rabbit',
    isDefault: true,
    events: [
      evt('r-vhd-1',   'VHD Vaccine',                             'vaccination', 28,  'VHD killed vaccine',     '1 mL',     'subcutaneous injection'),
      evt('r-myxo-1',  'Myxomatosis Vaccine',                     'vaccination', 42,  'Myxo live vaccine',      '1 mL',     'subcutaneous injection'),
      evt('r-dew-1',   'Deworming',                               'deworming',   30,  'Fenbendazole',           'per label','oral'),
    ],
  },
]
