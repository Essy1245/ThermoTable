import test from 'node:test';
import assert from 'node:assert/strict';
import tableA18 from '../src/data/tables/tableA18.ts';
import tableA19 from '../src/data/tables/tableA19.ts';

test('ideal-gas rows preserve the values printed in the source', () => {
  const rows = [
    { table: tableA18, T: 1320, h: '40,853', u: '29,378' },
    { table: tableA18, T: 1960, h: '63,381', u: '47,075' },
    { table: tableA19, T: 460, h: '13,525', u: '9,710' },
  ];
  for (const { table, T, h, u } of rows) {
    assert.equal(table.type, 'ideal_gas_molar');
    const row = table.rows.find(item => item.T.v === T);
    assert.ok(row);
    assert.equal(row.h_bar.s, h);
    assert.equal(row.u_bar.s, u);
  }
});
