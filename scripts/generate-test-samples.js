#!/usr/bin/env node
// Generate sample bulk upload files for testing
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';
import archiver from 'archiver';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.join(__dirname, '../test-samples');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Sample members data with IDs starting with 222
const sampleMembers = [
  {
    'Name': 'Ahmed Hassan',
    'Email': 'ahmed.hassan@example.com',
    'Mobile': '01711111111',
    'Student ID': '22201001',
    'Blood': 'O+',
    'Designation': 'Software Engineer',
    'Organization': 'Google Bangladesh',
    'Location': 'Dhaka',
    'Photo': 'ahmed.jpg'
  },
  {
    'Name': 'Fatima Khan',
    'Email': 'fatima.khan@example.com',
    'Mobile': '01712222222',
    'Student ID': '22201002',
    'Blood': 'B+',
    'Designation': 'Data Scientist',
    'Organization': 'Microsoft',
    'Location': 'Dhaka',
    'Photo': 'fatima.jpg'
  },
  {
    'Name': 'Mohammad Islam',
    'Email': 'mohammad.islam@example.com',
    'Mobile': '01713333333',
    'Student ID': '22201003',
    'Blood': 'A+',
    'Designation': 'DevOps Engineer',
    'Organization': 'Amazon',
    'Location': 'Dhaka',
    'Photo': 'mohammad.jpg'
  },
  {
    'Name': 'Aisha Begum',
    'Email': 'aisha.begum@example.com',
    'Mobile': '01714444444',
    'Student ID': '22201004',
    'Blood': 'AB+',
    'Designation': 'Product Manager',
    'Organization': 'Uber Bangladesh',
    'Location': 'Dhaka',
    'Photo': 'aisha.jpg'
  },
  {
    'Name': 'Karim Ahmed',
    'Email': 'karim.ahmed@example.com',
    'Mobile': '01715555555',
    'Student ID': '22201005',
    'Blood': 'O-',
    'Designation': 'Full Stack Developer',
    'Organization': 'TechStart',
    'Location': 'Dhaka',
    'Photo': 'karim.jpg'
  }
];

// Create Excel file
function createExcelFile() {
  const worksheet = XLSX.utils.json_to_sheet(sampleMembers);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Members');
  
  const excelPath = path.join(outputDir, 'sample-members.xlsx');
  XLSX.writeFile(workbook, excelPath);
  console.log('✅ Created:', excelPath);
  return excelPath;
}

// Create sample photos (1x1 pixel images for testing)
function createSamplePhotos() {
  const photosDir = path.join(outputDir, 'photos');
  if (!fs.existsSync(photosDir)) {
    fs.mkdirSync(photosDir, { recursive: true });
  }

  // Create simple 1x1 transparent PNG for each member
  const png1x1 = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
    0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
    0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82
  ]);

  sampleMembers.forEach(member => {
    const photoPath = path.join(photosDir, member.Photo);
    fs.writeFileSync(photoPath, png1x1);
  });

  console.log(`✅ Created ${sampleMembers.length} sample photos in: ${photosDir}`);
  return photosDir;
}

// Create ZIP file with photos
async function createZipFile(photosDir) {
  return new Promise((resolve, reject) => {
    const zipPath = path.join(outputDir, 'sample-photos.zip');
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      console.log('✅ Created:', zipPath, `(${archive.pointer()} bytes)`);
      resolve(zipPath);
    });

    archive.on('error', reject);
    archive.pipe(output);
    
    // Add all photos from the directory
    archive.directory(photosDir, false);
    archive.finalize();
  });
}

// Main execution
async function main() {
  try {
    console.log('📝 Creating sample bulk upload test files...\n');
    
    createExcelFile();
    const photosDir = createSamplePhotos();
    await createZipFile(photosDir);

    console.log('\n✅ Test files ready! Location:', outputDir);
    console.log('\n📋 How to use for bulk upload:');
    console.log('1. Go to Admin → Bulk Upload tab');
    console.log('2. Upload Excel: sample-members.xlsx');
    console.log('3. Upload ZIP: sample-photos.zip');
    console.log('4. Click "Upload Members"');
    console.log('\n🎯 All members will have IDs starting with 222');
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

main();
