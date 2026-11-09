# VNL Modular Labs — GitHub Pages upgrade

This package contains ONLY HTML files. Keep your existing `vdata_index.json`, `vdata_0.json`, `vdata_1.json`, `vdata_2.json`, `d13_data_index.json`, `d13_meshes.json`, and `d13-physics.js` in your GitHub repository root.

## Upload
Upload the 8 HTML files into the repository root and replace `index.html` and `d13.html`. Keep all JSON and JavaScript model assets as they are.

`index.html`: Claude's original full-truck explorer preserved with navigation bar. Heavy and loads its entire model. On machines where Three.js is blank, use `truck-lite.html` instead.
`truck-lite.html`: independently loaded, verified raw WebGL2 lightweight truck viewer.
`d13.html`: independently loaded D13 engine-only 3D workshop with simple state-machine teardown and physics approximation.
`transmission.html`: standalone interactive 2D manual gearbox/clutch mechanics.
`wheels.html`: standalone interactive 2D air-brake and wheel system.
`suspension.html`: standalone air spring/damper teaching model.
`axles.html`: standalone differential speed model.
`electrical.html`: standalone voltage/current/fuse model.

Switching between tabs follows ordinary links and unloads the previous page. Tabs are NOT hidden 3D canvases. New system simulations are schematic and generic, NOT verified OEM part models or engineering simulations.

## Direct URL paths
`https://manpreet2213.github.io/d13/`
`https://manpreet2213.github.io/d13/d13.html`
`https://manpreet2213.github.io/d13/transmission.html`

The original Claude viewer loads Three.js externally and needs internet access. New 2D labs don't use external JavaScript libraries. Models load from your GitHub JSON files only when opening the corresponding 3D viewer.
