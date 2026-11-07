# VNL D13 Engine Physics Workshop — November 2026

An extended version of the user-supplied **VNL Truck Build** project. Original supplied 3D mesh/catalogue data remains unchanged; the D13 workbench adds separate source modules for engine motion, numerical engine behavior, wrench handling and diagnostic overlays.

**Status:** functional *engineering-learning prototype*. It is **not** a validated Volvo D13 engineering simulation, OEM service document, CFD/FEA solver, or a safe source of real-world repair torque, timing or clearances.

## Open it

### Android — single file

Open `D13_Workshop_Phone.html` in Chrome or a WebGL-enabled browser. This version contains the engine geometry and all workshop source code in one HTML file. **Internet is required** to load Three.js and OrbitControls from their pre-existing CDNs. Some Android apps restrict file:// HTML and WebGL. If it does not load directly, publish the extracted folder through GitHub Pages or a simple web server and visit `d13.html` instead.

### Desktop and full truck

Extract the ZIP, open a terminal inside `VNL_D13_Workshop`, run `python -m http.server 8000`, and open:

- `http://localhost:8000/d13.html` — the lighter engine-only workbench.
- `http://localhost:8000/index.html` — the complete original Volvo truck with the additional **D13 workbench** tab.

Do not open `index.html` or `d13.html` directly through `file://`, since those two pages fetch external local model JSON files.

## New: animated engine internals

- Hand-crank through **720 degrees** or start the dynamic engine model, with **0.025× slow motion** for observing the mechanics.
- Animate all **six original piston meshes** using an analytic slider-crank mechanism with the model's nominal **158 mm stroke**, 79 mm throw, and an assumed **255 mm rod length**.
- Move crankshaft, piston rings, piston pins, con-rods and caps, crank-driven gear/flywheel, camshaft, cam gear, intake and exhaust valves, valve retainers, rocker arms, bridges, and valve springs.
- Firing order: **1-5-3-6-2-4**, 720-degree four-stroke timing, valve lift curves and visually timed injection/combustion event.
- Choose **Hide block / head** for cutaway. The engine shape and original separate-part catalogue are retained rather than substituted with primitive replacement parts.

Kinematics are analytic and apply to the modeled components. Internal component positions, rocker pivots, gear mesh behavior and service clearances have **not** been verified against detailed OEM CAD. The position of rotating rod parts depends on approximate center distances and source meshes.

## New: spatial ratchet training

1. Open the D13 workbench and select a visible fastener directly on the model.
2. Select **Socket / ratchet** and choose **Place 3D ratchet on selected bolt**.
3. Drag **left** on the 3D viewport to simulate counterclockwise loosening, or **right** to simulate clockwise fastening. You may need multiple drags. Angular travel accumulates and progresses the fastener state.
4. Continue using the original **Next operation** button for one-click guided actions, or switch to the hand and simulated torque-check tools during installation.

The 3D tool has a modeled handle and socket and checks direction, travel and assembly dependencies. This is *not* real rigid-body contact detection, socket-fit verification, friction/slippage modeling or OEM torque-angle calibration. Incorrect-tool prompts and the torque-check stage still use training rules.

## New: simplified physical engine model

A reproducible, zero-dimensional numerical engine model drives a 720-degree pressure graph and six live cylinder state indicators:

- A four-stroke pressure-volume cycle with compression/expansion and a Wiebe-inspired approximate diesel heat-release curve.
- Instantaneous cylinder pressure and pressure-derived crankshaft torque, rotating inertia, estimated friction/load, simulated fueling, governor and turbo pressure.
- Oil circulation tied to RPM, temperature-dependent viscosity, approximate gallery pressure, pump failure, oil inventory, leak rates and evolving low-oil-pressure damage/shutdown.
- Coolant pump flow, thermostat opening, lumped thermal mass, radiator/fan cooling, cooling system pressure, cooling loss and overheating.
- Adjustable **throttle** and **load**, with injectors, air restriction, failed oil pump, failed coolant pump, blocked radiator, coolant leak, thermostat-stuck-closed and oil-leak fault experiments.
- Cutaway overlays: schematic oil-flow and coolant-flow markers and a calculated combustion-pressure glow.

Important: This is a **0-D pressure/volume and lumped hydraulic/thermal** model, **not** finite-volume fluid dynamics, CFD, detailed combustion kinetics, measured oil passages, OEM temperature/pressure maps, or a verified engine dyno. The fluid tracers indicate **illustrative paths**, not actual Volvo gallery routing. The oil and coolant inventories, losses, heat-transfer coefficients, friction and torque maps are **assumptions** for educational experiments. Values must not be used to diagnose, tune or repair a real truck.

## Original workbench retained

The earlier 14-stage guided engine top-end teardown/reassembly still tracks 90 placed component/fastener instances with simplified prerequisites, gasket condition, tool selection and progress. The original whole-truck explorer and model-data files are retained.

## Test results

Run from inside `VNL_D13_Workshop`:

```bash
node tests/test_lab.cjs
node tests/test_physics.cjs
node tests/test_motion.cjs
```

All pass. An additional interface test `python tests/test_ui.py` also passed with Chromium running the real browser DOM and **a mocked THREE scene**. This checks the controls, pressure graph, inputs, and dynamic UI state, **not 3D rendering**. JavaScript syntax was checked with Node. A browser WebGL integration test and physical Android touch test **were not completed** because the execution environment restricts navigation to local/file URLs and cannot retrieve the CDN libraries.

## Project files

- `D13_Workshop_Phone.html` — bundled engine model + source; Three.js still fetched over internet.
- `d13.html` — stand-alone engine-only workbench with external engine JSON files.
- `index.html` — full VNL truck explorer plus D13 workbench mode.
- `d13-workshop.js` / `.css` — repair logic, new controls, gauges, pressure chart.
- `d13-physics.js` — platform-independent engine physics, analytic kinematics, pressure curves, oil/coolant circuits.
- `d13-motion.js` — animations applied to the actual uploaded engine meshes.
- `d13-tools.js` — 3D ratchet model and touch/mouse-drag interaction.
- `d13-effects.js` — cutaway schematic fluid movement and combustion visualization.
- `d13_meshes.json`, `d13_data_index.json` — pre-existing engine-only model data.
- `vdata_*.json`, `vdata_index.json` — original whole-truck model data.
- `tests/test_*.cjs`, `tests/test_ui.py` — tests.
