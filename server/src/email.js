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
      subject: `You're now an admin of ${clubName} on RunNation`,
      text: `Hi${name ? ` ${name}` : ''},\n\nYou've been made an admin of "${clubName}" on RunNation.\n\nLog in here: ${loginUrl}`,
      html: `<p>Hi${name ? ` ${name}` : ''},</p>
        <p>You've been made an admin of <strong>${clubName}</strong> on RunNation.</p>
        <p><a href="${loginUrl}">Log in to RunNation</a></p>`,
    });
    return { sent: true };
  } catch (err) {
    console.error('Failed to send club-admin notification email:', err.message);
    return { sent: false };
  }
}

// Sends the signup activation email containing a one-click link to verify
// the address and activate the account. Same never-throws contract as
// sendClubAdminAssignedEmail. When SMTP isn't configured, the activation
// link is logged so local development can still activate accounts by hand.
export async function sendActivationEmail({ to, name, token }) {
  const t = getTransporter();
  const activateUrl = `${process.env.APP_URL || 'http://localhost:5173'}/activate?token=${token}`;
  if (!t) {
    console.warn(`SMTP not configured — activation link for ${to}: ${activateUrl}`);
    return { sent: false };
  }

  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject: 'Activate your RunNation account',
      text: `Hi${name ? ` ${name}` : ''},\n\nWelcome to RunNation! Confirm your email to activate your account:\n\n${activateUrl}\n\nThis link expires in 24 hours.`,
      html: `<p>Hi${name ? ` ${name}` : ''},</p>
        <p>Welcome to RunNation! Confirm your email to activate your account.</p>
        <p><a href="${activateUrl}">Activate my account</a></p>
        <p>This link expires in 24 hours.</p>`,
    });
    return { sent: true };
  } catch (err) {
    console.error('Failed to send activation email:', err.message);
    return { sent: false };
  }
}

// Notifies one club admin that a user has requested to join their club.
// Same never-throws contract as the others.
export async function sendClubJoinRequestEmail({ to, adminName, userName, userEmail, clubName }) {
  const t = getTransporter();
  const dashboardUrl = `${process.env.APP_URL || 'http://localhost:5173'}/admin`;
  if (!t) {
    console.warn(`SMTP not configured — would have notified ${to} of ${userName}'s request to join "${clubName}"`);
    return { sent: false };
  }

  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject: `New join request for ${clubName}`,
      text: `Hi${adminName ? ` ${adminName}` : ''},\n\n${userName} (${userEmail}) requested to join "${clubName}".\n\nReview it here: ${dashboardUrl}`,
      html: `<p>Hi${adminName ? ` ${adminName}` : ''},</p>
        <p><strong>${userName}</strong> (${userEmail}) requested to join <strong>${clubName}</strong>.</p>
        <p><a href="${dashboardUrl}">Review the request</a></p>`,
    });
    return { sent: true };
  } catch (err) {
    console.error('Failed to send join-request notification email:', err.message);
    return { sent: false };
  }
}

// Notifies a user that their club join request was approved or rejected.
export async function sendClubJoinResponseEmail({ to, name, clubName, status }) {
  const t = getTransporter();
  const approved = status === 'approved';
  if (!t) {
    console.warn(`SMTP not configured — would have told ${to} their request to join "${clubName}" was ${status}`);
    return { sent: false };
  }

  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject: approved ? `You're in! Welcome to ${clubName}` : `Update on your ${clubName} join request`,
      text: approved
        ? `Hi${name ? ` ${name}` : ''},\n\nGreat news — your request to join "${clubName}" was approved. Welcome aboard!`
        : `Hi${name ? ` ${name}` : ''},\n\nYour request to join "${clubName}" was declined.`,
      html: approved
        ? `<p>Hi${name ? ` ${name}` : ''},</p><p>Great news — your request to join <strong>${clubName}</strong> was approved. Welcome aboard!</p>`
        : `<p>Hi${name ? ` ${name}` : ''},</p><p>Your request to join <strong>${clubName}</strong> was declined.</p>`,
    });
    return { sent: true };
  } catch (err) {
    console.error('Failed to send join-response email:', err.message);
    return { sent: false };
  }
}

// Notifies a user that an admin removed their club membership.
export async function sendClubMembershipRemovedEmail({ to, name, clubName }) {
  const t = getTransporter();
  if (!t) {
    console.warn(`SMTP not configured — would have told ${to} their membership in "${clubName}" was removed`);
    return { sent: false };
  }

  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject: `You've been removed from ${clubName}`,
      text: `Hi${name ? ` ${name}` : ''},\n\nYou've been removed from "${clubName}" on RunNation. You're welcome to request to join again anytime.`,
      html: `<p>Hi${name ? ` ${name}` : ''},</p><p>You've been removed from <strong>${clubName}</strong> on RunNation. You're welcome to request to join again anytime.</p>`,
    });
    return { sent: true };
  } catch (err) {
    console.error('Failed to send membership-removed email:', err.message);
    return { sent: false };
  }
}
