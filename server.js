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

const app = express();

//middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));
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

app.post("/api/send-email", async (req, res) => {
  console.log("Received email request:", req.body);
  const { name, email, phone, subject, message } = req.body;

  try {
    const { data, error } = await resend.emails.send({
      from: SENDER_EMAIL,
      to: RECEIVER_EMAIL,
      subject: `Contact Form: ${subject}`,
      html: `
        <h3>New Contact Form Submission Education & Training Website</h3>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <p><strong>Message:</strong></p>
        <p>${message.replace(/\n/g, "<br>")}</p>
      `,
    });

    if (error) {
      console.error("Resend API error:", JSON.stringify(error, null, 2));
      return res
        .status(500)
        .json({ error: "Failed to send email", details: error });
    }

    console.log("Resend response data:", data);
    res.status(200).json({ message: "Email sent successfully" });
  } catch (err) {
    console.error("Server error while sending email:", err);
    res.status(500).json({ error: "Internal server error" });
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
app.put("/api/admin/articles/:articleId", authenticateToken, async (req, res) => {
  const { articleId } = req.params;
  const { category, title, description, readTime, imageData, imageUrl } = req.body;

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

    return res.json({ message: "Article updated successfully", article: updatedArticle });
  } catch (error) {
    console.error("Update article error:", error);
    return res.status(500).json({ error: "Failed to update article" });
  }
});

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
