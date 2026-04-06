import { Currency } from "lucide-react";
import Razorpay from "razorpay";
import "dotenv/config"


var instance = new Razorpay({
  key_id:process.env.RAZOR_PAY_API ,
  key_secret: process.env.RAZORPAY_SECRET,
});

const paymentController = async (req, res) => {
  const options = {
    amount: Number(req.body.amount*100),
    currency: "INR",
  };
  try {
    const order = await instance.orders.create(options);
    return res.status(200).json({
      sucess: true,
      order: order,
    });
  } catch (e) {
    return res.status(500).json({
      error: e,
    });
  }
};

export default paymentController;
