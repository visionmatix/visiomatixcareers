import "dotenv/config";
import { Resend } from "resend";
import { v2 as cloudinary } from "cloudinary";

const resend = new Resend(process.env.EMAIL_API_KEY);
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

const uploadPhotoToCloudinary = async (base64Data) => {
  try {
    const result = await cloudinary.uploader.upload(base64Data, {
      folder: "vmc-reservations",
      resource_type: "auto",
      public_id: `passport_${Date.now()}`,
    });
    return result.secure_url;
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    throw new Error("Failed to upload photo");
  }
};

const convertBase64ToBinary = (base64String) => {
  // Remove data URL prefix if present
  const base64Data = base64String.replace(/^data:image\/\w+;base64,/, "");
  return Buffer.from(base64Data, "base64");
};

const getImageContentType = (base64String) => {
  if (base64String.includes("data:image/png")) return "image/png";
  if (
    base64String.includes("data:image/jpeg") ||
    base64String.includes("data:image/jpg")
  )
    return "image/jpeg";
  return "image/jpeg"; // default
};

const reservationController = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      applicationType,
      preferredCourse,
      experienceLevel,
      aboutYourself,
      passportPhoto,
      paymentStatus,
    } = req.body;

    // Validate required fields
    if (!name || !email || !phone || !passportPhoto) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    // Upload photo to Cloudinary
    let photoUrl = "";
    try {
      photoUrl = await uploadPhotoToCloudinary(passportPhoto);
      console.log("Photo uploaded successfully:", photoUrl);
    } catch (uploadError) {
      console.error("Photo upload failed:", uploadError);
      // Continue even if photo upload fails, we'll send a link to admin
      photoUrl = "Photo upload failed - check backend logs";
    }

    // Prepare email content for admin
    const adminEmailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #162d45; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h2 style="margin: 0;">New Seat Reservation</h2>
          <p style="margin: 5px 0; opacity: 0.9;">Candidate Details & Payment Confirmation</p>
        </div>

        <div style="background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd;">
          <h3 style="color: #162d45; margin-top: 0; border-bottom: 2px solid #2cb5b5; padding-bottom: 10px;">
            Candidate Information
          </h3>

          <table style="width: 100%; margin-bottom: 20px; font-size: 14px; border-collapse: collapse;">
            <tr style="background-color: #fff;">
              <td style="padding: 10px; font-weight: bold; color: #162d45; border-bottom: 1px solid #e0e0e0;">Name:</td>
              <td style="padding: 10px; border-bottom: 1px solid #e0e0e0;">${name}</td>
            </tr>
            <tr style="background-color: #fff;">
              <td style="padding: 10px; font-weight: bold; color: #162d45; border-bottom: 1px solid #e0e0e0;">Email:</td>
              <td style="padding: 10px; border-bottom: 1px solid #e0e0e0;"><a href="mailto:${email}">${email}</a></td>
            </tr>
            <tr style="background-color: #fff;">
              <td style="padding: 10px; font-weight: bold; color: #162d45; border-bottom: 1px solid #e0e0e0;">Phone:</td>
              <td style="padding: 10px; border-bottom: 1px solid #e0e0e0;">${phone}</td>
            </tr>
            <tr style="background-color: #fff;">
              <td style="padding: 10px; font-weight: bold; color: #162d45; border-bottom: 1px solid #e0e0e0;">Application Type:</td>
              <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; text-transform: capitalize;">${applicationType}</td>
            </tr>
            <tr style="background-color: #fff;">
              <td style="padding: 10px; font-weight: bold; color: #162d45; border-bottom: 1px solid #e0e0e0;">Preferred Course:</td>
              <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; text-transform: capitalize;">${preferredCourse}</td>
            </tr>
            <tr style="background-color: #fff;">
              <td style="padding: 10px; font-weight: bold; color: #162d45; border-bottom: 1px solid #e0e0e0;">Experience Level:</td>
              <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; text-transform: capitalize;">${experienceLevel}</td>
            </tr>
            <tr style="background-color: #fff;">
              <td style="padding: 10px; font-weight: bold; color: #162d45; border-bottom: 1px solid #e0e0e0;">Payment Status:</td>
              <td style="padding: 10px; border-bottom: 1px solid #e0e0e0;">
                <span style="background-color: #d4edda; color: #155724; padding: 5px 10px; border-radius: 4px; font-weight: bold;">
                  ${paymentStatus === "completed" ? "✓ COMPLETED" : "PENDING"}
                </span>
              </td>
            </tr>
          </table>

          <h3 style="color: #162d45; margin: 20px 0 10px 0; border-bottom: 2px solid #2cb5b5; padding-bottom: 10px;">
            About Candidate
          </h3>
          <p style="color: #333; font-size: 14px; line-height: 1.6; padding: 10px; background-color: #fff; border-left: 4px solid #2cb5b5;">
            ${aboutYourself.replace(/\n/g, "<br>")}
          </p>

          <h3 style="color: #162d45; margin: 20px 0 10px 0; border-bottom: 2px solid #2cb5b5; padding-bottom: 10px;">
            Passport Photo
          </h3>
          <p style="font-size: 14px; color: #333;">
            ${
              photoUrl &&
              photoUrl !== "Photo upload failed - check backend logs"
                ? `<img src="${photoUrl}" alt="Passport Photo" style="max-width: 200px; max-height: 250px; border: 2px solid #2cb5b5; border-radius: 4px;"><br><br><strong>Photo URL:</strong> <a href="${photoUrl}">${photoUrl}</a>`
                : `<span style="color: #d32f2f;">${photoUrl}</span>`
            }
          </p>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666;">
            <p style="margin: 0;">
              <strong>Submission Time:</strong> ${new Date().toLocaleString("en-IN")}
            </p>
            <p style="margin: 5px 0 0 0;">
              <strong>Amount Paid:</strong> ₹15,000
            </p>
          </div>
        </div>

        <div style="background-color: #162d45; color: white; padding: 15px; border-radius: 0 0 8px 8px; text-align: center; font-size: 12px;">
          <p style="margin: 0;">
            This is an automated email from Visiomatix Media Tech Reservation System
          </p>
        </div>
      </div>
    `;

    // Send email to admin
    console.log("Sending reservation email to admin:", RECEIVER_EMAIL);
    const { error: adminEmailError } = await resend.emails.send({
      from: SENDER_EMAIL,
      to: RECEIVER_EMAIL,
      subject: `🎉 New Seat Reservation - ${name} (${email})`,
      html: adminEmailHtml,
    });

    if (adminEmailError) {
      console.error("Email send error:", adminEmailError);
      // Log but don't fail the entire request if email fails
    }

    // Send confirmation email to candidate
    const candidateEmailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h2 style="color: #162d45; margin: 0;">Visiomatix Media Tech</h2>
          <p style="color: #666; margin: 5px 0;">Professional Career Development Programs</p>
        </div>

        <div style="background-color: #e8f5e9; border-left: 4px solid #4caf50; padding: 20px; border-radius: 4px; margin-bottom: 20px;">
          <h3 style="color: #2e7d32; margin-top: 0;">✓ Reservation Confirmed!</h3>
          <p>Dear <strong>${name}</strong>,</p>
          <p>Thank you for completing your payment of <strong>₹15,000</strong>. Your seat has been successfully reserved for the upcoming batch.</p>
        </div>

        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h3 style="color: #333; margin-top: 0;">Your Details</h3>
          <table style="width: 100%; font-size: 14px;">
            <tr>
              <td style="padding: 8px; font-weight: bold; color: #666;">Application Type:</td>
              <td style="padding: 8px; text-transform: capitalize;">${applicationType}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold; color: #666;">Preferred Course:</td>
              <td style="padding: 8px; text-transform: capitalize;">${preferredCourse}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold; color: #666;">Experience Level:</td>
              <td style="padding: 8px; text-transform: capitalize;">${experienceLevel}</td>
            </tr>
          </table>
        </div>

        <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; border-radius: 4px; margin-bottom: 20px;">
          <h4 style="color: #856404; margin-top: 0;">Next Steps:</h4>
          <ul style="color: #856404; padding-left: 20px; margin: 10px 0;">
            <li>Our team will review your application</li>
            <li>You'll receive a screening call within 2-3 business days</li>
            <li>Check your email regularly for updates</li>
          </ul>
        </div>

        <div style="text-align: center; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666;">
          <p>If you have any questions, feel free to contact us at <a href="mailto:info@visiomatix.in">info@visiomatix.in</a></p>
        </div>
      </div>
    `;

    const { error: candidateEmailError } = await resend.emails.send({
      from: SENDER_EMAIL,
      to: email,
      subject: "Your Seat Reservation is Confirmed - Visiomatix Media Tech",
      html: candidateEmailHtml,
    });

    if (candidateEmailError) {
      console.error("Candidate email send error:", candidateEmailError);
    }

    return res.status(200).json({
      success: true,
      message: "Reservation processed successfully",
      photoUrl,
    });
  } catch (error) {
    console.error("Reservation controller error:", error);
    return res.status(500).json({
      success: false,
      message: "Error processing reservation",
      error: error.message,
    });
  }
};

export default reservationController;
