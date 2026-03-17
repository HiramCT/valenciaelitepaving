'use strict';

require('dotenv').config();
const express = require('express');
const path = require('path');
const { Resend } = require('resend');
const rateLimit = require('express-rate-limit');
const multer = require('multer');

const app = express();
const resend = new Resend(process.env.RESEND_API_KEY);
const TO_EMAIL = process.env.TO_EMAIL || 'info@valenciaelitepaving.ca';
const PORT = process.env.PORT || 3000;

// ── Multer config — memory storage, max 100 MB total ─────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024,   // 100 MB per file
    files: 10,                      // max 10 files
  },
  fileFilter: (req, file, cb) => {
    // Accept only common image types
    const allowed = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'image/heic', 'image/heif', 'image/bmp', 'image/tiff',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed. Please upload images only.`));
    }
  },
});

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static frontend
app.use(express.static(path.join(__dirname)));

// Rate limiting: 5 submissions per IP per 15 minutes
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again in 15 minutes.' },
});

// ── Helpers ─────────────────────────────────────────────────────────────────
const ALLOWED_SERVICES = [
  'Asphalt Paving', 'Asphalt Repair', 'Sealcoating', 'Driveway Paving',
  'Parking Lot Paving', 'Line Striping', 'Crack Filling', 'Curb Work',
  'Municipal Road', 'Other',
];

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone) {
  return /^[\d\s\-\+\(\)\.]{7,20}$/.test(phone);
}

function sanitize(str, maxLen = 500) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>]/g, '').trim().slice(0, maxLen);
}

function serverValidate(body) {
  const errors = [];
  if (!body.name || body.name.trim().length < 2)
    errors.push('Full name is required (min 2 characters).');
  if (!body.email || !isValidEmail(body.email))
    errors.push('A valid email address is required.');
  if (!body.phone || !isValidPhone(body.phone))
    errors.push('A valid phone number is required.');
  if (!body.address || body.address.trim().length < 5)
    errors.push('Project address is required.');
  if (!body.service || !ALLOWED_SERVICES.includes(body.service))
    errors.push('Please select a valid service type.');
  return errors;
}

// ── Contact / Quote Endpoint (multipart with file uploads) ──────────────────
app.post('/api/contact', contactLimiter, (req, res) => {
  // Use multer middleware inline to catch upload errors gracefully
  upload.array('photos', 10)(req, res, async (uploadErr) => {
    if (uploadErr) {
      const msg = uploadErr.code === 'LIMIT_FILE_SIZE'
        ? 'One or more files exceed the 100 MB limit.'
        : uploadErr.code === 'LIMIT_FILE_COUNT'
          ? 'Maximum 10 files allowed.'
          : uploadErr.message || 'File upload error.';
      return res.status(400).json({ error: msg });
    }

    // Honeypot
    if (req.body.website && req.body.website.trim() !== '') {
      return res.status(200).json({ success: true });
    }

    const errors = serverValidate(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join(' ') });
    }

    // Sanitize fields
    const name = sanitize(req.body.name, 100);
    const email = sanitize(req.body.email, 100);
    const phone = sanitize(req.body.phone, 30);
    const address = sanitize(req.body.address, 200);
    const service = sanitize(req.body.service, 50);
    const dimensions = sanitize(req.body.dimensions, 100);
    const message = sanitize(req.body.message, 2000);

    // Build HTML email body
    const fileCount = req.files ? req.files.length : 0;
    const photoRow = fileCount > 0
      ? `<tr><td style="padding:8px;background:#f5f5f5;font-weight:bold;">Photos Attached</td><td style="padding:8px;">${fileCount} file(s) — see attachments</td></tr>`
      : '';

    const htmlBody = `
      <h2 style="color:#1A1C1E;font-family:Arial,sans-serif;border-bottom:4px solid #FFC000;padding-bottom:8px;">
        New Quote Request — Valencia's Elite Paving
      </h2>
      <table style="font-family:Arial,sans-serif;font-size:15px;border-collapse:collapse;width:100%;">
        <tr><td style="padding:8px;background:#f5f5f5;font-weight:bold;width:180px;">Full Name</td><td style="padding:8px;">${name}</td></tr>
        <tr><td style="padding:8px;font-weight:bold;">Email</td><td style="padding:8px;"><a href="mailto:${email}">${email}</a></td></tr>
        <tr><td style="padding:8px;background:#f5f5f5;font-weight:bold;">Phone</td><td style="padding:8px;">${phone}</td></tr>
        <tr><td style="padding:8px;font-weight:bold;">Project Address</td><td style="padding:8px;">${address}</td></tr>
        <tr><td style="padding:8px;background:#f5f5f5;font-weight:bold;">Service Type</td><td style="padding:8px;">${service}</td></tr>
        <tr><td style="padding:8px;font-weight:bold;">Estimated Dimensions</td><td style="padding:8px;">${dimensions || '—'}</td></tr>
        <tr><td style="padding:8px;background:#f5f5f5;font-weight:bold;vertical-align:top;">Additional Notes</td><td style="padding:8px;">${message || '—'}</td></tr>
        ${photoRow}
      </table>
      <hr style="border:none;border-top:1px solid #ddd;margin-top:20px;">
      <p style="font-size:12px;color:#888;font-family:Arial,sans-serif;">
        Submitted via valenciaelitepaving.ca contact form — ${new Date().toLocaleString('en-CA', { timeZone: 'America/Toronto' })}
      </p>
    `;

    // Build Resend attachments array from uploaded files
    const attachments = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        attachments.push({
          filename: file.originalname,
          content: file.buffer,
        });
      }
    }

    try {
      const emailPayload = {
        from: 'Valencia Elite Paving Form <onboarding@resend.dev>',
        to: TO_EMAIL,
        replyTo: email,
        subject: `New Quote Request: ${service} — ${name}`,
        html: htmlBody,
      };

      // Only add attachments key if there are files
      if (attachments.length > 0) {
        emailPayload.attachments = attachments;
      }

      const { error } = await resend.emails.send(emailPayload);

      if (error) {
        console.error('Resend error:', error);
        return res.status(500).json({ error: 'Failed to send message. Please call us directly.' });
      }

      console.log(`✔ Quote sent: ${service} from ${name} (${fileCount} photos attached)`);
      return res.json({ success: true });
    } catch (err) {
      console.error('Server error:', err);
      return res.status(500).json({ error: 'Server error. Please try again later.' });
    }
  });
});

// ── Fallback: serve index.html for any other route ──────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  ✔  Valencia's Elite Paving website running at http://localhost:${PORT}`);
  console.log(`  ✔  Resend API: ${process.env.RESEND_API_KEY ? 'Configured' : '⚠  NOT SET'}`);
  console.log(`  ✔  Quote emails → ${TO_EMAIL}\n`);
});
