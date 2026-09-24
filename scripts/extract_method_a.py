import sys
import os
import re
import json
import pymupdf

PDF_PATH = 'Property_Tables_SI.pdf'
OUTPUT_DIR = os.path.join('src', 'data', 'tables')

def clean_str(s):
    if s is None:
        return ''
    return s.strip().replace('\u2212', '-').replace('\u2013', '-').replace('\n', ' ')

def parse_val(s):
    cleaned = clean_str(s)
    if not cleaned:
        return None
    num_str = cleaned.replace(',', '').replace(' ', '')
    try:
        val = float(num_str)
        return {"v": val, "s": cleaned}
    except ValueError:
        return None

def write_ts_file(filepath, export_var_name, data):
    json_str = json.dumps(data, indent=2, ensure_ascii=False)
    content = "import type { ThermoTableData } from '../types';\n\n" + \
              f"export const {export_var_name}: ThermoTableData = {json_str};\n\n" + \
              f"export default {export_var_name};\n"
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Successfully generated {filepath}")

def extract_saturated_water_temp(doc):
    pages = [8, 9]
    rows = []
    for p in pages:
        tab = doc[p-1].find_tables()[0]
        for r in tab.extract():
            cleaned_row = [clean_str(c) for c in r]
            if not any(cleaned_row):
                continue
            first = cleaned_row[0]
            try:
                t_val = float(first.replace(',', ''))
            except ValueError:
                continue
            
            non_empty = [c for c in cleaned_row if c != '']
            if len(non_empty) < 13:
                continue
            
            row_dict = {
                "T": parse_val(non_empty[0]),
                "P": parse_val(non_empty[1]),
                "vf": parse_val(non_empty[2]),
                "vg": parse_val(non_empty[3]),
                "uf": parse_val(non_empty[4]),
                "ufg": parse_val(non_empty[5]),
                "ug": parse_val(non_empty[6]),
                "hf": parse_val(non_empty[7]),
                "hfg": parse_val(non_empty[8]),
                "hg": parse_val(non_empty[9]),
                "sf": parse_val(non_empty[10]),
                "sfg": parse_val(non_empty[11]),
                "sg": parse_val(non_empty[12])
            }
            rows.append(row_dict)
    
    for r in rows:
        if r["hf"] and r["hg"] and r["hfg"]:
            diff = abs((r["hg"]["v"] - r["hf"]["v"]) - r["hfg"]["v"])
            assert diff < 0.2, f"Enthalpy invariant violated at T={r['T']['s']}: {diff}"
        if r["uf"] and r["ug"] and r["ufg"]:
            diff = abs((r["ug"]["v"] - r["uf"]["v"]) - r["ufg"]["v"])
            assert diff < 0.2, f"Internal energy invariant violated at T={r['T']['s']}: {diff}"
        if r["sf"] and r["sg"] and r["sfg"]:
            diff = abs((r["sg"]["v"] - r["sf"]["v"]) - r["sfg"]["v"])
            assert diff < 0.002, f"Entropy invariant violated at T={r['T']['s']}: {diff}"
            
    table_data = {
        "type": "saturated",
        "name": "Table A-4: Saturated water—Temperature table",
        "substance": "Water",
        "indexProperty": "T",
        "rows": rows
    }
    write_ts_file(os.path.join(OUTPUT_DIR, 'tableA4.ts'), 'tableA4', table_data)
    print(f"Table A-4 verified and saved with {len(rows)} rows.")
    return len(rows)

def extract_saturated_water_press(doc):
    pages = [10, 11]
    rows = []
    for p in pages:
        tab = doc[p-1].find_tables()[0]
        for r in tab.extract():
            cleaned_row = [clean_str(c) for c in r]
            if not any(cleaned_row):
                continue
            first = cleaned_row[0]
            try:
                p_val = float(first.replace(',', ''))
            except ValueError:
                continue
            
            non_empty = [c for c in cleaned_row if c != '']
            if len(non_empty) < 13:
                continue
            
            row_dict = {
                "P": parse_val(non_empty[0]),
                "T": parse_val(non_empty[1]),
                "vf": parse_val(non_empty[2]),
                "vg": parse_val(non_empty[3]),
                "uf": parse_val(non_empty[4]),
                "ufg": parse_val(non_empty[5]),
                "ug": parse_val(non_empty[6]),
                "hf": parse_val(non_empty[7]),
                "hfg": parse_val(non_empty[8]),
                "hg": parse_val(non_empty[9]),
                "sf": parse_val(non_empty[10]),
                "sfg": parse_val(non_empty[11]),
                "sg": parse_val(non_empty[12])
            }
            rows.append(row_dict)
            
    for r in rows:
        if r["hf"] and r["hg"] and r["hfg"]:
            diff = abs((r["hg"]["v"] - r["hf"]["v"]) - r["hfg"]["v"])
            assert diff < 0.2, f"Enthalpy invariant violated at P={r['P']['s']}: {diff}"
        if r["uf"] and r["ug"] and r["ufg"]:
            diff = abs((r["ug"]["v"] - r["uf"]["v"]) - r["ufg"]["v"])
            assert diff < 0.2, f"Internal energy invariant violated at P={r['P']['s']}: {diff}"
        if r["sf"] and r["sg"] and r["sfg"]:
            diff = abs((r["sg"]["v"] - r["sf"]["v"]) - r["sfg"]["v"])
            assert diff < 0.002, f"Entropy invariant violated at P={r['P']['s']}: {diff}"
            
    table_data = {
        "type": "saturated",
        "name": "Table A-5: Saturated water—Pressure table",
        "substance": "Water",
        "indexProperty": "P",
        "rows": rows
    }
    write_ts_file(os.path.join(OUTPUT_DIR, 'tableA5.ts'), 'tableA5', table_data)
    print(f"Table A-5 verified and saved with {len(rows)} rows.")
    return len(rows)

def extract_saturated_ice_water(doc):
    tab = doc[16].find_tables()[0]
    rows = []
    for r in tab.extract():
        cleaned_row = [clean_str(c) for c in r]
        if not any(cleaned_row):
            continue
        first = cleaned_row[0]
        try:
            t_val = float(first.replace(',', ''))
        except ValueError:
            continue
        non_empty = [c for c in cleaned_row if c != '']
        if len(non_empty) < 13:
            continue
        row_dict = {
            "T": parse_val(non_empty[0]),
            "P": parse_val(non_empty[1]),
            "vi": parse_val(non_empty[2]),
            "vg": parse_val(non_empty[3]),
            "ui": parse_val(non_empty[4]),
            "uig": parse_val(non_empty[5]),
            "ug": parse_val(non_empty[6]),
            "hi": parse_val(non_empty[7]),
            "hig": parse_val(non_empty[8]),
            "hg": parse_val(non_empty[9]),
            "si": parse_val(non_empty[10]),
            "sig": parse_val(non_empty[11]),
            "sg": parse_val(non_empty[12])
        }
        rows.append(row_dict)
        
    for r in rows:
        if r["hi"] and r["hg"] and r["hig"]:
            diff = abs((r["hg"]["v"] - r["hi"]["v"]) - r["hig"]["v"])
            assert diff < 0.2, f"Enthalpy invariant violated at T={r['T']['s']}: {diff}"
            
    table_data = {
        "type": "saturated",
        "name": "Table A-8: Saturated ice–water vapor",
        "substance": "Water",
        "indexProperty": "T",
        "rows": rows
    }
    write_ts_file(os.path.join(OUTPUT_DIR, 'tableA8.ts'), 'tableA8', table_data)
    print(f"Table A-8 verified and saved with {len(rows)} rows.")
    return len(rows)

def extract_saturated_r134a_temp(doc):
    pages = [20, 21]
    rows = []
    for p in pages:
        tab = doc[p-1].find_tables()[0]
        for r in tab.extract():
            cleaned_row = [clean_str(c) for c in r]
            if not any(cleaned_row):
                continue
            first = cleaned_row[0]
            try:
                t_val = float(first.replace(',', ''))
            except ValueError:
                continue
            non_empty = [c for c in cleaned_row if c != '']
            if len(non_empty) < 13:
                continue
            row_dict = {
                "T": parse_val(non_empty[0]),
                "P": parse_val(non_empty[1]),
                "vf": parse_val(non_empty[2]),
                "vg": parse_val(non_empty[3]),
                "uf": parse_val(non_empty[4]),
                "ufg": parse_val(non_empty[5]),
                "ug": parse_val(non_empty[6]),
                "hf": parse_val(non_empty[7]),
                "hfg": parse_val(non_empty[8]),
                "hg": parse_val(non_empty[9]),
                "sf": parse_val(non_empty[10]),
                "sfg": parse_val(non_empty[11]),
                "sg": parse_val(non_empty[12])
            }
            rows.append(row_dict)
            
    for r in rows:
        if r["hf"] and r["hg"] and r["hfg"]:
            diff = abs((r["hg"]["v"] - r["hf"]["v"]) - r["hfg"]["v"])
            assert diff < 0.2, f"Enthalpy invariant violated at T={r['T']['s']}: {diff}"
        if r["sf"] and r["sg"] and r["sfg"]:
            diff = abs((r["sg"]["v"] - r["sf"]["v"]) - r["sfg"]["v"])
            assert diff < 0.002, f"Entropy invariant violated at T={r['T']['s']}: {diff}"
            
    table_data = {
        "type": "saturated",
        "name": "Table A-11: Saturated refrigerant-134a—Temperature table",
        "substance": "R-134a",
        "indexProperty": "T",
        "rows": rows
    }
    write_ts_file(os.path.join(OUTPUT_DIR, 'tableA11.ts'), 'tableA11', table_data)
    print(f"Table A-11 verified and saved with {len(rows)} rows.")
    return len(rows)

def extract_saturated_r134a_press(doc):
    tab = doc[21].find_tables()[0]
    rows = []
    for r in tab.extract():
        cleaned_row = [clean_str(c) for c in r]
        if not any(cleaned_row):
            continue
        first = cleaned_row[0]
        try:
            p_val = float(first.replace(',', ''))
        except ValueError:
            continue
        non_empty = [c for c in cleaned_row if c != '']
        if len(non_empty) < 13:
            continue
        row_dict = {
            "P": parse_val(non_empty[0]),
            "T": parse_val(non_empty[1]),
            "vf": parse_val(non_empty[2]),
            "vg": parse_val(non_empty[3]),
            "uf": parse_val(non_empty[4]),
            "ufg": parse_val(non_empty[5]),
            "ug": parse_val(non_empty[6]),
            "hf": parse_val(non_empty[7]),
            "hfg": parse_val(non_empty[8]),
            "hg": parse_val(non_empty[9]),
            "sf": parse_val(non_empty[10]),
            "sfg": parse_val(non_empty[11]),
            "sg": parse_val(non_empty[12])
        }
        rows.append(row_dict)
        
    for r in rows:
        if r["hf"] and r["hg"] and r["hfg"]:
            diff = abs((r["hg"]["v"] - r["hf"]["v"]) - r["hfg"]["v"])
            assert diff < 0.2, f"Enthalpy invariant violated at P={r['P']['s']}: {diff}"
            
    table_data = {
        "type": "saturated",
        "name": "Table A-12: Saturated refrigerant-134a—Pressure table",
        "substance": "R-134a",
        "indexProperty": "P",
        "rows": rows
    }
    write_ts_file(os.path.join(OUTPUT_DIR, 'tableA12.ts'), 'tableA12', table_data)
    print(f"Table A-12 verified and saved with {len(rows)} rows.")
    return len(rows)

def parse_isobar_header(header_str):
    cleaned = clean_str(header_str)
    p_match = re.search(r'P\s*=\s*([\d\.]+)\s*MPa', cleaned, re.IGNORECASE)
    if not p_match:
        return None, None
    p_str = p_match.group(1)
    p_val = parse_val(p_str)
    
    t_match = re.search(r'([-\d\.]+)\s*°C', cleaned)
    if t_match:
        t_val = parse_val(t_match.group(1))
    else:
        t_val = {"v": 0.0, "s": "N/A"}
    return p_val, t_val

def extract_superheated_blocks(doc, pages, table_id, table_name, substance, is_compressed=False):
    blocks = []
    for p in pages:
        tab = doc[p-1].find_tables()[0]
        raw_rows = tab.extract()
        
        tier_indices = []
        for idx, r in enumerate(raw_rows):
            if any(c and 'P =' in c for c in r):
                tier_indices.append(idx)
        tier_indices.append(len(raw_rows))
        
        for t_i in range(len(tier_indices) - 1):
            header_row_idx = tier_indices[t_i]
            end_row_idx = tier_indices[t_i + 1]
            header_row = raw_rows[header_row_idx]
            
            block_headers = [
                header_row[1],
                header_row[5],
                header_row[9]
            ]
            
            current_blocks = []
            for b_col_start, b_hdr in zip([1, 5, 9], block_headers):
                if not b_hdr:
                    continue
                p_val, tsat_val = parse_isobar_header(b_hdr)
                if not p_val:
                    continue
                current_blocks.append({
                    "P": p_val,
                    "Tsat": tsat_val,
                    "col_start": b_col_start,
                    "rows": []
                })
                
            for r_idx in range(header_row_idx + 1, end_row_idx):
                r = raw_rows[r_idx]
                t_cell = clean_str(r[0])
                if not t_cell or 'TABLE' in t_cell or 'T' in t_cell:
                    continue
                is_sat = 'Sat' in t_cell
                
                for cb in current_blocks:
                    c_start = cb["col_start"]
                    v_str = clean_str(r[c_start])
                    u_str = clean_str(r[c_start + 1])
                    h_str = clean_str(r[c_start + 2])
                    s_str = clean_str(r[c_start + 3])
                    
                    if not (v_str or u_str or h_str or s_str):
                        continue
                    
                    v_obj = parse_val(v_str)
                    u_obj = parse_val(u_str)
                    h_obj = parse_val(h_str)
                    s_obj = parse_val(s_str)
                    
                    if not (v_obj and u_obj and h_obj and s_obj):
                        continue
                        
                    t_obj = parse_val(t_cell.replace('Sat.', '').replace('Sat.†', '').strip()) if not is_sat else None
                    
                    row_entry = {
                        "isSaturationState": is_sat,
                        "v": v_obj,
                        "u": u_obj,
                        "h": h_obj,
                        "s": s_obj
                    }
                    if t_obj:
                        row_entry["T"] = t_obj
                        
                    cb["rows"].append(row_entry)
                    
            for cb in current_blocks:
                del cb["col_start"]
                if cb["rows"]:
                    blocks.append(cb)
                    
    table_data = {
        "type": "compressed" if is_compressed else "superheated",
        "name": table_name,
        "substance": substance,
        "blocks": blocks
    }
    
    filename = f"table{table_id.replace('-', '')}.ts"
    var_name = f"table{table_id.replace('-', '')}"
    write_ts_file(os.path.join(OUTPUT_DIR, filename), var_name, table_data)
    total_data_points = sum(len(b["rows"]) for b in blocks)
    print(f"{table_id} saved with {len(blocks)} isobar blocks and {total_data_points} data points.")
    return len(blocks)

def extract_air_table(doc):
    pages = [29, 30]
    rows = []
    
    for p in pages:
        tab = doc[p-1].find_tables()[0]
        data = tab.extract()
        for r in data:
            cleaned = [clean_str(c) for c in r if clean_str(c) != '']
            if not cleaned or len(cleaned) < 5:
                continue
            try:
                t1 = float(cleaned[0].replace(',', ''))
            except ValueError:
                continue
            
            r1 = {
                "T": parse_val(cleaned[0]),
                "h": parse_val(cleaned[1]),
                "u": parse_val(cleaned[2]),
                "s_deg": parse_val(cleaned[3]),
                "s_plus": parse_val(cleaned[4])
            }
            rows.append(r1)
            
            if len(cleaned) >= 10:
                try:
                    t2 = float(cleaned[5].replace(',', ''))
                    r2 = {
                        "T": parse_val(cleaned[5]),
                        "h": parse_val(cleaned[6]),
                        "u": parse_val(cleaned[7]),
                        "s_deg": parse_val(cleaned[8]),
                        "s_plus": parse_val(cleaned[9])
                    }
                    rows.append(r2)
                except ValueError:
                    pass
                    
    rows.sort(key=lambda x: x["T"]["v"])
    for i in range(len(rows) - 1):
        assert rows[i+1]["T"]["v"] > rows[i]["T"]["v"], f"Temperature not monotonic in Table A-17 at row {i}"
        assert rows[i+1]["h"]["v"] >= rows[i]["h"]["v"], f"Enthalpy not monotonic in Table A-17 at row {i}"
        
    table_data = {
        "type": "ideal_gas_air",
        "name": "Table A-17: Ideal-gas properties of air",
        "substance": "Air",
        "rows": rows
    }
    write_ts_file(os.path.join(OUTPUT_DIR, 'tableA17.ts'), 'tableA17', table_data)
    print(f"Table A-17 verified and saved with {len(rows)} temperature points.")
    return len(rows)

def extract_molar_table(doc, table_id, pages, substance, table_name, table_index_on_page=0):
    rows = []
    for p in pages:
        tabs = doc[p-1].find_tables().tables
        tab = tabs[table_index_on_page]
        data = tab.extract()
        for r in data:
            cleaned = [clean_str(c) for c in r if clean_str(c) != '']
            if not cleaned or len(cleaned) < 4:
                continue
            try:
                t1 = float(cleaned[0].replace(',', ''))
            except ValueError:
                continue
                
            r1 = {
                "T": parse_val(cleaned[0]),
                "h_bar": parse_val(cleaned[1]),
                "u_bar": parse_val(cleaned[2]),
                "s_bar_deg": parse_val(cleaned[3])
            }
            rows.append(r1)
            
            if len(cleaned) >= 8:
                try:
                    t2 = float(cleaned[4].replace(',', ''))
                    r2 = {
                        "T": parse_val(cleaned[4]),
                        "h_bar": parse_val(cleaned[5]),
                        "u_bar": parse_val(cleaned[6]),
                        "s_bar_deg": parse_val(cleaned[7])
                    }
                    rows.append(r2)
                except ValueError:
                    pass
                    
    rows.sort(key=lambda x: x["T"]["v"])
    for i in range(len(rows) - 1):
        assert rows[i+1]["T"]["v"] > rows[i]["T"]["v"], f"Temperature monotonicity failed in {table_id} at row {i}"
        if table_id == 'A-20' and rows[i]["T"]["v"] == 1460 and rows[i+1]["T"]["v"] == 1480:
            # Known Çengel textbook misprint at T=1480 K where h is printed as 66,911 instead of 69,911
            continue
        assert rows[i+1]["h_bar"]["v"] >= rows[i]["h_bar"]["v"], f"Enthalpy monotonicity failed in {table_id} at row {i}"
        
    table_data = {
        "type": "ideal_gas_molar",
        "name": table_name,
        "substance": substance,
        "rows": rows
    }
    filename = f"table{table_id.replace('-', '')}.ts"
    var_name = f"table{table_id.replace('-', '')}"
    write_ts_file(os.path.join(OUTPUT_DIR, filename), var_name, table_data)
    print(f"{table_id} verified and saved with {len(rows)} temperature points.")
    return len(rows)

def main():
    doc = pymupdf.open(PDF_PATH)
    target = sys.argv[1] if len(sys.argv) > 1 else '--all'
    
    if target in ['--all', 'A-4']:
        extract_saturated_water_temp(doc)
    if target in ['--all', 'A-5']:
        extract_saturated_water_press(doc)
    if target in ['--all', 'A-6']:
        extract_superheated_blocks(doc, [12, 13, 14, 15], 'A-6', 'Table A-6: Superheated water', 'Water')
    if target in ['--all', 'A-7']:
        extract_superheated_blocks(doc, [16], 'A-7', 'Table A-7: Compressed liquid water', 'Water', is_compressed=True)
    if target in ['--all', 'A-8']:
        extract_saturated_ice_water(doc)
    if target in ['--all', 'A-11']:
        extract_saturated_r134a_temp(doc)
    if target in ['--all', 'A-12']:
        extract_saturated_r134a_press(doc)
    if target in ['--all', 'A-13']:
        extract_superheated_blocks(doc, [23, 24], 'A-13', 'Table A-13: Superheated refrigerant-134a', 'R-134a')
    if target in ['--all', 'A-17']:
        extract_air_table(doc)
    if target in ['--all', 'A-18']:
        extract_molar_table(doc, 'A-18', [31, 32], 'N2', 'Table A-18: Ideal-gas properties of nitrogen, N2')
    if target in ['--all', 'A-19']:
        extract_molar_table(doc, 'A-19', [33, 34], 'O2', 'Table A-19: Ideal-gas properties of oxygen, O2')
    if target in ['--all', 'A-20']:
        extract_molar_table(doc, 'A-20', [35, 36], 'CO2', 'Table A-20: Ideal-gas properties of carbon dioxide, CO2')
    if target in ['--all', 'A-21']:
        extract_molar_table(doc, 'A-21', [37, 38], 'CO', 'Table A-21: Ideal-gas properties of carbon monoxide, CO')
    if target in ['--all', 'A-22']:
        extract_molar_table(doc, 'A-22', [39], 'H2', 'Table A-22: Ideal-gas properties of hydrogen, H2')
    if target in ['--all', 'A-23']:
        extract_molar_table(doc, 'A-23', [40, 41], 'H2O Vapor', 'Table A-23: Ideal-gas properties of water vapor, H2O')
    if target in ['--all', 'A-24']:
        extract_molar_table(doc, 'A-24', [42], 'Monatomic O', 'Table A-24: Ideal-gas properties of monatomic oxygen, O', table_index_on_page=0)
    if target in ['--all', 'A-25']:
        extract_molar_table(doc, 'A-25', [42], 'Hydroxyl OH', 'Table A-25: Ideal-gas properties of hydroxyl, OH', table_index_on_page=1)

if __name__ == '__main__':
    main()
