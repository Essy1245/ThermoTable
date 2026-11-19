import type { ThermoTableData, ThermoValue } from './data/types';

type TempUnit = 'C' | 'K';
type PressUnit = 'kPa' | 'MPa' | 'bar';

export interface JumpOption {
  id: string;
  label: string;
  /** The rendered column ID, which may differ from the property being searched. */
  columnId: string;
  valuesAt: (index: number) => number[];
}

const numericValue = (value?: ThermoValue): number | undefined => {
  if (!value || !Number.isFinite(value.v) || /^(?:N\/A|—|-)$/i.test(value.s.trim())) return undefined;
  return value.v;
};

const temperature = (value: ThermoValue | undefined, native: TempUnit, display: TempUnit) => {
  const number = numericValue(value);
  if (number === undefined || native === display) return number;
  return native === 'C' ? number + 273.15 : number - 273.15;
};

const pressure = (value: ThermoValue | undefined, native: 'kPa' | 'MPa', display: PressUnit) => {
  const number = numericValue(value);
  if (number === undefined) return undefined;
  const kPa = native === 'MPa' ? number * 1000 : number;
  return display === 'MPa' ? kPa / 1000 : display === 'bar' ? kPa / 100 : kPa;
};

function makeOption<Row>(
  rows: Row[],
  id: string,
  label: string,
  getValues: (row: Row) => Array<number | undefined>,
  columnId = id,
): JumpOption {
  return {
    id,
    label,
    columnId,
    valuesAt: (index) => getValues(rows[index]).filter((value): value is number => value !== undefined && Number.isFinite(value)),
  };
}

/** Options correspond to displayed table values and use the currently selected units. */
export function getJumpOptions(table: ThermoTableData, tempUnit: TempUnit, pressUnit: PressUnit): JumpOption[] {
  const tempLabel = tempUnit === 'C' ? '°C' : 'K';
  switch (table.type) {
    case 'saturated': {
      const rows = table.rows;
      const option = (id: keyof typeof rows[number], label: string) =>
        makeOption(rows, id, label, row => [numericValue(row[id])]);
      const properties = [
        option('vf', 'vf (m³/kg)'), option('vg', 'vg (m³/kg)'),
        option('uf', 'uf (kJ/kg)'), option('ufg', 'ufg (kJ/kg)'), option('ug', 'ug (kJ/kg)'),
        option('hf', 'hf (kJ/kg)'), option('hfg', 'hfg (kJ/kg)'), option('hg', 'hg (kJ/kg)'),
        option('sf', 'sf (kJ/kg·K)'), option('sfg', 'sfg (kJ/kg·K)'), option('sg', 'sg (kJ/kg·K)'),
      ];
      return [
        makeOption(rows, 'T', `Temp (${tempLabel})`, row => [temperature(row.T, 'C', tempUnit)]),
        makeOption(rows, 'P', `Pressure (${pressUnit})`, row => [pressure(row.P, 'kPa', pressUnit)]),
        ...properties.filter(item => rows.some((_, index) => item.valuesAt(index).length)),
      ];
    }
    case 'ideal_gas_air': {
      const rows = table.rows;
      return [
        makeOption(rows, 'T', `Temp (${tempLabel})`, row => [temperature(row.T, 'K', tempUnit)]),
        makeOption(rows, 'h', 'h (kJ/kg)', row => [numericValue(row.h)]),
        makeOption(rows, 'u', 'u (kJ/kg)', row => [numericValue(row.u)]),
        makeOption(rows, 's_deg', 's° (kJ/kg·K)', row => [numericValue(row.s_deg)]),
        makeOption(rows, 's_plus', 's⁺ (kJ/kg·K)', row => [numericValue(row.s_plus)]),
      ];
    }
    case 'ideal_gas_molar': {
      const rows = table.rows;
      return [
        makeOption(rows, 'T', `Temp (${tempLabel})`, row => [temperature(row.T, 'K', tempUnit)]),
        makeOption(rows, 'h_bar', 'h̄ (kJ/kmol)', row => [numericValue(row.h_bar)]),
        makeOption(rows, 'u_bar', 'ū (kJ/kmol)', row => [numericValue(row.u_bar)]),
        makeOption(rows, 's_bar_deg', 's̄° (kJ/kmol·K)', row => [numericValue(row.s_bar_deg)]),
      ];
    }
    case 'specific_heat_temp': {
      const rows = table.rows;
      const gases = [
        ['air', 'Air'], ['co2', 'CO₂'], ['co', 'CO'],
        ['h2', 'H₂'], ['n2', 'N₂'], ['o2', 'O₂'],
      ] as const;
      const properties = [['cp', 'cp'], ['cv', 'cv'], ['k', 'k']] as const;
      return [
        makeOption(rows, 'T', `Temp (${tempLabel})`, row => [temperature(row.T, 'K', tempUnit)]),
        ...gases.flatMap(([gas, label]) => properties.map(([key, symbol]) =>
          makeOption(rows, `${gas}_${key}`, `${label} ${symbol}${key === 'k' ? '' : ' (kJ/kg·K)'}`,
            row => [numericValue(row[gas][key])]))),
      ];
    }
    case 'critical_properties': {
      const rows = table.rows;
      return [
        makeOption(rows, 'M', 'M (kg/kmol)', row => [numericValue(row.M)]),
        makeOption(rows, 'R', 'R (kJ/kg·K)', row => [numericValue(row.R)]),
        makeOption(rows, 'T_cr', `T critical (${tempLabel})`, row => [temperature(row.T_cr, 'K', tempUnit)]),
        makeOption(rows, 'P_cr', `P critical (${pressUnit})`, row => [pressure(row.P_cr, 'MPa', pressUnit)]),
        makeOption(rows, 'v_cr', 'v critical (m³/kmol)', row => [numericValue(row.v_cr)]),
      ];
    }
    case 'specific_heat_300k': {
      const rows = table.rows;
      return [
        makeOption(rows, 'R', 'R (kJ/kg·K)', row => [numericValue(row.R)]),
        makeOption(rows, 'cp', 'cp (kJ/kg·K)', row => [numericValue(row.cp)]),
        makeOption(rows, 'cv', 'cv (kJ/kg·K)', row => [numericValue(row.cv)]),
        makeOption(rows, 'k', 'k', row => [numericValue(row.k)]),
      ];
    }
    case 'specific_heat_poly': {
      const rows = table.rows;
      return [
        makeOption(rows, 'a', 'a', row => [numericValue(row.a)]),
        makeOption(rows, 'b', 'b (full value)', row => [numericValue(row.b)]),
        makeOption(rows, 'c', 'c (full value)', row => [numericValue(row.c)]),
        makeOption(rows, 'd', 'd (full value)', row => [numericValue(row.d)]),
        makeOption(rows, 'T_min', `Min temp (${tempLabel})`, row => [temperature(row.T_min, 'K', tempUnit)], 'tempRange'),
        makeOption(rows, 'T_max', `Max temp (${tempLabel})`, row => [temperature(row.T_max, 'K', tempUnit)], 'tempRange'),
        makeOption(rows, 'errorMax', 'Max error (%)', row => [numericValue(row.errorMax)]),
        makeOption(rows, 'errorAvg', 'Avg error (%)', row => [numericValue(row.errorAvg)]),
      ];
    }
    case 'liquids': {
      const rows = table.rows;
      return [
        makeOption(rows, 'T_boil', `Boiling temp (${tempLabel})`, row => [temperature(row.T_boil, 'C', tempUnit), temperature(row.T_boil_max, 'C', tempUnit)]),
        makeOption(rows, 'h_fg', 'hfg (kJ/kg)', row => [numericValue(row.h_fg), numericValue(row.h_fg_max)]),
        makeOption(rows, 'T_freeze', `Freezing temp (${tempLabel})`, row => [temperature(row.T_freeze, 'C', tempUnit)]),
        makeOption(rows, 'h_if', 'hif (kJ/kg)', row => [numericValue(row.h_if)]),
        makeOption(rows, 'T_liq', `Liquid temp (${tempLabel})`, row => [temperature(row.T_liq, 'C', tempUnit)]),
        makeOption(rows, 'rho', 'ρ (kg/m³)', row => [numericValue(row.rho)]),
        makeOption(rows, 'cp', 'cp (kJ/kg·K)', row => [numericValue(row.cp)]),
      ];
    }
    case 'solids': {
      const rows = table.rows;
      return [
        makeOption(rows, 'T', `Temp (${tempLabel})`, row => [temperature(row.T, row.T_nativeUnit || 'C', tempUnit)]),
        makeOption(rows, 'rho', 'ρ (kg/m³)', row => [numericValue(row.rho)]),
        makeOption(rows, 'cp', 'cp (kJ/kg·K)', row => [numericValue(row.cp)]),
      ];
    }
    case 'foods': {
      const rows = table.rows;
      return [
        makeOption(rows, 'waterContent', 'Water (%)', row => [numericValue(row.waterContent)]),
        makeOption(rows, 'T_freeze', `Freezing temp (${tempLabel})`, row => [temperature(row.T_freeze, 'C', tempUnit)]),
        makeOption(rows, 'cp_above', 'cp above (kJ/kg·K)', row => [numericValue(row.cp_above)]),
        makeOption(rows, 'cp_below', 'cp below (kJ/kg·K)', row => [numericValue(row.cp_below)]),
        makeOption(rows, 'h_if', 'hif (kJ/kg)', row => [numericValue(row.h_if)]),
      ];
    }
    case 'superheated':
    case 'compressed':
      return [];
  }
}

/** Returns the first closest row, ignoring missing or non-finite cells. */
export function findNearestRow(option: JumpOption, count: number, target: number): number {
  if (!Number.isFinite(target)) return -1;
  let bestIndex = -1;
  let bestDifference = Infinity;
  for (let index = 0; index < count; index++) {
    for (const value of option.valuesAt(index)) {
      const difference = Math.abs(value - target);
      if (difference < bestDifference) {
        bestDifference = difference;
        bestIndex = index;
      }
    }
  }
  return bestIndex;
}
