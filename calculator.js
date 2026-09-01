/* The calculation engine, in the browser.
   A direct port of backend/calculator.py. Each function names the cell in
   GTX_and_CV60_FOV_Calculator_5.xlsx that it implements.

   tools/verify_static.py checks this file against the Python engine across
   every model and lens combination, so the two cannot silently drift apart. */

const MM_PER_INCH = DATA.mmPerInch;

class CalculationError extends Error {}

/* VLOOKUP of the model across the workbook's five lookup tables
   (C7, D7, E7, C8, D8). */
function lookupCamera(model) {
  const cam = DATA.cameras[model];
  if (!cam) throw new CalculationError(`Unknown camera model: ${model}`);
  return cam;
}

/* Cells C19 and D19:  =(B15/B12)*C7  and  =(B15/B12)*D7 */
function fieldOfViewMm(workingDistanceMm, focalLengthMm, sensorMm) {
  if (focalLengthMm === 0) throw new CalculationError("Lens focal length cannot be zero.");
  return (workingDistanceMm / focalLengthMm) * sensorMm;
}

/* Cells C20, D20 and I9:  =C19/25.4 */
function mmToInch(mm) { return mm / MM_PER_INCH; }

/* Cell I13:  =(H13*25.4) */
function inchToMm(inch) { return inch * MM_PER_INCH; }

/* Column N of the reference table:  =25.4*L6*12 */
function feetToMm(ft) { return MM_PER_INCH * ft * 12; }

/* Column M of the reference table:  =L6*12 */
function feetToInch(ft) { return ft * 12; }

/* Cell H19:  =((C8/C19)*25.4*H18) */
function pixelsPerModule(pixelsX, fovXMm, milSizeIn) {
  if (fovXMm === 0) throw new CalculationError("Field of view cannot be zero.");
  return (pixelsX / fovXMm) * MM_PER_INCH * milSizeIn;
}

function ppmRating(ppm) {
  return ppm >= DATA.ppmMinimum ? "good" : "low";
}

/* Length in any supported unit -> millimetres (the unit of cell B15). */
function toMm(value, unit) {
  if (value === "" || value === null || value === undefined) {
    throw new CalculationError("Enter a working distance.");
  }
  const v = Number(value);
  if (!Number.isFinite(v)) throw new CalculationError("Check that every field has a valid number.");
  if (unit === "mm") return v;
  if (unit === "inch") return inchToMm(v);
  if (unit === "feet") return feetToMm(v);
  throw new CalculationError("Working distance unit must be mm, inch or feet.");
}

/* Code module size in any supported unit -> inches (the unit of cell H18). */
function toInch(value, unit) {
  if (value === "" || value === null || value === undefined) {
    throw new CalculationError("Enter a code module size.");
  }
  const v = Number(value);
  if (!Number.isFinite(v)) throw new CalculationError("Check that every field has a valid number.");
  if (unit === "inch") return v;
  if (unit === "mil") return v / 1000;      // 1 mil = one thousandth of an inch
  if (unit === "mm") return mmToInch(v);
  throw new CalculationError("Module size unit must be mil, inch or mm.");
}

/* Run the whole sheet for one set of inputs. */
function calculate({ model, focalLengthMm, workingDistanceMm, milSizeIn }) {
  const focal = Number(focalLengthMm);
  const wd = Number(workingDistanceMm);
  const mil = Number(milSizeIn);

  if (!Number.isFinite(focal) || !Number.isFinite(wd) || !Number.isFinite(mil)) {
    throw new CalculationError("Check that every field has a valid number.");
  }
  if (focal <= 0) throw new CalculationError("Enter a lens focal length greater than zero.");
  if (wd <= 0) throw new CalculationError("Enter a working distance greater than zero.");
  if (mil <= 0) throw new CalculationError("Enter a code module size greater than zero.");

  const cam = lookupCamera(model);
  const fovXMm = fieldOfViewMm(wd, focal, cam.sensor_x_mm);
  const fovYMm = fieldOfViewMm(wd, focal, cam.sensor_y_mm);
  const ppm = pixelsPerModule(cam.pixels_x, fovXMm, mil);

  return {
    inputs: {
      model,
      focal_length_mm: focal,
      working_distance_mm: wd,
      working_distance_in: mmToInch(wd),
      working_distance_ft: mmToInch(wd) / 12,
      mil_size_in: mil,
      mil_size_mil: mil * 1000,
    },
    camera: {
      model,
      sensor_x_mm: cam.sensor_x_mm,
      sensor_y_mm: cam.sensor_y_mm,
      pixels_x: cam.pixels_x,
      pixels_y: cam.pixels_y,
      optical_format: cam.optical_format,
      megapixels: Math.round(cam.pixels_x * cam.pixels_y / 1e6 * 10) / 10,
    },
    results: {
      fov_x_mm: fovXMm,
      fov_y_mm: fovYMm,
      fov_x_in: mmToInch(fovXMm),
      fov_y_in: mmToInch(fovYMm),
      fov_x_ft: mmToInch(fovXMm) / 12,
      fov_y_ft: mmToInch(fovYMm) / 12,
      ppm,
      ppm_rating: ppmRating(ppm),
      resolution_mm_per_pixel: fovXMm / cam.pixels_x,
    },
  };
}

/* The feet / inch / mm reference table, cells L6:N20. */
function referenceTable(maxFeet = 15) {
  const rows = [];
  for (let ft = 1; ft <= maxFeet; ft += 1) {
    rows.push({ feet: ft, inch: feetToInch(ft), mm: feetToMm(ft) });
  }
  return rows;
}

/* Exported for the Node verification script; harmless in a browser. */
if (typeof module !== "undefined" && module.exports) {
  module.exports = { calculate, referenceTable, mmToInch, inchToMm, feetToMm, CalculationError };
}
