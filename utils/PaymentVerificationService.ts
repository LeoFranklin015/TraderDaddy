import { HederaPaymentManager } from "./HederaPaymentManager";
import { placeTrade } from "./gmx";
import dotenv from "dotenv";

dotenv.config();

interface PaymentVerificationConfig {
  hederaNetwork: "mainnet" | "testnet";
  requiredConfirmations: number;
  verificationInterval: number; // in ms
  autoTradeEnabled: boolean;
}

interface DappPaymentRequest {
  id: string;
  amount: string;
  receiverAddress: string;
  dappUrl: string;
  tradingOptions?: {
    asset: string;
    leverage: string;
    isLong: boolean;
    positionSize: string;
    takeProfit?: string;
    stopLoss?: string;
  };
}

export class PaymentVerificationService {
  private hederaManager: HederaPaymentManager;
  private config: PaymentVerificationConfig;
  private pendingPayments: Map<string, DappPaymentRequest>;
  private checkInterval: NodeJS.Timeout | null;
  private privateKey: string;

  constructor(config: PaymentVerificationConfig) {
    this.hederaManager = new HederaPaymentManager(config.hederaNetwork);
    this.config = config;
    this.pendingPayments = new Map();
    this.checkInterval = null;
    this.privateKey = process.env.PRIVATE_KEY || "";
  }

  /**
   * Initialize the service
   */
  public async init(): Promise<boolean> {
    if (!this.privateKey) {
      console.error("No private key found in environment variables");
      return false;
    }

    const initSuccess = await this.hederaManager.init(this.privateKey);
    if (!initSuccess) {
      console.error("Failed to initialize Hedera payment manager");
      return false;
    }

    // Start monitoring pending payments
    this.startMonitoring();
    return true;
  }

  /**
   * Register a new payment request from a DApp
   */
  public async registerPaymentRequest(
    request: DappPaymentRequest
  ): Promise<boolean> {
    try {
      console.log(`Registering new payment request from ${request.dappUrl}`);
      console.log(
        `Payment details: ${request.amount} HBAR to ${request.receiverAddress}`
      );

      // Store the payment request
      this.pendingPayments.set(request.id, request);

      return true;
    } catch (error) {
      console.error("Error registering payment request:", error);
      return false;
    }
  }

  /**
   * Start monitoring for payments
   */
  private startMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(
      () => this.checkPendingPayments(),
      this.config.verificationInterval
    );

    console.log(
      `Payment monitoring started, checking every ${
        this.config.verificationInterval / 1000
      } seconds`
    );
  }

  /**
   * Check all pending payments
   */
  private async checkPendingPayments(): Promise<void> {
    console.log(`Checking ${this.pendingPayments.size} pending payments...`);

    for (const [id, request] of this.pendingPayments.entries()) {
      try {
        // Check if payment was received
        const receiverAddress = request.receiverAddress;
        const expectedAmount = request.amount;

        const payment = await this.hederaManager.checkPaymentReceived(
          receiverAddress,
          expectedAmount
        );

        if (payment && payment.status === "confirmed") {
          console.log(`✅ Payment for request ${id} confirmed!`);
          console.log(`Transaction: ${payment.txHash}`);

          // If auto-trade is enabled and trading options are provided
          if (this.config.autoTradeEnabled && request.tradingOptions) {
            await this.executeTrade(request.tradingOptions);
          }

          // Remove from pending payments
          this.pendingPayments.delete(id);
        }
      } catch (error) {
        console.error(`Error checking payment for request ${id}:`, error);
      }
    }
  }

  /**
   * Execute a trade on GMX using Arbitrum Sepolia
   */
  private async executeTrade(
    options: DappPaymentRequest["tradingOptions"]
  ): Promise<void> {
    if (!options) return;

    try {
      console.log(`Executing trade on GMX...`);
      console.log(
        `Asset: ${options.asset}, Position Size: ${options.positionSize}, Leverage: ${options.leverage}`
      );

      const result = await placeTrade(
        this.privateKey,
        "ETH", // Native token
        options.asset,
        "421614", // Arbitrum Sepolia
        options.leverage,
        options.positionSize,
        options.takeProfit || "",
        options.stopLoss || "",
        options.isLong
      );

      console.log(
        `Trade executed successfully! Transaction hash: ${result.hash}`
      );
    } catch (error) {
      console.error("Failed to execute trade:", error);
    }
  }

  /**
   * Stop the monitoring service
   */
  public stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log("Payment verification service stopped");
    }
  }

  /**
   * Get all pending payment requests
   */
  public getPendingPayments(): DappPaymentRequest[] {
    return Array.from(this.pendingPayments.values());
  }
}
