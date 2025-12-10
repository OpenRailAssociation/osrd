/**
 * This function captures a list of canvas layers into a PNG image, and returns a blob with the
 * PNG data if possible.
 */
export default async function getPNGBlob(
  canvases: Record<string, HTMLCanvasElement>,
  layers: readonly string[],
  backgroundColor = '#fff'
): Promise<Blob> {
  if (!layers.length) throw Error('There must be at least one layer to capture.');

  const firstCanvas = canvases[layers[0]];
  const width = firstCanvas.width;
  const height = firstCanvas.height;

  // Create a new canvas, on which the different layers will be drawn:
  const canvas = document.createElement('CANVAS') as HTMLCanvasElement;
  canvas.setAttribute('width', width + '');
  canvas.setAttribute('height', height + '');
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

  // Draw a white background first:
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, width, height);

  // For each layer, draw it on our canvas:
  layers.forEach((id) => {
    ctx.drawImage(canvases[id], 0, 0, width, height, 0, 0, width, height);
  });

  // Save the canvas as a PNG image:
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject();
    }, 'image/png');
  });
}
