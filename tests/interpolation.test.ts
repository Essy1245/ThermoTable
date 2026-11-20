import test from 'node:test';
import assert from 'node:assert/strict';
import {
  findBoundingRowGap,
  formatFullPrecision,
  formatWithColumnPrecision,
  getProgressiveColumns,
  isProgressiveTable,
  solveInterpolatedRow,
} from '../src/interpolation.ts';
import tableA1 from '../src/data/tables/tableA1.ts';
import tableA4 from '../src/data/tables/tableA4.ts';
import tableA6 from '../src/data/tables/tableA6.ts';
import tableA17 from '../src/data/tables/tableA17.ts';
import tableA18 from '../src/data/tables/tableA18.ts';

test('identifies progressive tables vs discrete property tables', () => {
  assert.equal(isProgressiveTable(tableA4), true);
  assert.equal(isProgressiveTable(tableA6), true);
  assert.equal(isProgressiveTable(tableA17), true);
  assert.equal(isProgressiveTable(tableA18), true);
  assert.equal(isProgressiveTable(tableA1), false);
});

test('solves Table A-4 saturated water forward from T and backwards from hf', () => {
  assert.equal(tableA4.type, 'saturated');
  const idx20 = tableA4.rows.findIndex((r) => r.T?.v === 20);
  assert.ok(idx20 >= 0);
  assert.equal(tableA4.rows[idx20 + 1].T?.v, 25);

  const forward = solveInterpolatedRow(
    tableA4,
    { id: 'test-1', afterIndex: idx20, dominatingColId: 'T', inputValue: '22.5' },
    'C',
    'kPa'
  );
  assert.equal(forward.isValidInput, true);
  assert.equal(forward.isExtrapolated, false);
  assert.ok(Math.abs((forward.weight ?? 0) - 0.5) < 1e-12);

  const expectedHf = (tableA4.rows[idx20].hf!.v + tableA4.rows[idx20 + 1].hf!.v) / 2;
  assert.ok(Math.abs(forward.cells.hf.value - expectedHf) < 1e-9);
  assert.equal(
    forward.cells.hf.display,
    formatWithColumnPrecision(expectedHf, tableA4.rows[idx20].hf!.s, tableA4.rows[idx20 + 1].hf!.s)
  );

  // Reverse solve given hf = 100 kJ/kg between T=20 (83.915) and T=25 (104.83)
  const reverse = solveInterpolatedRow(
    tableA4,
    { id: 'test-2', afterIndex: idx20, dominatingColId: 'hf', inputValue: '100' },
    'C',
    'kPa'
  );
  assert.equal(reverse.isValidInput, true);
  assert.equal(reverse.isExtrapolated, false);
  const w = (100 - tableA4.rows[idx20].hf!.v) / (tableA4.rows[idx20 + 1].hf!.v - tableA4.rows[idx20].hf!.v);
  assert.ok(Math.abs((reverse.weight ?? 0) - w) < 1e-12);
  assert.ok(Math.abs(reverse.cells.T.value - (20 + w * 5)) < 1e-9);
  assert.ok(reverse.cells.T.analyticSubstituted.includes('100'));
});

test('solves Table A-17 in both K and C with column vs full precision', () => {
  assert.equal(tableA17.type, 'ideal_gas_air');
  const idx298 = tableA17.rows.findIndex((r) => r.T.v === 298);
  assert.ok(idx298 >= 0);
  assert.equal(tableA17.rows[idx298 + 1].T.v, 300);

  const solvedK = solveInterpolatedRow(
    tableA17,
    { id: 'air-k', afterIndex: idx298, dominatingColId: 'T', inputValue: '299' },
    'K',
    'kPa'
  );
  assert.equal(solvedK.isValidInput, true);
  assert.ok(Math.abs((solvedK.weight ?? 0) - 0.5) < 1e-12);

  const expectedH = (tableA17.rows[idx298].h.v + tableA17.rows[idx298 + 1].h.v) / 2;
  assert.equal(solvedK.cells.h.display, expectedH.toFixed(2));
  assert.equal(solvedK.cells.h.fullPrecision, formatFullPrecision(expectedH, tableA17.rows[idx298].h.s, tableA17.rows[idx298 + 1].h.s));
  assert.ok(solvedK.cells.h.fullPrecision.length > solvedK.cells.h.display.length);

  // 299 K = 25.85 °C between 24.85 °C (298 K) and 26.85 °C (300 K)
  const solvedC = solveInterpolatedRow(
    tableA17,
    { id: 'air-c', afterIndex: idx298, dominatingColId: 'T', inputValue: '25.85' },
    'C',
    'kPa'
  );
  assert.equal(solvedC.isValidInput, true);
  assert.ok(Math.abs((solvedC.weight ?? 0) - 0.5) < 1e-10);
  assert.equal(solvedC.cells.h.display, solvedK.cells.h.display);
});

test('preserves thousands commas on Table A-18 and finds bounding row gaps', () => {
  assert.equal(tableA18.type, 'ideal_gas_molar');
  const idx220 = tableA18.rows.findIndex((r) => r.T.v === 220);
  assert.ok(idx220 >= 0);

  const gap = findBoundingRowGap(tableA18, 'T', 225, 'K', 'kPa');
  assert.equal(gap, idx220);

  const solved = solveInterpolatedRow(
    tableA18,
    { id: 'n2-225', afterIndex: gap, dominatingColId: 'T', inputValue: '225' },
    'K',
    'kPa'
  );
  assert.equal(solved.isValidInput, true);
  assert.ok(solved.cells.h_bar.display.includes(','));
  assert.equal(solved.cells.h_bar.display, '6,537');
  assert.equal(solved.cells.h_bar.fullPrecision, '6,537.00');

  // Extrapolation detection when input is outside surrounding pair
  const extrap = solveInterpolatedRow(
    tableA18,
    { id: 'n2-extrap', afterIndex: gap, dominatingColId: 'T', inputValue: '250' },
    'K',
    'kPa'
  );
  assert.equal(extrap.isValidInput, true);
  assert.equal(extrap.isExtrapolated, true);
});

test('lists progressive columns and supports superheated Sat. row interpolation', () => {
  assert.equal(tableA6.type, 'superheated');
  const cols = getProgressiveColumns(tableA6, 'C', 'MPa');
  assert.deepEqual(
    cols.map((c) => c.id),
    ['T', 'v', 'u', 'h', 's']
  );

  // Block with Sat. row at index 0 followed by first superheated temp
  const blockIdx = tableA6.blocks.findIndex((b) => b.rows[0]?.isSaturationState && b.Tsat.s !== 'N/A');
  assert.ok(blockIdx >= 0);
  const block = tableA6.blocks[blockIdx];
  const midT = (block.Tsat.v + block.rows[1].T!.v) / 2;
  const solved = solveInterpolatedRow(
    tableA6,
    { id: 'sup-1', blockIndex: blockIdx, afterIndex: 0, dominatingColId: 'T', inputValue: String(midT) },
    'C',
    'MPa'
  );
  assert.equal(solved.isValidInput, true);
  assert.ok(Math.abs((solved.weight ?? 0) - 0.5) < 1e-10);
});
