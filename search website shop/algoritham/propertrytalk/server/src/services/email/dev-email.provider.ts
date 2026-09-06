import { IEmailProvider, AppointmentEmailDetails } from './email.interface';

export class DevelopmentEmailProvider implements IEmailProvider {
  readonly isDevelopment = true;
  readonly name = 'DevelopmentEmailProvider (Console Preview)';

  async sendEmailVerification(params: {
    to: string;
    name: string;
    verificationLink: string;
  }): Promise<boolean> {
    console.log('\n======================================================');
    console.log('📧 [DEV EMAIL MODE] Email Verification Dispatched');
    console.log(`To: ${params.name} <${params.to}>`);
    console.log(`Subject: Verify your email address for PropertyTalk`);
    console.log(`🔗 Action Link: ${params.verificationLink}`);
    console.log('======================================================\n');
    return true;
  }

  async sendPasswordReset(params: {
    to: string;
    name: string;
    resetLink: string;
    portalName: string;
  }): Promise<boolean> {
    console.log('\n======================================================');
    console.log(`🔑 [DEV EMAIL MODE] Password Reset Dispatched for ${params.portalName}`);
    console.log(`To: ${params.name} <${params.to}>`);
    console.log(`Subject: Reset your PropertyTalk password`);
    console.log(`🔗 Secure Reset Link: ${params.resetLink}`);
    console.log('⏳ Link expires in 15 minutes. Single-use only.');
    console.log('======================================================\n');
    return true;
  }

  async sendLoginOtp(params: {
    to: string;
    name: string;
    otp: string;
    expiresMinutes: number;
  }): Promise<boolean> {
    console.log('\n======================================================');
    console.log('🔢 [DEV EMAIL MODE] Login / Action OTP Dispatched');
    console.log(`To: ${params.name} <${params.to}>`);
    console.log(`Subject: Your PropertyTalk Verification Code`);
    console.log(`🔑 6-Digit OTP: ${params.otp}`);
    console.log(`⏳ Code expires in ${params.expiresMinutes} minutes.`);
    console.log('======================================================\n');
    return true;
  }

  async sendAppointmentConfirmation(params: {
    to: string;
    name: string;
    isExpert: boolean;
    appointment: AppointmentEmailDetails;
  }): Promise<boolean> {
    console.log('\n======================================================');
    console.log(`📅 [DEV EMAIL MODE] Appointment Confirmed (${params.isExpert ? 'Expert Alert' : 'Customer Confirmation'})`);
    console.log(`To: ${params.name} <${params.to}>`);
    console.log(`Consultation: ${params.appointment.consultationType} with ${params.isExpert ? params.appointment.consumerName : params.appointment.expertName}`);
    console.log(`Date & Time: ${params.appointment.date} @ ${params.appointment.startTime} - ${params.appointment.endTime} (${params.appointment.timezone})`);
    console.log('======================================================\n');
    return true;
  }

  async sendAppointmentReminder(params: {
    to: string;
    name: string;
    isExpert: boolean;
    appointment: AppointmentEmailDetails;
    reminderWindow: '24h' | '1h';
  }): Promise<boolean> {
    console.log('\n======================================================');
    console.log(`⏰ [DEV EMAIL MODE] Appointment Reminder [${params.reminderWindow.toUpperCase()} Before]`);
    console.log(`To: ${params.name} <${params.to}>`);
    console.log(`Consultation: ${params.appointment.date} @ ${params.appointment.startTime} (${params.appointment.timezone})`);
    console.log('======================================================\n');
    return true;
  }

  async sendAppointmentCancelled(params: {
    to: string;
    name: string;
    isExpert: boolean;
    appointment: AppointmentEmailDetails;
    cancelledBy: string;
    reason?: string;
  }): Promise<boolean> {
    console.log('\n======================================================');
    console.log(`❌ [DEV EMAIL MODE] Appointment Cancelled (By ${params.cancelledBy})`);
    console.log(`To: ${params.name} <${params.to}>`);
    console.log(`Date: ${params.appointment.date} @ ${params.appointment.startTime}`);
    if (params.reason) console.log(`Reason: ${params.reason}`);
    console.log('======================================================\n');
    return true;
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
    console.log('\n======================================================');
    console.log(`🔄 [DEV EMAIL MODE] Appointment Rescheduled (By ${params.rescheduledBy})`);
    console.log(`To: ${params.name} <${params.to}>`);
    console.log(`Previous: ${params.oldDate} @ ${params.oldTime}`);
    console.log(`New Time: ${params.appointment.date} @ ${params.appointment.startTime} (${params.appointment.timezone})`);
    if (params.reason) console.log(`Reason: ${params.reason}`);
    console.log('======================================================\n');
    return true;
  }

  async sendExpertVerificationUpdate(params: {
    to: string;
    name: string;
    status: string;
    notes?: string;
  }): Promise<boolean> {
    console.log('\n======================================================');
    console.log(`🛡️ [DEV EMAIL MODE] Expert Verification Update: ${params.status}`);
    console.log(`To: ${params.name} <${params.to}>`);
    if (params.notes) console.log(`Notes: ${params.notes}`);
    console.log('======================================================\n');
    return true;
  }

  async sendSecurityAlert(params: {
    to: string;
    name: string;
    subject: string;
    bodyText: string;
  }): Promise<boolean> {
    console.log('\n======================================================');
    console.log('🛡️ [DEV EMAIL MODE] Security Alert Email Dispatched');
    console.log(`To: ${params.name} <${params.to}>`);
    console.log(`Subject: ${params.subject}`);
    console.log(params.bodyText);
    console.log('======================================================\n');
    return true;
  }
}
