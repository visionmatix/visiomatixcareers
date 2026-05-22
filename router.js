import express from "express";
import paymentController from "./controller/paymentController.js";
import { getKeyController } from "./controller/getKeyController.js";
import { verifyController, forgotPasswordController } from "./controller/verifyController.js";
import reservationController from "./controller/reservationController.js";
import sendEmailController from "./controller/sendEmailController.js";

const router = express.Router();

router.post("/payment", paymentController);
router.get("/getapikey", getKeyController);
router.post("/verify", verifyController);
// router.post("/forgot-password", forgotPasswordController);
router.post("/auth/forgot-password", forgotPasswordController);
router.post("/reservation", reservationController);
router.post("/api/send-email", sendEmailController);

export default router;
