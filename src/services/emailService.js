const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.MAIL_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

async function sendResetPasswordEmail(email, token) {
  const mailOptions = {
    from: `"Spy Game" <${process.env.MAIL_USER}>`,
    to: email,
    subject: 'Mã xác nhận đặt lại mật khẩu',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto;">
        <h2 style="color: #e53e3e;">Spy Game - Đặt Lại Mật Khẩu</h2>
        <p>Bạn đã yêu cầu đặt lại mật khẩu. Mã xác nhận của bạn là:</p>
        <div style="background: #f7fafc; border: 2px solid #e53e3e; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #e53e3e;">${token}</span>
        </div>
        <p>Mã có hiệu lực trong <strong>15 phút</strong>.</p>
        <p style="color: #718096;">Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.</p>
      </div>
    `,
  };
  await transporter.sendMail(mailOptions);
}

module.exports = { sendResetPasswordEmail };
