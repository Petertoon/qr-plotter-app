QR CUT v2 — Graphtec CE6000-60 Plus

IMPORTANT TEST ORDER
1. Leave the cutter GP-GL STEP SIZE at 1016 point/inch (40 steps/mm), as shown in your photo.
2. Load vinyl and make sure the pinch rollers are correctly positioned.
3. Open index.html.
4. Click "Create 1-inch Test Square".
5. Download the GPGL file.
6. Run SendToPlotter.bat and select the downloaded GPGL file.
7. If the 1-inch square cuts correctly, generate a small QR (2 inches is a good next test).
8. Only then try the full-size QR.

WHAT CHANGED
- Removed the final move back to 0,0 that could touch the edge of the usable area.
- QR coordinates now start at a configurable positive safety margin.
- Added actual vinyl-width checking so the app can stop a job before an off-scale error.
- Added a 1-inch test-square generator.
- Kept GP-GL at 40 steps/mm for your photographed 1016 point/in setting.
- Cleaned the BAT/PowerShell filenames so they match.
- Raw Windows printing remains available through WritePrinter.

DEFAULT PRINTER NAME
The PowerShell file uses:
Graphtec CE6000-60 Raw

If your Windows printer has a different name, run PowerShell with:
-PrinterName "YOUR EXACT WINDOWS PRINTER NAME"

Do not change the cutter's step size while testing.
