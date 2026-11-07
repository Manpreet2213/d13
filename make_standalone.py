import json
from pathlib import Path
r=Path(__file__).parent
s=(r/'d13.html').read_text()
css=(r/'d13-workshop.css').read_text()
js=(r/'d13-workshop.js').read_text()
idx=json.loads((r/'d13_data_index.json').read_text())
meshes=json.loads((r/'d13_meshes.json').read_text())['meshes']
payload=json.dumps({'meshes':meshes,'parts':idx['parts'],'systems':idx['systems']},separators=(',',':')).replace('</','<\\/')
s=s.replace('<link rel="stylesheet" href="d13-workshop.css">','<style>\n'+css+'\n</style>',1)
s=s.replace('<script src="d13-workshop.js"></script>','<script>\n'+js+'\n</script>',1)
s=s.replace("async function __load() { const idx = await (await fetch('d13_data_index.json')).json(); const parts = await Promise.all(idx.files.map((f) => fetch(f).then((r) => r.json()))); DATA = { meshes: [].concat(...parts.map((p) => p.meshes)), parts: idx.parts, systems: idx.systems }; }", "async function __load() { DATA = JSON.parse(document.getElementById('d13-bundle-data').textContent); }")
s=s.replace('<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>', '<script id="d13-bundle-data" type="application/json">'+payload+'</script>\n<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>',1)
s=s.replace("if(window.location.pathname.endsWith('d13.html'))enable(true);", "if(window.location.pathname.endsWith('d13.html') || window.location.pathname.endsWith('D13_Workshop_Phone.html'))enable(true);")
s=s.replace("const storeKey='vnl-d13-lab-v2-' + (window.location.pathname.endsWith('d13.html') ? 'engine':'full');", "const storeKey='vnl-d13-lab-v2-' + ((window.location.pathname.endsWith('d13.html')||window.location.pathname.endsWith('D13_Workshop_Phone.html')) ? 'engine':'full');")
# Insert a recovery fallback if the library CDN cannot be reached. A file:// launch needs no JSON fetch.
s=s.replace('</body>', '</body>')
(r/'D13_Workshop_Phone.html').write_text(s)
print('Wrote single-file phone app:',(r/'D13_Workshop_Phone.html').stat().st_size,'bytes')
