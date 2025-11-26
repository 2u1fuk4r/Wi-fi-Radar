const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

class AuthService {
  constructor() {
    // In production, these should be stored securely (e.g., in a database)
    this.adminCredentials = {
      username: process.env.ADMIN_USERNAME || 'admin',
      // Default password hash for 'admin123'
      passwordHash: process.env.ADMIN_PASSWORD_HASH || '$2a$10$XWN5hX1Fl8zJ5.5Yd5L5B.J6z3Ue1wP5h.K9A5Ue5X5X5X5X5X5X5',
      // Optional plain password for local testing (not for production)
      passwordPlain: process.env.ADMIN_PASSWORD || null
    };

    // If no credentials set and we're in development, allow a default plain password for convenience
    if (!this.adminCredentials.passwordPlain && !process.env.ADMIN_PASSWORD_HASH && process.env.NODE_ENV !== 'production') {
      this.adminCredentials.passwordPlain = 'admin123';
      console.warn('AuthService: Using default development password "admin123" for user', this.adminCredentials.username);
    }
  }

  async login(username, password) {
    if (username !== this.adminCredentials.username) {
      throw new Error('Invalid credentials');
    }

    // If a plain password is provided via env for local testing, accept it
    if (this.adminCredentials.passwordPlain) {
      if (password !== this.adminCredentials.passwordPlain) {
        throw new Error('Invalid credentials');
      }
    } else {
      const isValid = await bcrypt.compare(password, this.adminCredentials.passwordHash);
      if (!isValid) {
        throw new Error('Invalid credentials');
      }
    }

    return jwt.sign({ username }, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '1h' });
  }

  verifyToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    } catch (error) {
      throw new Error('Invalid token');
    }
  }
}

module.exports = new AuthService();