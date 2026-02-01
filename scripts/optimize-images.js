
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const IMAGES_DIR = path.join(__dirname, '../public/images');

async function processDirectory(directory) {
    const files = fs.readdirSync(directory);

    for (const file of files) {
        const filePath = path.join(directory, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            await processDirectory(filePath); // Recursive call
            continue;
        }

        if (!/\.(jpg|jpeg|png|webp)$/i.test(file)) continue;

        try {
            const inputBuffer = fs.readFileSync(filePath);
            const image = sharp(inputBuffer);
            const metadata = await image.metadata();

            // Web Optimization: Resize to a max width of 1600px
            if (metadata.width > 1600) {
                image.resize(1600);
            }

            let optimizedBuffer;
            if (file.toLowerCase().endsWith('.png')) {
                optimizedBuffer = await image
                    .png({ quality: 70, compressionLevel: 9 })
                    .toBuffer();
            } else if (file.toLowerCase().endsWith('.webp')) {
                optimizedBuffer = await image
                    .webp({ quality: 70 })
                    .toBuffer();
            } else {
                optimizedBuffer = await image
                    .jpeg({ quality: 70, mozjpeg: true })
                    .toBuffer();
            }

            fs.writeFileSync(filePath, optimizedBuffer);
            const newStat = fs.statSync(filePath);
            console.log(`✅ Optimized: ${path.relative(IMAGES_DIR, filePath)} (${(newStat.size / 1024).toFixed(1)} KB)`);
        } catch (error) {
            console.error(`❌ Error processing ${file}:`, error.message);
        }
    }
}

console.log('🚀 Starting Deep Image Optimization...');
processDirectory(IMAGES_DIR).then(() => {
    console.log('-----------------------------------');
    console.log('🎉 Optimization Complete! All images in all folders are now small.');
}).catch(err => console.error('Fatal error:', err));
