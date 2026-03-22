const { Resend } = require('resend');

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

// ── Serverless Handler ──────────────────────────────────────────────────────
module.exports = async (req, res) => {
    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const apiKey = process.env.RESEND_API_KEY;
        const toEmail = process.env.TO_EMAIL || 'info@valenciaelitepaving.ca';

        if (!apiKey) {
            console.error('CRITICAL: RESEND_API_KEY is missing from environment variables');
            return res.status(500).json({ error: 'Configuración del servidor incompleta. Por favor, asegúrate de que agregaste RESEND_API_KEY en el dashboard de Vercel y volviste a desplegar (Redeploy).' });
        }

        const resend = new Resend(apiKey);
        const body = req.body || {};

        // Honeypot
        if (body.website && body.website.trim() !== '') {
            return res.status(200).json({ success: true });
        }

        const errors = serverValidate(body);
        if (errors.length > 0) {
            return res.status(400).json({ error: errors.join(' ') });
        }

        // Sanitize fields
        const name = sanitize(body.name, 100);
        const email = sanitize(body.email, 100);
        const phone = sanitize(body.phone, 30);
        const address = sanitize(body.address, 200);
        const service = sanitize(body.service, 50);
        const dimensions = sanitize(body.dimensions, 100);
        const message = sanitize(body.message, 2000);

        // Build HTML email body
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
      </table>
      <hr style="border:none;border-top:1px solid #ddd;margin-top:20px;">
      <p style="font-size:12px;color:#888;font-family:Arial,sans-serif;">
        Submitted via valenciaelitepaving.ca contact form — ${new Date().toLocaleString('en-CA', { timeZone: 'America/Toronto' })}
      </p>
    `;

        const emailPayload = {
            from: 'Valencia Elite Paving Form <onboarding@resend.dev>',
            to: toEmail,
            replyTo: email,
            subject: `New Quote Request: ${service} — ${name}`,
            html: htmlBody,
        };

        const { error } = await resend.emails.send(emailPayload);

        if (error) {
            console.error('Resend error:', error);
            // Si hay un error de Resend, como dominio no verificado
            return res.status(500).json({ error: 'Error de envío de correo: ' + error.message });
        }

        console.log(`✔ Quote sent: ${service} from ${name}`);
        return res.json({ success: true });
    } catch (err) {
        console.error('Server error:', err);
        return res.status(500).json({ error: 'Error interno del servidor: ' + err.message });
    }
};
