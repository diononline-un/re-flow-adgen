/** Clientseitige Bildkompression: max. 1568 px lange Kante, JPEG q0.8, <= 5 MB. */
export async function compressImage(file: File): Promise<string> {
  const dataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("decode failed"));
    image.src = dataUrl;
  });

  const MAX_SIDE = 1568;
  let { width, height } = img;
  const longSide = Math.max(width, height);
  if (longSide > MAX_SIDE) {
    const scale = MAX_SIDE / longSide;
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, width, height);

  let quality = 0.8;
  let out = canvas.toDataURL("image/jpeg", quality);
  while (out.length > 7 * 1024 * 1024 && quality > 0.3) {
    quality -= 0.15;
    out = canvas.toDataURL("image/jpeg", quality);
  }
  return out;
}
