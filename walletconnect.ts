import SignClient from "@walletconnect/sign-client";
import { SessionTypes } from "@walletconnect/types";
import { getSdkError } from "@walletconnect/utils";
import { ethers } from "ethers";

class WalletConnectManager {
  private client: SignClient | null = null;
  private sessions: Map<string, SessionTypes.Struct> = new Map();

  async initialize() {
    if (!process.env.WALLETCONNECT_PROJECT_ID) {
      throw new Error(
        "WalletConnect Project ID not found in environment variables"
      );
    }

    this.client = await SignClient.init({
      projectId: process.env.WALLETCONNECT_PROJECT_ID,
      metadata: {
        name: "TraderDaddy Bot",
        description: "WhatsApp Web3 Trading Assistant",
        url: "https://traderdaddy.com",
        icons: ["https://your-icon-url.com/icon.png"],
      },
    });
  }

  private pendingApprovals = new Map<string, Promise<SessionTypes.Struct>>();

  async createSession(chatId: string): Promise<string> {
    if (!this.client) throw new Error("WalletConnect client not initialized");

    const { uri, approval } = await this.client.connect({
      requiredNamespaces: {
        eip155: {
          methods: [
            "eth_sendTransaction",
            "eth_signTransaction",
            "eth_sign",
            "personal_sign",
            "eth_signTypedData",
          ],
          chains: ["eip155:1"], // Add more chains as needed
          events: ["chainChanged", "accountsChanged"],
        },
      },
    });

    if (!uri) throw new Error("Failed to generate connection URI");

    // Store the approval promise with chat ID
    this.pendingApprovals.set(chatId, approval());

    return uri;
  }

  async handleSessionApproval(chatId: string): Promise<SessionTypes.Struct> {
    const approval = this.pendingApprovals.get(chatId);
    if (!approval) throw new Error("No pending session approval found");

    try {
      const session = await approval;
      this.sessions.set(chatId, session);
      this.pendingApprovals.delete(chatId);
      return session;
    } catch (error) {
      this.pendingApprovals.delete(chatId);
      throw error;
    }
  }

  async signMessage(chatId: string, message: string): Promise<string> {
    if (!this.client) throw new Error("WalletConnect client not initialized");

    const session = this.sessions.get(chatId);
    if (!session) throw new Error("No active session found");

    const account = session.namespaces.eip155.accounts[0].split(":")[2];

    try {
      const signature = await this.client.request({
        topic: session.topic,
        chainId: "eip155:1",
        request: {
          method: "personal_sign",
          params: [ethers.hexlify(ethers.toUtf8Bytes(message)), account],
        },
      });

      return signature as string;
    } catch (error) {
      console.error("Error signing message:", error);
      throw error;
    }
  }

  async signTransaction(chatId: string, transaction: any): Promise<string> {
    if (!this.client) throw new Error("WalletConnect client not initialized");

    const session = this.sessions.get(chatId);
    if (!session) throw new Error("No active session found");

    try {
      const signature = await this.client.request({
        topic: session.topic,
        chainId: "eip155:1",
        request: {
          method: "eth_signTransaction",
          params: [transaction],
        },
      });

      return signature as string;
    } catch (error) {
      console.error("Error signing transaction:", error);
      throw error;
    }
  }

  async disconnect(chatId: string) {
    if (!this.client) throw new Error("WalletConnect client not initialized");

    const session = this.sessions.get(chatId);
    if (!session) return;

    await this.client.disconnect({
      topic: session.topic,
      reason: getSdkError("USER_DISCONNECTED"),
    });

    this.sessions.delete(chatId);
  }

  isConnected(chatId: string): boolean {
    return this.sessions.has(chatId);
  }

  getSession(chatId: string): SessionTypes.Struct | undefined {
    return this.sessions.get(chatId);
  }
}

export const walletConnectManager = new WalletConnectManager();
