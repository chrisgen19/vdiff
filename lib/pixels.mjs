import { readFileSync } from 'node:fs';

const CHANNEL_TOLERANCE = 16;

const toDataUrl = (file) => `data:image/png;base64,${readFileSync(file).toString('base64')}`;

/**
 * Pixel compare of two PNGs in a scratch Chromium page (canvas), so no image
 * library is needed. Ratio is over the larger of the two areas minus the
 * `ignore` rects (image boxes, whose pixels vary with which srcset candidate
 * loaded); a size difference counts pixels outside the overlap as changed.
 */
export const comparePngs = async (browser, beforePath, afterPath, ignore = []) => {
  const context = await browser.newContext();
  const scratch = await context.newPage();
  try {
    return await scratch.evaluate(
      async ({ a, b, tolerance, ignore }) => {
        const load = (src) =>
          new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
          });
        const [imgA, imgB] = await Promise.all([load(a), load(b)]);
        const width = Math.max(imgA.width, imgB.width);
        const height = Math.max(imgA.height, imgB.height);
        const pixels = (img) => {
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext('2d');
          context.drawImage(img, 0, 0);
          return context.getImageData(0, 0, width, height).data;
        };
        const [da, db] = [pixels(imgA), pixels(imgB)];
        const skip = new Uint8Array(width * height);
        for (const rect of ignore) {
          const [x0, y0] = [Math.max(0, Math.floor(rect.x)), Math.max(0, Math.floor(rect.y))];
          const [x1, y1] = [Math.min(width, Math.ceil(rect.x + rect.width)), Math.min(height, Math.ceil(rect.y + rect.height))];
          for (let y = y0; y < y1; y += 1) skip.fill(1, y * width + x0, y * width + Math.max(x0, x1));
        }
        let changed = 0;
        let counted = 0;
        for (let i = 0; i < da.length; i += 4) {
          if (skip[i / 4]) continue;
          counted += 1;
          if (
            Math.abs(da[i] - db[i]) > tolerance ||
            Math.abs(da[i + 1] - db[i + 1]) > tolerance ||
            Math.abs(da[i + 2] - db[i + 2]) > tolerance ||
            Math.abs(da[i + 3] - db[i + 3]) > tolerance
          ) {
            changed += 1;
          }
        }
        return {
          ratio: counted ? changed / counted : 0,
          sizeChanged: imgA.width !== imgB.width || imgA.height !== imgB.height,
        };
      },
      { a: toDataUrl(beforePath), b: toDataUrl(afterPath), tolerance: CHANNEL_TOLERANCE, ignore },
    );
  } finally {
    await context.close();
  }
};
