import test from 'node:test';
import assert from 'node:assert/strict';
import { formatPressure } from '../src/data/pressureUnits.ts';

test('converts saturation pressure without dropping source precision', () => {
  const pressure = { v: 0.6117, s: '0.6117' };
  assert.equal(formatPressure(pressure, 'kPa', 'MPa'), '0.0006117');
  assert.equal(formatPressure(pressure, 'kPa', 'bar'), '0.006117');
  assert.equal(formatPressure(pressure, 'kPa', 'kPa'), '0.6117');
});

test('converts isobar and critical pressures without rounding away digits', () => {
  assert.equal(formatPressure({ v: 1.25, s: '1.25' }, 'MPa', 'bar'), '12.5');
  assert.equal(formatPressure({ v: 4.059, s: '4.059' }, 'MPa', 'kPa'), '4059');
  assert.equal(formatPressure({ v: 22.064, s: '22.064' }, 'MPa', 'bar'), '220.64');
  assert.equal(formatPressure({ v: 10556, s: '10,556' }, 'kPa', 'MPa'), '10.556');
  assert.equal(formatPressure(undefined, 'kPa', 'MPa'), '-');
});
