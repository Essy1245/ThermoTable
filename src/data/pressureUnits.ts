import type { ThermoValue } from './types';

export type PressUnit = 'kPa' | 'MPa' | 'bar';

// Power of ten relative to kPa. Pressure conversion only moves the decimal
// point, so retain the precision of the source table instead of rounding all
// converted values to a fixed number of decimal places.
const KPA_EXPONENT: Record<PressUnit, number> = { kPa: 0, MPa: 3, bar: 2 };

export function formatPressure(
  value: ThermoValue | undefined,
  sourceUnit: PressUnit,
  targetUnit: PressUnit,
): string {
  if (!value) return '-';
  if (sourceUnit === targetUnit) return value.s;

  const shift = KPA_EXPONENT[sourceUnit] - KPA_EXPONENT[targetUnit];
  const source = value.s.replace(/,/g, '').trim();
  const match = source.match(/^[+-]?\d+(?:\.(\d+))?$/);
  if (!match) {
    return Number((value.v * 10 ** shift).toPrecision(12)).toString();
  }

  const decimalPlaces = Math.max(0, (match[1]?.length ?? 0) - shift);
  return (value.v * 10 ** shift).toFixed(decimalPlaces);
}
