/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const REPLACEMENTS = new Map([
  ['Ã³', 'ó'],
  ['Ã©', 'é'],
  ['Ã­', 'í'],
  ['Ã¡', 'á'],
  ['Ã±', 'ñ'],
  ['Ã¼', 'ü'],
  ['Ãº', 'ú'],
  ['â€™', "'"],
]);

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findSrcDir() {
  const direct = path.resolve(process.cwd(), 'src');
  if (fs.existsSync(direct) && fs.statSync(direct).isDirectory()) {
    return direct;
  }

  const frontendSrc = path.resolve(process.cwd(), 'apps', 'frontend', 'src');
  if (fs.existsSync(frontendSrc) && fs.statSync(frontendSrc).isDirectory()) {
    return frontendSrc;
  }

  return null;
}

function collectTsFiles(dir, acc) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      collectTsFiles(fullPath, acc);
      continue;
    }

    if (entry.isFile() && (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx'))) {
      acc.push(fullPath);
    }
  }
}

function replaceInText(content) {
  let updated = content;
  let replacements = 0;

  for (const [broken, fixed] of REPLACEMENTS.entries()) {
    const regex = new RegExp(escapeRegExp(broken), 'g');
    const matches = updated.match(regex);
    if (!matches) continue;

    replacements += matches.length;
    updated = updated.replace(regex, fixed);
  }

  return { updated, replacements };
}

function run() {
  const srcDir = findSrcDir();
  if (!srcDir) {
    console.error('No se encontro una carpeta src para procesar.');
    process.exitCode = 1;
    return;
  }

  const files = [];
  collectTsFiles(srcDir, files);

  let filesChanged = 0;
  let totalReplacements = 0;

  for (const filePath of files) {
    const original = fs.readFileSync(filePath, 'utf8');
    const { updated, replacements } = replaceInText(original);

    if (replacements > 0) {
      fs.writeFileSync(filePath, updated, 'utf8');
      filesChanged += 1;
      totalReplacements += replacements;
    }
  }

  console.log('--- Reporte fix-encoding ---');
  console.log(`Directorio procesado: ${srcDir}`);
  console.log(`Archivos analizados: ${files.length}`);
  console.log(`Archivos modificados: ${filesChanged}`);
  console.log(`Reemplazos totales: ${totalReplacements}`);
}

run();

