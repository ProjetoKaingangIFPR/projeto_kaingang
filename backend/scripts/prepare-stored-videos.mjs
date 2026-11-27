import { readFile, writeFile, stat, rename, mkdir } from 'node:fs/promises';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { availableParallelism } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const runIndex = process.argv.indexOf('--run-dir');
const directory = path.resolve(root, runIndex === -1 ? 'build/stored-video-vbr' : process.argv[runIndex + 1]);
if (!directory.startsWith(path.join(root, 'build') + path.sep)) throw new Error('Pasta inválida.');
const tools = JSON.parse(await readFile(path.join(root, 'build/stored-video-vbr/tools/paths.json'), 'utf8'));
const crfIndex = process.argv.indexOf('--crf'), limitIndex = process.argv.indexOf('--limit');
const presetIndex = process.argv.indexOf('--preset');
const preset = presetIndex === -1 ? 'slow' : process.argv[presetIndex + 1];
if (!['medium', 'slow'].includes(preset)) throw new Error('Preset inválido.');
const codecIndex = process.argv.indexOf('--codec');
const codec = codecIndex === -1 ? 'h264' : process.argv[codecIndex + 1];
if (!['h264', 'hevc'].includes(codec)) throw new Error('Codec inválido.');
const crf = crfIndex === -1 ? 18 : Number(process.argv[crfIndex + 1]);
const limit = limitIndex === -1 ? Infinity : Number(process.argv[limitIndex + 1]);
if (!Number.isInteger(crf) || crf < 14 || crf > (codec === 'hevc' ? 30 : 24) || !(limit > 0)) throw new Error('Parâmetros inválidos.');
const reportPath = path.join(directory, `native-${codec === 'h264' ? '' : codec + '-'}${preset}-crf${crf}.json`);
const files = JSON.parse(await readFile(path.join(directory, 'backups.json'), 'utf8')).filter(file => file.type.startsWith('video/')).slice(0, limit);
let report;
try { report = JSON.parse(await readFile(reportPath, 'utf8')); } catch { report = { results: [] }; }
await mkdir(path.join(directory, 'candidates'), { recursive: true });
for (const [index, file] of files.entries()) {
  if (report.results.some(result => result.id === file.id)) continue;
  const result = { id: file.id, sourceSha256: file.sha256, sourceBytes: file.size, method: `ffmpeg-${codec === 'h264' ? 'x264' : 'x265'}-${preset}-crf${crf}`, status: 'skipped' };
  try {
    const { stdout } = await promisify(execFile)(tools.ffprobe, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file.backupPath], { windowsHide: true });
    const metadata = JSON.parse(stdout), videos = metadata.streams.filter(stream => stream.codec_type === 'video');
    if (videos.length !== 1 || metadata.streams.some(stream => !['video', 'audio'].includes(stream.codec_type))) throw new Error('Faixas extras preservadas no original.');
    if (['smpte2084', 'arib-std-b67'].includes(videos[0].color_transfer) || !['yuv420p', 'yuvj420p'].includes(videos[0].pix_fmt)) throw new Error('HDR ou profundidade/formato de cor especial preservado.');
    const destination = path.join(directory, 'candidates', file.id + `.${codec}-${preset}-crf${crf}.mp4`);
    const profile = /baseline/i.test(videos[0].profile ?? '') ? 'baseline' : videos[0].profile === 'Main' ? 'main' : 'high';
    const compatibility = codec === 'h264' ? ['-profile:v', profile, '-refs', '4']
      : ['-profile:v', 'main', '-tag:v', 'hvc1', '-x265-params', `pools=${Math.min(8, availableParallelism())}:frame-threads=2:log-level=error`];
    if (codec === 'h264' && videos[0].codec_name === 'h264' && videos[0].level > 0) compatibility.push('-level:v', (videos[0].level / 10).toFixed(1));
    const start = Date.now();
    console.log(`${index + 1}/${files.length} iniciando ${codec === 'h264' ? 'x264' : 'x265'} CRF ${crf}`);
    await new Promise((resolve, reject) => {
      const child = spawn(tools.ffmpeg, ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-i', file.backupPath,
        '-map', '0', '-map_metadata', '0', '-c', 'copy', '-c:v', codec === 'h264' ? 'libx264' : 'libx265', '-preset', preset, '-crf', String(crf),
        '-threads', String(Math.min(8, availableParallelism())), ...compatibility, '-pix_fmt', 'yuv420p', '-fps_mode:v', 'passthrough', '-enc_time_base:v', 'demux',
        '-movflags', '+faststart', '-fs', String(file.size), '-progress', 'pipe:1', '-stats_period', '10', destination],
      { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      let error = '';
      child.stderr.on('data', chunk => { error = (error + chunk.toString()).slice(-6000); });
      child.stdout.on('data', chunk => {
        const match = chunk.toString().match(/out_time_us=(\d+)/);
        if (match) console.log(`  ${Math.min(100, Number(match[1]) / 1e6 / Number(metadata.format.duration) * 100).toFixed(0)}%`);
      });
      child.on('error', reject); child.on('close', code => code === 0 ? resolve() : reject(new Error(error || 'FFmpeg encerrou com erro.')));
    });
    result.encodingSeconds = (Date.now() - start) / 1000;
    result.outputBytes = (await stat(destination)).size;
    result.savedPercent = (1 - result.outputBytes / file.size) * 100;
    if (result.savedPercent < 5) result.reason = 'Economia inferior a 5%; original preservado.';
    else { result.status = 'prepared'; result.candidatePath = destination; }
  } catch (error) { result.reason = String(error); }
  report.results.push(result);
  await writeFile(reportPath + '.tmp', JSON.stringify(report, null, 2)); await rename(reportPath + '.tmp', reportPath);
  console.log(`${index + 1}/${files.length} ${result.status} ${result.savedPercent?.toFixed(1) ?? 0}% ${result.reason ?? ''}`);
}
