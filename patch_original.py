from pathlib import Path
r=Path('/mnt/data/VNL_D13_Workshop')
s=(r/'index.html').read_text()
s=s.replace('</style>\n\n<div class="app">','</style>\n<link rel="stylesheet" href="d13-workshop.css">\n\n<div class="app">',1)
s=s.replace('    <input id="q" class="search"', '''    <div class="lab-switch"><button id="mode-catalog" aria-pressed="true">Full truck explorer</button><button id="mode-lab" aria-pressed="false">D13 workbench</button></div>
    <div id="d13-panel" hidden></div>
    <input id="q" class="search"''',1)
s=s.replace('  const items = [];   // {part, mesh, base, ex}', '  const items = [];   // {part, mesh, base, ex}\n  let lab = null;',1)
s=s.replace('mesh.userData = { pi, base: M.clone(), ex: new THREE.Vector3(...p.ex[k]) };','mesh.userData = { pi, ki: k, base: M.clone(), ex: new THREE.Vector3(...p.ex[k]) };',1)
s=s.replace("items.forEach((m) => { m.visible = !!sysOn[DATA.parts[m.userData.pi].s]; });", "items.forEach((m) => { m.visible = !!sysOn[DATA.parts[m.userData.pi].s] && (!lab || lab.isVisible(m)); });",1)
s=s.replace('function select(pi, fromList) {','function select(pi, fromList, k) {',1)
s=s.replace('    applyVis();\n  }\n  // picking','    applyVis();\n    if(lab && lab.active) { card.hidden = true; lab.onSelect(pi, k); }\n  }\n  // picking',1)
s=s.replace('    select(hit ? hit.object.userData.pi : -1);','    select(hit ? hit.object.userData.pi : -1, false, hit ? hit.object.userData.ki : null);',1)
s=s.replace("  $('ex').addEventListener('input', () => {\n    const t", "  $('ex').addEventListener('input', () => {\n    if (lab && lab.active) return;\n    const t",1)
s=s.replace("  $('iso').addEventListener('click', home); home();","  $('iso').addEventListener('click', () => { if(lab && lab.active) { lab.enable(true); } else home(); }); home();",1)
s=s.replace("  (function loop() { controls.update(); renderer.render(scene, camera); requestAnimationFrame(loop); })();", "  lab = window.createD13Workshop({DATA, items, root, scene, camera, controls, canvas, sysOn, applyVis, home});\n  (function loop() { controls.update(); if(lab) lab.tick(); renderer.render(scene, camera); requestAnimationFrame(loop); })();",1)
s=s.replace('<script>\n__load().then(function () {', '<script src="d13-workshop.js"></script>\n<script>\n__load().then(function () {',1)
assert 'workshop.css' in s and 'createD13Workshop' in s
(r/'index.html').write_text(s)
engine=s.replace("fetch('vdata_index.json')", "fetch('d13_data_index.json')").replace('<h1>VNL 6x4 TRUCK BUILD</h1>','<h1>VOLVO D13 · ENGINE LAB</h1>')
(r/'d13.html').write_text(engine)
print('Full html',len(s),'D13 html',len(engine))
