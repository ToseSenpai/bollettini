# -*- mode: python ; coding: utf-8 -*-

import os
from PyInstaller.utils.hooks import collect_data_files

# --- Manually curated spec file for stability ---

# Collect data files for pandas
datas = collect_data_files('pandas')

# Manually add the Playwright browser binaries from the local app data
playwright_browsers_path = os.path.join(os.getenv('LOCALAPPDATA'), 'ms-playwright')
if os.path.exists(playwright_browsers_path):
    datas.append((playwright_browsers_path, 'playwright\\driver\\package\\.local-browsers'))


a = Analysis(
    ['backend.py'],
    pathex=[],
    binaries=[],
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
        'openpyxl'
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
