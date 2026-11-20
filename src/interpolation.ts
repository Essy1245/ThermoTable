import { formatPressure } from './data/pressureUnits.ts';
import type {
  SaturatedTableRow,
  SpecificHeatTempRow,
  ThermoTableData,
  ThermoValue,
} from './data/types.ts';

export type TempUnit = 'C' | 'K';
export type PressUnit = 'kPa' | 'MPa' | 'bar';

export interface InterpolatedRowSpec {
  id: string;
  blockIndex?: number;
  afterIndex: number;
  dominatingColId: string;
  inputValue: string;
  showMoreDigits?: boolean;
  showAnalytic?: boolean;
}

export interface SolvedCell {
  colId: string;
  label: string;
  display: string;
  fullPrecision: string;
  value: number;
  y1Str: string;
  y1: number;
  y2Str: string;
  y2: number;
  analyticSubstituted: string;
}

export interface SolvedInterpolatedRow {
  spec: InterpolatedRowSpec;
  isValidInput: boolean;
  inputNumber?: number;
  weight?: number;
  isExtrapolated: boolean;
  x1?: number;
  x1Str?: string;
  x2?: number;
  x2Str?: string;
  cells: Record<string, SolvedCell>;
}

const A2B_GASES = [
  ['air', 'Air'],
  ['co2', 'CO₂'],
  ['co', 'CO'],
  ['h2', 'H₂'],
  ['n2', 'N₂'],
  ['o2', 'O₂'],
] as const;

const SATURATED_PROPERTY_DEFS: ReadonlyArray<{
  id: keyof SaturatedTableRow;
  label: string;
  unit: string;
}> = [
  { id: 'vf', label: 'vf', unit: 'm³/kg' },
  { id: 'vg', label: 'vg', unit: 'm³/kg' },
  { id: 'uf', label: 'uf', unit: 'kJ/kg' },
  { id: 'ufg', label: 'ufg', unit: 'kJ/kg' },
  { id: 'ug', label: 'ug', unit: 'kJ/kg' },
  { id: 'hf', label: 'hf', unit: 'kJ/kg' },
  { id: 'hfg', label: 'hfg', unit: 'kJ/kg' },
  { id: 'hg', label: 'hg', unit: 'kJ/kg' },
  { id: 'sf', label: 'sf', unit: 'kJ/kg·K' },
  { id: 'sfg', label: 'sfg', unit: 'kJ/kg·K' },
  { id: 'sg', label: 'sg', unit: 'kJ/kg·K' },
];

export function isProgressiveTable(table?: ThermoTableData | null): boolean {
  if (!table) return false;
  return (
    table.type === 'saturated' ||
    table.type === 'superheated' ||
    table.type === 'compressed' ||
    table.type === 'ideal_gas_air' ||
    table.type === 'ideal_gas_molar' ||
    table.type === 'specific_heat_temp'
  );
}

export function getTableRowCount(table: ThermoTableData, blockIndex?: number): number {
  if (table.type === 'superheated' || table.type === 'compressed') {
    return table.blocks[blockIndex ?? 0]?.rows.length ?? 0;
  }
  if ('rows' in table) {
    return table.rows.length;
  }
  return 0;
}

export function getProgressiveColumns(
  table: ThermoTableData,
  tempUnit: TempUnit,
  pressUnit: PressUnit
): { id: string; label: string; unit: string }[] {
  const tUnit = tempUnit === 'K' ? 'K' : '°C';
  switch (table.type) {
    case 'saturated': {
      const tCol = {
        id: 'T',
        label: table.indexProperty === 'P' ? 'Tsat' : 'Temp',
        unit: tUnit,
      };
      const pCol = {
        id: 'P',
        label: table.indexProperty === 'T' ? 'Psat' : 'Press',
        unit: pressUnit,
      };
      const props = SATURATED_PROPERTY_DEFS.filter((def) =>
        table.rows.some((r) => isNumericThermoValue(r[def.id]))
      );
      return table.indexProperty === 'T' ? [tCol, pCol, ...props] : [pCol, tCol, ...props];
    }
    case 'superheated':
    case 'compressed':
      return [
        { id: 'T', label: 'Temp', unit: tUnit },
        { id: 'v', label: 'v', unit: 'm³/kg' },
        { id: 'u', label: 'u', unit: 'kJ/kg' },
        { id: 'h', label: 'h', unit: 'kJ/kg' },
        { id: 's', label: 's', unit: 'kJ/kg·K' },
      ];
    case 'ideal_gas_air':
      return [
        { id: 'T', label: 'Temp', unit: tUnit },
        { id: 'h', label: 'h', unit: 'kJ/kg' },
        { id: 'u', label: 'u', unit: 'kJ/kg' },
        { id: 's_deg', label: 's°', unit: 'kJ/kg·K' },
        { id: 's_plus', label: 's+', unit: 'kJ/kg·K' },
      ];
    case 'ideal_gas_molar':
      return [
        { id: 'T', label: 'Temp', unit: tUnit },
        { id: 'h_bar', label: 'h̄', unit: 'kJ/kmol' },
        { id: 'u_bar', label: 'ū', unit: 'kJ/kmol' },
        { id: 's_bar_deg', label: 's̄°', unit: 'kJ/kmol·K' },
      ];
    case 'specific_heat_temp':
      return [
        { id: 'T', label: 'Temp', unit: tUnit },
        ...A2B_GASES.flatMap(([gasId, shortLabel]) => [
          { id: `${gasId}_cp`, label: `${shortLabel} cp`, unit: 'kJ/kg·K' },
          { id: `${gasId}_cv`, label: `${shortLabel} cv`, unit: 'kJ/kg·K' },
          { id: `${gasId}_k`, label: `${shortLabel} k`, unit: '' },
        ]),
      ];
    default:
      return [];
  }
}

function isNumericThermoValue(val?: ThermoValue): val is ThermoValue {
  return Boolean(val && Number.isFinite(val.v) && !/^(?:N\/A|—|-)$/i.test(val.s.trim()));
}

function convertTempFromC(val: ThermoValue | undefined, tempUnit: TempUnit): { v: number; s: string } | undefined {
  if (!isNumericThermoValue(val)) return undefined;
  if (tempUnit === 'K') {
    const v = val.v + 273.15;
    return { v, s: v.toFixed(2) };
  }
  return { v: val.v, s: val.s };
}

function convertTempFromK(val: ThermoValue | undefined, tempUnit: TempUnit): { v: number; s: string } | undefined {
  if (!isNumericThermoValue(val)) return undefined;
  if (tempUnit === 'C') {
    const v = val.v - 273.15;
    return { v, s: v.toFixed(2) };
  }
  return { v: val.v, s: val.s };
}

function convertPressFromKPa(val: ThermoValue | undefined, pressUnit: PressUnit): { v: number; s: string } | undefined {
  if (!isNumericThermoValue(val)) return undefined;
  const v = pressUnit === 'MPa' ? val.v / 1000 : pressUnit === 'bar' ? val.v / 100 : val.v;
  return { v, s: formatPressure(val, 'kPa', pressUnit) };
}

export function getRowColumnDisplayValue(
  table: ThermoTableData,
  rowIndex: number,
  colId: string,
  tempUnit: TempUnit,
  pressUnit: PressUnit,
  blockIndex?: number
): { v: number; s: string } | undefined {
  if (rowIndex < 0) return undefined;

  if (table.type === 'saturated') {
    const row = table.rows[rowIndex];
    if (!row) return undefined;
    if (colId === 'T') return convertTempFromC(row.T, tempUnit);
    if (colId === 'P') return convertPressFromKPa(row.P, pressUnit);
    const val = row[colId as keyof SaturatedTableRow];
    return isNumericThermoValue(val) ? { v: val.v, s: val.s } : undefined;
  }

  if (table.type === 'superheated' || table.type === 'compressed') {
    const block = table.blocks[blockIndex ?? 0];
    const row = block?.rows[rowIndex];
    if (!row) return undefined;
    if (colId === 'T') {
      const tVal = row.isSaturationState ? block.Tsat : row.T;
      return convertTempFromC(tVal, tempUnit);
    }
    if (colId === 'v' || colId === 'u' || colId === 'h' || colId === 's') {
      const val = row[colId];
      return isNumericThermoValue(val) ? { v: val.v, s: val.s } : undefined;
    }
    return undefined;
  }

  if (table.type === 'ideal_gas_air') {
    const row = table.rows[rowIndex];
    if (!row) return undefined;
    if (colId === 'T') return convertTempFromK(row.T, tempUnit);
    if (colId === 'h' || colId === 'u' || colId === 's_deg' || colId === 's_plus') {
      const val = row[colId];
      return isNumericThermoValue(val) ? { v: val.v, s: val.s } : undefined;
    }
    return undefined;
  }

  if (table.type === 'ideal_gas_molar') {
    const row = table.rows[rowIndex];
    if (!row) return undefined;
    if (colId === 'T') return convertTempFromK(row.T, tempUnit);
    if (colId === 'h_bar' || colId === 'u_bar' || colId === 's_bar_deg') {
      const val = row[colId];
      return isNumericThermoValue(val) ? { v: val.v, s: val.s } : undefined;
    }
    return undefined;
  }

  if (table.type === 'specific_heat_temp') {
    const row = table.rows[rowIndex];
    if (!row) return undefined;
    if (colId === 'T') return convertTempFromK(row.T, tempUnit);
    const match = colId.match(/^(air|co2|co|h2|n2|o2)_(cp|cv|k)$/);
    if (!match) return undefined;
    const gas = match[1] as keyof Omit<SpecificHeatTempRow, 'T'>;
    const prop = match[2] as 'cp' | 'cv' | 'k';
    const val = row[gas][prop];
    return isNumericThermoValue(val) ? { v: val.v, s: val.s } : undefined;
  }

  return undefined;
}

function countDecimals(s: string): number {
  const cleaned = s.replace(/,/g, '').replace(/\s+/g, '').replace(/^[−+-]/, '');
  const dotIdx = cleaned.indexOf('.');
  if (dotIdx === -1) return 0;
  const frac = cleaned.slice(dotIdx + 1);
  return /^\d+$/.test(frac) ? frac.length : 0;
}

function applyThousandsCommas(numStr: string): string {
  const sign = numStr.startsWith('-') ? '-' : '';
  const body = sign ? numStr.slice(1) : numStr;
  const [intPart, decPart] = body.split('.');
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decPart !== undefined ? `${sign}${formattedInt}.${decPart}` : `${sign}${formattedInt}`;
}

function normalizeNegativeZero(fixed: string): string {
  return /^-0(?:\.0+)?$/.test(fixed) ? fixed.slice(1) : fixed;
}

/**
 * Formats an interpolated scalar using the maximum decimal places of its two
 * bounding column cells, preserving comma grouping when used in that column.
 */
export function formatWithColumnPrecision(value: number, s1: string, s2: string): string {
  const decimals = Math.max(countDecimals(s1), countDecimals(s2));
  const fixed = normalizeNegativeZero(value.toFixed(decimals));
  return s1.includes(',') || s2.includes(',') ? applyThousandsCommas(fixed) : fixed;
}

/**
 * Formats an interpolated scalar with extra significant digits so users can
 * inspect or copy intermediate results without premature rounding error.
 */
export function formatFullPrecision(value: number, s1: string, s2: string): string {
  const dec = Math.max(countDecimals(s1), countDecimals(s2));
  const maxDec = Math.min(10, dec + 5);
  const minDec = Math.min(maxDec, dec + 2);
  let fixed = normalizeNegativeZero(value.toFixed(maxDec));
  const dotIdx = fixed.indexOf('.');
  if (dotIdx !== -1) {
    let end = fixed.length;
    while (end - dotIdx - 1 > minDec && fixed[end - 1] === '0') {
      end--;
    }
    fixed = fixed.slice(0, end);
  }
  return s1.includes(',') || s2.includes(',') ? applyThousandsCommas(fixed) : fixed;
}

export function solveInterpolatedRow(
  table: ThermoTableData,
  spec: InterpolatedRowSpec,
  tempUnit: TempUnit,
  pressUnit: PressUnit
): SolvedInterpolatedRow {
  const rawInput = spec.inputValue.trim();
  const normalizedInput = rawInput.replace(/,/g, '').replace(/−/g, '-');
  const parsedNumber = normalizedInput === '' ? Number.NaN : Number(normalizedInput);

  const x1Cell = getRowColumnDisplayValue(
    table,
    spec.afterIndex,
    spec.dominatingColId,
    tempUnit,
    pressUnit,
    spec.blockIndex
  );
  const x2Cell = getRowColumnDisplayValue(
    table,
    spec.afterIndex + 1,
    spec.dominatingColId,
    tempUnit,
    pressUnit,
    spec.blockIndex
  );

  if (
    !Number.isFinite(parsedNumber) ||
    !x1Cell ||
    !x2Cell ||
    Math.abs(x2Cell.v - x1Cell.v) < 1e-15
  ) {
    return {
      spec,
      isValidInput: false,
      isExtrapolated: false,
      x1: x1Cell?.v,
      x1Str: x1Cell?.s,
      x2: x2Cell?.v,
      x2Str: x2Cell?.s,
      cells: {},
    };
  }

  const weight = (parsedNumber - x1Cell.v) / (x2Cell.v - x1Cell.v);
  if (!Number.isFinite(weight)) {
    return {
      spec,
      isValidInput: false,
      isExtrapolated: false,
      x1: x1Cell.v,
      x1Str: x1Cell.s,
      x2: x2Cell.v,
      x2Str: x2Cell.s,
      cells: {},
    };
  }

  const isExtrapolated = weight < -1e-9 || weight > 1 + 1e-9;
  const cols = getProgressiveColumns(table, tempUnit, pressUnit);
  const cells: Record<string, SolvedCell> = {};

  for (const col of cols) {
    const y1Cell = getRowColumnDisplayValue(
      table,
      spec.afterIndex,
      col.id,
      tempUnit,
      pressUnit,
      spec.blockIndex
    );
    const y2Cell = getRowColumnDisplayValue(
      table,
      spec.afterIndex + 1,
      col.id,
      tempUnit,
      pressUnit,
      spec.blockIndex
    );
    if (!y1Cell || !y2Cell) continue;

    const solvedVal =
      col.id === spec.dominatingColId
        ? parsedNumber
        : y1Cell.v + weight * (y2Cell.v - y1Cell.v);
    if (!Number.isFinite(solvedVal)) continue;

    const display = formatWithColumnPrecision(solvedVal, y1Cell.s, y2Cell.s);
    const fullPrecision = formatFullPrecision(solvedVal, y1Cell.s, y2Cell.s);
    const analyticSubstituted =
      col.id === spec.dominatingColId
        ? `${col.label} = ${rawInput} (given input between ${x1Cell.s} and ${x2Cell.s})`
        : `${y1Cell.s} + ((${rawInput} − ${x1Cell.s}) / (${x2Cell.s} − ${x1Cell.s})) × (${y2Cell.s} − ${y1Cell.s}) = ${fullPrecision}`;

    cells[col.id] = {
      colId: col.id,
      label: col.label,
      display,
      fullPrecision,
      value: solvedVal,
      y1Str: y1Cell.s,
      y1: y1Cell.v,
      y2Str: y2Cell.s,
      y2: y2Cell.v,
      analyticSubstituted,
    };
  }

  return {
    spec,
    isValidInput: true,
    inputNumber: parsedNumber,
    weight,
    isExtrapolated,
    x1: x1Cell.v,
    x1Str: x1Cell.s,
    x2: x2Cell.v,
    x2Str: x2Cell.s,
    cells,
  };
}

/**
 * Finds the best gap index `i` (between row `i` and `i + 1`) that brackets
 * `targetValue` in column `colId`, falling back to the nearest endpoint gap.
 */
export function findBoundingRowGap(
  table: ThermoTableData,
  colId: string,
  targetValue: number,
  tempUnit: TempUnit,
  pressUnit: PressUnit,
  blockIndex?: number
): number {
  const count = getTableRowCount(table, blockIndex);
  if (count < 2) return -1;
  if (!Number.isFinite(targetValue)) return 0;

  let fallbackIndex = 0;
  let bestEndpointDist = Infinity;

  for (let i = 0; i < count - 1; i++) {
    const a = getRowColumnDisplayValue(table, i, colId, tempUnit, pressUnit, blockIndex);
    const b = getRowColumnDisplayValue(table, i + 1, colId, tempUnit, pressUnit, blockIndex);
    if (!a || !b) continue;

    if (
      (targetValue >= a.v && targetValue <= b.v) ||
      (targetValue <= a.v && targetValue >= b.v)
    ) {
      return i;
    }

    const endpointDist = Math.min(Math.abs(targetValue - a.v), Math.abs(targetValue - b.v));
    if (endpointDist < bestEndpointDist) {
      bestEndpointDist = endpointDist;
      fallbackIndex = i;
    }
  }

  return fallbackIndex;
}
