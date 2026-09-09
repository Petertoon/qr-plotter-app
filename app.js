(function(){
  const $ = id => document.getElementById(id);

  const els = {
    text: $('qr-text'),
    targetSize: $('target-size'),
    targetUnit: $('target-unit'),
    ec: $('ec-level'),
    steps: $('steps-per-mm'),
    quiet: $('quiet-zone'),
    mediaWidth: $('media-width'),
    mediaUnit: $('media-unit'),
    margin: $('margin'),
    generate: $('generate-btn'),
    test: $('test-btn'),
    canvas: $('qr-canvas'),
    stats: $('stats'),
    warning: $('warning'),
    download: $('download-area')
  };

  const MIN_MODULE_MM = 3;

  window.addEventListener('DOMContentLoaded', () => generateQR());

  els.generate.addEventListener('click', generateQR);
  els.test.addEventListener('click', generateTestSquare);

  function mmFrom(value, unit) {
    return unit === 'in' ? value * 25.4 : value;
  }

  function stepsPerMm() {
    // CE6000 GP-GL:
    // 0.025 mm per step = 40 steps/mm
    return parseFloat(els.steps.value) || 40;
  }

  function clearWarning() {
    els.warning.hidden = true;
    els.warning.textContent = '';
  }

  function warn(msg) {
    els.warning.hidden = false;
    els.warning.textContent = msg;
  }

  function generateQR() {
    clearWarning();

    const text = els.text.value.trim();

    if (!text) {
      warn('Enter a URL or text first.');
      return;
    }

    const target = mmFrom(
      parseFloat(els.targetSize.value) || 6,
      els.targetUnit.value
    );

    const ec = els.ec.value;

    const quiet = Math.max(
      0,
      parseInt(els.quiet.value, 10) || 0
    );

    const spm = stepsPerMm();

    const margin = Math.max(
      1,
      parseFloat(els.margin.value) || 10
    );

    const media = mmFrom(
      parseFloat(els.mediaWidth.value) || 12,
      els.mediaUnit.value
    );

    const qr = qrcode(0, ec);

    qr.addData(text);
    qr.make();

    const count = qr.getModuleCount();

    const size = count + quiet * 2;

    const moduleMm = target / size;

    if (target + margin * 2 > media) {
      warn(
        `OFF-SCALE PREVENTED: QR is ${target.toFixed(1)} mm wide, ` +
        `but vinyl is only ${media.toFixed(1)} mm wide. ` +
        `Reduce QR size or enter the correct vinyl width.`
      );

      return;
    }

    const matrix = [];

    for (let r = 0; r < size; r++) {

      const row = [];

      for (let c = 0; c < size; c++) {

        const rr = r - quiet;
        const cc = c - quiet;

        row.push(
          rr >= 0 &&
          rr < count &&
          cc >= 0 &&
          cc < count &&
          qr.isDark(rr, cc)
        );
      }

      matrix.push(row);
    }

    drawPreview(matrix);

    const rects = extractRects(matrix);

    const gpgl = buildGpgl(
      rects,
      moduleMm,
      spm,
      margin
    );

    offerDownload(
      gpgl,
      sanitize(text) + '-qr'
    );

    els.stats.textContent =
      `QR modules: ${count} x ${count}  | ` +
      `with quiet zone: ${size} x ${size}\n` +

      `finished size: ${target.toFixed(1)} mm ` +
      `(${(target / 25.4).toFixed(2)} in)\n` +

      `module size: ${moduleMm.toFixed(2)} mm\n` +

      `cut rectangles: ${rects.length}\n` +

      `origin margin: ${margin.toFixed(1)} mm\n` +

      `GP-GL: ${spm} steps/mm`;

    if (moduleMm < MIN_MODULE_MM) {

      warn(
        `Warning: module size is ${moduleMm.toFixed(2)} mm. ` +
        `Weeding may be difficult below about ${MIN_MODULE_MM} mm.`
      );
    }
  }

  function generateTestSquare() {

    clearWarning();

    const spm = stepsPerMm();

    const margin = Math.max(
      1,
      parseFloat(els.margin.value) || 10
    );

    // Exactly 1 inch
    const sizeMm = 25.4;

    const steps = Math.round(
      sizeMm * spm
    );

    const x = Math.round(
      margin * spm
    );

    const y = Math.round(
      margin * spm
    );

    const x2 = x + steps;

    const y2 = y + steps;

    /*
      GP-GL commands:

      IN = initialize
      M  = move
      D  = draw

      IMPORTANT:
      Do NOT use PU or PD here.
      Those are HP-GL-style commands.
    */

    const gpgl = [
      'IN;',
      `M${x},${y};`,
      `D${x2},${y};`,
      `D${x2},${y2};`,
      `D${x},${y2};`,
      `D${x},${y};`
    ].join('\n') + '\n';

    drawSquarePreview();

    offerDownload(
      gpgl,
      'CE6000-1inch-test-square'
    );

    els.stats.textContent =
      `TEST SQUARE: 1.00 in x 1.00 in\n` +
      `origin: ${margin.toFixed(1)} mm from zero\n` +
      `GP-GL: ${spm} steps/mm\n` +
      `COMMANDS: M/D (GP-GL)`;
  }

  function extractRects(matrix) {

    const rects = [];

    const n = matrix.length;

    for (let r = 0; r < n; r++) {

      let c = 0;

      while (c < n) {

        if (!matrix[r][c]) {
          c++;
          continue;
        }

        const start = c;

        while (
          c < n &&
          matrix[r][c]
        ) {
          c++;
        }

        rects.push({
          row: r,
          col: start,
          width: c - start
        });
      }
    }

    return rects;
  }

  function buildGpgl(
    rects,
    moduleMm,
    spm,
    marginMm
  ) {

    const spmModule =
      moduleMm * spm;

    const ox =
      Math.round(marginMm * spm);

    const lines = [
      'IN;'
    ];

    for (const rect of rects) {

      const x1 =
        ox +
        Math.round(
          rect.col * spmModule
        );

      const x2 =
        ox +
        Math.round(
          (rect.col + rect.width) *
          spmModule
        );

      const y1 =
        ox +
        Math.round(
          rect.row * spmModule
        );

      const y2 =
        ox +
        Math.round(
          (rect.row + 1) *
          spmModule
        );

      // GP-GL MOVE
      lines.push(
        `M${x1},${y1};`
      );

      // GP-GL DRAW
      lines.push(
        `D${x2},${y1};`
      );

      lines.push(
        `D${x2},${y2};`
      );

      lines.push(
        `D${x1},${y2};`
      );

      lines.push(
        `D${x1},${y1};`
      );
    }

    return lines.join('\n') + '\n';
  }

  function drawPreview(matrix) {

    const n = matrix.length;

    const px = Math.max(
      2,
      Math.floor(480 / n)
    );

    const c = els.canvas;

    c.width = n * px;

    c.height = n * px;

    const ctx =
      c.getContext('2d');

    ctx.fillStyle = '#fff';

    ctx.fillRect(
      0,
      0,
      c.width,
      c.height
    );

    ctx.fillStyle = '#111';

    for (let r = 0; r < n; r++) {

      for (
        let col = 0;
        col < n;
        col++
      ) {

        if (matrix[r][col]) {

          ctx.fillRect(
            col * px,
            r * px,
            px,
            px
          );
        }
      }
    }
  }

  function drawSquarePreview() {

    const c = els.canvas;

    c.width = 480;

    c.height = 480;

    const ctx =
      c.getContext('2d');

    ctx.fillStyle = '#fff';

    ctx.fillRect(
      0,
      0,
      480,
      480
    );

    ctx.fillStyle = '#111';

    ctx.fillRect(
      40,
      40,
      400,
      400
    );
  }

  function offerDownload(
    content,
    name
  ) {

    const blob =
      new Blob(
        [content],
        {
          type: 'text/plain'
        }
      );

    const url =
      URL.createObjectURL(blob);

    els.download.innerHTML = '';

    const a =
      document.createElement('a');

    a.href = url;

    a.download =
      name + '.gpgl';

    a.textContent =
      'Download ' + a.download;

    els.download.appendChild(a);
  }

  function sanitize(s) {

    return s
      .replace(
        /^https?:\/\//,
        ''
      )
      .replace(
        /[^a-z0-9]+/gi,
        '-'
      )
      .replace(
        /^-+|-+$/g,
        ''
      )
      .slice(
        0,
        35
      )
      .toLowerCase() ||
      'qr-cut';
  }

})();
