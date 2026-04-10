// src/modules/contact/contact.controller.js

import { query, paginate } from './database.js';
import * as res from './response.js';
import { asyncHandler, parsePagination, sanitize } from './helpers.js';
import logger from './logger.js';

// ---------------------------------------------------------------------------
//  Optional: send email notification to admin (uses nodemailer if configured)
// ---------------------------------------------------------------------------
async function notifyAdmin(contact) {
  if (!process.env.SMTP_HOST || !process.env.NOTIFY_EMAIL) return;
  try {
    const { createTransport } = await import('nodemailer');
    const transporter = createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transporter.sendMail({
      from:    process.env.SMTP_FROM || process.env.SMTP_USER,
      to:      process.env.NOTIFY_EMAIL,
      subject: `New Contact Form: ${contact.name} — ${contact.subject || 'General Enquiry'}`,
      html: `
        <h2>New message from ${contact.name}</h2>
        <p><strong>Email:</strong> ${contact.email}</p>
        <p><strong>Phone:</strong> ${contact.phone || '—'}</p>
        <p><strong>Subject:</strong> ${contact.subject || '—'}</p>
        <p><strong>Message:</strong></p>
        <blockquote>${contact.message}</blockquote>
        <p><em>Received at ${new Date().toLocaleString()}</em></p>
      `,
    });
    logger.info('Contact notification email sent', { to: process.env.NOTIFY_EMAIL });
  } catch (err) {
    logger.error('Failed to send contact notification', { error: err.message });
  }
}

// POST /api/contact
export const submit = asyncHandler(async (req, resp) => {
  const { name, email, phone, subject, message, audience, service_ref, project_ref } = req.body;

  const cleanMessage = sanitize(message);

  const result = await query(
    `INSERT INTO contacts
       (name, email, phone, subject, message, audience, service_ref, project_ref, ip_address, user_agent)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [
      name.trim(), email.toLowerCase().trim(), phone || null,
      subject || null, cleanMessage, audience || null,
      service_ref || null, project_ref || null,
      req.ip, req.get('user-agent'),
    ]
  );

  const contact = result.rows[0];
  logger.info('Contact form submitted', { contactId: contact.id, email: contact.email });

  // Fire email notification in background
  notifyAdmin(contact).catch(() => {});

  return res.created(resp, {
    id:      contact.id,
    message: 'Thank you! Your message has been received. We will contact you within 24 hours.',
  }, 'Message sent successfully');
});

// GET /api/contact  (admin)
export const list = asyncHandler(async (req, resp) => {
  const { page, limit } = parsePagination(req.query);
  const { status, search } = req.query;

  const conditions = [];
  const params = [];

  if (status) { params.push(status); conditions.push(`status = $${params.length}`); }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(name ILIKE $${params.length} OR email ILIKE $${params.length} OR message ILIKE $${params.length})`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await paginate(
    `SELECT id, name, email, phone, subject, message, audience, status, created_at FROM contacts ${where} ORDER BY created_at DESC`,
    `SELECT COUNT(*) FROM contacts ${where}`,
    params, page, limit
  );

  return res.paginated(resp, result);
});

// GET /api/contact/:id  (admin)
export const getById = asyncHandler(async (req, resp) => {
  const result = await query('SELECT * FROM contacts WHERE id=$1', [req.params.id]);
  if (!result.rows.length) return res.notFound(resp, 'Contact');

  // Mark as read
  if (result.rows[0].status === 'new') {
    await query("UPDATE contacts SET status='read' WHERE id=$1", [req.params.id]);
  }

  return res.success(resp, result.rows[0]);
});

// PATCH /api/contact/:id/status  (admin)
export const updateStatus = asyncHandler(async (req, resp) => {
  const { status, notes } = req.body;
  const validStatuses = ['new', 'read', 'replied', 'archived'];
  if (!validStatuses.includes(status)) return res.badRequest(resp, 'Invalid status');

  const result = await query(
    `UPDATE contacts SET status=$1, notes=$2,
     replied_at = CASE WHEN $1='replied' THEN NOW() ELSE replied_at END,
     replied_by = CASE WHEN $1='replied' THEN $3 ELSE replied_by END
     WHERE id=$4 RETURNING *`,
    [status, notes || null, req.user.id, req.params.id]
  );

  if (!result.rows.length) return res.notFound(resp, 'Contact');
  return res.success(resp, result.rows[0], 'Contact updated');
});

// GET /api/contact/stats  (admin dashboard widget)
export const stats = asyncHandler(async (req, resp) => {
  const result = await query(`
    SELECT
      COUNT(*) FILTER (WHERE status='new')     AS new_count,
      COUNT(*) FILTER (WHERE status='read')    AS read_count,
      COUNT(*) FILTER (WHERE status='replied') AS replied_count,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS last_7_days,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') AS last_30_days
    FROM contacts
  `);
  return res.success(resp, result.rows[0]);
});
