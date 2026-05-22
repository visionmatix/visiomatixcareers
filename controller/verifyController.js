import crypto from "crypto";
import "dotenv/config";
import Student from "../models/Student.js"; 
import nodemailer from "nodemailer";

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

    if (!email) {
      return res.status(400).json({ success: false, error: "Email is required!" });
    }

    // student exists or not
    const student = await Student.findOne({ email });
    if (!student) {
      return res.status(404).json({ success: false, error: "No account found with this email address." });
    }

    // Nodemailer SMTP Configuration
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER, 
        pass: process.env.EMAIL_PASS, 
      },
    });

    // Email Template
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: student.email,
      subject: "Visiomatix Media - Account Password Recovery",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #0f172a;">Password Recovery Request</h2>
          <p>Hello <b>${student.studentName || "Student"}</b>,</p>
          <p>We received a request to recover your password for Visiomatix Portal.</p>
          <div style="background-color: #f1f5f9; padding: 15px; border-radius: 8px; margin: 20px 0; font-size: 16px;">
            Your Login Password is: <strong style="color: #2563eb;">${student.password}</strong>
          </div>
          <p>If you didn't request this, you can safely ignore this email.</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="font-size: 12px; color: #64748b;">Visiomatix Media Team</p>
        </div>
      `,
    };

    // Trigger Mail
    await transporter.sendMail(mailOptions);
    return res.status(200).json({ success: true, message: "Password has been successfully sent to your registered email." });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message || "Internal Server Error" });
  }
};
