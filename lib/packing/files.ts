type FileExporter = (name: string, text: string, mime: string) => Promise<void>;
let nativeExporter: FileExporter | undefined;
export const hasNativeFileExporter = () => Boolean(nativeExporter);
export function setFileExporter(exporter: FileExporter) {
  nativeExporter = exporter;
}
export async function saveTextFile(
  name: string,
  text: string,
  mime = 'application/json',
) {
  if (nativeExporter) return nativeExporter(name, text, mime);
  const url = URL.createObjectURL(new Blob([text], { type: mime })),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
