import { Resend } from "resend";
import "dotenv/config";

const resend = new Resend(process.env.EMAIL_API_KEY);
const SENDER_EMAIL = process.env.EMAIL_SENDER;
const RECEIVER_EMAIL = process.env.EMAIL_RECEIVER;

const sendEmailController = async (req, res) => {
  const { name, email, phone, subject, message, payment } = req.body;

  // Trim and validate email
  const userEmail = email ? email.trim() : "";

  try {
    // Email to Admin
    const { data: adminEmailData, error: adminEmailError } =
      await resend.emails.send({
        from: SENDER_EMAIL,
        to: RECEIVER_EMAIL,
        subject: `Contact Form: ${subject}`,
        html: `
        <h3>New Contact Form Submission Education & Training Website</h3>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${userEmail}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <p><strong>Message:</strong></p>
        <p>${message.replace(/\n/g, "<br>")}</p>
        <h1><strong>Payment:</strong> ${payment}</h1>
      `,
      });

    if (adminEmailError) {
      return res
        .status(500)
        .json({ error: "Failed to send email", details: adminEmailError });
    }

    // If payment is done, send invoice email to user
    if (payment === "Done" && userEmail) {
      const invoiceDate = new Date().toLocaleDateString("en-IN");
      const invoiceNumber = `INV-${Date.now()}`;

      const { data: userEmailData, error: userEmailError } =
        await resend.emails.send({
          from: SENDER_EMAIL,
          to: userEmail,
          subject: `Seat Confirmation & Invoice - Visiomatix Media Tech`,
          html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h2 style="color: #051729; margin: 0;">Visiomatix Media Tech</h2>
              <p style="color: #666; margin: 5px 0;">Professional Career Development Programs</p>
            </div>

            <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
              <h3 style="color: #333; margin-top: 0;">Congratulations! Your Seat is Confirmed</h3>
              <p>Dear <strong>${name}</strong>,</p>
              <p>Thank you for your application and payment. Your seat has been successfully reserved for the upcoming batch.</p>
            </div>

            <div style="margin-bottom: 30px; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
              <div style="background-color: #162d45; color: white; padding: 15px;">
                <h3 style="margin: 0;">INVOICE</h3>
              </div>
              
              <div style="padding: 20px;">
                <table style="width: 100%; margin-bottom: 20px; font-size: 14px;">
                  <tr>
                    <td><strong>Invoice Number:</strong></td>
                    <td>${invoiceNumber}</td>
                  </tr>
                  <tr>
                    <td><strong>Invoice Date:</strong></td>
                    <td>${invoiceDate}</td>
                  </tr>
                  <tr>
                    <td><strong>Status:</strong></td>
                    <td><span style="background-color: #d4edda; color: #155724; padding: 5px 10px; border-radius: 4px; font-weight: bold;">Paid</span></td>
                  </tr>
                </table>

                <h4 style="margin-bottom: 15px; color: #333;">Bill To:</h4>
                <table style="width: 100%; margin-bottom: 30px; font-size: 14px;">
                  <tr>
                    <td><strong>Name:</strong></td>
                    <td>${name}</td>
                  </tr>
                  <tr>
                    <td><strong>Email:</strong></td>
                    <td>${userEmail}</td>
                  </tr>
                  <tr>
                    <td><strong>Phone:</strong></td>
                    <td>${phone}</td>
                  </tr>
                </table>

                <h4 style="margin-bottom: 15px; color: #333;">Order Summary:</h4>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                  <thead>
                    <tr style="background-color: #f0f0f0; border-bottom: 2px solid #162d45;">
                      <th style="padding: 10px; text-align: left; font-weight: bold;">Description</th>
                      <th style="padding: 10px; text-align: right; font-weight: bold;">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style="border-bottom: 1px solid #eee;">
                      <td style="padding: 10px;">Seat Reservation Fee</td>
                      <td style="padding: 10px; text-align: right;">₹200.00</td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr style="background-color: #f9f9f9; border-top: 2px solid #162d45;">
                      <td style="padding: 10px; font-weight: bold;">Total Amount Paid</td>
                      <td style="padding: 10px; text-align: right; font-weight: bold; color: #162d45; font-size: 16px;">₹200.00</td>
                    </tr>
                  </tfoot>
                </table>

                <p style="color: #666; font-size: 13px; margin: 20px 0;">
                  <strong>Payment Method:</strong> Razorpay
                </p>
              </div>
            </div>

            <div style="background-color: #e8f5f5; padding: 15px; border-radius: 8px; margin-bottom: 30px;">
              <h4 style="color: #162d45; margin-top: 0;">What's Next?</h4>
              <ul style="color: #666; margin: 10px 0;">
                <li>Our team will contact you within 24 hours for onboarding</li>
                <li>Prepare your profile information for the screening call</li>
                <li>Review the program curriculum before your first session</li>
              </ul>
            </div>

            <div style="border-top: 1px solid #ddd; padding-top: 20px; text-align: center; color: #666; font-size: 12px;">
              <p>Visiomatix Media Tech | Professional Career Development Programs</p>
              <p>Email: info@visiomatix.in | Website: www.visiomatixmedia.net</p>
              <p style="margin-top: 15px;">Thank you for choosing Visiomatix Media Tech!</p>
            </div>
            <h3>This is an system generated email kindly don't reply to it!</h3>
          </div>
        `,
        });

      if (userEmailError) {
        // Email send failed silently
      }
    }

    res.status(200).json({ message: "Email sent successfully" });
  } catch (err) {
    console.error("Server error while sending email:", err);
    res
      .status(500)
      .json({ error: "Internal server error", message: err.message });
  }
};

export default sendEmailController;
