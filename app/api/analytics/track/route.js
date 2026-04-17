import sql from '@/lib/db';
import { createHash } from 'crypto';

// POST /api/analytics/track - Track page view or card view
export async function POST(request) {
  try {
    const body = await request.json();
    const { type, memberId, memberName } = body;

    if (!type || !['page_view', 'card_view'].includes(type)) {
      return Response.json({ error: 'Invalid type' }, { status: 400 });
    }

    // Get actual IP address
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : request.headers.get('x-real-ip') || '';
    
    // Hash IP for privacy
    const ipHash = ip ? createHash('sha256').update(ip + '_duet_reunion').digest('hex').slice(0, 16) : '';

    const userAgent = request.headers.get('user-agent') || '';

    // Get geo info from multiple sources (Vercel, Cloudflare, etc.)
    let country = '';
    let city = '';
    
    // Try Vercel headers first
    country = request.headers.get('x-vercel-ip-country') || '';
    city = request.headers.get('x-vercel-ip-city') || '';
    
    // Try Cloudflare headers if Vercel not available
    if (!country) country = request.headers.get('cf-ipcountry') || '';
    
    // Insert analytics record
    await sql`
      INSERT INTO analytics (type, member_id, member_name, ip, ip_hash, user_agent, country, city, timestamp)
      VALUES (${type}, ${memberId || null}, ${memberName || null}, ${ip || null}, ${ipHash || null}, ${userAgent.slice(0, 255)}, ${country}, ${city}, NOW())
    `;

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: 'Failed to track' }, { status: 500 });
  }
}
