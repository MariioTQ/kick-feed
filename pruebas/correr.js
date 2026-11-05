// Corre las pruebas y dice cuáles fallaron.  node correr.js [servidor|app] [nombre]
// Cada archivo imprime «PASS …» / «FAIL …» y al final «TODO BIEN» (o «TODO OK») si todo salió.
const { spawnSync } = require('child_process'), fs = require('fs'), path = require('path');
const quien = process.argv[2], solo = process.argv[3];
const dirs = quien ? [quien] : ['servidor', 'app'];
let malas = [];
for (const d of dirs) {
  const lista = fs.readdirSync(path.join(__dirname, d)).filter(f => /^(harness|v|guardia|sb|overlays)[\w]*\.js$/.test(f) && (!solo || f.indexOf(solo) >= 0)).sort();
  for (const f of lista) {
    const r = spawnSync(process.execPath, [path.join(__dirname, d, f)], { encoding: 'utf8', timeout: 300000, cwd: path.join(__dirname, d) });
    const out = (r.stdout || '') + (r.stderr || '');
    const ok = /TODO (BIEN|OK)\s*$/.test(out.trim());
    console.log((ok ? '✔ ' : '✘ ') + d + '/' + f);
    if (!ok) { malas.push(d + '/' + f); out.split('\n').filter(l => /^FAIL|Error/.test(l)).slice(0, 5).forEach(l => console.log('    ' + l.slice(0, 220))); }
  }
}
console.log(malas.length ? '\n' + malas.length + ' con fallas: ' + malas.join(', ') : '\nTODO BIEN');
process.exit(malas.length ? 1 : 0);
