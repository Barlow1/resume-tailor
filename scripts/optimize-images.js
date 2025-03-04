import sharp from 'sharp'
import fs from 'fs/promises'
import path from 'path'

const MARKETING_IMAGES_DIR = './app/routes/_marketing+/logos'

async function optimizeImage(filePath) {
  const fileName = path.basename(filePath, path.extname(filePath))
  const outputDir = path.dirname(filePath)
  
  const image = sharp(filePath)
  const metadata = await image.metadata()
  
  // Skip SVG files
  if (metadata.format === 'svg') {
    console.log(`Skipping SVG file: ${fileName}`)
    return
  }

  // Generate WebP version
  await image
    .clone()
    .webp({ quality: 80 })
    .toFile(path.join(outputDir, `${fileName}.webp`))

  // Optimize original
  if (metadata.format === 'png') {
    await image
      .clone()
      .png({ quality: 80, compressionLevel: 9 })
      .toFile(path.join(outputDir, `${fileName}.optimized.png`))
    
    // Replace original with optimized version
    await fs.rename(
      path.join(outputDir, `${fileName}.optimized.png`),
      path.join(outputDir, `${fileName}.png`)
    )
  } else if (metadata.format === 'jpeg' || metadata.format === 'jpg') {
    await image
      .clone()
      .jpeg({ quality: 80 })
      .toFile(path.join(outputDir, `${fileName}.optimized.jpg`))
    
    // Replace original with optimized version
    await fs.rename(
      path.join(outputDir, `${fileName}.optimized.jpg`),
      path.join(outputDir, `${fileName}.jpg`)
    )
  }

  console.log(`Optimized: ${fileName}`)
}

async function optimizeDirectory(directory) {
  const files = await fs.readdir(directory)
  
  for (const file of files) {
    const filePath = path.join(directory, file)
    const stat = await fs.stat(filePath)
    
    if (stat.isDirectory()) {
      await optimizeDirectory(filePath)
    } else if (/\.(png|jpe?g)$/i.test(file)) {
      await optimizeImage(filePath)
    }
  }
}

// Run the optimization
optimizeDirectory(MARKETING_IMAGES_DIR)
  .then(() => console.log('Image optimization complete!'))
  .catch(console.error) 