const extensions: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  gif: 'image/gif', avif: 'image/avif', bmp: 'image/bmp', tif: 'image/tiff',
  tiff: 'image/tiff', heic: 'image/heic', heif: 'image/heif',
  mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime',
  webm: 'video/webm', mkv: 'video/x-matroska',
  mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav',
  ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg',
  aac: 'audio/aac', flac: 'audio/flac',
};
export const mediaFormats = [...new Set([...Object.values(extensions), 'audio/webm'])];
export const mediaAccept = [...mediaFormats, ...Object.keys(extensions).map(extension => '.' + extension)].join(',');

export function normalizeMedia(file: File) {
  const type = mediaFormats.includes(file.type) ? file.type : extensions[file.name.split('.').pop()?.toLowerCase() ?? ''];
  return type && type !== file.type ? new File([file], file.name, { type, lastModified: file.lastModified }) : file;
}
