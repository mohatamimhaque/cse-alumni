#!/usr/bin/env node
/**
 * Diagnostic script to check R2 configuration
 * Run: node scripts/check-r2-config.js
 */

console.log('🔍 Checking R2 Configuration...\n');

const vars = {
  'R2_ENDPOINT': process.env.R2_ENDPOINT,
  'R2_ACCESS_KEY_ID': process.env.R2_ACCESS_KEY_ID,
  'R2_SECRET_ACCESS_KEY': process.env.R2_SECRET_ACCESS_KEY,
  'R2_BUCKET_NAME': process.env.R2_BUCKET_NAME,
};

let allSet = true;

for (const [key, value] of Object.entries(vars)) {
  if (value) {
    const display = key.includes('SECRET') || key.includes('KEY') 
      ? value.substring(0, 5) + '...' + value.substring(value.length - 5)
      : value;
    console.log(`✅ ${key}: ${display}`);
  } else {
    console.log(`❌ ${key}: NOT SET`);
    allSet = false;
  }
}

console.log('\n📋 What you need to do:\n');

if (!process.env.R2_ENDPOINT) {
  console.log('1. Set R2_ENDPOINT in .env.local');
  console.log('   Example: R2_ENDPOINT=https://xxxx.r2.cloudflarestorage.com\n');
  allSet = false;
}

if (!process.env.R2_ACCESS_KEY_ID) {
  console.log('2. Set R2_ACCESS_KEY_ID in .env.local');
  console.log('   Get this from Cloudflare R2 → API Tokens\n');
  allSet = false;
}

if (!process.env.R2_SECRET_ACCESS_KEY) {
  console.log('3. Set R2_SECRET_ACCESS_KEY in .env.local');
  console.log('   Get this from Cloudflare R2 → API Tokens\n');
  allSet = false;
}

if (!process.env.R2_BUCKET_NAME) {
  console.log('4. (Optional) Set R2_BUCKET_NAME in .env.local');
  console.log('   Defaults to: reunion-photos\n');
}

if (allSet) {
  console.log('✨ All R2 environment variables are set!');
  console.log('\n💡 If R2 still shows 0, check:');
  console.log('   • Credentials are correct');
  console.log('   • Bucket exists and contains photos');
  console.log('   • API token has list permissions');
  console.log('\nRestart your server: npm run dev');
} else {
  console.log('❌ Some R2 variables are missing.');
  console.log('   Add them to .env.local, then restart: npm run dev');
}

console.log('\n');
