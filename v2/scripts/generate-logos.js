#!/usr/bin/env node
// Generate placeholder logo images as JPG with Canvas
const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

const logoDir = path.join(__dirname, '../public/assests/logo');

// Ensure directory exists
if (!fs.existsSync(logoDir)) {
  fs.mkdirSync(logoDir, { recursive: true });
}

// Create DUET logo
function createDuetLogo() {
  const canvas = createCanvas(100, 100);
  const ctx = canvas.getContext('2d');

  // Blue gradient background
  const gradient = ctx.createLinearGradient(0, 0, 100, 100);
  gradient.addColorStop(0, '#1e40af');
  gradient.addColorStop(1, '#0c4a6e');
  
  // Draw circle
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(50, 50, 48, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Draw D letter
  ctx.fillStyle = 'white';
  ctx.font = 'bold 48px Arial';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('D', 35, 50);

  // Save as JPG
  const buffer = canvas.toBuffer('image/jpeg', { quality: 0.95 });
  fs.writeFileSync(path.join(logoDir, 'duet.jpg'), buffer);
  console.log('✅ Created: public/assests/logo/duet.jpg');
}

// Create CSE logo
function createCseLogo() {
  const canvas = createCanvas(100, 100);
  const ctx = canvas.getContext('2d');

  // Green gradient background
  const gradient = ctx.createLinearGradient(0, 0, 100, 100);
  gradient.addColorStop(0, '#059669');
  gradient.addColorStop(1, '#047857');
  
  // Draw circle
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(50, 50, 48, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Draw code brackets
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  
  // Left bracket
  ctx.beginPath();
  ctx.moveTo(35, 35);
  ctx.lineTo(28, 35);
  ctx.lineTo(28, 65);
  ctx.lineTo(35, 65);
  ctx.stroke();

  // Right bracket
  ctx.beginPath();
  ctx.moveTo(65, 35);
  ctx.lineTo(72, 35);
  ctx.lineTo(72, 65);
  ctx.lineTo(65, 65);
  ctx.stroke();

  // Center dot
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.arc(50, 50, 3, 0, Math.PI * 2);
  ctx.fill();

  // Save as JPG
  const buffer = canvas.toBuffer('image/jpeg', { quality: 0.95 });
  fs.writeFileSync(path.join(logoDir, 'cse.jpg'), buffer);
  console.log('✅ Created: public/assests/logo/cse.jpg');
}

try {
  createDuetLogo();
  createCseLogo();
  console.log('\n✅ Logo files generated successfully!');
} catch (err) {
  if (err.code === 'MODULE_NOT_FOUND' && err.message.includes('canvas')) {
    console.error('⚠️  canvas library not installed');
    console.log('Install it with: npm install canvas');
  } else {
    console.error('Error:', err.message);
  }
  process.exit(1);
}

