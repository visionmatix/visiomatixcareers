import Razorpay from "razorpay";
import crypto from "crypto";
import { Resend } from "resend";
import "dotenv/config";
import Student from "../models/Student.js";

const instance = new Razorpay({
  key_id: process.env.RAZOR_PAY_API,
  key_secret: process.env.RAZORPAY_SECRET,
});

const resend = new Resend(process.env.EMAIL_API_KEY);
const SENDER_EMAIL = process.env.EMAIL_SENDER;
const RECEIVER_EMAIL = process.env.EMAIL_RECEIVER;

const escapeHtml = (value = "") =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

const generateInvoiceNumber = async () => {
  const timestamp = Date.now().toString().slice(-6); // Last 6 digits of timestamp
  const year = new Date().getFullYear();
  const count = await Student.countDocuments();
  return `INV${year}${timestamp}${String(count + 1).padStart(4, "0")}`;
};

const generateInvoiceHTML = (student, payment) => {
  const invoiceDate = new Date(payment.paymentDate).toLocaleDateString();
  const seatBooking = 15000;
  const remainingFees = 35000;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
        .invoice { max-width: 800px; margin: 0 auto; border: 1px solid #ddd; padding: 20px; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
        .header h1 { margin: 0; color: #333; }
        .company-name { color: #666; font-size: 12px; }
        .invoice-details { display: flex; justify-content: space-between; margin-bottom: 30px; }
        .section { margin-bottom: 20px; }
        .section-title { font-weight: bold; margin-bottom: 10px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f5f5f5; font-weight: bold; }
        .total-section { margin-top: 20px; text-align: right; }
        .total-row { font-weight: bold; font-size: 16px; padding: 10px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="invoice">
        <div class="header">
          <h1>INVOICE</h1>
          <p class="company-name">Visiomatix Media</p>
        </div>
        
        <div class="invoice-details">
          <div>
            <strong>Invoice Number:</strong> ${payment.invoiceNumber}<br>
            <strong>Date:</strong> ${invoiceDate}<br>
            <strong>Transaction ID:</strong> ${payment.transactionId || "N/A"}
          </div>
          <div>
            <strong>Student ID:</strong> ${student.studentId}<br>
            <strong>Name:</strong> ${student.studentName}<br>
            <strong>Email:</strong> ${student.email}
          </div>
        </div>

        <div class="section">
          <div class="section-title">Course Details</div>
          <table>
            <tr>
              <th>Course Name</th>
              <td>${student.courseName}</td>
            </tr>
            <tr>
              <th>Enrollment Date</th>
              <td>${new Date(student.enrollmentDate).toLocaleDateString()}</td>
            </tr>
          </table>
        </div>

        <div class="section">
          <div class="section-title">Fee Breakdown</div>
          <table>
            <tr>
              <th>Description</th>
              <th>Amount (INR)</th>
            </tr>
            <tr>
              <td>Seat Booking</td>
              <td>₹${seatBooking.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Remaining Fees</td>
              <td>₹${remainingFees.toFixed(2)}</td>
            </tr>
            <tr style="background-color: #f5f5f5;">
              <td><strong>Total Fees</strong></td>
              <td><strong>₹${(student.totalFees / 100).toFixed(2)}</strong></td>
            </tr>
          </table>
        </div>

        <div class="section">
          <div class="section-title">Payment Information</div>
          <table>
            <tr>
              <td><strong>Amount Paid</strong></td>
              <td>₹${(payment.amount / 100).toFixed(2)}</td>
            </tr>
            <tr>
              <td><strong>Payment Method</strong></td>
              <td>${payment.paymentMethod === "razorpay" ? "Razorpay" : "Manual"}</td>
            </tr>
            <tr>
              <td><strong>Status</strong></td>
              <td>${payment.status.toUpperCase()}</td>
            </tr>
          </table>
        </div>

        <div class="section">
          <div class="section-title">Outstanding Balance</div>
          <div class="total-section">
            <div>Total Paid: ₹${(student.paidAmount / 100).toFixed(2)}</div>
            <div>Total Pending: ₹${(student.pendingAmount / 100).toFixed(2)}</div>
            <div class="total-row" style="color: #d9534f;">Remaining to Pay: ₹${(
              student.pendingAmount / 100
            ).toFixed(2)}</div>
          </div>
        </div>

        <div class="footer">
          <p>This is an automated invoice. Please contact support for any queries.</p>
          <p>&copy; 2024 Visiomatix Media. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Create payment order
export const studentPaymentController = async (req, res) => {
  const { amount, studentId } = req.body;

  if (!amount || !studentId) {
    return res.status(400).json({ error: "amount and studentId are required" });
  }

  try {
    const student = await Student.findOne({ studentId });

    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    const options = {
      amount: Number(amount) * 100, // Convert to paise
      currency: "INR",
      receipt: `rcpt_${Date.now().toString().slice(-8)}`,
    };

    const order = await instance.orders.create(options);

    return res.status(200).json({
      success: true,
      order: order,
      studentId: student._id,
      studentName: student.studentName,
    });
  } catch (error) {
    console.error("Payment order error:", error);
    return res.status(500).json({ error: "Failed to create payment order" });
  }
};

// Verify payment and update student record
export const verifyStudentPaymentController = async (req, res) => {
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    studentId,
    amount,
  } = req.body;

  if (
    !razorpay_order_id ||
    !razorpay_payment_id ||
    !razorpay_signature ||
    !studentId
  ) {
    return res
      .status(400)
      .json({ error: "Missing payment verification details" });
  }

  try {
    const student = await Student.findOne({ studentId });

    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    // Verify signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ error: "Payment verification failed" });
    }

    // Generate invoice
    const invoiceNumber = await generateInvoiceNumber();

    // Update student payment
    const paymentRecord = {
      amount: Number(amount) * 100, // Store in paise
      invoiceNumber,
      paymentDate: new Date(),
      paymentMethod: "razorpay",
      transactionId: razorpay_payment_id,
      status: "completed",
    };

    student.paymentHistory.push(paymentRecord);
    student.paidAmount += Number(amount) * 100;
    student.pendingAmount = Math.max(0, student.totalFees - student.paidAmount);

    await student.save();

    const invoiceHTML = generateInvoiceHTML(student, paymentRecord);

    // Send invoice email to student
    await resend.emails.send({
      from: SENDER_EMAIL,
      to: student.email,
      subject: `Invoice ${invoiceNumber} - Visiomatix Media`,
      html: `
        <h2>Payment Received - Invoice ${invoiceNumber}</h2>
        <p>Dear ${escapeHtml(student.studentName)},</p>
        <p>Thank you for your payment of ₹${amount}. Your invoice is attached below.</p>
        <table style="border: 1px solid #ddd; padding: 10px; margin: 20px 0;">
          <tr><td><strong>Invoice Number:</strong></td><td>${invoiceNumber}</td></tr>
          <tr><td><strong>Amount Paid:</strong></td><td>₹${amount}</td></tr>
          <tr><td><strong>Total Paid:</strong></td><td>₹${(student.paidAmount / 100).toFixed(2)}</td></tr>
          <tr><td><strong>Pending Amount:</strong></td><td>₹${(student.pendingAmount / 100).toFixed(2)}</td></tr>
          <tr><td><strong>Transaction ID:</strong></td><td>${razorpay_payment_id}</td></tr>
        </table>
        <p>You can download your full invoice from your student dashboard.</p>
        <p>Thank you!</p>
      `,
    });

    // Send notification email to admin
    await resend.emails.send({
      from: SENDER_EMAIL,
      to: RECEIVER_EMAIL,
      subject: `Payment Received - ${student.studentName}`,
      html: `
        <h2>New Payment Received</h2>
        <p>A payment has been successfully processed.</p>
        <table style="border: 1px solid #ddd; padding: 10px; margin: 20px 0;">
          <tr><td><strong>Student Name:</strong></td><td>${escapeHtml(student.studentName)}</td></tr>
          <tr><td><strong>Student ID:</strong></td><td>${student.studentId}</td></tr>
          <tr><td><strong>Email:</strong></td><td>${student.email}</td></tr>
          <tr><td><strong>Course:</strong></td><td>${student.courseName}</td></tr>
          <tr><td><strong>Amount Paid:</strong></td><td>₹${amount}</td></tr>
          <tr><td><strong>Invoice Number:</strong></td><td>${invoiceNumber}</td></tr>
          <tr><td><strong>Total Paid:</strong></td><td>₹${(student.paidAmount / 100).toFixed(2)}</td></tr>
          <tr><td><strong>Pending Amount:</strong></td><td>₹${(student.pendingAmount / 100).toFixed(2)}</td></tr>
        </table>
      `,
    });

    return res.status(200).json({
      success: true,
      message: "Payment verified and recorded successfully",
      student: {
        ...student.toObject(),
        password: undefined,
      },
      payment: paymentRecord,
    });
  } catch (error) {
    console.error("Payment verification error:", error);
    return res.status(500).json({ error: "Payment verification failed" });
  }
};

export default studentPaymentController;
