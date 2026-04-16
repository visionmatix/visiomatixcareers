import Razorpay from "razorpay";
import "dotenv/config";

var instance = new Razorpay({
  key_id: process.env.RAZOR_PAY_API,
  key_secret: process.env.RAZORPAY_SECRET,
});

const paymentController = async (req, res) => {
  const { amount } = req.body;

  if (!amount) {
    return res.status(400).json({ error: "Amount is required" });
  }

  if (!process.env.RAZOR_PAY_API || !process.env.RAZORPAY_SECRET) {
    console.error("Razorpay credentials not configured");
    return res.status(500).json({ error: "Payment service not configured" });
  }

  const options = {
    amount: Number(amount) * 100,
    currency: "INR",
  };

  try {
    const order = await instance.orders.create(options);
    return res.status(200).json({
      success: true,
      order: order,
    });
  } catch (e) {
    console.error("Payment order creation error:", e);
    return res.status(500).json({
      error: "Failed to create payment order. Please try again.",
    });
  }
};

export default paymentController;
