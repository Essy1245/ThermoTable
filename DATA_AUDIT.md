# Thermodynamic Table Audit

The tables currently present in the application were compared with the supplied `Property_Tables_SI.pdf`. The reviewed file is identical to the PDF in this repository (SHA-256: `d32869c325dd0bce2838ceb23fae1297e92fdcd60027c0f570aeee8edfade27f`). Page numbers below refer to PDF pages, not the printed appendix numbers.

## Coverage

| Tables | PDF pages | Review |
| --- | --- | --- |
| A-1, A-2(a), A-2(b), A-2(c) | 2–5 | Compared names, order, units, coefficients and values. A-1 has 34 rows; A-2(a) has 16; A-2(b) has 14 temperatures with six gas-property triplets each; A-2(c) has 28 rows. |
| A-3(a), A-3(b), A-3(c) | 6–7 | Reviewed the 39 liquid, 48 solid and 22 food rows, including ranges, mixed source temperature units, names, order and notes. |
| A-4, A-5 | 8–11 | Compared 76 and 73 rows, respectively, including all 13 values per row. |
| A-6, A-7 | 12–16 | Compared all 545 and 111 property rows, respectively, along with pressure headings and saturation entries. |
| A-11, A-12 | 20–22 | Compared 56 and 34 rows, respectively, including all 13 values per row. |
| A-13 | 23–24 | Compared all 262 property rows along with pressure headings and saturation entries. |
| A-17, A-18, A-19 | 29–34 | Compared all 121, 156 and 156 rows, respectively, including the source's 0 K reference rows in A-18 and A-19. |

The isobar review compared every printed `v/u/h/s` quadruplet by source page and temperature. PDF text extraction removes blank cells, so sparse rows cannot always be assigned mechanically to individual isobar columns; the column associations were also reviewed against rendered PDF pages. The mobile-friendly web layout may organize side-by-side source columns vertically, while preserving the order within each source list.

No verified transcription errors were found in the numeric data. The review corrected the A-2(c) column headings, which previously implied an additional scale factor even though the coefficients already contained their printed exponents. It also restored source and interpretive notes, including the food freezing-point explanation, and added the A-2(c) equation and units to snippets.

## Additional checks

- Pressure unit conversion retains the precision of the printed source rather than rounding every converted result to four decimal places.
- Unit-aware property jumps, missing values, ranges, scientific coefficients and pressure conversion have focused regression tests in `tests/`.
