import mongoose from "mongoose";

const paymentHistorySchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: true,
  },
  paymentDate: {
    type: Date,
    default: Date.now,
  },
  invoiceNumber: {
    type: String,
    sparse: true,
  },
  invoiceUrl: {
    type: String,
  },
  paymentMethod: {
    type: String,
    enum: ["razorpay", "manual"],
    default: "razorpay",
  },
  transactionId: {
    type: String,
  },
  status: {
    type: String,
    enum: ["pending", "completed", "failed"],
    default: "completed",
  },
});

const studentSchema = new mongoose.Schema(
  {
    studentId: {
      type: String,
      required: true,
      unique: true,
      sparse: true,
      index: true,
    },
    studentName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      sparse: true,
      index: true,
    },

    phone: {
      type: String,
      default: "",
      required: true,
      
    },
    city: {
      type: String,
      default: "",
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    passwordChangedByStudent: {
      type: Boolean,
      default: false,
    },
    courseName: {
      type: String,
      required: true,
      enum: ["Courses", "Web Developer", "UI/UX Designer", "Fullstack Developer", "Graphic Designer", "Artificial Intelligence", "Software Testing & Quality Assurance", "Cloud Computing & Hosting Management", "App Development (IOS & Android)"],
    },
    profileImageUrl: {
      type: String,
      default: "",
    },
    totalFees: {
      type: Number,
      default: 50000, // Total fees in paise for INR
    },
    seatBooking: {
      type: Number,
      default: 15000, // Seat booking amount
    },
    remainingFees: {
      type: Number,
      default: 35000, // Remaining fees
    },
    paidAmount: {
      type: Number,
      default: 0,
    },
    pendingAmount: {
      type: Number,
      default: 50000,
    },
    paymentHistory: [paymentHistorySchema],
    enrollmentDate: {
      type: Date,
      default: Date.now,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.model("Student", studentSchema);
