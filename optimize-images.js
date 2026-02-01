import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputDir = path.join(__dirname, 'public', 'images', 'jpg');
const outputDir = path.join(__dirname, 'public', 'images', 'optimized');

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

fs.readdir(inputDir, (err, files) => {
    if (err) {
        console.error('Error reading input directory:', err);
        return;
    }

    files.forEach(file => {
        if (file.toLowerCase().endsWith('.jpg') || file.toLowerCase().endsWith('.jpeg')) {
            const inputPath = path.join(inputDir, file);
            const outputPath = path.join(outputDir, file.replace(/\.jpg/i, '.webp'));

            sharp(inputPath)
                .webp({ quality: 60 }) // تحويل لـ WebP وجودة 60% لضغط فائق
                .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true }) // تصغير الأبعاد لو كانت ضخمة
                .toFile(outputPath)
                .then(info => {
                    const oldSize = (fs.statSync(inputPath).size / 1024 / 1024).toFixed(2);
                    const newSize = (info.size / 1024).toFixed(2);
                    console.log(`Optimized: ${file} | ${oldSize}MB -> ${newSize}KB (WebP)`);
                })
                .catch(err => {
                    console.error(`Error optimizing ${file}:`, err);
                });
        }
    });
});
