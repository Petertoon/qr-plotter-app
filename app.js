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

  const chooseFolderButton = $("choose-folder");
  const folderStatus = $("folder-status");
  const autoSave = $("auto-save");

  const savePanel = $("save-panel");
  const filenameInput = $("filename");
  const saveManual = $("save-manual");

  let outputDirectory = null;
  let lastSvg = null;
  let lastFilename = null;


  // Convert inches to millimeters when needed.
  function mm(value, selectedUnit) {
    return selectedUnit === "in"
      ? value * 25.4
      : value;
  }


  // Display a warning message.
  function showWarning(message) {
    warning.hidden = !message;
    warning.textContent = message || "";
  }


  // Create a safe filename from the QR content.
  function safeName(value) {
    return value
      .replace(/^https?:\/\//i, "")
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50)
      .toLowerCase() || "qr";
  }


  // Create the QR matrix.
  function makeMatrix(value) {

    const qr = qrcode(0, ec.value);

    qr.addData(value);
    qr.make();

    const qrModules = qr.getModuleCount();

    const quietModules =
      Math.max(
        0,
        parseInt(quiet.value, 10) || 0
      );

    const totalModules =
      qrModules + quietModules * 2;

    const matrix = [];

    for (
      let row = 0;
      row < totalModules;
      row++
    ) {

      const currentRow = [];

      for (
        let col = 0;
        col < totalModules;
        col++
      ) {

        const qrRow =
          row - quietModules;

        const qrCol =
          col - quietModules;

        const dark =
          qrRow >= 0 &&
          qrRow < qrModules &&
          qrCol >= 0 &&
          qrCol < qrModules &&
          qr.isDark(qrRow, qrCol);

        currentRow.push(Boolean(dark));
      }

      matrix.push(currentRow);
    }

    return {
      matrix,
      qrModules,
      totalModules
    };
  }


  // Find horizontal black runs in the QR code.
  function getRuns(matrix) {

    const output = [];

    for (
      let row = 0;
      row < matrix.length;
      row++
    ) {

      let col = 0;

      while (col < matrix.length) {

        if (!matrix[row][col]) {
          col++;
          continue;
        }

        const start = col;

        while (
          col < matrix.length &&
          matrix[row][col]
        ) {
          col++;
        }

        output.push({
          row,
          start,
          width: col - start
        });
      }
    }

    return output;
  }


  // Create the SVG file.
  //
  // The SVG uses millimeters so Graphtec Studio 2
  // can preserve the physical size.
  function makeSvg(
    matrix,
    moduleMm,
    marginMm
  ) {

    const qrSide =
      matrix.length * moduleMm;

    const pageSide =
      qrSide + marginMm * 2;

    const rectangles =
      getRuns(matrix)
        .map(run => {

          const x =
            marginMm +
            run.start * moduleMm;

          const y =
            marginMm +
            run.row * moduleMm;

          const width =
            run.width * moduleMm;

          return `
<rect
  x="${x.toFixed(4)}"
  y="${y.toFixed(4)}"
  width="${width.toFixed(4)}"
  height="${moduleMm.toFixed(4)}"/>`;

        })
        .join("\n");

    return `<?xml version="1.0" encoding="UTF-8"?>

<svg
xmlns="http://www.w3.org/2000/svg"
width="${pageSide.toFixed(4)}mm"
height="${pageSide.toFixed(4)}mm"
viewBox="0 0 ${pageSide.toFixed(4)} ${pageSide.toFixed(4)}">

<title>Graphtec Studio 2 QR</title>

<g
fill="none"
stroke="#000000"
stroke-width="0.01">

${rectangles}

</g>

</svg>
`;
  }


  // Create the 1-inch test square.
  function makeTestSquareSvg() {

    const marginMm =
      Math.max(
        0,
        parseFloat(margin.value) || 0
      );

    const squareMm = 25.4;

    const pageMm =
      squareMm + marginMm * 2;

    return `<?xml version="1.0" encoding="UTF-8"?>

<svg
xmlns="http://www.w3.org/2000/svg"
width="${pageMm.toFixed(4)}mm"
height="${pageMm.toFixed(4)}mm"
viewBox="0 0 ${pageMm.toFixed(4)} ${pageMm.toFixed(4)}">

<rect
x="${marginMm.toFixed(4)}"
y="${marginMm.toFixed(4)}"
width="${squareMm.toFixed(4)}"
height="${squareMm.toFixed(4)}"
fill="none"
stroke="#000000"
stroke-width="0.01"/>

</svg>
`;
  }


  // Draw QR preview.
  function drawMatrix(matrix) {

    const n = matrix.length;

    const pixels =
      Math.max(
        2,
        Math.floor(480 / n)
      );

    preview.width =
      n * pixels;

    preview.height =
      n * pixels;

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
      let row = 0;
      row < n;
      row++
    ) {

      for (
        let col = 0;
        col < n;
        col++
      ) {

        if (matrix[row][col]) {

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


  // Draw the 1-inch test square.
  function drawTestSquare() {

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


  // Put the suggested filename into the save box.
  function setSuggestedFilename(name) {

    filenameInput.value =
      name.endsWith(".svg")
        ? name
        : name + ".svg";
  }


  // Display the manual save controls.
  function showManualSave(
    svg,
    filename
  ) {

    lastSvg = svg;
    lastFilename = filename;

    setSuggestedFilename(filename);

    savePanel.hidden = false;

    downloads.innerHTML = "";

    const downloadLink =
      document.createElement("a");

    downloadLink.href =
      URL.createObjectURL(
        new Blob(
          [svg],
          {
            type:
              "image/svg+xml;charset=utf-8"
          }
        )
      );

    downloadLink.download =
      filename;

    downloadLink.textContent =
      "Download SVG";

    downloads.appendChild(
      downloadLink
    );
  }


  // Choose a Windows folder for automatic saving.
  async function chooseFolder() {

    if (
      !("showDirectoryPicker" in window)
    ) {

      showWarning(
        "Your browser does not support folder selection. " +
        "Use the Download SVG button instead."
      );

      return;
    }

    try {

      outputDirectory =
        await window.showDirectoryPicker({
          mode: "readwrite"
        });

      folderStatus.textContent =
        "Output folder selected. Auto-save is ready.";

      showWarning("");

    } catch (error) {

      if (
        error.name !== "AbortError"
      ) {

        showWarning(
          "Could not select the folder."
        );
      }
    }
  }


  // Save an SVG directly into the selected folder.
  async function saveToFolder(
    svg,
    filename
  ) {

    if (!outputDirectory) {

      throw new Error(
        "Choose an output folder first."
      );
    }

    const fileHandle =
      await outputDirectory.getFileHandle(
        filename,
        {
          create: true
        }
      );

    const writable =
      await fileHandle.createWritable();

    await writable.write(svg);

    await writable.close();
  }


  // Manual save button.
  async function saveCurrentManually() {

    if (!lastSvg) {
      return;
    }

    let filename =
      filenameInput.value.trim();

    if (!filename) {

      filename =
        lastFilename ||
        "qr-code.svg";
    }

    if (
      !filename
        .toLowerCase()
        .endsWith(".svg")
    ) {

      filename += ".svg";
    }


    // If a folder was selected,
    // save directly into that folder.
    if (outputDirectory) {

      try {

        await saveToFolder(
          lastSvg,
          filename
        );

        folderStatus.textContent =
          "Saved: " + filename;

        showWarning("");

        return;

      } catch (error) {

        console.error(error);

        showWarning(
          "Could not save to the selected folder. " +
          "Use the Download SVG button below."
        );
      }
    }


    // Otherwise use the normal browser download.
    const link =
      document.createElement("a");

    link.href =
      URL.createObjectURL(
        new Blob(
          [lastSvg],
          {
            type:
              "image/svg+xml;charset=utf-8"
          }
        )
      );

    link.download =
      filename;

    link.click();
  }


  // Generate a QR code.
  async function generate() {

    downloads.innerHTML = "";

    savePanel.hidden = true;

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

      const result =
        makeMatrix(value);

      const matrix =
        result.matrix;

      const qrModules =
        result.qrModules;

      const totalModules =
        result.totalModules;

      const moduleMm =
        targetMm / totalModules;

      const svg =
        makeSvg(
          matrix,
          moduleMm,
          marginMm
        );

      drawMatrix(matrix);

      const filename =
        safeName(value) +
        "-qr.svg";

      showManualSave(
        svg,
        filename
      );


      stats.textContent =
        `QR code: ${qrModules} × ${qrModules} modules
Finished QR size: ${targetMm.toFixed(2)} mm (${(targetMm / 25.4).toFixed(2)} in)
SVG page: ${(targetMm + marginMm * 2).toFixed(2)} mm square
Vector rectangles: ${getRuns(matrix).length}`;


      // Automatic save.
      if (autoSave.checked) {

        if (!outputDirectory) {

          showWarning(
            "Auto-save is turned on, but no output folder has been selected. " +
            "Click Choose Output Folder first."
          );

        } else {

          try {

            await saveToFolder(
              svg,
              filename
            );

            folderStatus.textContent =
              "Automatically saved: " +
              filename;

            savePanel.hidden = true;

          } catch (error) {

            console.error(error);

            showWarning(
              "Automatic save failed. " +
              "The SVG is still available with the Download SVG button."
            );
          }
        }
      }


      if (moduleMm < 1.0) {

        showWarning(
          `The QR modules are ${moduleMm.toFixed(2)} mm. ` +
          `Use a larger QR for the first vinyl test.`
        );
      }

    } catch (error) {

      console.error(error);

      showWarning(
        "QR generation failed. Refresh the page and try again."
      );
    }
  }


  // Create a 1-inch test square.
  async function createTestSquare() {

    downloads.innerHTML = "";

    savePanel.hidden = true;

    stats.textContent = "";

    showWarning("");

    drawTestSquare();

    const svg =
      makeTestSquareSvg();

    const filename =
      "CE6000-1-inch-test-square.svg";

    showManualSave(
      svg,
      filename
    );

    stats.textContent =
      "Test square: exactly 1.00 × 1.00 inch (25.4 × 25.4 mm).";


    if (autoSave.checked) {

      if (!outputDirectory) {

        showWarning(
          "Auto-save is turned on, but no output folder has been selected."
        );

        return;
      }


      try {

        await saveToFolder(
          svg,
          filename
        );

        folderStatus.textContent =
          "Automatically saved: " +
          filename;

        savePanel.hidden = true;

      } catch (error) {

        console.error(error);

        showWarning(
          "Automatic save failed. " +
          "The SVG is still available for download."
        );
      }
    }
  }


  // Button events.
  chooseFolderButton
    .addEventListener(
      "click",
      chooseFolder
    );


  $("generate")
    .addEventListener(
      "click",
      generate
    );


  $("test")
    .addEventListener(
      "click",
      createTestSquare
    );


  saveManual
    .addEventListener(
      "click",
      saveCurrentManually
    );


  autoSave
    .addEventListener(
      "change",
      () => {

        if (
          autoSave.checked &&
          !outputDirectory
        ) {

          folderStatus.textContent =
            "Choose an output folder to enable automatic saving.";
        }
      }
    );


  // Generate the initial QR when the page loads.
  generate();

})();
