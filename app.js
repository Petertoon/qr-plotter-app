(() => {
  "use strict";

  const $ = id => document.getElementById(id);

  const text = $("qr-text");
  const size = $("size");
  const unit = $("unit");
  const ec = $("ec");
  const quiet = $("quiet");
  const margin = $("margin");
  const preview = $("preview");
  const downloads = $("downloads");
  const stats = $("stats");
  const warning = $("warning");

  function mm(v, u) {
    return u === "in" ? v * 25.4 : v;
  }

  function showWarning(message) {
    warning.hidden = !message;
    warning.textContent = message || "";
  }

  function safeName(value) {
    return value
      .replace(/^https?:\/\//i, "")
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40)
      .toLowerCase() || "qr";
  }

  function makeMatrix(value) {
    const qr = qrcode(0, ec.value);

    qr.addData(value);
    qr.make();

    const qn = qr.getModuleCount();

    const q = Math.max(
      0,
      parseInt(quiet.value, 10) || 0
    );

    const n = qn + q * 2;

    const matrix = [];

    for (let r = 0; r < n; r++) {
      const row = [];

      for (let c = 0; c < n; c++) {
        const rr = r - q;
        const cc = c - q;

        const dark =
          rr >= 0 &&
          rr < qn &&
          cc >= 0 &&
          cc < qn &&
          qr.isDark(rr, cc);

        row.push(Boolean(dark));
      }

      matrix.push(row);
    }

    return {
      matrix,
      qn,
      n
    };
  }

  /*
   * Convert each black horizontal QR run
   * into a closed SVG rectangle.
   *
   * Graphtec Studio 2 receives vector geometry
   * at the requested physical millimeter size.
   */

  function runs(matrix) {
    const out = [];

    for (let r = 0; r < matrix.length; r++) {
      let c = 0;

      while (c < matrix.length) {

        if (!matrix[r][c]) {
          c++;
          continue;
        }

        const start = c;

        while (
          c < matrix.length &&
          matrix[r][c]
        ) {
          c++;
        }

        out.push({
          r,
          c: start,
          w: c - start
        });
      }
    }

    return out;
  }

  function svgFor(matrix, moduleMm, marginMm) {

    const side =
      matrix.length * moduleMm;

    const page =
      side + marginMm * 2;

    const rects = runs(matrix)
      .map(x => {

        const px =
          marginMm +
          x.c * moduleMm;

        const py =
          marginMm +
          x.r * moduleMm;

        const pw =
          x.w * moduleMm;

        return `
      <rect
        x="${px.toFixed(4)}"
        y="${py.toFixed(4)}"
        width="${pw.toFixed(4)}"
        height="${moduleMm.toFixed(4)}"
      />`;

      })
      .join("\n");

    return `<?xml version="1.0" encoding="UTF-8"?>

<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${page.toFixed(4)}mm"
  height="${page.toFixed(4)}mm"
  viewBox="0 0 ${page.toFixed(4)} ${page.toFixed(4)}">

  <title>Graphtec Studio 2 QR</title>

  <g
    fill="none"
    stroke="#000000"
    stroke-width="0.01">

    ${rects}

  </g>

</svg>
`;
  }

  function squareSvg() {

    const m =
      Math.max(
        0,
        parseFloat(margin.value) || 0
      );

    const s = 25.4;

    const p =
      s + m * 2;

    return `<?xml version="1.0" encoding="UTF-8"?>

<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${p.toFixed(4)}mm"
  height="${p.toFixed(4)}mm"
  viewBox="0 0 ${p.toFixed(4)} ${p.toFixed(4)}">

  <rect
    x="${m.toFixed(4)}"
    y="${m.toFixed(4)}"
    width="${s.toFixed(4)}"
    height="${s.toFixed(4)}"
    fill="none"
    stroke="#000000"
    stroke-width="0.01"/>

</svg>
`;
  }

  function draw(matrix) {

    const n = matrix.length;

    const px =
      Math.max(
        2,
        Math.floor(480 / n)
      );

    preview.width =
      n * px;

    preview.height =
      n * px;

    const ctx =
      preview.getContext("2d");

    ctx.fillStyle = "#ffffff";

    ctx.fillRect(
      0,
      0,
      preview.width,
      preview.height
    );

    ctx.fillStyle = "#111111";

    for (
      let r = 0;
      r < n;
      r++
    ) {

      for (
        let c = 0;
        c < n;
        c++
      ) {

        if (matrix[r][c]) {

          ctx.fillRect(
            c * px,
            r * px,
            px,
            px
          );

        }
      }
    }
  }

  function drawSquare() {

    preview.width = 480;
    preview.height = 480;

    const ctx =
      preview.getContext("2d");

    ctx.fillStyle = "#ffffff";

    ctx.fillRect(
      0,
      0,
      480,
      480
    );

    ctx.fillStyle = "#111111";

    ctx.fillRect(
      40,
      40,
      400,
      400
    );
  }

  function download(content, filename) {

    const blob =
      new Blob(
        [content],
        {
          type:
            "image/svg+xml;charset=utf-8"
        }
      );

    const url =
      URL.createObjectURL(blob);

    const a =
      document.createElement("a");

    a.href = url;

    a.download = filename;

    a.textContent =
      "Download " + filename;

    downloads.appendChild(a);
  }

  function generate() {

    downloads.innerHTML = "";

    stats.textContent = "";

    showWarning("");

    const value =
      text.value.trim();

    if (!value) {

      showWarning(
        "Enter a URL or text."
      );

      return;
    }

    const targetMm =
      mm(
        parseFloat(size.value),
        unit.value
      );

    if (
      !Number.isFinite(targetMm) ||
      targetMm <= 0
    ) {

      showWarning(
        "Enter a valid QR size."
      );

      return;
    }

    let marginMm =
      parseFloat(margin.value);

    if (
      !Number.isFinite(marginMm) ||
      marginMm < 0
    ) {

      marginMm = 10;
    }

    try {

      const {
        matrix,
        qn,
        n
      } = makeMatrix(value);

      const moduleMm =
        targetMm / n;

      const svg =
        svgFor(
          matrix,
          moduleMm,
          marginMm
        );

      draw(matrix);

      download(
        svg,
        safeName(value) +
          "-qr.svg"
      );

      stats.textContent =
        `QR code: ${qn} × ${qn} modules
Quiet zone: ${n - qn} modules total
Finished QR size: ${targetMm.toFixed(2)} mm (${(targetMm / 25.4).toFixed(2)} in)
SVG page: ${(targetMm + marginMm * 2).toFixed(2)} mm square
Vector rectangles: ${runs(matrix).length}`;

      if (moduleMm < 1.0) {

        showWarning(
          `The QR modules are only ${moduleMm.toFixed(2)} mm. ` +
          `Use a larger QR for the first vinyl test.`
        );
      }

    } catch (e) {

      console.error(e);

      showWarning(
        "QR generation failed. Refresh the page and try again."
      );
    }
  }

  function testSquare() {

    downloads.innerHTML = "";

    stats.textContent = "";

    showWarning("");

    drawSquare();

    download(
      squareSvg(),
      "CE6000-1-inch-test-square.svg"
    );

    stats.textContent =
      "Test square: exactly 1.00 × 1.00 inch (25.4 × 25.4 mm).";
  }

  $("generate")
    .addEventListener(
      "click",
      generate
    );

  $("test")
    .addEventListener(
      "click",
      testSquare
    );

  generate();

})();
