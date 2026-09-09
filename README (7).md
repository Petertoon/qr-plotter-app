# QR Cutter — Graphtec Studio 2 + Auto-Save

Clean replacement for the old direct-printer QR system.

## Files

- index.html
- app.js
- style.css
- README.md

## New saving workflow

1. Open the QR generator.
2. Click **Choose Output Folder**.
3. Select the Windows folder where you want QR SVG files.
4. Turn on **Automatically save every new QR**.
5. Generate a QR.
6. The SVG is written directly into that selected folder.
7. Open the SVG in Graphtec Studio 2 and cut it.

You can also leave Auto-save off and use **Save QR File** / **Download SVG**.

## Important browser note

Folder selection uses the browser File System Access API. Chrome and Edge on Windows support this feature. The browser will ask permission to access the selected folder.

A normal website cannot silently choose or access arbitrary Windows folders without permission.

## Graphtec Studio 2

The application creates SVG only. It does not send jobs directly to the CE6000 Plus and contains no PowerShell, GP-GL, raw-printer, or `Graphtec CE6000-60 Raw` code.

Recommended workflow:

QR Generator → SVG file → Graphtec Studio 2 → CE6000 Plus → OUTPUT

Use the 1-inch test square first and verify its physical dimensions in Graphtec Studio 2 before cutting.
