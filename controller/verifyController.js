import crypto from "crypto";
import "dotenv/config";
import Student from "../models/Student.js"; 
import { Resend } from "resend";
const resend = new Resend(process.env.EMAIL_API_KEY);

//  Payment Verification
export const verifyController = (req, res) => {
  const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
  const comb = razorpay_order_id + "|" + razorpay_payment_id;
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_SECRET)
    .update(comb.toString())
    .digest("hex");

  if (expectedSignature === razorpay_signature) {
    return res.status(200).json({
      success: true,
      message: "Payment verified",
    });
  } else {
    return res.status(400).json({
      success: false,
      message: "Invalid signature",
    });
  }
};

// Forgot Password 
export const forgotPasswordController = async (req, res) => {
  try {
    const { email } = req.body;

    // Check email exists
    if (!email) {
      return res.status(400).json({
        success: false,
        error: "Email is required!",
      });
    }

    // Find student
    const student = await Student.findOne({ email });

    if (!student) {
      return res.status(404).json({
        success: false,
        error: "No account found with this email address.",
      });
    }

    // Send Email using Resend
    const response = await resend.emails.send({
      from: process.env.EMAIL_SENDER, // example: onboardsending@resend.dev
      to: student.email,
      subject: "Visiomatix Media - Account Password Recovery",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #0f172a;">Password Recovery Request</h2>

          <p>Hello <b>${student.studentName || "Student"}</b>,</p>

          <p>
            We received a request to recover your password for
            <b>Visiomatix Portal</b>.
          </p>

          <div 
            style="
              background-color: #f1f5f9;
              padding: 15px;
              border-radius: 8px;
              margin: 20px 0;
              font-size: 16px;
            "
          >
            Your Login Password is:
            <strong style="color: #2563eb;">
              ${student.password}
            </strong>
          </div>

          <p>
            If you didn't request this, you can safely ignore this email.
          </p>

          <hr 
            style="
              border: 0;
              border-top: 1px solid #e2e8f0;
              margin: 20px 0;
            "
          />

          <p style="font-size: 12px; color: #64748b;">
            Visiomatix Media Team
          </p>
        </div>
      `,
    });

    return res.status(200).json({
      success: true,
      message: "Password has been successfully sent to your registered email.",
      data: response,
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || "Internal Server Error",
    });
  }
};
