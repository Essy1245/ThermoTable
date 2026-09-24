import type { ThermoTableData } from '../types';
import tableA4 from './tableA4';
import tableA5 from './tableA5';
import tableA6 from './tableA6';
import tableA7 from './tableA7';
import tableA8 from './tableA8';
import tableA11 from './tableA11';
import tableA12 from './tableA12';
import tableA13 from './tableA13';
import tableA17 from './tableA17';
import tableA18 from './tableA18';
import tableA19 from './tableA19';
import tableA20 from './tableA20';
import tableA21 from './tableA21';
import tableA22 from './tableA22';
import tableA23 from './tableA23';
import tableA24 from './tableA24';
import tableA25 from './tableA25';

export {
  tableA4,
  tableA5,
  tableA6,
  tableA7,
  tableA8,
  tableA11,
  tableA12,
  tableA13,
  tableA17,
  tableA18,
  tableA19,
  tableA20,
  tableA21,
  tableA22,
  tableA23,
  tableA24,
  tableA25,
};

export const TABLES_MAP: Record<string, ThermoTableData> = {
  'A-4': tableA4,
  'A-5': tableA5,
  'A-6': tableA6,
  'A-7': tableA7,
  'A-8': tableA8,
  'A-11': tableA11,
  'A-12': tableA12,
  'A-13': tableA13,
  'A-17': tableA17,
  'A-18': tableA18,
  'A-19': tableA19,
  'A-20': tableA20,
  'A-21': tableA21,
  'A-22': tableA22,
  'A-23': tableA23,
  'A-24': tableA24,
  'A-25': tableA25,
};

export function getTableData(id: string): ThermoTableData | undefined {
  return TABLES_MAP[id];
}
