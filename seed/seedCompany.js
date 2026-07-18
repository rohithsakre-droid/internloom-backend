require('dotenv').config();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const Company = require('../models/Company');

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);

  const email = 'demo@techcorp.com';
  const existing = await Company.findOne({ companyEmail: email });
  if (existing) {
    console.log('Demo company already exists:', email);
    return mongoose.disconnect();
  }

  const passwordHash = await bcrypt.hash('DemoPass123!', 10);
  await Company.create({
    companyName: 'TechCorp Demo Pvt Ltd',
    companyEmail: email,
    passwordHash,
    isApproved: true, // pre-approved, per spec section 3.1
    description: 'Seeded demo company for InternLoom hackathon judging.',
    website: 'https://example.com',
  });

  console.log('Seeded pre-approved company. Login with:', email, '/ DemoPass123!');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
