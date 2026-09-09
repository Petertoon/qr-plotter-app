# QR Cutter — Graphtec Studio 2 (Clean Edition)

This is the replacement for the old direct-to-plotter QR tool.

## What is intentionally removed

- No PowerShell sender
- No `SendToPlotter.ps1`
- No Windows printer-name lookup
- No `Graphtec CE6000-60 Raw` printer output
- No GP-GL download
- No direct USB/raw-printer communication

## What it does

The page generates only an SVG vector file at a physical millimeter size.

Workflow:

1. Open the GitHub Pages site.
2. Enter the URL/text and QR size.
3. Click **Generate SVG for Graphtec Studio 2**.
4. Download the SVG.
5. Open/import the SVG in Graphtec Studio 2.
6. Select the CE6000 Plus / CE6000-60.
7. Verify the physical dimensions.
8. Cut from Graphtec Studio 2.

There is also a **1-inch Test Square** button. Use that first to confirm the CE6000 Plus is cutting the correct physical size.

## GitHub Pages

Upload these files to the repository root:

- `index.html`
- `app.js`
- `style.css`
- `README.md`

Then enable GitHub Pages from the repository's Pages settings and use the deployed site.

## Important

The browser cannot directly launch Graphtec Studio 2 or send a cutting job to the Windows USB cutter. The intended handoff is the SVG file into Graphtec Studio 2.

Graphtec's current software page lists SVG as a supported import format and lists the CE6000 Plus as an operation-confirmed model for Graphtec Studio 2. Verify the cutter selection and physical dimensions in Graphtec Studio 2 before cutting.
