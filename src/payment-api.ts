import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import { PaymentVerificationService } from "../utils/PaymentVerificationService";
import dotenv from "dotenv";

dotenv.config();

// Initialize the payment verification service
const paymentService = new PaymentVerificationService({
  hederaNetwork: (process.env.HEDERA_NETWORK || "testnet") as
    | "mainnet"
    | "testnet",
  requiredConfirmations: parseInt(process.env.REQUIRED_CONFIRMATIONS || "1"),
  verificationInterval: parseInt(process.env.VERIFICATION_INTERVAL || "30000"),
  autoTradeEnabled: process.env.AUTO_TRADE_ENABLED === "true",
});

// Initialize express app
const app = express();
app.use(cors());
app.use(bodyParser.json());

// Initialize the service
async function initService() {
  const initialized = await paymentService.init();
  if (!initialized) {
    console.error("Failed to initialize payment verification service");
    process.exit(1);
  }
  console.log("Payment verification service initialized successfully");
}

// API routes
app.post("/api/register-payment", async (req, res) => {
  try {
    const { id, amount, receiverAddress, dappUrl, tradingOptions } = req.body;

    if (!id || !amount || !receiverAddress || !dappUrl) {
      return res.status(400).json({
        success: false,
        message: "Missing required parameters",
      });
    }

    const registered = await paymentService.registerPaymentRequest({
      id,
      amount,
      receiverAddress,
      dappUrl,
      tradingOptions,
    });

    if (registered) {
      return res.status(200).json({
        success: true,
        message: "Payment request registered successfully",
        paymentRequest: {
          id,
          amount,
          receiverAddress,
          dappUrl,
        },
      });
    } else {
      return res.status(500).json({
        success: false,
        message: "Failed to register payment request",
      });
    }
  } catch (error) {
    console.error("Error in register-payment endpoint:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Get all pending payments
app.get("/api/pending-payments", (req, res) => {
  try {
    const pendingPayments = paymentService.getPendingPayments();
    return res.status(200).json({
      success: true,
      pendingPayments,
    });
  } catch (error) {
    console.error("Error in pending-payments endpoint:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Payment verification service is running",
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Payment verification server running on port ${PORT}`);

  // Initialize the service
  initService();
});

export default app;
