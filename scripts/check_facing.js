import sharp from 'sharp';

async function checkFacing() {
  const imgPath = './public/assets/sprites/naruto.png';
  const { data } = await sharp(imgPath)
    .extract({ left: 0, top: 0, width: 48, height: 48 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  
  const pixels = new Uint8Array(data);
  
  // Find yellow pixels (hair) and peach pixels (skin)
  let yellowXSum = 0, yellowCount = 0;
  let skinXSum = 0, skinCount = 0;
  
  for (let y = 0; y < 48; y++) {
    for (let x = 0; x < 48; x++) {
      const idx = (y * 48 + x) * 4;
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];
      const a = pixels[idx + 3];
      
      if (a > 200) {
        // Yellow (hair): R > 200, G > 180, B < 80
        if (r > 200 && g > 180 && b < 80) {
          yellowXSum += x;
          yellowCount++;
        }
        // Skin (peach): R > 220, G > 170 && G < 210, B > 130 && B < 180
        if (r > 220 && g > 160 && g < 220 && b > 120 && b < 180) {
          skinXSum += x;
          skinCount++;
        }
      }
    }
  }
  
  const avgYellowX = yellowCount > 0 ? yellowXSum / yellowCount : 0;
  const avgSkinX = skinCount > 0 ? skinXSum / skinCount : 0;
  
  console.log(`Average Yellow X (hair): ${avgYellowX} (pixels: ${yellowCount})`);
  console.log(`Average Skin X (face): ${avgSkinX} (pixels: ${skinCount})`);
  
  if (avgYellowX > avgSkinX) {
    console.log('Naruto is facing LEFT (hair is to the right of face)');
  } else {
    console.log('Naruto is facing RIGHT (hair is to the left of face)');
  }
}

checkFacing();
