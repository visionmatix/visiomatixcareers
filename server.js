import express from "express";
import cors from "cors";
import { Resend } from "resend";
import "dotenv/config";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { v2 as cloudinary } from "cloudinary";
import VmcSubscriber from "./models/VmcSubscriber.js";
import VmcArticle from "./models/VmcArticle.js";
import router from "./router.js";

const app = express();

//middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false }));
//middleware

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const ADMIN_USERNAME = process.env.UNAME;
const ADMIN_PASSWORD = process.env.PASSWORD || "admin123";
const ADMIN_PASSWORD_HASH = bcrypt.hashSync(ADMIN_PASSWORD, 10);
const PORT = Number(process.env.PORT) || 5002;
const MONGODB_URI = process.env.MONGODB_URI;

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

app.use("/api", router);

app.get("/api/cron", async (req, res) => {
  console.log("Cron job triggered");

  // your logic here
  // e.g. clean DB, send emails, etc.

  res.status(200).send("Job done");
});

app.post("/api/send-email", async (req, res) => {
  console.log("Received email request:", req.body);
  const { name, email, phone, subject, message, payment } = req.body;

  // Trim and validate email
  const userEmail = email ? email.trim() : "";
  console.log("Payment status:", JSON.stringify(payment));
  console.log("User email:", userEmail);
  console.log("Email is empty?:", userEmail === "");
  console.log("Payment is 'Done'?:", payment === "Done");

  try {
    // Email to Admin
    console.log("Sending email to admin:", RECEIVER_EMAIL);
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
      console.error(
        "Resend API error:",
        JSON.stringify(adminEmailError, null, 2),
      );
      return res
        .status(500)
        .json({ error: "Failed to send email", details: adminEmailError });
    }

    console.log("Admin email sent successfully:", adminEmailData);

    // If payment is done, send invoice email to user
    if (payment === "Done" && userEmail) {
      console.log(
        "✓ Payment is Done and email is valid, sending invoice email to:",
        userEmail,
      );
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
        console.error("❌ User email error when sending to:", userEmail);
        console.error(
          "Detailed error:",
          JSON.stringify(userEmailError, null, 2),
        );
      } else {
        console.log("✓ User invoice email sent successfully to:", userEmail);
      }
    } else {
      console.log(
        "⚠ Not sending user email. Payment is 'Done'?:",
        payment === "Done",
        "Email is valid?:",
        !!userEmail,
      );
    }

    res.status(200).json({ message: "Email sent successfully" });
  } catch (err) {
    console.error("Server error while sending email:", err);
    res
      .status(500)
      .json({ error: "Internal server error", message: err.message });
  }
});
//email on inquiry

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
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.status(401).json({ error: "Access token required" });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = user;
    next();
  });
};

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

//db connection

connectDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});
