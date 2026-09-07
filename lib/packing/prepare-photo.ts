export async function preparePhoto(file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new Error('Choose a JPEG, PNG or WebP photo.');
  if (file.size > 15 * 1024 * 1024)
    throw new Error('Choose a photo smaller than 15 MB.');
  const bitmap = await createImageBitmap(file);
  if (Math.min(bitmap.width, bitmap.height) < 320) {
    bitmap.close();
    throw new Error(
      'This photo is too small. Retake it at a higher resolution.',
    );
  }
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('Photo preparation is unavailable in this browser.');
  }
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.85);
}
