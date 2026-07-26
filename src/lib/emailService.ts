import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendVerificationEmail(email: string, code: string) {
  try {
    const { data, error } = await resend.emails.send({
      from: 'MAMAS <onboarding@resend.dev>', // Update this with your verified domain
      to: [email],
      subject: 'MAMAS Account Verification Code',
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
          <h2>MAMAS Account Verification</h2>
          <p>Your verification code is:</p>
          <h1 style="font-size: 36px; letter-spacing: 5px; color: #10b981;">${code}</h1>
          <p>This code will expire in 15 minutes.</p>
          <p>If you did not request this, please ignore this email.</p>
        </div>
      `,
    });

    if (error) {
      console.error("Resend error:", error);
      throw new Error("Failed to send email");
    }

    return data;
  } catch (error) {
    console.error("Failed to send email:", error);
    throw error;
  }
}
