# Field of View Calculator

Machine vision sizing tool. Pick a camera, a lens and a working distance, and
read the field of view and pixels per module.

Calculations match `GTX_and_CV60_FOV_Calculator_5.xlsx` cell for cell.

## Publishing to GitHub Pages

1. Create a repository and push these files to it:

   ```
   git init
   git add .
   git commit -m "Field of view calculator"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/REPO-NAME.git
   git push -u origin main
   ```

2. Go to **Settings → Pages**.
3. Set Source to **Deploy from a branch**, branch **main**, folder **/ (root)**.
   Save.
4. A minute later the site is live at
   `https://YOUR-USERNAME.github.io/REPO-NAME/`.

Pushing a change redeploys the site automatically.

To use an address like `fov.peaktech.com`, add it under Settings → Pages →
Custom domain, create the DNS record GitHub asks for, then tick **Enforce
HTTPS**.

Note that GitHub Pages sites are public by default on every plan except
Enterprise Cloud. Making the repository private does not make the site private.

## Testing it before you push

Open `index.html` in a browser. There is no build step and no server, so what
you see locally is exactly what gets published.

## Editing the camera list

Camera specs live in `calc-data.js`. Add or change an entry in `cameras` and add
the model name to `modelOrder` to make it appear in the dropdown:

```js
"GTX 20000": {
  "sensor_x_mm": 14.2,
  "sensor_y_mm": 10.6,
  "pixels_x": 4512,
  "pixels_y": 4512,
  "optical_format": "1.2"
},
```

`lenses` is the focal length dropdown. `ppmMinimum` is the pixels-per-module
threshold that turns the readout green or red; it is currently 1.5.

## Files

| File | Purpose |
|---|---|
| `index.html` | the page |
| `styles.css` | styling |
| `calc-data.js` | camera specs, lens list, thresholds — edit this one |
| `calculator.js` | the formulas, one function per spreadsheet cell |
| `app.js` | the interface |
