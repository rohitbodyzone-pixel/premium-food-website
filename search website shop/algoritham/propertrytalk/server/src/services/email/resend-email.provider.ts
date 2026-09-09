import https from 'https';
import { IEmailProvider, AppointmentEmailDetails } from './email.interface';

export class ResendEmailProvider implements IEmailProvider {
  readonly isDevelopment = false;
  readonly name = 'ResendEmailProvider (Production)';
  private apiKey: string;
  private fromAddress: string;
  private fromName: string;

  private lastDispatchId: string | null = null;
  private lastError: string | null = null;

  constructor(apiKey: string, fromAddress?: string, fromName?: string) {
    this.apiKey = apiKey;
    this.fromAddress = fromAddress || 'onboarding@resend.dev';
    this.fromName = fromName || 'PropertyTalk';
  }

  getLastDispatchId(): string | null {
    return this.lastDispatchId;
  }

  getLastError(): string | null {
    return this.lastError;
  }

  private async sendRawEmail(params: {
    to: string;
    subject: string;
    html: string;
  }): Promise<boolean> {
    this.lastDispatchId = null;
    this.lastError = null;

    return new Promise((resolve) => {
      const payload = JSON.stringify({
        from: `${this.fromName} <${this.fromAddress}>`,
        to: [params.to],
        subject: params.subject,
        html: params.html,
      });

      const options: https.RequestOptions = {
        hostname: 'api.resend.com',
        port: 443,
        path: '/emails',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const data = JSON.parse(body);
              this.lastDispatchId = data.id || null;
            } catch {}
            console.log(`📧 [ResendEmailProvider] Email accepted by Resend for ${params.to}. Status: ${res.statusCode}, ID: ${this.lastDispatchId}`);
            resolve(true);
          } else {
            this.lastError = body || `Status ${res.statusCode}`;
            console.error('Resend API Error:', res.statusCode, body);
            resolve(false);
          }
        });
      });

      req.on('error', (err) => {
        this.lastError = err.message;
        console.error('Resend HTTPS request error:', err);
        resolve(false);
      });

      req.write(payload);
      req.end();
    });
  }

  async sendTestEmail(params: { to: string; name?: string }): Promise<boolean> {
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
        <h2 style="color: #0f172a; margin-top: 0;">PropertyTalk — System Integration Test</h2>
        <p style="color: #334155; font-size: 15px;">Hi ${params.name || 'User'},</p>
        <p style="color: #334155; font-size: 15px; line-height: 1.6;">This is a real test email dispatched from PropertyTalk via <strong>Resend</strong> to verify operational email readiness.</p>
        <div style="background-color: #f8fafc; border-left: 4px solid #059669; padding: 12px 16px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0; color: #0f172a; font-weight: 600;">Status: Verified Operational</p>
          <p style="margin: 4px 0 0 0; color: #64748b; font-size: 13px;">Timestamp: ${new Date().toUTCString()}</p>
        </div>
        <p style="color: #94a3b8; font-size: 12px; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 12px;">PropertyTalk Platform Integration Notification</p>
      </div>
    `;
    return this.sendRawEmail({ to: params.to, subject: 'PropertyTalk System Test — Resend Integration Verified', html });
  }

  async sendEmailVerification(params: {
    to: string;
    name: string;
    verificationLink: string;
  }): Promise<boolean> {
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #0f172a;">Verify your PropertyTalk account</h2>
        <p>Hi ${params.name},</p>
        <p>Thank you for signing up for PropertyTalk. Please click the button below to verify your email address:</p>
        <p style="margin: 30px 0;">
          <a href="${params.verificationLink}" style="background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Verify Email Address</a>
        </p>
        <p style="color: #64748b; font-size: 13px;">This link will expire in 24 hours. If you did not create an account, you can safely ignore this email.</p>
      </div>
    `;
    return this.sendRawEmail({ to: params.to, subject: 'Verify your email address for PropertyTalk', html });
  }

  async sendPasswordReset(params: {
    to: string;
    name: string;
    resetLink: string;
    portalName: string;
  }): Promise<boolean> {
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #0f172a;">Password Reset Request</h2>
        <p>Hi ${params.name},</p>
        <p>We received a request to reset your password for your PropertyTalk ${params.portalName} account.</p>
        <p style="margin: 30px 0;">
          <a href="${params.resetLink}" style="background-color: #0f172a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Reset Password</a>
        </p>
        <p style="color: #64748b; font-size: 13px;">This link will expire in 15 minutes and can only be used once. If you did not request this, please secure your account immediately.</p>
      </div>
    `;
    return this.sendRawEmail({ to: params.to, subject: 'Reset your PropertyTalk password', html });
  }

  async sendLoginOtp(params: {
    to: string;
    name: string;
    otp: string;
    expiresMinutes: number;
  }): Promise<boolean> {
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #0f172a;">PropertyTalk Verification Code</h2>
        <p>Hi ${params.name},</p>
        <p>Your one-time verification code is:</p>
        <div style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #059669; padding: 20px; background: #f0fdf4; border-radius: 12px; text-align: center; margin: 20px 0;">
          ${params.otp}
        </div>
        <p style="color: #64748b; font-size: 13px;">This code will expire in ${params.expiresMinutes} minutes. Never share this code with anyone.</p>
      </div>
    `;
    return this.sendRawEmail({ to: params.to, subject: `${params.otp} is your PropertyTalk verification code`, html });
  }

  async sendAppointmentConfirmation(params: {
    to: string;
    name: string;
    isExpert: boolean;
    appointment: AppointmentEmailDetails;
  }): Promise<boolean> {
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #059669;">Appointment Confirmed</h2>
        <p>Hi ${params.name},</p>
        <p>Your consultation is scheduled:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr><td style="padding: 8px 0; color: #64748b;">Professional:</td><td style="font-weight: bold;">${params.appointment.expertName}</td></tr>
          <tr><td style="padding: 8px 0; color: #64748b;">Client:</td><td style="font-weight: bold;">${params.appointment.consumerName}</td></tr>
          <tr><td style="padding: 8px 0; color: #64748b;">Date:</td><td style="font-weight: bold;">${params.appointment.date}</td></tr>
          <tr><td style="padding: 8px 0; color: #64748b;">Time:</td><td style="font-weight: bold;">${params.appointment.startTime} - ${params.appointment.endTime} (${params.appointment.timezone})</td></tr>
          <tr><td style="padding: 8px 0; color: #64748b;">Type:</td><td style="font-weight: bold;">${params.appointment.consultationType}</td></tr>
        </table>
      </div>
    `;
    return this.sendRawEmail({ to: params.to, subject: `Consultation Confirmed: ${params.appointment.date} @ ${params.appointment.startTime}`, html });
  }

  async sendAppointmentReminder(params: {
    to: string;
    name: string;
    isExpert: boolean;
    appointment: AppointmentEmailDetails;
    reminderWindow: '24h' | '1h';
  }): Promise<boolean> {
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #0f172a;">Reminder: Upcoming Consultation in ${params.reminderWindow.toUpperCase()}</h2>
        <p>Hi ${params.name},</p>
        <p>This is a reminder that your session is coming up:</p>
        <p><strong>${params.appointment.date} @ ${params.appointment.startTime} (${params.appointment.timezone})</strong></p>
        <p>Type: ${params.appointment.consultationType} with ${params.isExpert ? params.appointment.consumerName : params.appointment.expertName}</p>
      </div>
    `;
    return this.sendRawEmail({ to: params.to, subject: `Reminder: Consultation in ${params.reminderWindow.toUpperCase()}`, html });
  }

  async sendAppointmentCancelled(params: {
    to: string;
    name: string;
    isExpert: boolean;
    appointment: AppointmentEmailDetails;
    cancelledBy: string;
    reason?: string;
  }): Promise<boolean> {
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #dc2626;">Consultation Cancelled</h2>
        <p>Hi ${params.name},</p>
        <p>The appointment scheduled for <strong>${params.appointment.date} @ ${params.appointment.startTime}</strong> was cancelled by ${params.cancelledBy}.</p>
        ${params.reason ? `<p><strong>Reason:</strong> ${params.reason}</p>` : ''}
      </div>
    `;
    return this.sendRawEmail({ to: params.to, subject: `Appointment Cancelled: ${params.appointment.date}`, html });
  }

  async sendAppointmentRescheduled(params: {
    to: string;
    name: string;
    isExpert: boolean;
    appointment: AppointmentEmailDetails;
    oldDate: string;
    oldTime: string;
    rescheduledBy: string;
    reason?: string;
  }): Promise<boolean> {
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #0284c7;">Consultation Rescheduled</h2>
        <p>Hi ${params.name},</p>
        <p>The appointment has been rescheduled by ${params.rescheduledBy}.</p>
        <p><strong>Previous Time:</strong> ${params.oldDate} @ ${params.oldTime}</p>
        <p><strong>New Time:</strong> ${params.appointment.date} @ ${params.appointment.startTime} (${params.appointment.timezone})</p>
        ${params.reason ? `<p><strong>Reason:</strong> ${params.reason}</p>` : ''}
      </div>
    `;
    return this.sendRawEmail({ to: params.to, subject: `Appointment Rescheduled: ${params.appointment.date}`, html });
  }

  async sendExpertVerificationUpdate(params: {
    to: string;
    name: string;
    status: string;
    notes?: string;
  }): Promise<boolean> {
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #0f172a;">Professional Verification Status Update</h2>
        <p>Hi ${params.name},</p>
        <p>Your verification status is now: <strong>${params.status}</strong>.</p>
        ${params.notes ? `<p><strong>Audit Notes:</strong> ${params.notes}</p>` : ''}
      </div>
    `;
    return this.sendRawEmail({ to: params.to, subject: `PropertyTalk Verification Update: ${params.status}`, html });
  }

  async sendSecurityAlert(params: {
    to: string;
    name: string;
    subject: string;
    bodyText: string;
  }): Promise<boolean> {
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #0f172a;">${params.subject}</h2>
        <p>Hi ${params.name},</p>
        <p>${params.bodyText.replace(/\n/g, '<br/>')}</p>
        <p style="color: #64748b; font-size: 13px; margin-top: 20px;">If you did not make this change, please contact PropertyTalk customer support immediately.</p>
      </div>
    `;
    return this.sendRawEmail({ to: params.to, subject: params.subject, html });
  }
}
