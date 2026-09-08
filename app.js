(function () {
  const els = {
    text: document.getElementById('qr-text'),
    targetSize: document.getElementById('target-size'),
    targetUnit: document.getElementById('target-unit'),
    ecLevel: document.getElementById('ec-level'),
    stepsPerMm: document.getElementById('steps-per-mm'),
    quietZone: document.getElementById('quiet-zone'),
    generateBtn: document.getElementById('generate-btn'),
    canvas: document.getElementById('qr-canvas'),
    stats: document.getElementById('stats'),
    warning: document.getElementById('warning'),
    downloadArea: document.getElementById('download-area'),
  };

  const MIN_RELIABLE_MODULE_MM = 3;

  els.generateBtn.addEventListener('click', generate);
  window.addEventListener('DOMContentLoaded', generate);

  function generate() {
    const text = els.text.value.trim();
    if (!text) return;

    const ec = els.ecLevel.value;
    const stepsPerMm = parseFloat(els.stepsPerMm.value) || 40;
    const quietZone = parseInt(els.quietZone.value, 10) || 0;
    const targetSizeRaw = parseFloat(els.targetSize.value) || 6;
    const targetUnit = els.targetUnit.value;
    const targetMm = targetUnit === 'in' ? targetSizeRaw * 25.4 : targetSizeRaw;

    // 1. Encode
    const qr = qrcode(0, ec);
    qr.addData(text);
    qr.make();
    const count = qr.getModuleCount();

    // 2. Build a padded boolean matrix (quiet zone included)
    const size = count + quietZone * 2;

    // Module size falls out of the finished size the user asked for,
    // divided by however many modules (incl. quiet zone) this QR needs.
    const moduleMm = targetMm / size;
    const matrix = [];
    for (let r = 0; r < size; r++) {
      const row = [];
      for (let c = 0; c < size; c++) {
        const rr = r - quietZone;
        const cc = c - quietZone;
        const dark = rr >= 0 && rr < count && cc >= 0 && cc < count && qr.isDark(rr, cc);
        row.push(dark);
      }
      matrix.push(row);
    }

    // 3. Preview
    drawPreview(matrix);

    // 4. Extract cut rectangles: merge horizontal runs of dark modules per row
    const rects = extractRowMergedRects(matrix);

    // 5. Build GP-GL and offer download
    const gpgl = buildGpgl(rects, moduleMm, stepsPerMm, size);
    offerDownload(gpgl, sanitizeFilename(text));

    // 6. Stats + weedability warning
    const finishedMm = size * moduleMm;
    const finishedIn = finishedMm / 25.4;
    els.stats.textContent =
      `modules: ${count} x ${count}  (with quiet zone: ${size} x ${size})\n` +
      `finished size: ${finishedMm.toFixed(1)}mm x ${finishedMm.toFixed(1)}mm  (${finishedIn.toFixed(2)}in)\n` +
      `module size: ${moduleMm.toFixed(2)}mm\n` +
      `cut rectangles: ${rects.length}\n` +
      `error correction: ${ec}`;

    if (moduleMm < MIN_RELIABLE_MODULE_MM) {
      els.warning.hidden = false;
      els.warning.textContent =
        `Modules work out to ${moduleMm.toFixed(2)}mm at this size — below the ~${MIN_RELIABLE_MODULE_MM}mm ` +
        `mark where weeding gets unreliable on a drag-knife. Increase the finished size, shorten the encoded ` +
        `text, or drop to a lower error-correction level to fix it.`;
    } else {
      els.warning.hidden = true;
    }
  }

  function drawPreview(matrix) {
    const size = matrix.length;
    const px = Math.max(2, Math.floor(480 / size));
    const canvas = els.canvas;
    canvas.width = size * px;
    canvas.height = size * px;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#1c1b19';
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (matrix[r][c]) ctx.fillRect(c * px, r * px, px, px);
      }
    }
  }

  // Merge consecutive dark modules within each row into single rectangles.
  // (Cheap, effective reduction in pen-up/pen-down move count. Cross-row
  // merging into bigger blocks is a possible future optimization.)
  function extractRowMergedRects(matrix) {
    const rects = [];
    const size = matrix.length;
    for (let r = 0; r < size; r++) {
      let c = 0;
      while (c < size) {
        if (matrix[r][c]) {
          const startC = c;
          while (c < size && matrix[r][c]) c++;
          rects.push({ row: r, col: startC, width: c - startC, height: 1 });
        } else {
          c++;
        }
      }
    }
    return rects;
  }

  // Convert module-space rectangles into a GP-GL command stream.
  // Coordinate origin: top-left of the design, Y grows downward in module
  // space, then flipped so plotter Y grows upward (standard GP-GL/HP-GL
  // convention with origin at bottom-left).
  function buildGpgl(rects, moduleMm, stepsPerMm, gridSize) {
    const stepsPerModule = moduleMm * stepsPerMm;
    const totalSteps = gridSize * stepsPerModule;

    const toX = (col) => Math.round(col * stepsPerModule);
    const toY = (row) => Math.round(totalSteps - row * stepsPerModule);

    const lines = [];
    lines.push('IN;');
    lines.push('SP1;');

    for (const rect of rects) {
      const x1 = toX(rect.col);
      const x2 = toX(rect.col + rect.width);
      const yTop = toY(rect.row);
      const yBottom = toY(rect.row + rect.height);
      // yTop > yBottom since Y is flipped; draw a closed rectangle
      lines.push(`PU${x1},${yBottom};`);
      lines.push(`PD${x1},${yTop},${x2},${yTop},${x2},${yBottom},${x1},${yBottom};`);
    }

    lines.push('PU0,0;');
    return lines.join('\n') + '\n';
  }

  function offerDownload(content, baseName) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    els.downloadArea.innerHTML = '';
    const a = document.createElement('a');
    a.href = url;
    a.download = `${baseName || 'qr-cut'}.gpgl`;
    a.textContent = `Download ${a.download}`;
    els.downloadArea.appendChild(a);
  }

  function sanitizeFilename(text) {
    return text
      .replace(/^https?:\/\//, '')
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40)
      .toLowerCase() || 'qr-cut';
  }
})();
