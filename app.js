/* Field of view calculator - user interface.
   This file collects inputs and draws results. All arithmetic lives in
   calculator.js, which is a checked port of the spreadsheet's formulas. */

const el = (id) => document.getElementById(id);

const ui = {
  model: el("model"), modelSpec: el("modelSpec"),
  lens: el("lens"), lensCustom: el("lensCustom"),
  distance: el("distance"), distanceUnit: el("distanceUnit"), distanceEcho: el("distanceEcho"),
  module: el("module"), moduleUnit: el("moduleUnit"),
  alert: el("alert"),
  viewport: el("viewport"),
  fovX: el("fovX"), fovXAlt: el("fovXAlt"),
  fovY: el("fovY"), fovYAlt: el("fovYAlt"),
  ppm: el("ppm"), ppmAlt: el("ppmAlt"), ppmCard: el("ppmCard"),
  specsheet: el("specsheet"),
  convValue: el("convValue"), convUnit: el("convUnit"), convOut: el("convOut"),
  refTable: el("refTable").querySelector("tbody"),
  copyBtn: el("copyBtn"),
};

let options = null;
let latest = null;

const num = (v, dp) => v.toLocaleString(undefined, {
  minimumFractionDigits: dp, maximumFractionDigits: dp,
});

/* --------------------------------------------------------------- startup */

function start() {
  options = { ppm_minimum: DATA.ppmMinimum };

  DATA.modelOrder.forEach((m) => {
    ui.model.add(new Option(m, m));
  });
  DATA.lenses.forEach((f) => {
    ui.lens.add(new Option(`${f}`, `${f}`));
  });
  ui.lens.add(new Option("Custom\u2026", "custom"));

  // The workbook was last saved on this combination.
  ui.model.value = "FS42-5MP";
  ui.lens.value = "8";

  ui.refTable.innerHTML = referenceTable().map((r) =>
    `<tr><td>${r.feet}</td><td>${num(r.inch, 0)}</td><td>${num(r.mm, 1)}</td></tr>`).join("");

  [ui.model, ui.lens, ui.lensCustom, ui.distance, ui.distanceUnit, ui.module, ui.moduleUnit]
    .forEach((node) => node.addEventListener("input", schedule));
  ui.lens.addEventListener("change", toggleCustomLens);
  ui.copyBtn.addEventListener("click", copyResults);
  [ui.convValue, ui.convUnit].forEach((n) => n.addEventListener("input", convert));

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => latest && drawViewport(latest), 180);
  });

  convert();
  run();
}

function toggleCustomLens() {
  const custom = ui.lens.value === "custom";
  ui.lensCustom.classList.toggle("hidden", !custom);
  if (custom) ui.lensCustom.focus();
}

/* ------------------------------------------------------------ calculate */

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(run, 140);
}

function focalLength() {
  return ui.lens.value === "custom" ? ui.lensCustom.value : ui.lens.value;
}

function run() {
  if (focalLength() === "" || ui.distance.value === "" || ui.module.value === "") {
    showAlert("Fill in every field to see a result.");
    return;
  }

  try {
    // The workbook's cell B15 is millimetres and cell H18 is inches. Whatever
    // unit was chosen is converted first, so the arithmetic is unchanged.
    latest = calculate({
      model: ui.model.value,
      focalLengthMm: focalLength(),
      workingDistanceMm: toMm(ui.distance.value, ui.distanceUnit.value),
      milSizeIn: toInch(ui.module.value, ui.moduleUnit.value),
    });
    clearAlert();
    render(latest);
  } catch (err) {
    showAlert(err.message);
  }
}

/* The field of view is reported in whichever unit the working distance was
   entered in. That unit gets the large reading; the other two follow beneath
   it. Only the presentation changes -- the underlying numbers are the same. */
const UNITS = {
  mm: {
    suffix: "mm", dp: () => 1,
    x: (r) => r.fov_x_mm, y: (r) => r.fov_y_mm, wd: (i) => i.working_distance_mm,
  },
  inch: {
    suffix: "in", dp: (v) => (Math.abs(v) >= 100 ? 1 : 2),
    x: (r) => r.fov_x_in, y: (r) => r.fov_y_in, wd: (i) => i.working_distance_in,
  },
  feet: {
    suffix: "ft", dp: (v) => (Math.abs(v) >= 100 ? 1 : 2),
    x: (r) => r.fov_x_ft, y: (r) => r.fov_y_ft, wd: (i) => i.working_distance_ft,
  },
};

const SECONDARY_UNITS = {
  mm:   ["inch", "feet"],
  inch: ["mm", "feet"],
  feet: ["mm", "inch"],
};

function primaryUnit() {
  return UNITS[ui.distanceUnit.value] ? ui.distanceUnit.value : "mm";
}

/* One large reading, formatted in the chosen unit. */
function mainValue(results, axis) {
  const u = UNITS[primaryUnit()];
  const v = u[axis](results);
  return `${num(v, u.dp(v))} ${u.suffix}`;
}

/* The working distance, echoed back in the unit it was entered in. */
function distanceInPrimary(inputs) {
  const u = UNITS[primaryUnit()];
  const v = u.wd(inputs);
  return `${num(v, u.dp(v))} ${u.suffix}`;
}

/* The remaining two units, with their labels subordinate to the numbers. */
function altValues(results, axis) {
  return SECONDARY_UNITS[primaryUnit()]
    .map((key) => {
      const u = UNITS[key];
      const v = u[axis](results);
      return `${num(v, u.dp(v))}<span class="unit">${u.suffix}</span>`;
    })
    .join('<span class="sep">/</span>');
}

/* --------------------------------------------------------------- render */

function render(d) {
  const r = d.results, c = d.camera;

  ui.fovX.textContent = mainValue(r, "x");
  ui.fovXAlt.innerHTML = altValues(r, "x");
  ui.fovY.textContent = mainValue(r, "y");
  ui.fovYAlt.innerHTML = altValues(r, "y");

  ui.ppm.textContent = num(r.ppm, 2);
  ui.ppmCard.className = `readout readout--ppm is-${r.ppm_rating}`;
  ui.ppmAlt.textContent = r.ppm_rating === "good"
    ? `Meets the ${options.ppm_minimum} minimum`
    : `Below the ${options.ppm_minimum} minimum`;

  ui.modelSpec.textContent =
    `${c.pixels_x} \u00d7 ${c.pixels_y} px \u00b7 ${c.megapixels} MP \u00b7 ` +
    `sensor ${c.sensor_x_mm} \u00d7 ${c.sensor_y_mm} mm`;

  ui.distanceEcho.textContent = ui.distanceUnit.value === "mm"
    ? `${num(d.inputs.working_distance_in, 1)} in from the lens`
    : `${num(d.inputs.working_distance_mm, 1)} mm from the lens`;

  const rows = [
    ["Sensor width", `${c.sensor_x_mm} mm`],
    ["Sensor height", `${c.sensor_y_mm} mm`],
    ["Resolution", `${c.pixels_x} \u00d7 ${c.pixels_y} px`],
    ["Lens", `${num(d.inputs.focal_length_mm, 1)} mm`],
    ["Working distance", `${num(d.inputs.working_distance_mm, 1)} mm`],
    ["Module size", `${num(d.inputs.mil_size_mil, 1)} mil`],
  ];
  ui.specsheet.innerHTML = rows.map(([k, v]) =>
    `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");

  drawViewport(d);
}

/* --------------------------- the field of view, drawn to its true shape */

function drawViewport(d) {
  const fx = d.results.fov_x_mm, fy = d.results.fov_y_mm;

  // A narrower viewBox on small screens keeps the dimension text readable,
  // because the SVG scales to the container either way.
  // Geometry is always computed in mm; only the printed labels change unit.
  const dimX = mainValue(d.results, "x");
  const dimY = mainValue(d.results, "y");

  const narrow = window.matchMedia("(max-width: 880px)").matches;
  const W = narrow ? 420 : 720;
  const H = narrow ? 430 : 440;
  const pad = narrow ? { l: 54, t: 46, r: 16, b: 42 } : { l: 68, t: 50, r: 24, b: 44 };
  const boxW = W - pad.l - pad.r, boxH = H - pad.t - pad.b;

  // Fit the true aspect ratio inside the available box.
  const scale = Math.min(boxW / fx, boxH / fy);
  const w = fx * scale, h = fy * scale;
  const cx = pad.l + boxW / 2, cy = pad.t + boxH / 2;
  const x = cx - w / 2, y = cy - h / 2;

  ui.viewport.innerHTML = `
  <svg viewBox="0 0 ${W} ${H}" role="img"
       aria-label="Field of view ${dimX} by ${dimY}, drawn to scale">
    <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"
          fill="#F1F5E2" stroke="#A4C03C" stroke-width="2.5" rx="3"/>

    <!-- width dimension -->
    <line x1="${x.toFixed(1)}" y1="${(y - 22).toFixed(1)}" x2="${(x + w).toFixed(1)}" y2="${(y - 22).toFixed(1)}"
          stroke="#5F6555" stroke-width="1"/>
    <line x1="${x.toFixed(1)}" y1="${(y - 28).toFixed(1)}" x2="${x.toFixed(1)}" y2="${(y - 16).toFixed(1)}" stroke="#5F6555" stroke-width="1"/>
    <line x1="${(x + w).toFixed(1)}" y1="${(y - 28).toFixed(1)}" x2="${(x + w).toFixed(1)}" y2="${(y - 16).toFixed(1)}" stroke="#5F6555" stroke-width="1"/>
    <text x="${(x + w / 2).toFixed(1)}" y="${(y - 30).toFixed(1)}" text-anchor="middle"
          font-size="14" font-weight="500" fill="#1D2115">${dimX}</text>

    <!-- height dimension -->
    <line x1="${(x - 22).toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x - 22).toFixed(1)}" y2="${(y + h).toFixed(1)}"
          stroke="#5F6555" stroke-width="1"/>
    <line x1="${(x - 28).toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x - 16).toFixed(1)}" y2="${y.toFixed(1)}" stroke="#5F6555" stroke-width="1"/>
    <line x1="${(x - 28).toFixed(1)}" y1="${(y + h).toFixed(1)}" x2="${(x - 16).toFixed(1)}" y2="${(y + h).toFixed(1)}" stroke="#5F6555" stroke-width="1"/>
    <text x="${(x - 32).toFixed(1)}" y="${(y + h / 2).toFixed(1)}" text-anchor="middle"
          font-size="14" font-weight="500" fill="#1D2115"
          transform="rotate(-90 ${(x - 32).toFixed(1)} ${(y + h / 2).toFixed(1)})">${dimY}</text>

    <text x="${(W / 2).toFixed(1)}" y="${(H - 12).toFixed(1)}" text-anchor="middle"
          font-size="12" fill="#5F6555">
      ${d.camera.model} \u00b7 ${num(d.inputs.focal_length_mm, 1)} mm lens \u00b7 ${distanceInPrimary(d.inputs)} working distance
    </text>
  </svg>`;
}

/* ------------------------------------------------------------ converters */

function convert() {
  if (ui.convValue.value === "") { ui.convOut.textContent = "\u00a0"; return; }
  try {
    const mm = toMm(ui.convValue.value, ui.convUnit.value);
    const inch = mmToInch(mm);
    ui.convOut.textContent =
      `${num(mm, 2)} mm \u00b7 ${num(inch, 3)} in \u00b7 ${num(inch / 12, 3)} ft`;
  } catch (err) {
    ui.convOut.textContent = err.message;
  }
}

/* ---------------------------------------------------------------- alerts */

function showAlert(msg) {
  ui.alert.textContent = msg;
  ui.alert.classList.remove("hidden");
}
function clearAlert() {
  ui.alert.classList.add("hidden");
}

/* ----------------------------------------------------------------- copy */

async function copyResults() {
  if (!latest) return;
  const d = latest, r = d.results, c = d.camera;
  const text = [
    "Field of view calculation",
    `Camera             ${c.model} (${c.pixels_x} x ${c.pixels_y}, ${c.megapixels} MP)`,
    `Lens               ${num(d.inputs.focal_length_mm, 1)} mm`,
    `Working distance   ${num(d.inputs.working_distance_mm, 1)} mm`,
    `Module size        ${num(d.inputs.mil_size_mil, 1)} mil`,
    "",
    `FOV width          ${num(r.fov_x_mm, 1)} mm  /  ${num(r.fov_x_in, 2)} in`,
    `FOV height         ${num(r.fov_y_mm, 1)} mm  /  ${num(r.fov_y_in, 2)} in`,
    `Pixels per module  ${num(r.ppm, 2)}`,
  ].join("\n");

  try {
    await navigator.clipboard.writeText(text);
    ui.copyBtn.textContent = "Copied";
  } catch {
    ui.copyBtn.textContent = "Press Ctrl+C";
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    setTimeout(() => ta.remove(), 6000);
  }
  setTimeout(() => { ui.copyBtn.textContent = "Copy results"; }, 2200);
}

start();
