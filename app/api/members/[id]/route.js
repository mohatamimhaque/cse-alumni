import sql, { toMember } from '@/lib/db';
import { isAdmin, adminUnauthorized } from '@/lib/auth';

// PUT /api/members/[id] - Update member (admin only)
export async function PUT(request, { params }) {
  if (!(await isAdmin())) return adminUnauthorized();

  try {
    const { id } = await params;
    const numId = Number(id);
    
    if (!Number.isFinite(numId) || numId <= 0) {
      return Response.json({ error: 'Invalid member ID' }, { status: 400 });
    }

    const body = await request.json();

    // ── Fast path: visibility-only toggle ────────────────────────────────────
    if (Object.keys(body).length === 1 && body.visible !== undefined) {
      const isVisible = body.visible === true || body.visible === 'true';
      const rows = await sql`
        UPDATE members
        SET    visible    = ${isVisible},
               updated_at = NOW()
        WHERE  id = ${numId}
        RETURNING *
      `;
      if (rows.length === 0)
        return Response.json({ error: 'Member not found' }, { status: 404 });
      return Response.json(toMember(rows[0]));
    }

    // ── Validate at least one field to update ────────────────────────────────
    const sanitize = (val, maxLen = 255) => val !== undefined ? String(val || '').trim().substring(0, maxLen) : null;
    const name = sanitize(body.Name);
    const email = sanitize(body.Email, 255);
    const mobile = sanitize(body.Mobile, 20);
    const student_id = sanitize(body.ID, 50);
    const blood = sanitize(body.Blood, 10);
    const designation = sanitize(body.Designation);
    const organization = sanitize(body.Organization);
    const location = sanitize(body.Location);
    const photo = sanitize(body.photo);

    // Validate email format if provided and not empty
    if (email && email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: 'Invalid email format' }, { status: 400 });
    }

    const hasAny = [name, email, mobile, student_id, blood, designation, organization, location, photo].some((v) => v !== null);

    if (!hasAny)
      return Response.json({ error: 'No fields to update' }, { status: 400 });

    const rows = await sql`
      UPDATE members SET
        name         = COALESCE(${name},         name),
        email        = COALESCE(${email},        email),
        mobile       = COALESCE(${mobile},       mobile),
        student_id   = COALESCE(${student_id},   student_id),
        blood        = COALESCE(${blood},        blood),
        designation  = COALESCE(${designation},  designation),
        organization = COALESCE(${organization}, organization),
        location     = COALESCE(${location},     location),
        photo        = COALESCE(${photo},        photo),
        updated_at   = NOW()
      WHERE id = ${numId}
      RETURNING *
    `;

    if (rows.length === 0)
      return Response.json({ error: 'Member not found' }, { status: 404 });

    return Response.json(toMember(rows[0]));
  } catch (error) {
    return Response.json({ error: 'Failed to update member' }, { status: 500 });
  }
}

// DELETE /api/members/[id] - Delete member (admin only)
export async function DELETE(request, { params }) {
  if (!(await isAdmin())) return adminUnauthorized();

  try {
    const { id } = await params;
    const rows = await sql`DELETE FROM members WHERE id = ${Number(id)} RETURNING id`;

    if (rows.length === 0)
      return Response.json({ error: 'Member not found' }, { status: 404 });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: 'Failed to delete member' }, { status: 500 });
  }
}
