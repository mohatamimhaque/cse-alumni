import sql from '@/lib/db';
import { isAdmin, adminUnauthorized } from '@/lib/auth';

// GET /api/analytics - Get analytics data (admin only)
export async function GET(request) {
  if (!(await isAdmin())) return adminUnauthorized();

  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(10, parseInt(searchParams.get('limit') || '20')));
    const offset = (page - 1) * limit;

    // Total page views (last 30 days)
    const pageViewsResult = await sql`
      SELECT COUNT(*) as count FROM analytics
      WHERE type = 'page_view' AND timestamp > NOW() - INTERVAL '30 days'
    `;

    // Total card views (last 30 days)
    const cardViewsResult = await sql`
      SELECT COUNT(*) as count FROM analytics
      WHERE type = 'card_view' AND timestamp > NOW() - INTERVAL '30 days'
    `;

    // Unique visitors (by ip_hash, last 30 days)
    const uniqueResult = await sql`
      SELECT COUNT(DISTINCT ip_hash) as count FROM analytics
      WHERE timestamp > NOW() - INTERVAL '30 days' AND ip_hash IS NOT NULL
    `;

    // Top viewed members
    const topMembers = await sql`
      SELECT member_id as "_id", member_name as name, COUNT(*) as views
      FROM analytics
      WHERE type = 'card_view' AND timestamp > NOW() - INTERVAL '30 days'
      GROUP BY member_id, member_name
      ORDER BY views DESC
      LIMIT 20
    `;

    // Total count of recent visitors
    const countResult = await sql`
      SELECT COUNT(*) as count FROM analytics
    `;
    const totalVisitors = Number(countResult[0]?.count || 0);

    // Recent visitors with pagination
    const recentVisitors = await sql`
      SELECT id as "_id", type, member_name as "memberName", COALESCE(ip, '') as ip, country, city, timestamp
      FROM analytics
      ORDER BY timestamp DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    // Views over time (last 30 days, daily)
    const viewsOverTime = await sql`
      SELECT DATE_TRUNC('day', timestamp)::DATE as date, 
             COUNT(*) as total,
             SUM(CASE WHEN type = 'page_view' THEN 1 ELSE 0 END) as pageViews,
             SUM(CASE WHEN type = 'card_view' THEN 1 ELSE 0 END) as cardViews
      FROM analytics
      WHERE timestamp > NOW() - INTERVAL '30 days'
      GROUP BY DATE_TRUNC('day', timestamp)
      ORDER BY date DESC
    `;

    // Country distribution
    const countryDist = await sql`
      SELECT COALESCE(NULLIF(country, ''), 'Unknown') as country, COUNT(*) as count
      FROM analytics
      WHERE timestamp > NOW() - INTERVAL '30 days'
      GROUP BY COALESCE(NULLIF(country, ''), 'Unknown')
      ORDER BY count DESC
      LIMIT 15
    `;

    return Response.json({
      totalPageViews: Number(pageViewsResult[0]?.count || 0),
      totalCardViews: Number(cardViewsResult[0]?.count || 0),
      uniqueVisitors: Number(uniqueResult[0]?.count || 0),
      topMembers: topMembers.map((m) => ({ ...m, views: Number(m.views) })),
      recentVisitors,
      viewsOverTime: viewsOverTime.map((row) => ({
        date: row.date,
        total: Number(row.total),
        pageViews: Number(row.pageViews),
        cardViews: Number(row.cardViews),
      })),
      countryDist: countryDist.map((row) => ({
        country: row.country || 'Unknown',
        count: Number(row.count),
      })),
      pagination: {
        page,
        limit,
        total: totalVisitors,
        pages: Math.ceil(totalVisitors / limit),
      },
    });
  } catch (error) {
    return Response.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}
