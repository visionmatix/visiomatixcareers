import express from "express";
import paymentController from "./controller/paymentController.js";
import { getKeyController } from "./controller/getKeyController.js";
import { verifyController } from "./controller/verifyController.js";
import reservationController from "./controller/reservationController.js";

const router = express.Router();

router.post("/payment", paymentController);
router.get("/getapikey", getKeyController);
router.post("/verify", verifyController);
router.post("/reservation", reservationController);

export default router;
