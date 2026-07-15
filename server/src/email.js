import nodemailer from 'nodemailer';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST) return null;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  });
  return transporter;
}

// Sends the "you're now a club admin" notification email. Returns
// { sent: boolean } — if SMTP isn't configured (or sending fails), this
// never throws; the caller can proceed regardless.
export async function sendClubAdminAssignedEmail({ to, name, clubName }) {
  const t = getTransporter();
  const loginUrl = `${process.env.APP_URL || 'http://localhost:5173'}/login`;
  if (!t) {
    console.warn(`SMTP not configured — would have notified ${to} of admin access to "${clubName}"`);
    return { sent: false };
  }

  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject: `You're now an admin of ${clubName} on RunsDB`,
      text: `Hi${name ? ` ${name}` : ''},\n\nYou've been made an admin of "${clubName}" on RunsDB.\n\nLog in here: ${loginUrl}`,
      html: `<p>Hi${name ? ` ${name}` : ''},</p>
        <p>You've been made an admin of <strong>${clubName}</strong> on RunsDB.</p>
        <p><a href="${loginUrl}">Log in to RunsDB</a></p>`,
    });
    return { sent: true };
  } catch (err) {
    console.error('Failed to send club-admin notification email:', err.message);
    return { sent: false };
  }
}
