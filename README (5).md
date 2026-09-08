# QR Cut

A small web tool that turns a URL or text into a cut-ready file for a
Graphtec CE6000-60+ vinyl cutting plotter, so you can produce QR code decals
(each dark module cut out as its own weeded piece of vinyl).

**Status: v1 — file export only.** The browser can't talk to the CE6000-60+
directly (it enumerates as a Windows print-class device, not a plain serial
port), so this generates a `.gpgl` file you send to the plotter through
whatever's already driving it (Cutting Master, Graphtec Studio, or a raw
copy to the printer port). See **Roadmap** below for the direct-send plan.

## How it works

1. You type in a URL/text, the **finished size** you want (default 6in —
   the smallest size this shop cuts), and an error correction level.
2. The QR matrix is generated client-side (`qrcode-generator` library, via
   CDN — no backend needed). Module size (mm per QR pixel) is worked out
   automatically: finished size ÷ number of modules the QR actually needs.
3. Dark modules are merged into horizontal-run rectangles to keep the pen
   path count reasonable, then converted to GP-GL commands
   (`IN;`, `SP1;`, `PU`/`PD` moves) scaled by your plotter's step
   resolution.
4. You download the `.gpgl` file and send it to the cutter.

A 6in (152mm) QR fits comfortably within the CE6000-60's 24in cutting
width — no tiling/splitting needed at that size or larger.

## Running locally

It's a static site — no build step. Just open `index.html` in a browser,
or serve the folder:

```bash
npx serve .
```

## Deploying

**GitHub Pages** — push this folder to a repo, enable Pages on the `main`
branch (root), done.

**Render (Static Site)** — connect the GitHub repo, set:
- Build command: (none)
- Publish directory: `.`

No server-side code is required for v1.

## Before your first real cut

- On the plotter's control panel, confirm command mode is set to **GP-GL**
  (not HP-GL) and note the **STEP SIZE** — match that to the "Plotter
  resolution (steps/mm)" field in the tool. 40 steps/mm (0.025mm
  resolution) is the common Graphtec default.
- Run a small test QR (short URL, larger module size) before committing a
  full sheet — coordinate scale/origin can vary slightly depending on the
  driver or spooler you send the file through.
- Modules under ~3mm get hard to weed reliably with a drag knife. The tool
  warns you if your finished size + text length + error correction level
  work out to modules that small — at 6in and a typical URL, you've got a
  lot of headroom, but very long URLs or high error correction can eat into
  it.

## Roadmap

- [ ] **Direct plotter connection.** Likely path: a small local bridge app
  (similar in spirit to Zebra Browser Print) that this web app talks to
  over localhost, which forwards the raw GP-GL bytes to the plotter via the
  Windows print spooler (raw/passthrough mode) or a serial port if using
  RS-232. WebUSB/WebSerial probably won't work directly since Windows
  claims the interface as a printer.
- [ ] Cross-row rectangle merging (bigger contiguous blocks instead of one
  rectangle per row-run) to cut path length further.
- [ ] Optional cut-around border/frame.
- [ ] Batch mode (multiple QR codes in one job, e.g. sequential order
  numbers).
- [ ] Save/reuse presets (module size, EC level, step size) per job type.
