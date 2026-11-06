import sharp from "sharp";
import fs from "fs";
import path from "path";

// Lockup horizontal de marca: se centra sobre un lienzo cuadrado blanco.
// El PNG de origen es el logo horizontal; los iconos deben ser cuadrados.
const LOGO_SRC = path.join(process.cwd(), "src", "assets", "servired.png");
const LOGO_WIDTH_RATIO = 0.82;

const SIZES = [
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
  { file: "apple-touch-icon-180.png", size: 180 },
];

async function generateIcons() {
  const iconsDir = path.join(process.cwd(), "public", "icons");
  fs.mkdirSync(iconsDir, { recursive: true });

  if (!fs.existsSync(LOGO_SRC)) {
    throw new Error(`No existe el logo de origen: ${LOGO_SRC}`);
  }

  const meta = await sharp(LOGO_SRC).metadata();
  const aspect = meta.height / meta.width;

  for (const { file, size } of SIZES) {
    const logoWidth = Math.round(size * LOGO_WIDTH_RATIO);
    const logoHeight = Math.round(logoWidth * aspect);

    const logo = await sharp(LOGO_SRC)
      .resize({ width: logoWidth, height: logoHeight, fit: "contain" })
      .png()
      .toBuffer();

    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: "#FFFFFF",
      },
    })
      .composite([
        {
          input: logo,
          left: Math.round((size - logoWidth) / 2),
          top: Math.round((size - logoHeight) / 2),
        },
      ])
      .png()
      .toFile(path.join(iconsDir, file));

    console.log(`Generated ${file} (${size}x${size})`);
  }

  console.log(
    "favicon.ico no se regenera aqui (sharp no escribe .ico); se mantiene el asset versionado"
  );
}

generateIcons().catch((err) => {
  console.error(err);
  process.exit(1);
});