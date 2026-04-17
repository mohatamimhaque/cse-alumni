import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { isAdmin, adminUnauthorized } from '@/lib/auth';

export async function POST(request) {
  if (!(await isAdmin())) return adminUnauthorized();

  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return Response.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file is actually a File object
    if (!(file instanceof File)) {
      return Response.json({ error: 'Invalid file' }, { status: 400 });
    }

    // Validate file size (max 10MB)
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_SIZE) {
      return Response.json({ error: 'File too large (max 10MB)' }, { status: 413 });
    }

    // Validate file type
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!ALLOWED_TYPES.includes(file.type)) {
      return Response.json({ error: 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP' }, { status: 400 });
    }

    // Validate R2 credentials
    if (!process.env.R2_ENDPOINT || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY || !process.env.R2_BUCKET_NAME) {
      return Response.json({ error: 'Upload service not configured' }, { status: 500 });
    }

    const s3Client = new S3Client({
      region: 'auto',
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });

    const bytes = await file.arrayBuffer();
    if (!bytes || bytes.byteLength === 0) {
      return Response.json({ error: 'File is empty' }, { status: 400 });
    }

    // Sanitize filename
    const sanitizedName = file.name.replace(/[^\w.-]/g, '_').substring(0, 255);
    const key = `photos/${Date.now()}_${sanitizedName}`;

    await s3Client.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: Buffer.from(bytes),
      ContentType: file.type || 'image/jpeg',
    }));

    const url = `${process.env.R2_ENDPOINT}/${key}`;
    return Response.json({ url });
  } catch (error) {
    return Response.json({ error: 'Upload failed' }, { status: 500 });
  }
}
