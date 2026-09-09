(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const els = {
    text: $("qr-text"),
    targetSize: $("target-size"),
    targetUnit: $("target-unit"),
    ec: $("ec-level"),
    steps: $("steps-per-mm"),
    quiet: $("quiet-zone"),
    mediaWidth: $("media-width"),
    mediaUnit: $("media-unit"),
    margin: $("margin"),
    generate: $("generate-btn"),
    test: $("test-btn"),
    canvas: $("qr-canvas"),
    stats: $("stats"),
    warning: $("warning"),
    download: $("download-area")
  };

  const DEFAULT_STEPS_PER_MM = 40;

  /*
   * Convert inches/mm to millimeters.
   */
  function mmFrom(value, unit) {
    if (unit === "in") {
      return value * 25.4;
    }

    return value;
  }

  /*
   * Get cutter resolution.
   */
  function getStepsPerMm() {
    const value = parseFloat(els.steps.value);

    if (!Number.isFinite(value) || value <= 0) {
      return DEFAULT_STEPS_PER_MM;
    }

    return value;
  }

  /*
   * Warning helpers.
   */
  function clearWarning() {
    els.warning.hidden = true;
    els.warning.textContent = "";
  }

  function warn(message) {
    els.warning.hidden = false;
    els.warning.textContent = message;
  }

  /*
   * Main QR generator.
   */
  function generateQR() {
    clearWarning();

    const text = (els.text.value || "").trim();

    if (!text) {
      warn("Enter a URL or text first.");
      return;
    }

    /*
     * QR finished size.
     */
    let targetValue = parseFloat(els.targetSize.value);

    if (!Number.isFinite(targetValue) || targetValue <= 0) {
      targetValue = 1;
      els.targetSize.value = "1";
    }

    const targetMm = mmFrom(
      targetValue,
      els.targetUnit.value
    );

    /*
     * Error correction.
     */
    const ec = els.ec.value || "M";

    /*
     * Quiet zone.
     */
    let quiet = parseInt(
      els.quiet.value,
      10
    );

    if (!Number.isFinite(quiet) || quiet < 0) {
      quiet = 4;
    }

    /*
     * Cutter resolution.
     */
    const stepsPerMm = getStepsPerMm();

    /*
     * Safe margin.
     */
    let marginMm = parseFloat(
      els.margin.value
    );

    if (!Number.isFinite(marginMm) || marginMm < 0) {
      marginMm = 10;
    }

    /*
     * Vinyl width.
     */
    let mediaValue = parseFloat(
      els.mediaWidth.value
    );

    if (!Number.isFinite(mediaValue) || mediaValue <= 0) {
      mediaValue = 12;
    }

    const mediaMm = mmFrom(
      mediaValue,
      els.mediaUnit.value
    );

    /*
     * Make QR.
     */
    if (typeof qrcode !== "function") {
      warn(
        "QR library is not loaded. Refresh the page and try again."
      );
      return;
    }

    let qr;

    try {
      qr = qrcode(0, ec);
      qr.addData(text);
      qr.make();
    } catch (error) {
      console.error(error);

      warn(
        "The QR code could not be created. Try shorter text or a URL."
      );

      return;
    }

    const qrModules = qr.getModuleCount();

    /*
     * Total modules including quiet zone.
     */
    const totalModules =
      qrModules + quiet * 2;

    /*
     * Each QR module is this many millimeters.
     */
    const moduleMm =
      targetMm / totalModules;

    /*
     * Make sure the complete QR fits the vinyl.
     */
    if (
      targetMm + marginMm * 2 >
      mediaMm
    ) {
      warn(
        "QR is too wide for the vinyl. " +
        "Reduce the QR size or enter the correct vinyl width."
      );

      return;
    }

    /*
     * Build matrix.
     */
    const matrix = [];

    for (
      let row = 0;
      row < totalModules;
      row++
    ) {
      const line = [];

      for (
        let col = 0;
        col < totalModules;
        col++
      ) {
        const qrRow = row - quiet;
        const qrCol = col - quiet;

        const dark =
          qrRow >= 0 &&
          qrRow < qrModules &&
          qrCol >= 0 &&
          qrCol < qrModules &&
          qr.isDark(qrRow, qrCol);

        line.push(Boolean(dark));
      }

      matrix.push(line);
    }

    /*
     * Show preview.
     */
    drawPreview(matrix);

    /*
     * Convert dark areas into rectangles.
     */
    const rectangles =
      extractRectangles(matrix);

    /*
     * Build GP-GL.
     */
    const gpgl =
      buildGpgl(
        rectangles,
        moduleMm,
        stepsPerMm,
        marginMm
      );

    /*
     * Give user download button.
     */
    offerDownload(
      gpgl,
      sanitize(text) + "-qr"
    );

    /*
     * Show information.
     */
    els.stats.textContent =
      "QR modules: " +
      qrModules +
      " x " +
      qrModules +
      "\n" +

      "Total modules: " +
      totalModules +
      " x " +
      totalModules +
      "\n" +

      "Finished size: " +
      targetMm.toFixed(2) +
      " mm (" +
      (targetMm / 25.4).toFixed(2) +
      " in)\n" +

      "Module size: " +
      moduleMm.toFixed(3) +
      " mm\n" +

      "Cut rectangles: " +
      rectangles.length +
      "\n" +

      "Origin margin: " +
      marginMm.toFixed(1) +
      " mm\n" +

      "GP-GL: " +
      stepsPerMm +
      " steps/mm";

    /*
     * Small modules can be difficult to weed.
     */
    if (moduleMm < 1.5) {
      warn(
        "This QR has very small modules (" +
        moduleMm.toFixed(2) +
        " mm). For the first QR test, use 1 inch or larger."
      );
    }
  }

  /*
   * Create the simple 1-inch square test.
   *
   * This uses the same positive-coordinate
   * method that we already confirmed reaches
   * the CE6000-60 Plus.
   */
  function generateTestSquare() {
    clearWarning();

    const stepsPerMm =
      getStepsPerMm();

    let marginMm =
      parseFloat(els.margin.value);

    if (
      !Number.isFinite(marginMm) ||
      marginMm < 0
    ) {
      marginMm = 10;
    }

    /*
     * Exactly 1 inch.
     */
    const sizeMm = 25.4;

    const sizeSteps =
      Math.round(
        sizeMm * stepsPerMm
      );

    const originSteps =
      Math.round(
        marginMm * stepsPerMm
      );

    const x1 = originSteps;
    const y1 = originSteps;

    const x2 =
      x1 + sizeSteps;

    const y2 =
      y1 + sizeSteps;

    /*
     * Very simple GP-GL.
     */
    const lines = [
      "IN;",
      `PU${x1},${y1};`,
      `PD${x2},${y1};`,
      `PD${x2},${y2};`,
      `PD${x1},${y2};`,
      `PD${x1},${y1};`,
      "PU;"
    ];

    const gpgl =
      lines.join("\n") + "\n";

    drawSquarePreview();

    offerDownload(
      gpgl,
      "CE6000-1inch-test-square"
    );

    els.stats.textContent =
      "TEST SQUARE\n" +
      "Size: 1.00 in x 1.00 in\n" +
      "Size: 25.4 mm x 25.4 mm\n" +
      "Origin: " +
      marginMm.toFixed(1) +
      " mm\n" +
      "GP-GL: " +
      stepsPerMm +
      " steps/mm";
  }

  /*
   * Turn the QR matrix into horizontal
   * rectangular paths.
   */
  function extractRectangles(matrix) {
    const rectangles = [];

    const rows = matrix.length;

    for (
      let row = 0;
      row < rows;
      row++
    ) {
      let col = 0;

      while (col < rows) {

        /*
         * Skip white modules.
         */
        if (!matrix[row][col]) {
          col++;
          continue;
        }

        const start =
          col;

        /*
         * Find end of this run.
         */
        while (
          col < rows &&
          matrix[row][col]
        ) {
          col++;
        }

        rectangles.push({
          row: row,
          col: start,
          width: col - start
        });
      }
    }

    return rectangles;
  }

  /*
   * Build GP-GL commands.
   */
  function buildGpgl(
    rectangles,
    moduleMm,
    stepsPerMm,
    marginMm
  ) {
    const moduleSteps =
      moduleMm * stepsPerMm;

    const origin =
      Math.round(
        marginMm * stepsPerMm
      );

    const lines = [
      "IN;"
    ];

    for (
      const rect of rectangles
    ) {

      const x1 =
        origin +
        Math.round(
          rect.col * moduleSteps
        );

      const x2 =
        origin +
        Math.round(
          (rect.col + rect.width) *
          moduleSteps
        );

      const y1 =
        origin +
        Math.round(
          rect.row * moduleSteps
        );

      const y2 =
        origin +
        Math.round(
          (rect.row + 1) *
          moduleSteps
        );

      /*
       * Move to starting point.
       */
      lines.push(
        `PU${x1},${y1};`
      );

      /*
       * Draw rectangle.
       */
      lines.push(
        `PD${x2},${y1};`
      );

      lines.push(
        `PD${x2},${y2};`
      );

      lines.push(
        `PD${x1},${y2};`
      );

      lines.push(
        `PD${x1},${y1};`
      );

      /*
       * Lift blade.
       */
      lines.push(
        "PU;"
      );
    }

    return (
      lines.join("\n") +
      "\n"
    );
  }

  /*
   * Draw QR preview.
   */
  function drawPreview(matrix) {
    const n = matrix.length;

    const pixels =
      Math.max(
        2,
        Math.floor(480 / n)
      );

    const canvas =
      els.canvas;

    canvas.width =
      n * pixels;

    canvas.height =
      n * pixels;

    const ctx =
      canvas.getContext("2d");

    ctx.fillStyle =
      "#ffffff";

    ctx.fillRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    ctx.fillStyle =
      "#111111";

    for (
      let row = 0;
      row < n;
      row++
    ) {
      for (
        let col = 0;
        col < n;
        col++
      ) {

        if (
          matrix[row][col]
        ) {
          ctx.fillRect(
            col * pixels,
            row * pixels,
            pixels,
            pixels
          );
        }
      }
    }
  }

  /*
   * Draw 1-inch test preview.
   */
  function drawSquarePreview() {
    const canvas =
      els.canvas;

    canvas.width = 480;
    canvas.height = 480;

    const ctx =
      canvas.getContext("2d");

    ctx.fillStyle =
      "#ffffff";

    ctx.fillRect(
      0,
      0,
      480,
      480
    );

    ctx.fillStyle =
      "#111111";

    ctx.fillRect(
      40,
      40,
      400,
      400
    );
  }

  /*
   * Create download link.
   */
  function offerDownload(
    content,
    filename
  ) {
    const blob =
      new Blob(
        [content],
        {
          type:
            "text/plain;charset=utf-8"
        }
      );

    const url =
      URL.createObjectURL(blob);

    els.download.innerHTML = "";

    const link =
      document.createElement("a");

    link.href = url;

    link.download =
      filename + ".gpgl";

    link.textContent =
      "Download " +
      link.download;

    link.style.display =
      "block";

    link.style.padding =
      "12px";

    els.download.appendChild(
      link
    );
  }

  /*
   * Make safe filename.
   */
  function sanitize(value) {
    return value
      .replace(
        /^https?:\/\//i,
        ""
      )
      .replace(
        /[^a-z0-9]+/gi,
        "-"
      )
      .replace(
        /^-+|-+$/g,
        ""
      )
      .slice(
        0,
        35
      )
      .toLowerCase() ||
      "qr-cut";
  }

  /*
   * Wire up buttons.
   */
  function initialize() {

    if (
      els.generate
    ) {
      els.generate.addEventListener(
        "click",
        generateQR
      );
    }

    if (
      els.test
    ) {
      els.test.addEventListener(
        "click",
        generateTestSquare
      );
    }

    /*
     * Automatically generate the QR
     * when the page loads.
     */
    generateQR();
  }

  /*
   * Wait until the page is ready.
   */
  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      initialize
    );
  } else {
    initialize();
  }

})();
