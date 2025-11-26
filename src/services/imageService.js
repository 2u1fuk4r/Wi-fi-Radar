const sharp = require('sharp');
const config = require('../config');

class ImageService {
    async extractFeatures(buffer) {
        try {
            const image = sharp(buffer);
            
            // Görsel özelliklerini normalize et
            const resized = await image
                .resize(config.IMAGE_RESIZE_DIMENSIONS, config.IMAGE_RESIZE_DIMENSIONS, { fit: 'fill' })
                .grayscale()
                .raw()
                .toBuffer();
            
            return Array.from(resized);
        } catch (error) {
            console.error('Feature extraction error:', error);
            throw new Error('Image processing failed');
        }
    }

    calculateSimilarity(features1, features2) {
        try {
            // Vektörlerin aynı boyutta olduğundan emin olalım
            if (features1.length !== features2.length) {
                throw new Error('Feature vectors must have same length');
            }

            // Öklid mesafesi hesaplama
            let sumSquaredDiff = 0;
            for (let i = 0; i < features1.length; i++) {
                const diff = features1[i] - features2[i];
                sumSquaredDiff += diff * diff;
            }
            
            // Normalize edilmiş benzerlik skoru (0-1 arası)
            const distance = Math.sqrt(sumSquaredDiff);
            const maxDistance = Math.sqrt(255 * 255 * features1.length); // Max olası mesafe
            const similarity = 1 - (distance / maxDistance);
            
            return similarity;
        } catch (error) {
            console.error('Similarity calculation error:', error);
            throw new Error('Similarity calculation failed');
        }
    }
}

module.exports = new ImageService();