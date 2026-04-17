import { S3Client, HeadObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

// GET /api/image?url=<r2_url_or_key>
// Proxies images from Cloudflare R2
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get('url');

  if (!imageUrl) {
    return new Response('Missing url param', { status: 400 });
  }

  // If it's an R2 URL, extract the key; otherwise redirect
  let key = null;
  if (imageUrl.includes(process.env.R2_ENDPOINT)) {
    // Extract key from R2 URL: https://account.r2.cloudflarestorage.com/photos/image.jpg → photos/image.jpg
    key = imageUrl.split(process.env.R2_ENDPOINT + '/')[1];
  } else if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return Response.redirect(imageUrl, 302);
  } else {
    // Assume it's already a key
    key = imageUrl;
  }

  if (!key) {
    return new Response('Invalid image URL', { status: 400 });
  }

  try {
    const s3Client = new S3Client({
      region: 'auto',
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });

    // Get object metadata
    const headCmd = new HeadObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
    });
    const headRes = await s3Client.send(headCmd);

    // Fetch the object
    const getCmd = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
    });
    const getRes = await s3Client.send(getCmd);

    // Convert stream to buffer
    const chunks = [];
    for await (const chunk of getRes.Body) {
      chunks.push(chunk);
    }
    const imageBuffer = Buffer.concat(chunks);

    return new Response(imageBuffer, {
      headers: {
        'Content-Type': headRes.ContentType || 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Length': String(imageBuffer.length),
      },
    });
  } catch (error) {
    return new Response('Image not found', { status: 404 });
  }
}
