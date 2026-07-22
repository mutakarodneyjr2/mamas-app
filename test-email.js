import nodemailer from 'nodemailer';
async function run() {
  let testAccount = await nodemailer.createTestAccount();
  let transporter = nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: testAccount.user, // generated ethereal user
      pass: testAccount.pass, // generated ethereal password
    },
  });
  let info = await transporter.sendMail({
    from: '"MAMAS Admin" <admin@mamas.local>',
    to: "test@example.com",
    subject: "Hello",
    text: "Hello world?",
  });
  console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
}
run().catch(console.error);
