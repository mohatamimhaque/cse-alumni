import sql, { toMember } from '@/lib/db';
import { isAdmin, adminUnauthorized } from '@/lib/auth';

// GET /api/members - List all members (public sees only visible, admin sees all)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';

    let adminMode = false;
    try { adminMode = await isAdmin(); } catch {}

    let rows;

    if (search) {
      const pattern = `%${search}%`;
      if (adminMode) {
        rows = await sql`
          SELECT * FROM members
          WHERE name ILIKE ${pattern} OR student_id ILIKE ${pattern}
            OR email ILIKE ${pattern} OR mobile ILIKE ${pattern}
            OR designation ILIKE ${pattern} OR organization ILIKE ${pattern}
            OR location ILIKE ${pattern}
          ORDER BY student_id ASC
        `;
      } else {
        rows = await sql`
          SELECT * FROM members
          WHERE visible = true
            AND (name ILIKE ${pattern} OR student_id ILIKE ${pattern}
              OR email ILIKE ${pattern} OR mobile ILIKE ${pattern}
              OR designation ILIKE ${pattern} OR organization ILIKE ${pattern}
              OR location ILIKE ${pattern})
          ORDER BY student_id ASC
        `;
      }
    } else {
      if (adminMode) {
        rows = await sql`SELECT * FROM members ORDER BY student_id ASC`;
      } else {
        rows = await sql`SELECT * FROM members WHERE visible = true ORDER BY student_id ASC`;
      }
    }

    const response = Response.json(rows.map(toMember));
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    return response;
  } catch (error) {
    return Response.json({ error: 'Failed to fetch members' }, { status: 500 });
  }
}

// POST /api/members - Add new member (admin only)
export async function POST(request) {
  if (!(await isAdmin())) return adminUnauthorized();

  try {
    const body = await request.json();

    // Validate required fields
    if (!body.Name || !String(body.Name).trim()) {
      return Response.json({ error: 'Name is required' }, { status: 400 });
    }

    if (!body.ID || !String(body.ID).trim()) {
      return Response.json({ error: 'Student ID is required' }, { status: 400 });
    }

    // Sanitize and limit string lengths
    const sanitize = (val, maxLen = 255) => String(val || '').trim().substring(0, maxLen);
    const email = sanitize(body.Email, 255);
    const mobile = sanitize(body.Mobile, 20);

    // Validate email format if provided
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: 'Invalid email format' }, { status: 400 });
    }

    const rows = await sql`
      INSERT INTO members (name, email, mobile, student_id, blood, designation, organization, location, photo, visible)
      VALUES (${sanitize(body.Name)}, ${email}, ${mobile}, ${sanitize(body.ID, 50)},
              ${sanitize(body.Blood, 10)}, ${sanitize(body.Designation)}, ${sanitize(body.Organization)},
              ${sanitize(body.Location)}, ${sanitize(body.photo)}, ${body.visible !== false})
      RETURNING *
    `;

    return Response.json(toMember(rows[0]), { status: 201 });
  } catch (error) {
    return Response.json({ error: 'Failed to create member' }, { status: 500 });
  }
}
