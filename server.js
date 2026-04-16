import express from "express";
import cors from "cors";

import { Resend } from "resend";
import "dotenv/config";
import authenticateToken from "./middleware/jwt.js";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { v2 as cloudinary } from "cloudinary";
import jwt from "jsonwebtoken";
import VmcSubscriber from "./models/VmcSubscriber.js";
import VmcArticle from "./models/VmcArticle.js";
import Student from "./models/Student.js";
import {
  studentPaymentController,
  verifyStudentPaymentController,
} from "./controller/studentPaymentController.js";
import router from "./router.js";

const app = express();

//middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false }));
//middleware

const ADMIN_USERNAME = process.env.UNAME;
const ADMIN_PASSWORD = process.env.PASSWORD;
const ADMIN_PASSWORD_HASH = bcrypt.hashSync(ADMIN_PASSWORD, 10);
const PORT = Number(process.env.PORT);
const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET;

//email on inquiry
const resend = new Resend(process.env.EMAIL_API_KEY);

// Ensure this sender is verified in Resend (domain or address)
const SENDER_EMAIL = process.env.EMAIL_SENDER;
const RECEIVER_EMAIL = process.env.EMAIL_RECEIVER;
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

if (CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
  });
}

const connectDb = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

const escapeHtml = (value = "") =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

const chunkArray = (array, size) => {
  const chunks = [];
  for (let index = 0; index < array.length; index += size) {
    chunks.push(array.slice(index, index + size));
  }
  return chunks;
};

const generateStudentId = async () => {
  const year = new Date().getFullYear();
  const timestamp = Date.now().toString().slice(-8); // Last 8 digits of timestamp
  const random = Math.random().toString(36).substring(2, 5).toUpperCase(); // 3 random chars
  const count = await Student.countDocuments();
  const sequence = String(count + 1).padStart(4, "0");
  return `VMS${year}${timestamp}${random}${sequence}`;
};

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
              <td>₹${(seatBooking / 100).toFixed(2)}</td>
            </tr>
            <tr>
              <td>Remaining Fees</td>
              <td>₹${(remainingFees / 100).toFixed(2)}</td>
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
            <div class="total-row" style="color: #d9534f;">Remaining to Pay: ₹${(student.pendingAmount / 100).toFixed(2)}</div>
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

const uploadArticleImageToCloudinary = async (imageData) => {
  if (!imageData) return "";

  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new Error("Cloudinary credentials are not configured on backend");
  }

  const uploadResult = await cloudinary.uploader.upload(imageData, {
    folder: "vmc-insights",
    resource_type: "image",
  });

  return uploadResult.secure_url || "";
};

const notifySubscribersAboutArticle = async (article) => {
  const subscribers = await VmcSubscriber.find({}, { email: 1, _id: 0 }).lean();
  const emails = subscribers.map((subscriber) => subscriber.email);

  if (emails.length === 0) {
    return { notifiedCount: 0, failedCount: 0 };
  }

  const batches = chunkArray(emails, 50);
  let failedCount = 0;

  for (const batch of batches) {
    const { error } = await resend.emails.send({
      from: SENDER_EMAIL,
      to: batch,
      subject: `New Insight Published: ${article.title}`,
      html: `
        <h2>New article from Visiomatix Media</h2>
        <p><strong>${escapeHtml(article.title)}</strong></p>
        <p>${escapeHtml(article.description)}</p>
        <p><strong>Category:</strong> ${escapeHtml(article.category)}</p>
        <p><strong>Read time:</strong> ${escapeHtml(article.readTime)}</p>
        <p>Visit <a href="https://visiomatixmedia.net/insights">Insights</a> to read more.</p>
      `,
    });

    if (error) {
      failedCount += batch.length;
      console.error("Failed to send article notifications:", error);
    }
  }

  return {
    notifiedCount: emails.length - failedCount,
    failedCount,
  };
};

app.get("/api/cron", async (req, res) => {
  console.log("Cron job triggered");

  // your logic here
  // e.g. clean DB, send emails, etc.

  res.status(200).send("Job done");
});

// Subscribe user to newsletter
app.post("/api/subscribe", async (req, res) => {
  const { email } = req.body;

  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "Valid email is required" });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(normalizedEmail)) {
    return res.status(400).json({ error: "Please enter a valid email" });
  }

  try {
    const existingSubscriber = await VmcSubscriber.findOne({
      email: normalizedEmail,
    });

    if (existingSubscriber) {
      return res.status(200).json({ message: "Email is already subscribed" });
    }

    await VmcSubscriber.create({ email: normalizedEmail });
    return res.status(201).json({ message: "Subscribed successfully" });
  } catch (error) {
    console.error("Subscribe error:", error);
    return res.status(500).json({ error: "Failed to subscribe" });
  }
});

// Public articles endpoint for Insights page
app.get("/api/articles", async (_req, res) => {
  try {
    const articles = await VmcArticle.find({}).sort({ publishedAt: -1 }).lean();
    return res.json({ articles });
  } catch (error) {
    console.error("Fetch articles error:", error);
    return res.status(500).json({ error: "Failed to fetch articles" });
  }
});

// Admin authentication
app.post("/api/admin/login", async (req, res) => {
  const { username, password } = req.body;

  if (
    username !== ADMIN_USERNAME ||
    !bcrypt.compareSync(password, ADMIN_PASSWORD_HASH)
  ) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: "1h" });
  res.json({ token });
});

// Middleware to verify JWT

// Protected admin dashboard
app.get("/api/admin/dashboard", authenticateToken, (req, res) => {
  res.json({ message: "Welcome to the admin dashboard!", user: req.user });
});

// Admin stats
app.get("/api/admin/stats", authenticateToken, async (_req, res) => {
  try {
    const [subscriberCount, articleCount] = await Promise.all([
      VmcSubscriber.countDocuments(),
      VmcArticle.countDocuments(),
    ]);

    return res.json({ subscriberCount, articleCount });
  } catch (error) {
    console.error("Stats fetch error:", error);
    return res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// Admin subscribers list
app.get("/api/admin/subscribers", authenticateToken, async (_req, res) => {
  try {
    const subscribers = await VmcSubscriber.find({})
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ subscribers });
  } catch (error) {
    console.error("Subscribers fetch error:", error);
    return res.status(500).json({ error: "Failed to fetch subscribers" });
  }
});

// Admin uploaded articles list
app.get("/api/admin/articles", authenticateToken, async (_req, res) => {
  try {
    const articles = await VmcArticle.find({}).sort({ publishedAt: -1 }).lean();
    return res.json({ articles });
  } catch (error) {
    console.error("Admin articles fetch error:", error);
    return res.status(500).json({ error: "Failed to fetch articles" });
  }
});

// Admin edit article
app.put(
  "/api/admin/articles/:articleId",
  authenticateToken,
  async (req, res) => {
    const { articleId } = req.params;
    const { category, title, description, readTime, imageData, imageUrl } =
      req.body;

    if (!category || !title || !description || !readTime) {
      return res.status(400).json({
        error: "category, title, description and readTime are required",
      });
    }

    try {
      const existingArticle = await VmcArticle.findById(articleId);

      if (!existingArticle) {
        return res.status(404).json({ error: "Article not found" });
      }

      const uploadedImageUrl = await uploadArticleImageToCloudinary(imageData);

      const updatedArticle = await VmcArticle.findByIdAndUpdate(
        articleId,
        {
          category: String(category).trim(),
          title: String(title).trim(),
          description: String(description).trim(),
          readTime: String(readTime).trim(),
          imageUrl: String(
            uploadedImageUrl || imageUrl || existingArticle.imageUrl || "",
          ).trim(),
        },
        { new: true },
      );

      return res.json({
        message: "Article updated successfully",
        article: updatedArticle,
      });
    } catch (error) {
      console.error("Update article error:", error);
      return res.status(500).json({ error: "Failed to update article" });
    }
  },
);

// Admin delete article
app.delete(
  "/api/admin/articles/:articleId",
  authenticateToken,
  async (req, res) => {
    const { articleId } = req.params;

    try {
      const deletedArticle = await VmcArticle.findByIdAndDelete(articleId);

      if (!deletedArticle) {
        return res.status(404).json({ error: "Article not found" });
      }

      return res.json({ message: "Article deleted successfully" });
    } catch (error) {
      console.error("Delete article error:", error);
      return res.status(500).json({ error: "Failed to delete article" });
    }
  },
);

// Admin delete subscriber
app.delete(
  "/api/admin/subscribers/:subscriberId",
  authenticateToken,
  async (req, res) => {
    const { subscriberId } = req.params;

    try {
      const deletedSubscriber =
        await VmcSubscriber.findByIdAndDelete(subscriberId);

      if (!deletedSubscriber) {
        return res.status(404).json({ error: "Subscriber not found" });
      }

      return res.json({ message: "Subscriber deleted successfully" });
    } catch (error) {
      console.error("Delete subscriber error:", error);
      return res.status(500).json({ error: "Failed to delete subscriber" });
    }
  },
);

// Create new article and email all subscribers
app.post("/api/admin/articles", authenticateToken, async (req, res) => {
  const { category, title, description, imageUrl, imageData, readTime } =
    req.body;

  if (!category || !title || !description || !readTime) {
    return res.status(400).json({
      error: "category, title, description and readTime are required",
    });
  }

  try {
    const uploadedImageUrl = await uploadArticleImageToCloudinary(imageData);

    const article = await VmcArticle.create({
      category: String(category).trim(),
      title: String(title).trim(),
      description: String(description).trim(),
      imageUrl: String(uploadedImageUrl || imageUrl || "").trim(),
      readTime: String(readTime).trim(),
      publishedAt: new Date(),
    });

    const { notifiedCount, failedCount } =
      await notifySubscribersAboutArticle(article);

    return res.status(201).json({
      message: "Article published successfully",
      article,
      emailSummary: {
        notifiedCount,
        failedCount,
      },
    });
  } catch (error) {
    console.error("Create article error:", error);
    return res.status(500).json({ error: "Failed to publish article" });
  }
});

// ============ STUDENT MANAGEMENT ENDPOINTS ============

// Admin: Create new student
app.post("/api/admin/students", authenticateToken, async (req, res) => {
  const {
    studentName,
    email,
    courseName,
    totalFees,
    seatBooking,
    remainingFees,
  } = req.body;

  if (!studentName || !email || !courseName) {
    return res.status(400).json({
      error: "studentName, email, and courseName are required",
    });
  }

  try {
    const existingStudent = await Student.findOne({
      email: email.toLowerCase(),
    });
    if (existingStudent) {
      return res
        .status(400)
        .json({ error: "Student with this email already exists" });
    }

    const studentId = await generateStudentId();
    const tempPassword = Math.random().toString(36).slice(-10);
    const hashedPassword = bcrypt.hashSync(tempPassword, 10);

    const student = await Student.create({
      studentId,
      studentName: String(studentName).trim(),
      email: String(email).trim().toLowerCase(),
      password: hashedPassword,
      courseName: String(courseName).trim(),
      totalFees: Number(totalFees) || 5000000, // Default 50000 INR in paise
      seatBooking: Number(seatBooking) || 1500000, // Default 15000 INR
      remainingFees: Number(remainingFees) || 3500000, // Default 35000 INR
      pendingAmount: Number(totalFees) || 5000000,
    });

    // Send credentials email to student (non-blocking)
    resend.emails
      .send({
        from: SENDER_EMAIL,
        to: email,
        subject:
          "Welcome to Visiomatix Media - Your Student Account Credentials",
        html: `
        <h2>Welcome to Visiomatix Media!</h2>
        <p>Dear ${escapeHtml(studentName)},</p>
        <p>Your student account has been created. Here are your login credentials:</p>
        <table style="border: 1px solid #ddd; padding: 10px; margin: 20px 0; text-align: left;">
          <tr><td><strong>Student ID:</strong></td><td>${studentId}</td></tr>
          <tr><td><strong>Email:</strong></td><td>${email}</td></tr>
          <tr><td><strong>Temporary Password:</strong></td><td><b>${tempPassword}</b></td></tr>
          <tr><td><strong>Course:</strong></td><td>${courseName}</td></tr>
          <tr><td><strong>Total Fees:</strong></td><td>₹${((Number(totalFees) || 5000000) / 100).toFixed(2)}</td></tr>
        </table>
        <p><strong>Please log in with your Student ID and change your password on your first login.</strong></p>
        <p>Visit: <a href="https://visiomatixmedia.net/student-login">Student Portal</a></p>
        <p>If you have any questions, please contact support.</p>
      `,
      })
      .catch((emailError) => {
        console.error("Failed to send student credentials email:", emailError);
      });

    return res.status(201).json({
      message: "Student created successfully",
      student: {
        ...student.toObject(),
        password: undefined,
      },
      tempPassword, // Return only for admin confirmation
    });
  } catch (error) {
    console.error("Create student error:", error.message);
    console.error("Full error:", JSON.stringify(error, null, 2));
    console.error("Stack trace:", error.stack);

    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      const value = error.keyValue[field];
      return res.status(400).json({
        error: `${field === "studentId" ? "Student ID" : "Email"} already exists: ${value}. This is a system error. Please contact support.`,
      });
    }

    // Handle validation errors
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors)
        .map((err) => err.message)
        .join(", ");
      return res.status(400).json({
        error: "Validation error",
        details: messages,
      });
    }

    return res
      .status(500)
      .json({ error: "Failed to create student", details: error.message });
  }
});

// Admin: Get all students
app.get("/api/admin/students", authenticateToken, async (_req, res) => {
  try {
    const students = await Student.find({})
      .select("-password")
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ students });
  } catch (error) {
    console.error("Fetch students error:", error);
    return res.status(500).json({ error: "Failed to fetch students" });
  }
});

// Admin: Get specific student
app.get(
  "/api/admin/students/:studentId",
  authenticateToken,
  async (req, res) => {
    try {
      const student = await Student.findById(req.params.studentId)
        .select("-password")
        .lean();

      if (!student) {
        return res.status(404).json({ error: "Student not found" });
      }

      return res.json({ student });
    } catch (error) {
      console.error("Fetch student error:", error);
      return res.status(500).json({ error: "Failed to fetch student" });
    }
  },
);

// Admin: Delete student
app.delete(
  "/api/admin/students/:studentId",
  authenticateToken,
  async (req, res) => {
    try {
      const student = await Student.findByIdAndDelete(req.params.studentId);

      if (!student) {
        return res.status(404).json({ error: "Student not found" });
      }

      return res.json({
        message: "Student deleted successfully",
        student: {
          ...student.toObject(),
          password: undefined,
        },
      });
    } catch (error) {
      console.error("Delete student error:", error);
      return res.status(500).json({ error: "Failed to delete student" });
    }
  },
);

// Student: Login
app.post("/api/student/login", async (req, res) => {
  const { studentId, password } = req.body;

  if (!studentId || !password) {
    return res
      .status(400)
      .json({ error: "Student ID and password are required" });
  }

  try {
    const student = await Student.findOne({ studentId });

    if (!student) {
      return res.status(401).json({ error: "Invalid Student ID or password" });
    }

    const isPasswordValid = bcrypt.compareSync(password, student.password);

    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid Student ID or password" });
    }

    if (!student.isActive) {
      return res.status(401).json({ error: "Student account is inactive" });
    }

    const token = jwt.sign(
      { studentId: student.studentId, email: student.email, role: "student" },
      JWT_SECRET,
      { expiresIn: "24h" },
    );

    return res.json({
      token,
      student: {
        _id: student._id,
        studentId: student.studentId,
        studentName: student.studentName,
        email: student.email,
        courseName: student.courseName,
        profileImageUrl: student.profileImageUrl,
      },
    });
  } catch (error) {
    console.error("Student login error:", error);
    return res.status(500).json({ error: "Login failed" });
  }
});

// Student middleware to verify token
const authenticateStudentToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.status(401).json({ error: "Access token required" });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    if (user.role !== "student")
      return res.status(403).json({ error: "Not authorized as student" });
    req.student = user;
    next();
  });
};

// Student: Get dashboard data
app.get(
  "/api/student/dashboard",
  authenticateStudentToken,
  async (req, res) => {
    try {
      const student = await Student.findOne({
        studentId: req.student.studentId,
      })
        .select("-password")
        .populate("paymentHistory");

      if (!student) {
        return res.status(404).json({ error: "Student not found" });
      }

      return res.json({ student });
    } catch (error) {
      console.error("Dashboard error:", error);
      return res.status(500).json({ error: "Failed to fetch dashboard data" });
    }
  },
);

// Student: Change password
app.post(
  "/api/student/change-password",
  authenticateStudentToken,
  async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res
        .status(400)
        .json({ error: "Old and new password are required" });
    }

    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({ error: "New password must be at least 6 characters" });
    }

    try {
      const student = await Student.findOne({
        studentId: req.student.studentId,
      });

      if (!student) {
        return res.status(404).json({ error: "Student not found" });
      }

      const isPasswordValid = bcrypt.compareSync(oldPassword, student.password);

      if (!isPasswordValid) {
        return res.status(401).json({ error: "Old password is incorrect" });
      }

      const hashedNewPassword = bcrypt.hashSync(newPassword, 10);
      student.password = hashedNewPassword;
      student.passwordChangedByStudent = true;
      await student.save();

      return res.json({ message: "Password changed successfully" });
    } catch (error) {
      console.error("Change password error:", error);
      return res.status(500).json({ error: "Failed to change password" });
    }
  },
);

// Student: Upload profile photo
app.post(
  "/api/student/upload-profile-photo",
  authenticateStudentToken,
  async (req, res) => {
    const { imageData } = req.body;

    if (!imageData) {
      return res.status(400).json({ error: "Image data is required" });
    }

    try {
      if (
        !CLOUDINARY_CLOUD_NAME ||
        !CLOUDINARY_API_KEY ||
        !CLOUDINARY_API_SECRET
      ) {
        throw new Error("Cloudinary credentials are not configured");
      }

      const uploadResult = await cloudinary.uploader.upload(imageData, {
        folder: "vmc-student-profiles",
        resource_type: "image",
      });

      const student = await Student.findOneAndUpdate(
        { studentId: req.student.studentId },
        { profileImageUrl: uploadResult.secure_url },
        { new: true },
      ).select("-password");

      return res.json({
        message: "Profile photo uploaded successfully",
        profileImageUrl: uploadResult.secure_url,
        student,
      });
    } catch (error) {
      console.error("Upload profile photo error:", error);
      return res.status(500).json({ error: "Failed to upload profile photo" });
    }
  },
);

// Admin: Update student payment manually
app.post(
  "/api/admin/students/:studentId/update-payment",
  authenticateToken,
  async (req, res) => {
    const {
      amount,
      paidAmount,
      pendingAmount,
      studentName,
      email,
      courseName,
      totalFees,
      seatBooking,
      remainingFees,
      isActive,
      newPassword,
    } = req.body;
    const { studentId } = req.params;

    const hasPaymentUpdate =
      amount !== undefined ||
      paidAmount !== undefined ||
      pendingAmount !== undefined;
    const hasProfileUpdate =
      studentName !== undefined ||
      email !== undefined ||
      courseName !== undefined ||
      totalFees !== undefined ||
      seatBooking !== undefined ||
      remainingFees !== undefined ||
      isActive !== undefined;
    const hasPasswordUpdate =
      typeof newPassword === "string" && newPassword.trim().length > 0;

    if (!hasPaymentUpdate && !hasProfileUpdate && !hasPasswordUpdate) {
      return res.status(400).json({
        error:
          "Provide at least one update: payment, student details, or password",
      });
    }

    try {
      const student = await Student.findById(studentId);

      if (!student) {
        return res.status(404).json({ error: "Student not found" });
      }

      if (email !== undefined) {
        const normalizedEmail = String(email).trim().toLowerCase();
        const emailExists = await Student.findOne({
          email: normalizedEmail,
          _id: { $ne: student._id },
        });

        if (emailExists) {
          return res
            .status(400)
            .json({ error: "Another student already uses this email" });
        }

        student.email = normalizedEmail;
      }

      if (studentName !== undefined) {
        student.studentName = String(studentName).trim();
      }

      if (courseName !== undefined) {
        student.courseName = String(courseName).trim();
      }

      if (totalFees !== undefined) {
        student.totalFees = Number(totalFees);
      }

      if (seatBooking !== undefined) {
        student.seatBooking = Number(seatBooking);
      }

      if (remainingFees !== undefined) {
        student.remainingFees = Number(remainingFees);
      }

      if (isActive !== undefined) {
        student.isActive = Boolean(isActive);
      }

      let payment = null;
      if (amount !== undefined && Number(amount) > 0) {
        const invoiceNumber = await generateInvoiceNumber();
        payment = {
          amount: Number(amount),
          invoiceNumber,
          paymentMethod: "manual",
          status: "completed",
          transactionId: `MANUAL-${Date.now()}`,
        };

        student.paymentHistory.push(payment);
      }

      if (paidAmount !== undefined && Number(paidAmount) >= 0) {
        student.paidAmount = Number(paidAmount);
      } else if (payment) {
        student.paidAmount = Number(student.paidAmount) + Number(amount);
      }

      if (hasPaymentUpdate) {
        student.pendingAmount = Math.max(
          Number(student.totalFees) - Number(student.paidAmount),
          0,
        );
      } else if (pendingAmount !== undefined) {
        student.pendingAmount = Number(pendingAmount);
      }

      if (hasPasswordUpdate) {
        student.password = bcrypt.hashSync(String(newPassword), 10);
      }

      await student.save();

      if (payment) {
        // Send payment update email to student
        await resend.emails.send({
          from: SENDER_EMAIL,
          to: student.email,
          subject: "Payment Updated - Visiomatix Media",
          html: `
          <h2>Payment Update Confirmation</h2>
          <p>Dear ${escapeHtml(student.studentName)},</p>
          <p>Your payment has been updated successfully.</p>
          <table style="border: 1px solid #ddd; padding: 10px; margin: 20px 0;">
            <tr><td><strong>Amount Paid:</strong></td><td>₹${(Number(payment.amount) / 100).toFixed(2)}</td></tr>
            <tr><td><strong>Total Paid:</strong></td><td>₹${(Number(student.paidAmount) / 100).toFixed(2)}</td></tr>
            <tr><td><strong>Pending Amount:</strong></td><td>₹${(Number(student.pendingAmount) / 100).toFixed(2)}</td></tr>
            <tr><td><strong>Invoice Number:</strong></td><td>${payment.invoiceNumber}</td></tr>
          </table>
          <p>Log in to your dashboard to download the invoice.</p>
        `,
        });
      }

      return res.json({
        message: "Student updated successfully",
        student: {
          ...student.toObject(),
          password: undefined,
        },
        payment,
      });
    } catch (error) {
      console.error("Update payment error:", error);
      return res.status(500).json({ error: "Failed to update payment" });
    }
  },
);

// Download invoice
app.get(
  "/api/student/invoice/:invoiceNumber",
  authenticateStudentToken,
  async (req, res) => {
    try {
      const student = await Student.findOne({
        studentId: req.student.studentId,
      });

      if (!student) {
        return res.status(404).json({ error: "Student not found" });
      }

      const payment = student.paymentHistory.find(
        (p) => p.invoiceNumber === req.params.invoiceNumber,
      );

      if (!payment) {
        console.error(
          `Invoice not found. Looking for: ${req.params.invoiceNumber}, Available: ${student.paymentHistory.map((p) => p.invoiceNumber).join(", ")}`,
        );
        return res
          .status(404)
          .json({ error: "Invoice not found. Please contact support." });
      }

      const invoiceHTML = generateInvoiceHTML(student, payment);

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Content-Length", Buffer.byteLength(invoiceHTML, "utf8"));

      return res.send(invoiceHTML);
    } catch (error) {
      console.error("Download invoice error:", error);
      return res.status(500).json({ error: "Failed to download invoice" });
    }
  },
);

// Get all invoices for student
app.get("/api/student/invoices", authenticateStudentToken, async (req, res) => {
  try {
    const student = await Student.findOne({
      studentId: req.student.studentId,
    });

    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    const invoices = student.paymentHistory.map((payment) => ({
      invoiceNumber: payment.invoiceNumber,
      amount: payment.amount,
      paymentDate: payment.paymentDate,
      status: payment.status,
      transactionId: payment.transactionId,
    }));

    console.log(
      `Fetched ${invoices.length} invoices for student ${student.studentId}`,
    );

    return res.json({
      invoices,
    });
  } catch (error) {
    console.error("Fetch invoices error:", error);
    return res.status(500).json({ error: "Failed to fetch invoices" });
  }
});

// ============ STUDENT PAYMENT ENDPOINTS ============

// Create payment order for student
app.post(
  "/api/student/create-payment",
  authenticateStudentToken,
  async (req, res) => {
    const { amount } = req.body;

    if (!amount) {
      return res.status(400).json({ error: "amount is required" });
    }

    await studentPaymentController(
      { body: { amount, studentId: req.student.studentId } },
      res,
    );
  },
);

// Verify student payment
app.post("/api/student/verify-payment", async (req, res) => {
  await verifyStudentPaymentController(req, res);
});

// ============ END STUDENT PAYMENT ENDPOINTS ============

// Use router for remaining routes as fallback
app.use("/api", router);

//db connection

connectDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});
