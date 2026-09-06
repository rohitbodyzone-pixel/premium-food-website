export interface AppointmentEmailDetails {
  id: string;
  expertName: string;
  consumerName: string;
  date: string;
  startTime: string;
  endTime: string;
  timezone: string;
  consultationType: string;
  notes?: string | null;
}

export interface IEmailProvider {
  readonly isDevelopment: boolean;
  readonly name: string;

  sendEmailVerification(params: {
    to: string;
    name: string;
    verificationLink: string;
  }): Promise<boolean>;

  sendPasswordReset(params: {
    to: string;
    name: string;
    resetLink: string;
    portalName: string;
  }): Promise<boolean>;

  sendLoginOtp(params: {
    to: string;
    name: string;
    otp: string;
    expiresMinutes: number;
  }): Promise<boolean>;

  sendAppointmentConfirmation(params: {
    to: string;
    name: string;
    isExpert: boolean;
    appointment: AppointmentEmailDetails;
  }): Promise<boolean>;

  sendAppointmentReminder(params: {
    to: string;
    name: string;
    isExpert: boolean;
    appointment: AppointmentEmailDetails;
    reminderWindow: '24h' | '1h';
  }): Promise<boolean>;

  sendAppointmentCancelled(params: {
    to: string;
    name: string;
    isExpert: boolean;
    appointment: AppointmentEmailDetails;
    cancelledBy: string;
    reason?: string;
  }): Promise<boolean>;

  sendAppointmentRescheduled(params: {
    to: string;
    name: string;
    isExpert: boolean;
    appointment: AppointmentEmailDetails;
    oldDate: string;
    oldTime: string;
    rescheduledBy: string;
    reason?: string;
  }): Promise<boolean>;

  sendExpertVerificationUpdate(params: {
    to: string;
    name: string;
    status: string;
    notes?: string;
  }): Promise<boolean>;

  sendSecurityAlert(params: {
    to: string;
    name: string;
    subject: string;
    bodyText: string;
  }): Promise<boolean>;
}
