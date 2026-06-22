import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

// O spritesheet final do Phaser terá exatamente 12 frames de 48x48px
const FRAME_W = 48;
const FRAME_H = 48;
const TOTAL_FRAMES = 12;
const SHEET_W = FRAME_W * TOTAL_FRAMES; // 576px
const SHEET_H = FRAME_H; // 48px

/**
 * Remove o fundo magenta com tolerância e feathering.
 */
async function processAlpha(buffer, width, height, tolerance = 45, feather = 25) {
  const keyColor = { r: 255, g: 0, b: 255 }; // Magenta
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = new Uint8Array(data);

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const a = pixels[i + 3];

    const dist = Math.abs(r - keyColor.r) + Math.abs(g - keyColor.g) + Math.abs(b - keyColor.b);

    if (dist < tolerance) {
      pixels[i + 3] = 0; // Transparente
    } else if (dist < tolerance + feather) {
      const factor = (dist - tolerance) / feather;
      pixels[i + 3] = Math.round(a * factor);
      if (factor < 0.5) {
        pixels[i] = Math.round(r * factor);
        pixels[i + 1] = Math.round(g * factor);
        pixels[i + 2] = Math.round(b * factor);
      }
    }
  }

  return sharp(Buffer.from(pixels), {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4
    }
  }).png().toBuffer();
}

/**
 * Recorta, redimensiona, centraliza os frames e junta em uma tira horizontal 576x48px.
 */
export async function compileGeekSprite(inputPath, outputPath, options = {}) {
  const tolerance = options.tolerance ?? 45;
  const feather = options.feather ?? 25;
  const fitSize = options.fitSize ?? 38; // Encolhe levemente para não encostar nas bordas (48px)

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Imagem de entrada não encontrada: ${inputPath}`);
  }

  // 1. Carrega e remove o fundo da imagem inteira
  console.log(`[Geek Compiler] Removendo fundo de: ${inputPath}...`);
  const meta = await sharp(inputPath).metadata();
  const rawPngBuffer = await sharp(inputPath).png().toBuffer();
  const transparentBuffer = await processAlpha(rawPngBuffer, meta.width, meta.height, tolerance, feather);

  // 2. Fatia em 12 frames horizontais
  const inputCellW = Math.floor(meta.width / TOTAL_FRAMES);
  const inputCellH = meta.height; // Assume que é uma tira de 1 linha de altura
  const frameBuffers = [];

  console.log(`[Geek Compiler] Fatiando e centralizando ${TOTAL_FRAMES} frames (célula original: ${inputCellW}x${inputCellH}px)...`);

  for (let i = 0; i < TOTAL_FRAMES; i++) {
    const left = i * inputCellW;
    
    // Extrai o frame individual
    let frameSharp = sharp(transparentBuffer)
      .clone()
      .extract({ left, top: 0, width: inputCellW, height: inputCellH });

    // Redimensiona o sprite para caber no fitSize mantendo proporções
    // (ex: reduz o sprite para até 38px para caber na moldura de 48px com margem)
    frameSharp = frameSharp.resize(fitSize, fitSize, {
      fit: 'inside',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    });

    const frameBuf = await frameSharp.png().toBuffer();
    const frameMeta = await sharp(frameBuf).metadata();

    // Centraliza o frame dentro de uma moldura transparente padrão de 48x48px
    const offLeft = Math.round((FRAME_W - frameMeta.width) / 2);
    const offTop = FRAME_H - frameMeta.height - 2; // Coloca o personagem ancorado próximo à base (2px de margem na base)

    const finalCellBuf = await sharp({
      create: {
        width: FRAME_W,
        height: FRAME_H,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
    .composite([{ input: frameBuf, left: offLeft, top: offTop }])
    .png()
    .toBuffer();

    frameBuffers.push(finalCellBuf);
  }

  // 3. Monta a tira horizontal final
  console.log(`[Geek Compiler] Costurando a tira final (576x48px) em: ${outputPath}...`);
  const compositeList = frameBuffers.map((buf, i) => ({
    input: buf,
    left: i * FRAME_W,
    top: 0
  }));

  const outDir = path.dirname(outputPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  await sharp({
    create: {
      width: SHEET_W,
      height: SHEET_H,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
  .composite(compositeList)
  .png()
  .toFile(outputPath);

  console.log(`✓ Spritesheet compilada com sucesso!`);
}

// Execução por CLI
if (process.argv[1] && (process.argv[1].endsWith('compile_geek_sprite.mjs') || process.argv[1].endsWith('compile_geek_sprite'))) {
  const [,, input, output, fit] = process.argv;
  if (!input || !output) {
    console.log('Uso: node compile_geek_sprite.mjs <input_path> <output_path> [fit_size]');
    process.exit(1);
  }
  const fitSz = fit ? parseInt(fit, 10) : undefined;
  compileGeekSprite(input, output, { fitSize: fitSz }).catch(console.error);
}
