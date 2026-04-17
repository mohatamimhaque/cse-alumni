import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

// GET /api/photo?p=assests/photos/xxx.jpg
// Serves local photo files from the reunion_output/assests/photos directory.
// Also handles full Vercel Blob URLs by redirecting directly.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const photoPath = searchParams.get('p');

  if (!photoPath) {
    return new Response('Missing p param', { status: 400 });
  }

  // Full URL (Vercel Blob etc.) — just redirect
  if (photoPath.startsWith('http://') || photoPath.startsWith('https://')) {
    return Response.redirect(photoPath, 302);
  }

  // Sanitise: strip any leading slashes or ../ traversal
  const safe = photoPath.replace(/\.\./g, '').replace(/^\/+/, '');

  // The assests folder is one level above the v2/ project root
  const ROOT = path.resolve(process.cwd(), '..'); // reunion_output/
  const abs  = path.join(ROOT, safe);

  // Guard: must stay inside ROOT
  if (!abs.startsWith(ROOT)) {
    return new Response('Forbidden', { status: 403 });
  }

  if (!existsSync(abs)) {
    return new Response('Not found', { status: 404 });
  }

  try {
    const buf = await readFile(abs);
    const ext = path.extname(abs).toLowerCase();
    const mime =
      ext === '.png'  ? 'image/png'  :
      ext === '.gif'  ? 'image/gif'  :
      ext === '.webp' ? 'image/webp' :
      ext === '.svg'  ? 'image/svg+xml' :
      'image/jpeg';

    return new Response(buf, {
      headers: {
        'Content-Type': mime,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch {
    return new Response('Read error', { status: 500 });
  }
}
