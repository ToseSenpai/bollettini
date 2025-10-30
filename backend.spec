# -*- mode: python ; coding: utf-8 -*-

import os
import sys
from PyInstaller.utils.hooks import collect_data_files, collect_all

# --- Manually curated spec file for stability ---

# Collect data files for pandas
datas = collect_data_files('pandas')

# Collect sqlite3 binaries per risolvere errori DLL
sqlite3_datas, sqlite3_binaries, sqlite3_hiddenimports = collect_all('sqlite3')
datas += sqlite3_datas
binaries = sqlite3_binaries

# Forza inclusione di tutte le DLL Python necessarie
import glob
python_root = os.path.dirname(sys.executable)
dll_patterns = [
    os.path.join(python_root, 'DLLs', '_sqlite3.pyd'),
    os.path.join(python_root, 'DLLs', 'sqlite3.dll'),
]

for pattern in dll_patterns:
    for dll_file in glob.glob(pattern):
        binaries.append((dll_file, '.'))
        print(f'Aggiunta DLL: {os.path.basename(dll_file)}')

# Aggiungi le DLL di Python necessarie
python_dll_dir = os.path.join(sys.executable, '..', 'DLLs')
if os.path.exists(python_dll_dir):
    # Aggiungi tutte le DLL necessarie
    dll_files = ['_sqlite3.pyd', 'sqlite3.dll']
    for dll in dll_files:
        dll_path = os.path.join(python_dll_dir, dll)
        if os.path.exists(dll_path):
            binaries.append((dll_path, '.'))
            print(f'Aggiunta DLL: {dll}')

# Manually add the Playwright browser binaries from the local app data
playwright_browsers_path = os.path.join(os.getenv('LOCALAPPDATA'), 'ms-playwright')
if os.path.exists(playwright_browsers_path):
    datas.append((playwright_browsers_path, 'playwright\\driver\\package\\.local-browsers'))


a = Analysis(
    ['backend.py'],
    pathex=[],
    binaries=binaries,
    datas=datas,
    hiddenimports=[
        'pandas._libs.tslibs.timedeltas',
        'pandas._libs.tslibs.nattype',
        'pandas._libs.tslibs.np_datetime',
        'pandas._libs.tslibs.offsets',
        'pandas._libs.tslibs.period',
        'pandas._libs.tslibs.strptime',
        'pandas._libs.tslibs.timestamps',
        'pandas._libs.tslibs.timezones',
        'pandas._libs.tslibs.tzconversion',
        'playwright.sync_api',
        'fitz',
        'openpyxl',
        'sqlite3',
        '_sqlite3'
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    noarchive=False,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='backend',
)
