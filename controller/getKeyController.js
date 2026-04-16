import "dotenv/config";

export const getKeyController = async (req, res) => {
  if (!process.env.RAZOR_PAY_API) {
    console.error("Razorpay API key not configured");
    return res.status(500).json({ error: "Razorpay API key not configured" });
  }

  return res.status(200).json({
    success: true,
    key: process.env.RAZOR_PAY_API,
  });
};
