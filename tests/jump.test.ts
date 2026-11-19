import test from 'node:test';
import assert from 'node:assert/strict';
import { findNearestRow, getJumpOptions } from '../src/jump.ts';
import tableA1 from '../src/data/tables/tableA1.ts';
import tableA2b from '../src/data/tables/tableA2b.ts';
import tableA2c from '../src/data/tables/tableA2c.ts';
import tableA3a from '../src/data/tables/tableA3a.ts';
import tableA4 from '../src/data/tables/tableA4.ts';
import tableA17 from '../src/data/tables/tableA17.ts';

function find(table: typeof tableA1, property: string, target: number, tempUnit: 'C' | 'K' = 'K', pressUnit: 'kPa' | 'MPa' | 'bar' = 'MPa') {
  assert.ok('rows' in table);
  const option = getJumpOptions(table, tempUnit, pressUnit).find(item => item.id === property);
  assert.ok(option, `missing jump option ${property}`);
  return findNearestRow(option, table.rows.length, target);
}

test('jumps to the closest A-17 property, including negative entropy', () => {
  assert.ok('rows' in tableA17);
  const h = find(tableA17, 'h', 400);
  assert.equal(tableA17.rows[h].T.v, 400);
  const entropy = find(tableA17, 's_plus', -0.22503);
  assert.equal(tableA17.rows[entropy].T.v, 200);
});

test('compares index temperatures and pressures in the selected display unit', () => {
  assert.ok('rows' in tableA17 && 'rows' in tableA1 && 'rows' in tableA4);
  assert.equal(tableA17.rows[find(tableA17, 'T', 126.85, 'C')].T.v, 400);
  assert.equal(tableA1.rows[find(tableA1, 'P_cr', 37.7, 'K', 'bar')].substance, 'Air');
  assert.equal(tableA4.rows[find(tableA4, 'T', 373.15, 'K')].T?.v, 100);
});

test('searches non-index, nested and scientific-notation fields', () => {
  assert.ok('rows' in tableA2b && 'rows' in tableA2c && 'rows' in tableA4);
  assert.equal(tableA2b.rows[find(tableA2b, 'co2_cp', 0.939)].T.v, 400);
  assert.equal(tableA2c.rows[find(tableA2c, 'b', -0.001571)].substance, 'Nitrogen');
  const hf = find(tableA4, 'hf', 419.04);
  assert.equal(tableA4.rows[hf].T?.v, 100);
});

test('skips missing values and recognizes range endpoints', () => {
  assert.ok('rows' in tableA3a);
  const upper = tableA3a.rows.findIndex(row => row.T_boil_max);
  assert.notEqual(upper, -1);
  assert.equal(find(tableA3a, 'T_boil', tableA3a.rows[upper].T_boil_max!.v, 'C'), upper);
  const option = getJumpOptions(tableA3a, 'C', 'kPa').find(item => item.id === 'h_if')!;
  assert.equal(findNearestRow(option, tableA3a.rows.length, Number.NaN), -1);
  assert.deepEqual(option.valuesAt(tableA3a.rows.findIndex(row => !row.h_if)), []);
});
