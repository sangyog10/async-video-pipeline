const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

async function migrateUserData() {
  const usersPath = path.join(__dirname, '../data/users');
  const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));

  // Hash existing passwords and add email field
  for (let user of users) {
    if (user.password === 'sangyog') { // Only hash if it's the original password
      user.password = await bcrypt.hash('sangyog', 12);
    }
    
    // Add email field if it doesn't exist
    if (!user.email) {
      user.email = `${user.username}@example.com`; // Default email
    }

    // Add timestamps
    if (!user.createdAt) {
      user.createdAt = new Date().toISOString();
    }
  }

  // Write back to file
  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
  console.log('User data migrated successfully');
}

migrateUserData().catch(console.error);