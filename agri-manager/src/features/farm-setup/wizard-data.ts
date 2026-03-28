import type { EnterpriseType, InfrastructureType } from '../../shared/types'

// ── Enterprise type metadata ──────────────────────────────────────────────────

export const ENTERPRISE_LABELS: Record<EnterpriseType, string> = {
  layers:          'Laying Hens',
  broilers:        'Broilers (Meat Birds)',
  cattle_dairy:    'Dairy Cattle',
  cattle_beef:     'Beef Cattle',
  pigs_breeding:   'Breeding Pigs',
  pigs_growfinish: 'Grow-Finish Pigs',
  fish:            'Fish / Aquaculture',
  crop_annual:     'Annual Crops',
  crop_perennial:  'Perennial Crops',
  rabbit:          'Rabbits',
  custom_animal:   'Other Animals',
}

export const ENTERPRISE_ICONS: Record<EnterpriseType, string> = {
  layers:          '🐓',
  broilers:        '🐔',
  cattle_dairy:    '🐄',
  cattle_beef:     '🐂',
  pigs_breeding:   '🐷',
  pigs_growfinish: '🐖',
  fish:            '🐟',
  crop_annual:     '🌾',
  crop_perennial:  '🌳',
  rabbit:          '🐰',
  custom_animal:   '🐾',
}

export const ENTERPRISE_TO_INFRA_TYPE: Record<EnterpriseType, InfrastructureType> = {
  layers:          'poultry_house',
  broilers:        'poultry_house',
  cattle_dairy:    'cattle_pen',
  cattle_beef:     'cattle_pen',
  pigs_breeding:   'pig_pen',
  pigs_growfinish: 'pig_pen',
  fish:            'fish_pond',
  crop_annual:     'field',
  crop_perennial:  'field',
  rabbit:          'rabbit_hutch',
  custom_animal:   'other',
}

// ── Section labels per infra type ─────────────────────────────────────────────

export const INFRA_SECTION_LABEL: Record<InfrastructureType, string> = {
  poultry_house: '🏠 Poultry Houses',
  fish_pond:     '🐟 Fish Ponds',
  cattle_pen:    '🐄 Cattle Pens',
  pig_pen:       '🐷 Pig Pens',
  rabbit_hutch:  '🐰 Rabbit Hutches',
  field:         '🌾 Crop Fields',
  greenhouse:    '🏡 Greenhouses',
  other:         '🏗️ Other Units',
}

// ── Form labels ───────────────────────────────────────────────────────────────

export const CAPACITY_LABEL: Record<EnterpriseType, string> = {
  layers:          'Capacity (birds)',
  broilers:        'Capacity (birds)',
  cattle_dairy:    'Capacity (head)',
  cattle_beef:     'Capacity (head)',
  pigs_breeding:   'Capacity (sows)',
  pigs_growfinish: 'Capacity (pigs)',
  fish:            'Capacity (fingerlings)',
  crop_annual:     'Area (m²)',
  crop_perennial:  'Area (m²)',
  rabbit:          'Capacity (does)',
  custom_animal:   'Capacity',
}

export const STOCK_COUNT_LABEL: Record<EnterpriseType, string> = {
  layers:          'Number of birds currently',
  broilers:        'Number of birds currently',
  cattle_dairy:    'Number of cattle currently',
  cattle_beef:     'Number of cattle currently',
  pigs_breeding:   'Number of sows currently',
  pigs_growfinish: 'Number of pigs currently',
  fish:            'Estimated fish count',
  crop_annual:     'Planted area (m²)',
  crop_perennial:  'Planted area (m²)',
  rabbit:          'Number of rabbits currently',
  custom_animal:   'Number of animals currently',
}

export const BATCH_PREFIX: Record<EnterpriseType, string> = {
  layers:          'Flock',
  broilers:        'Batch',
  cattle_dairy:    'Herd',
  cattle_beef:     'Herd',
  pigs_breeding:   'Group',
  pigs_growfinish: 'Batch',
  fish:            'Batch',
  crop_annual:     'Season',
  crop_perennial:  'Crop',
  rabbit:          'Colony',
  custom_animal:   'Group',
}

export function getDefaultInfraName(type: EnterpriseType, count: number): string {
  const names: Record<EnterpriseType, string[]> = {
    layers:          ['House 1', 'House 2', 'House 3', 'House 4'],
    broilers:        ['House 1', 'House 2', 'House 3', 'House 4'],
    cattle_dairy:    ['Pen A', 'Pen B', 'Pen C'],
    cattle_beef:     ['Pen A', 'Pen B', 'Pen C'],
    pigs_breeding:   ['Pen 1', 'Pen 2', 'Pen 3'],
    pigs_growfinish: ['Pen 1', 'Pen 2', 'Pen 3'],
    fish:            ['Pond A', 'Pond B', 'Pond C'],
    crop_annual:     ['Field 1', 'Field 2', 'Field 3'],
    crop_perennial:  ['Field 1', 'Field 2', 'Field 3'],
    rabbit:          ['Block A', 'Block B', 'Block C'],
    custom_animal:   ['Unit 1', 'Unit 2', 'Unit 3'],
  }
  const arr = names[type]
  return arr[Math.min(count, arr.length - 1)] ?? `Unit ${count + 1}`
}

// ── Breed options per enterprise type ─────────────────────────────────────────

export const BREED_OPTIONS: Partial<Record<EnterpriseType, string[]>> = {
  layers:          ['Hy-Line Brown', 'ISA Brown', 'Lohmann Brown', 'SASSO', 'Dominant CZ', 'Local/Indigenous'],
  broilers:        ['Ross 308', 'Cobb 500', 'Arbor Acres', 'Hubbard', 'Marshall', 'Local/Indigenous'],
  cattle_dairy:    ['Holstein Friesian', 'Jersey', 'Guernsey', 'Brown Swiss', 'Ayrshire', 'Cross-bred'],
  cattle_beef:     ['Angus', 'Hereford', 'Brahman', 'Boran', 'Nguni', 'Zebu', 'Simmental', 'Cross-bred'],
  pigs_breeding:   ['Large White', 'Landrace', 'Duroc', 'Pietrain', 'Hampshire', 'Cross-bred'],
  pigs_growfinish: ['Large White', 'Landrace', 'Duroc', 'Pietrain', 'Hampshire', 'Cross-bred'],
  fish:            ['Nile Tilapia', 'Catfish (Clarias)', 'Rainbow Trout', 'Common Carp', 'Tilapia (local)'],
  rabbit:          ['New Zealand White', 'Californian', 'Rex', 'Chinchilla', 'Flemish Giant', 'Local'],
  crop_annual:     ['Maize (Hybrid)', 'Maize (OPV)', 'Soybean', 'Wheat', 'Rice', 'Sorghum', 'Millet', 'Groundnut', 'Sunflower'],
  crop_perennial:  ['Banana', 'Sugarcane', 'Coffee (Arabica)', 'Coffee (Robusta)', 'Cocoa', 'Tea', 'Cassava', 'Plantain'],
}

export const ALL_ENTERPRISE_TYPES: EnterpriseType[] = [
  'layers', 'broilers', 'cattle_dairy', 'cattle_beef',
  'pigs_breeding', 'pigs_growfinish', 'fish',
  'crop_annual', 'crop_perennial', 'rabbit', 'custom_animal',
]

export const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'fr', name: 'French' },
  { code: 'es', name: 'Spanish' },
  { code: 'sw', name: 'Swahili' },
  { code: 'pt', name: 'Portuguese' },
]
