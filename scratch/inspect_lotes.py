import zipfile
import xml.etree.ElementTree as ET
import os

file1 = r'C:\Users\mario\Downloads\Analiase\LOTE 1.xlsx'
file3 = r'C:\Users\mario\Downloads\Analiase\LOTE 3.xlsx'

def get_shared_strings(zf):
    try:
        content = zf.read('xl/sharedStrings.xml')
        tree = ET.fromstring(content)
        strings = []
        for elem in tree.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t'):
            strings.append(elem.text if elem.text else '')
        return strings
    except KeyError:
        return []

def get_sheet_names(zf):
    try:
        content = zf.read('xl/workbook.xml')
        tree = ET.fromstring(content)
        sheets = []
        for elem in tree.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}sheet'):
            sheets.append((elem.attrib['name'], elem.attrib.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')))
        return sheets
    except KeyError:
        return []

def inspect_xlsx(file_path):
    print("=" * 60)
    print("FILE:", os.path.basename(file_path))
    if not os.path.exists(file_path):
        print("File not found!")
        return

    with zipfile.ZipFile(file_path, 'r') as zf:
        shared_strings = get_shared_strings(zf)
        sheets = get_sheet_names(zf)
        print("Shared Strings count:", len(shared_strings))
        print("Sheets:", [s[0] for s in sheets])

        # Find worksheet files
        ws_files = [f for f in zf.namelist() if f.startswith('xl/worksheets/sheet')]
        for ws_file in sorted(ws_files):
            print(f"\n--- Worksheet File: {ws_file} ---")
            content = zf.read(ws_file)
            tree = ET.fromstring(content)
            rows = []
            for row_elem in tree.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row'):
                row_vals = []
                for cell in row_elem.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c'):
                    cell_type = cell.attrib.get('t')
                    val_elem = cell.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v')
                    cell_val = ''
                    if val_elem is not None and val_elem.text:
                        val_str = val_elem.text
                        if cell_type == 's' and val_str.isdigit():
                            idx = int(val_str)
                            if idx < len(shared_strings):
                                cell_val = shared_strings[idx]
                            else:
                                cell_val = val_str
                        else:
                            cell_val = val_str
                    row_vals.append(cell_val)
                rows.append(row_vals)
            
            print(f"Total Rows: {len(rows)}")
            for i, r in enumerate(rows[:10]):
                print(f"Row {i}: {r}")

inspect_xlsx(file1)
inspect_xlsx(file3)
