import { ethers } from "ethers";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hederaTestnet, hedera } from "viem/chains";

// Hedera network configuration
const HEDERA_NETWORKS = {
  mainnet: {
    chainId: 30,
    chain: hedera,
    rpcUrl: "https://public-node.rsk.co",
    blockExplorer: "https://explorer.rsk.co",
  },
  testnet: {
    chainId: 31,
    chain: hederaTestnet,
    rpcUrl: "https://public-node.testnet.rsk.co",
    blockExplorer: "https://explorer.testnet.rsk.co",
  },
};

// Interface for payment details
interface PaymentDetails {
  id: string;
  amount: string;
  from: string;
  to: string;
  timestamp: number;
  status: "pending" | "confirmed" | "failed";
  txHash?: string;
  confirmations?: number;
}

interface PaymentConfirmationOptions {
  requiredConfirmations?: number;
  timeout?: number;
}

interface Transaction {
  to: string;
  from: string;
  value: bigint;
  hash: string;
}

export class HederaPaymentManager {
  private provider: ethers.JsonRpcProvider;
  private wallet?: ethers.Wallet;
  private privateKey?: string;
  private network: "mainnet" | "testnet";
  private payments: Map<string, PaymentDetails>;

  constructor(network: "mainnet" | "testnet" = "testnet") {
    this.network = network;
    this.provider = new ethers.JsonRpcProvider(HEDERA_NETWORKS[network].rpcUrl);
    this.payments = new Map();
  }

  /**
   * Initialize the payment manager with a private key
   */
  public async init(privateKey: string): Promise<boolean> {
    try {
      this.privateKey = privateKey;
      this.wallet = new ethers.Wallet(privateKey, this.provider);

      // Validate connection
      const address = await this.wallet.getAddress();
      const balance = await this.provider.getBalance(address);

      console.log(`Initialized Hedera wallet: ${address}`);
      console.log(`Wallet balance: ${ethers.formatEther(balance)} RBTC`);

      return true;
    } catch (error) {
      console.error("Failed to initialize Hedera payment manager:", error);
      return false;
    }
  }

  /**
   * Get the wallet address
   */
  public async getWalletAddress(): Promise<string | null> {
    if (!this.wallet) return null;
    return await this.wallet.getAddress();
  }

  /**
   * Process a wallet-to-wallet transfer on Hedera
   */
  public async transferFunds(
    to: string,
    amount: string,
    memo?: string
  ): Promise<string> {
    if (!this.wallet) {
      throw new Error("Wallet not initialized. Call init() first.");
    }

    try {
      // Parse amount to ethers format
      const amountInWei = ethers.parseEther(amount);

      // Create transaction
      const tx = await this.wallet.sendTransaction({
        to,
        value: amountInWei,
        // Add memo to data field if provided
        data: memo ? ethers.hexlify(ethers.toUtf8Bytes(memo)) : undefined,
      });

      console.log(`Transaction sent: ${tx.hash}`);

      // Store payment details
      const paymentId = `payment_${Date.now()}`;
      const payment: PaymentDetails = {
        id: paymentId,
        amount,
        from: await this.wallet.getAddress(),
        to,
        timestamp: Date.now(),
        status: "pending",
        txHash: tx.hash,
      };

      this.payments.set(paymentId, payment);

      return paymentId;
    } catch (error) {
      console.error("Failed to transfer funds:", error);
      throw new Error(
        `Failed to transfer funds: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Monitor a transaction and wait for confirmation
   */
  public async waitForConfirmation(
    paymentId: string,
    options: PaymentConfirmationOptions = {}
  ): Promise<PaymentDetails> {
    const payment = this.payments.get(paymentId);
    if (!payment) {
      throw new Error(`Payment with ID ${paymentId} not found`);
    }

    if (!payment.txHash) {
      throw new Error(`Payment ${paymentId} has no transaction hash`);
    }

    const requiredConfirmations = options.requiredConfirmations || 1;
    const timeout = options.timeout || 300000; // Default 5 minutes timeout

    try {
      console.log(`Waiting for ${requiredConfirmations} confirmations...`);

      const receipt = await this.provider.waitForTransaction(
        payment.txHash,
        requiredConfirmations,
        timeout
      );

      if (receipt && receipt.status === 1) {
        const updatedPayment = {
          ...payment,
          status: "confirmed" as const,
          confirmations: requiredConfirmations,
        };

        this.payments.set(paymentId, updatedPayment);
        console.log(
          `Payment ${paymentId} confirmed with ${requiredConfirmations} confirmations`
        );

        return updatedPayment;
      } else {
        const updatedPayment = {
          ...payment,
          status: "failed" as const,
        };

        this.payments.set(paymentId, updatedPayment);
        throw new Error(`Transaction failed or reverted`);
      }
    } catch (error) {
      const updatedPayment = {
        ...payment,
        status: "failed" as const,
      };

      this.payments.set(paymentId, updatedPayment);
      throw error;
    }
  }

  /**
   * Check if a payment has been received at a specific address
   */
  public async checkPaymentReceived(
    address: string,
    expectedAmount: string,
    fromBlock: number = 0
  ): Promise<PaymentDetails | null> {
    try {
      const amountWei = ethers.parseEther(expectedAmount);

      // Get recent transactions to the address
      const blockNumber = await this.provider.getBlockNumber();
      const startBlock = fromBlock || blockNumber - 1000; // Last 1000 blocks if not specified

      console.log(
        `Checking for payment of ${expectedAmount} RBTC to ${address}...`
      );
      console.log(`Scanning blocks from ${startBlock} to ${blockNumber}`);

      // Loop through blocks to find matching transaction
      for (let i = blockNumber; i >= startBlock; i--) {
        const block = await this.provider.getBlock(i, true);

        if (!block || !block.transactions) continue;

        for (const transaction of block.transactions) {
          // Cast the transaction to our Transaction interface
          const tx = transaction as unknown as Transaction;

          if (
            tx.to?.toLowerCase() === address.toLowerCase() &&
            tx.value >= amountWei
          ) {
            const paymentId = `received_${tx.hash}`;

            const payment: PaymentDetails = {
              id: paymentId,
              amount: ethers.formatEther(tx.value),
              from: tx.from,
              to: tx.to,
              timestamp: (block.timestamp || Date.now() / 1000) * 1000, // Convert to milliseconds
              status: "confirmed",
              txHash: tx.hash,
              confirmations: blockNumber - i + 1,
            };

            this.payments.set(paymentId, payment);

            console.log(`Found matching payment in transaction ${tx.hash}`);
            return payment;
          }
        }
      }

      console.log(`No matching payment found`);
      return null;
    } catch (error) {
      console.error("Error checking for received payment:", error);
      throw error;
    }
  }

  /**
   * Get payment details
   */
  public getPayment(paymentId: string): PaymentDetails | null {
    return this.payments.get(paymentId) || null;
  }

  /**
   * Get explorer URL for a transaction
   */
  public getExplorerUrl(txHash: string): string {
    return `${HEDERA_NETWORKS[this.network].blockExplorer}/tx/${txHash}`;
  }
}
