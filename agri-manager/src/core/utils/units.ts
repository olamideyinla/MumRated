import type { UnitSystem } from '../../shared/types'

export function kgToLbs(kg: number): number { return kg * 2.20462 }
export function lbsToKg(lbs: number): number { return lbs / 2.20462 }
export function hectaresToAcres(ha: number): number { return ha * 2.47105 }
export function acresToHectares(acres: number): number { return acres / 2.47105 }
export function litresToGallons(l: number): number { return l * 0.264172 }

export function formatWeight(kg: number, system: UnitSystem = 'metric'): string {
  if (system === 'imperial') {
    return `${kgToLbs(kg).toFixed(1)} lb`
  }
  return kg >= 1000 ? `${(kg / 1000).toFixed(2)} t` : `${kg.toFixed(1)} kg`
}

export function formatArea(ha: number, system: UnitSystem = 'metric'): string {
  if (system === 'imperial') {
    return `${hectaresToAcres(ha).toFixed(2)} ac`
  }
  return `${ha.toFixed(2)} ha`
}

export function formatVolume(litres: number, system: UnitSystem = 'metric'): string {
  if (system === 'imperial') {
    return `${litresToGallons(litres).toFixed(1)} gal`
  }
  return `${litres.toFixed(1)} L`
}
