const fetch = require('node-fetch');
const config = require('../config');

class WordPressService {
    constructor() {
        this.baseUrl = config.WORDPRESS_URL.replace(/\/$/, '');
    }

    async getAllImages() {
        try {
            const url = `${this.baseUrl}/wp-json/image-search/v1/images`;
            
            console.log('Trying to fetch WordPress images from:', url);

            const response = await fetch(url, {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                timeout: 5000 // 5 saniye timeout
            });
            
            if (!response.ok) {
                const text = await response.text();
                console.error('WordPress API response:', text);
                throw new Error(`WordPress API error: ${response.status} - ${text}`);
            }
            
            const images = await response.json();
            console.log(`Successfully found ${images.length} images`);
            return images;
            
        } catch (error) {
            console.error('WordPress API error details:', error);
            throw new Error(`WordPress API bağlantı hatası: ${error.message}`);
        }
    }

    async fetchImage(url) {
        try {
            console.log('Fetching image from:', url);

            const response = await fetch(url, {
                timeout: 5000 // 5 saniye timeout
            });
            
            if (!response.ok) {
                throw new Error(`Görsel yüklenemedi: ${response.status}`);
            }
            
            return await response.buffer();
        } catch (error) {
            console.error('Image fetch error:', error);
            throw new Error(`Görsel yükleme hatası ${url}: ${error.message}`);
        }
    }
}

module.exports = new WordPressService();