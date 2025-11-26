const bcrypt = require('bcryptjs');
const password = process.argv[2] || 'admin123';
const saltRounds = 10;
const hash = bcrypt.hashSync(password, saltRounds);
console.log(hash);
