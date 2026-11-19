import type { ThermoTableData } from '../types';
import tableA1 from './tableA1';
import tableA2a from './tableA2a';
import tableA2b from './tableA2b';
import tableA2c from './tableA2c';
import tableA3a from './tableA3a';
import tableA3b from './tableA3b';
import tableA3c from './tableA3c';
import tableA4 from './tableA4';
import tableA5 from './tableA5';
import tableA6 from './tableA6';
import tableA7 from './tableA7';
import tableA11 from './tableA11';
import tableA12 from './tableA12';
import tableA13 from './tableA13';
import tableA17 from './tableA17';
import tableA18 from './tableA18';
import tableA19 from './tableA19';

export {
  tableA1,
  tableA2a,
  tableA2b,
  tableA2c,
  tableA3a,
  tableA3b,
  tableA3c,
  tableA4,
  tableA5,
  tableA6,
  tableA7,
  tableA11,
  tableA12,
  tableA13,
  tableA17,
  tableA18,
  tableA19,
};

export const TABLES_MAP: Record<string, ThermoTableData> = {
  'A-1': tableA1,
  'A-2': tableA2a,
  'A-2a': tableA2a,
  'A-2b': tableA2b,
  'A-2c': tableA2c,
  'A-3': tableA3a,
  'A-3a': tableA3a,
  'A-3b': tableA3b,
  'A-3c': tableA3c,
  'A-4': tableA4,
  'A-5': tableA5,
  'A-6': tableA6,
  'A-7': tableA7,
  'A-11': tableA11,
  'A-12': tableA12,
  'A-13': tableA13,
  'A-17': tableA17,
  'A-18': tableA18,
  'A-19': tableA19,
};

export function getTableData(id: string): ThermoTableData | undefined {
  return TABLES_MAP[id];
}
