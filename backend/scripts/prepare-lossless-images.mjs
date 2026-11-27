import sharp from 'sharp';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, stat, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const run = promisify(execFile);
const directory = fileURLToPath(new URL('../build/stored-media/', import.meta.url));
const binary = path.join(directory, 'tools/node_modules/jpegtran-bin/vendor', process.platform === 'win32' ? 'jpegtran.exe' : 'jpegtran');
const backups = JSON.parse(await readFile(path.join(directory, 'backups.json'), 'utf8'));
const reportPath = path.join(directory, 'lossless-comparison.json');
let report;
try { report = JSON.parse(await readFile(reportPath, 'utf8')); } catch { report = { results: [] }; }
const sameBuffer = (a, b) => a === undefined && b === undefined || Buffer.isBuffer(a) && Buffer.isBuffer(b) && a.equals(b);
const files = backups.filter(file => file.type === 'image/jpeg');
for (const [index, file] of files.entries()) {
  if (report.results.some(result => result.id === file.id)) continue;
  const result = { id: file.id, sourceBytes: file.size, sourceType: file.type, sourceSha256: file.sha256,
    outputType: file.type, outputName: file.name, status: 'skipped', method: 'jpegtran-lossless' };
  try {
    const source = await readFile(file.backupPath);
    const header = new TextDecoder('latin1').decode(source.subarray(0, 256 * 1024));
    if (header.includes('MPF\0') || header.includes('hdrgm:') || header.includes('hdr-gain-map')) result.reason = 'Imagem com múltiplas fotos/gain map preservada.';
    else {
      const candidatePath = path.join(directory, 'candidates', file.id + '.lossless');
      await run(binary, ['-copy', 'all', '-optimize', '-progressive', '-outfile', candidatePath, file.backupPath], { windowsHide: true });
      result.outputBytes = (await stat(candidatePath)).size;
      result.savedPercent = (1 - result.outputBytes / source.length) * 100;
      if (result.savedPercent < 5) result.reason = 'Economia inferior a 5%.';
      else {
        const [before, after] = await Promise.all([
          sharp(source).raw().toBuffer({ resolveWithObject: true }),
          sharp(candidatePath).raw().toBuffer({ resolveWithObject: true }),
        ]);
        const [beforeMetadata, afterMetadata] = await Promise.all([sharp(source).metadata(), sharp(candidatePath).metadata()]);
        const pixelsIdentical = before.data.equals(after.data) && before.info.width === after.info.width && before.info.height === after.info.height;
        const metadataPreserved = ['exif', 'icc', 'xmp', 'iptc'].every(key => sameBuffer(beforeMetadata[key], afterMetadata[key]))
          && beforeMetadata.orientation === afterMetadata.orientation;
        result.quality = { pixelsIdentical, metadataPreserved, width: before.info.width, height: before.info.height };
        if (!pixelsIdentical || !metadataPreserved) result.reason = 'Verificação de pixels/metadados reprovada.';
        else { result.status = 'accepted'; result.candidatePath = candidatePath; }
      }
    }
  } catch (error) { result.reason = String(error); }
  report.results.push(result);
  await writeFile(reportPath + '.tmp', JSON.stringify(report, null, 2));
  await rename(reportPath + '.tmp', reportPath);
  console.log(`${index + 1}/${files.length} ${result.status} ${result.savedPercent?.toFixed(1) ?? 0}% ${result.reason ?? ''}`);
}
