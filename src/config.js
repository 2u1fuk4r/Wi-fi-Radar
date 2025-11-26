const dotenv = require('dotenv');
dotenv.config();

module.exports = {
    PORT: process.env.PORT || 3000,
    WORDPRESS_URL: process.env.WORDPRESS_URL || 'http://localhost/wordpress',
    API_DEBUG: process.env.API_DEBUG === 'true' || false,
    IMAGE_RESIZE_DIMENSIONS: 64,
    MAX_RESULTS: 10,
    SIMILARITY_THRESHOLD: 0.6
};