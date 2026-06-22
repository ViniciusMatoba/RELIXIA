import sharp from 'sharp';
import fs from 'node:fs';

async function removeBackground(inputPath, outputPath, keyColor = { r: 255, g: 0, b: 255 }, tolerance = 45, feather = 25) {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input image not found: ${inputPath}`);
  }

  console.log(`[BG Remover] Loading ${inputPath}...`);
  const meta = await sharp(inputPath).metadata();
  const rawData = await sharp(inputPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixels = new Uint8Array(rawData.data);

  console.log(`[BG Remover] Processing alpha channel (tolerance: ${tolerance}, feather: ${feather})...`);
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const a = pixels[i + 3];

    // Distance in RGB space
    const dist = Math.abs(r - keyColor.r) + Math.abs(g - keyColor.g) + Math.abs(b - keyColor.b);

    if (dist < tolerance) {
      pixels[i + 3] = 0; // Fully transparent
    } else if (dist < tolerance + feather) {
      const factor = (dist - tolerance) / feather;
      pixels[i + 3] = Math.round(a * factor);
    }
  }

  console.log(`[BG Remover] Saving transparent image to ${outputPath}...`);
  await sharp(Buffer.from(pixels), {
    raw: {
      width: rawData.info.width,
      height: rawData.info.height,
      channels: 4
    }
  })
  .png()
  .toFile(outputPath);

  console.log(`✓ Background removed successfully!`);
}

// CLI Execution
if (process.argv[1] && (process.argv[1].endsWith('remove_background.mjs') || process.argv[1].endsWith('remove_background'))) {
  const [,, input, output, r, g, b, tol] = process.argv;
  if (!input || !output) {
    console.log('Usage: node remove_background.mjs <input_path> <output_path> [R] [G] [B] [tolerance]');
    process.exit(1);
  }
  const color = r !== undefined && g !== undefined && b !== undefined 
    ? { r: parseInt(r, 10), g: parseInt(g, 10), b: parseInt(b, 10) }
    : { r: 255, g: 0, b: 255 }; // Default magenta
  const toleranceVal = tol ? parseInt(tol, 10) : 45;

  removeBackground(input, output, color, toleranceVal).catch(console.error);
}
