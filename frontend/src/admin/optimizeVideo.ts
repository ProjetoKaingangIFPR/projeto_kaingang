import { AppendOnlyStreamTarget, BlobSource, Conversion, Input, ALL_FORMATS,
  Mp4OutputFormat, Output, QUALITY_HIGH } from 'mediabunny';

class VideoOptimizationError extends Error {}

export async function optimizeVideo(original: File, signal: AbortSignal, progress: (value: number) => void) {
  signal.throwIfAborted();
  const input = new Input({ source: new BlobSource(original), formats: ALL_FORMATS });
  const chunks: Blob[] = [];
  let outputSize = 0;
  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: 'fragmented' }),
    target: new AppendOnlyStreamTarget(new WritableStream({
      write(chunk: Uint8Array) {
        signal.throwIfAborted();
        outputSize += chunk.byteLength;
        if (outputSize >= original.size) throw new VideoOptimizationError('Com esta qualidade, a cópia não fica menor. Use o original.');
        chunks.push(new Blob([Uint8Array.from(chunk)]));
      },
    })),
  });
  try {
    const video = await input.getPrimaryVideoTrack();
    if (!video) {
      const audio = await input.getPrimaryAudioTrack();
      if (!audio) throw new VideoOptimizationError('O arquivo não contém uma faixa de áudio ou vídeo reconhecida.');
      const type = (await input.getFormat()).mimeType.replace(/^video\//, 'audio/');
      if (!['audio/mp4', 'audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/wav', 'audio/aac', 'audio/flac'].includes(type))
        throw new VideoOptimizationError('O formato de áudio deste arquivo ainda não é aceito.');
      signal.throwIfAborted();
      return new File([original], original.name, { type, lastModified: original.lastModified });
    }
    if (!await video.canDecode()) throw new VideoOptimizationError('Este navegador não consegue converter este vídeo.');
    if (await video.hasHighDynamicRange()) throw new VideoOptimizationError('Para preservar as cores HDR, use o vídeo original.');
    signal.throwIfAborted();
    const conversion = await Conversion.init({
      input, output, video: { forceTranscode: true, quality: QUALITY_HIGH },
    });
    if (!conversion.isValid || conversion.discardedTracks.length) throw new VideoOptimizationError('Este navegador não consegue conservar todas as faixas do arquivo.');
    signal.throwIfAborted();
    const cancel = () => { void conversion.cancel().catch(() => {}); };
    signal.addEventListener('abort', cancel, { once: true });
    try {
      conversion.onProgress = value => progress(Math.floor(value * 100));
      await conversion.execute();
      signal.throwIfAborted();
      if (!outputSize) throw new VideoOptimizationError('A conversão não produziu um vídeo.');
      return new File(chunks, original.name.replace(/\.[^.]+$/, '') + '-otimizado.mp4', { type: 'video/mp4' });
    } finally {
      signal.removeEventListener('abort', cancel);
    }
  } catch (err) {
    if (signal.aborted || err instanceof VideoOptimizationError) throw err;
    throw new Error('Não foi possível preparar uma cópia com este arquivo e navegador.');
  } finally {
    input.dispose();
  }
}
