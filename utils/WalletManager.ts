import pkg from "whatsapp-web.js";
const { Client } = pkg;
import type { Client as WhatsAppClient, Message } from "whatsapp-web.js";
import { privateKeyToAccount, type Account } from "viem/accounts";
import { createWalletClient, type WalletClient, http, Chain } from "viem";
import { hederaTestnet, arbitrumSepolia } from "viem/chains";
import SignClient from "@walletconnect/sign-client";
import { SessionTypes, SignClientTypes } from "@walletconnect/types";
import { ethers } from "ethers";

interface ChatWallet {
  account: Account;
  clients: Map<number, WalletClient>; // Map chainId to client
  wcSessions: Map<string, SessionTypes.Struct>;
}

interface PendingRequest {
  chatId: string;
  messageId: string;
  type: "transaction";
  data: any;
}

interface EVMNamespace {
  chains?: string[];
  methods?: string[];
  events?: string[];
}

interface RequiredNamespaces {
  eip155?: EVMNamespace;
  [key: string]: EVMNamespace | undefined;
}

// Supported chains configuration
const SUPPORTED_CHAINS = {
  296: hederaTestnet,
  421614: arbitrumSepolia,
} as const;

// For compatibility with dApps that don't natively support Hedera or Arbitrum Sepolia
const CHAIN_MAPPING: Record<number, number> = {
  // Map common chains to Hedera Testnet
  1: 296, // Ethereum -> Hedera Testnet
  42161: 421614, // Arbitrum -> Arbitrum Sepolia
  137: 296, // Polygon -> Hedera Testnet
  10: 421614, // Optimism -> Arbitrum Sepolia
  56: 296, // BSC -> Hedera Testnet
  43114: 296, // Avalanche -> Hedera Testnet
};

type SupportedChainId = keyof typeof SUPPORTED_CHAINS;

export class WalletManager {
  private chatWallets: Map<string, ChatWallet>;
  private client: WhatsAppClient;
  private signClient: SignClient | null;
  private pendingRequests: Map<string, PendingRequest>;
  private lastPairedChatId: string | null;

  constructor(client: WhatsAppClient) {
    this.chatWallets = new Map();
    this.client = client;
    this.signClient = null;
    this.pendingRequests = new Map();
    this.lastPairedChatId = null;
    this.initializeWalletConnect();
  }

  private async initializeWalletConnect() {
    try {
      this.signClient = await SignClient.init({
        projectId: process.env.WALLETCONNECT_PROJECT_ID as string,
        metadata: {
          name: "WhatsApp Web3 Bot",
          description: "A WhatsApp bot for Web3 interactions",
          url: "https://your-website.com",
          icons: ["https://your-website.com/icon.png"],
        },
      });

      // Setup event listeners after successful initialization
      this.setupEventListeners();
      console.log("WalletConnect initialized and listeners set up");
    } catch (error) {
      console.error("Failed to initialize WalletConnect:", error);
    }
  }

  private setupEventListeners() {
    if (!this.signClient) {
      console.error("Cannot setup listeners: SignClient not initialized");
      return;
    }

    console.log("Setting up WalletConnect event listeners");

    this.signClient.on("session_proposal", async (event) => {
      console.log("Received session proposal:", event);
      await this.handleSessionProposal(event);
    });

    this.signClient.on("session_request", async (event) => {
      console.log("Received session request:", event);
      await this.handleSessionRequest(event);
    });

    this.signClient.on("session_delete", async (event) => {
      console.log("Received session delete:", event);
      await this.handleSessionDelete(event);
    });

    this.client.on("message_reaction", async (event) => {
      console.log("Received message reaction:", event);
      await this.handleReaction(event);
    });
  }

  public getChatWallet(chatId: string): ChatWallet {
    if (!this.chatWallets.has(chatId)) {
      // Generate deterministic private key from chatId
      const hashedChatId = ethers.keccak256(ethers.toUtf8Bytes(chatId));
      const privateKey = hashedChatId.slice(2) as `0x${string}`;
      const account = privateKeyToAccount(`0x${privateKey}`);

      this.chatWallets.set(chatId, {
        account,
        clients: new Map(), // Initialize empty clients map
        wcSessions: new Map(),
      });
    }

    return this.chatWallets.get(chatId)!;
  }

  public getWalletClient(chatId: string, chainId: number): WalletClient {
    const chatWallet = this.getChatWallet(chatId);

    if (!chatWallet.clients.has(chainId)) {
      // Check if chain is supported
      const chain = SUPPORTED_CHAINS[chainId as SupportedChainId];
      if (!chain) {
        throw new Error(
          `Chain ID ${chainId} is not supported. Supported chains: ${Object.keys(
            SUPPORTED_CHAINS
          ).join(", ")}`
        );
      }

      // Create new client for this chain
      const client = createWalletClient({
        account: chatWallet.account,
        chain,
        transport: http(),
      });

      chatWallet.clients.set(chainId, client);
    }

    return chatWallet.clients.get(chainId)!;
  }

  public async handleWalletConnectUri(message: Message) {
    if (!this.signClient) {
      await message.reply(
        "WalletConnect is not initialized. Please try again later."
      );
      return;
    }

    try {
      const uri = message.body.trim();
      const chatWallet = this.getChatWallet(message.from);
      this.lastPairedChatId = message.from;

      console.log("Attempting to pair with URI:", uri);
      await this.signClient.pair({ uri });
      console.log("Pairing successful");

      await message.reply(
        "🔗 *WalletConnect Pairing*\n\n" + "Connecting to dApp... Please wait."
      );
    } catch (error) {
      console.error("Failed to handle WalletConnect URI:", error);
      await message.reply(
        "Invalid WalletConnect URI. Please try again with a valid URI."
      );
    }
  }

  private async handleSessionProposal(
    event: SignClientTypes.EventArguments["session_proposal"]
  ) {
    try {
      console.log("Handling session proposal:", event);
      const { id, params } = event;
      const { proposer, requiredNamespaces, optionalNamespaces } = params;

      const chatId = this.lastPairedChatId;
      if (!chatId) {
        console.error("No chat ID found for session proposal");
        return;
      }

      const chatWallet = this.getChatWallet(chatId);
      console.log("Chat wallet address:", chatWallet.account.address);

      // Prepare the response namespaces
      const responseNamespaces: Record<string, any> = {};

      // Handle both required and optional EVM namespaces
      const handleNamespace = (namespace: EVMNamespace, chains: string[]) => {
        // Map requested chains to supported Hedera chain
        const mappedChains = chains
          .map((chain) => {
            const requestedChainId = parseInt(chain.split(":")[1]);
            if (requestedChainId in SUPPORTED_CHAINS) {
              return chain; // Already supported
            } else if (requestedChainId in CHAIN_MAPPING) {
              const mappedChainId = CHAIN_MAPPING[requestedChainId];
              console.log(
                `Mapping chain ${requestedChainId} to Hedera ${mappedChainId}`
              );
              return `eip155:${mappedChainId}`;
            }
            return null;
          })
          .filter(Boolean) as string[];

        // If no chains are supported and none can be mapped, default to Hedera testnet
        if (mappedChains.length === 0) {
          console.log(
            `No supported chains found, defaulting to Hedera testnet`
          );
          mappedChains.push(`eip155:296`);
        }

        return {
          accounts: mappedChains.map(
            (chain) => `${chain}:${chatWallet.account.address}`
          ),
          methods: namespace.methods ?? [
            "eth_sendTransaction",
            "eth_signTransaction",
            "eth_sign",
            "personal_sign",
            "eth_signTypedData",
          ],
          events: namespace.events ?? ["chainChanged", "accountsChanged"],
        };
      };

      // Process required namespaces
      if (Object.keys(requiredNamespaces).length > 0) {
        for (const [chain, namespace] of Object.entries(requiredNamespaces)) {
          if (chain.startsWith("eip155")) {
            const chains = namespace.chains ?? [`${chain}:1`];
            responseNamespaces[chain] = handleNamespace(namespace, chains);
          }
        }
      }

      // Process optional namespaces if no required ones
      if (
        Object.keys(responseNamespaces).length === 0 &&
        optionalNamespaces?.eip155
      ) {
        const chains =
          optionalNamespaces.eip155.chains ??
          Object.keys(SUPPORTED_CHAINS).map((id) => `eip155:${id}`);
        responseNamespaces.eip155 = handleNamespace(
          optionalNamespaces.eip155,
          chains
        );
      }

      console.log("Response namespaces:", responseNamespaces);

      // Automatically approve the session
      const { acknowledged, topic } = await this.signClient!.approve({
        id: event.id,
        namespaces: responseNamespaces,
      });

      await acknowledged();
      console.log("Session approved with topic:", topic);

      const session = this.signClient!.session.get(topic);
      chatWallet.wcSessions.set(topic, session);

      // Send confirmation message with supported chains
      const supportedChainsMsg = `• ${hederaTestnet.name} (296)`;

      await this.client.sendMessage(
        chatId,
        "✅ *WalletConnect Connected Successfully*\n\n" +
          `*App:* ${proposer.metadata.name}\n` +
          `*URL:* ${proposer.metadata.url}\n` +
          `*Description:* ${proposer.metadata.description}\n\n` +
          `*Connected Address:* ${chatWallet.account.address}\n\n` +
          "*Supported Network:*\n" +
          supportedChainsMsg +
          "\n\n" +
          "You can now interact with the dApp. Any transaction or signature requests will require your approval."
      );
    } catch (error) {
      console.error("Error handling session proposal:", error);
      if (this.lastPairedChatId) {
        await this.client.sendMessage(
          this.lastPairedChatId,
          "❌ *Error*\n\nFailed to process the connection request. " +
            (error instanceof Error ? error.message : String(error))
        );
      }
    }
  }

  private async handleSessionRequest(
    event: SignClientTypes.EventArguments["session_request"]
  ) {
    try {
      const { topic, params } = event;
      const { request, chainId } = params;
      const session = this.signClient?.session.get(topic);

      if (!session) return;

      const chatId = this.findChatIdForSession(topic);
      if (!chatId) return;

      let messageText = "📝 *New Transaction Request*\n\n";

      if (request.method === "eth_sendTransaction") {
        const tx = request.params[0] as {
          to: string;
          value?: string;
          data?: string;
        };
        messageText += `*To:* ${tx.to}\n`;
        messageText += `*Value:* ${
          tx.value
            ? (BigInt(tx.value) / BigInt("1000000000000000000")).toString()
            : "0"
        } ETH\n`;
        messageText += `*Data:* ${tx.data ? "Yes" : "No"}\n\n`;
      } else if (request.method === "eth_signTypedData") {
        messageText = "📝 *New Signature Request*\n\n";
        messageText += `*Type:* Sign Typed Data\n`;
      } else if (request.method === "personal_sign") {
        messageText = "📝 *New Signature Request*\n\n";
        messageText += `*Type:* Personal Sign\n`;
      }

      messageText += "• React with 👍 to approve\n• React with 👎 to reject";

      const message = await this.client.sendMessage(chatId, messageText);

      this.pendingRequests.set(message.id._serialized, {
        chatId,
        messageId: message.id._serialized,
        type: "transaction",
        data: { request: event },
      });
    } catch (error) {
      console.error("Error handling session request:", error);
    }
  }

  public async handleSessionDelete(event: { topic: string }) {
    try {
      const chatId = this.findChatIdForSession(event.topic);
      if (!chatId) {
        console.error("No chat ID found for session:", event.topic);
        return;
      }

      const chatWallet = this.getChatWallet(chatId);
      chatWallet.wcSessions.delete(event.topic);

      if (this.signClient) {
        await this.signClient.disconnect({
          topic: event.topic,
          reason: {
            code: 6000,
            message: "User disconnected",
          },
        });
      }

      console.log("Session deleted successfully:", event.topic);
    } catch (error) {
      console.error("Error handling session delete:", error);
    }
  }

  private async handleReaction(reaction: any) {
    try {
      console.log("Processing reaction:", reaction);

      const messageId = reaction.msgId._serialized;
      const chatId = reaction.msgId.remote;
      const emoji = reaction.reaction;

      console.log("Looking for pending request with:", {
        messageId,
        chatId,
        emoji,
      });

      const pendingRequest = this.pendingRequests.get(messageId);

      if (!pendingRequest) {
        console.log("No pending request found for message ID:", messageId);
        return;
      }

      if (pendingRequest.chatId !== chatId) {
        console.log("Chat ID mismatch:", {
          expected: pendingRequest.chatId,
          received: chatId,
        });
        return;
      }

      console.log("Found pending request:", pendingRequest);

      if (emoji === "👍") {
        if (pendingRequest.type === "transaction") {
          console.log("Processing transaction request:", pendingRequest.data);
          const { request } = pendingRequest.data;

          // Extract chainId from the request
          const requestedChainId = parseInt(
            request.params.chainId.split(":")[1]
          );

          // Map to Hedera testnet if needed
          const chainId =
            requestedChainId in SUPPORTED_CHAINS ? requestedChainId : 296; // Always use Hedera testnet

          try {
            // Get the appropriate wallet client for this chain
            const walletClient = this.getWalletClient(chatId, chainId);
            const chain = SUPPORTED_CHAINS[chainId as SupportedChainId];

            if (request.params.request.method === "eth_sendTransaction") {
              const tx = request.params.request.params[0];
              console.log("Original transaction:", tx);

              const preparedTx = {
                ...tx,
                gas: undefined,
                value: tx.value ? BigInt(tx.value) : undefined,
              };

              console.log("Prepared transaction:", preparedTx);

              const hash = await walletClient.sendTransaction(preparedTx);
              console.log("Transaction hash:", hash);

              await this.signClient?.respond({
                topic: request.topic,
                response: {
                  id: request.id,
                  jsonrpc: "2.0",
                  result: hash,
                },
              });

              // Get block explorer URL
              const explorerUrl = chain.blockExplorers?.default
                ? `${chain.blockExplorers.default.url}/tx/${hash}`
                : null;

              await this.client.sendMessage(
                chatId,
                "✅ *Transaction Sent*\n\n" +
                  `*Network:* ${chain.name}\n` +
                  `*Transaction Hash:* \`${hash}\`\n` +
                  (explorerUrl ? `*View on Explorer:* ${explorerUrl}\n` : "") +
                  "\nYour transaction has been signed and sent!"
              );
            } else if (request.params.request.method === "eth_signTypedData") {
              console.log("Signing typed data");
              const signature = await walletClient.signTypedData(
                request.params.request.params
              );

              await this.signClient?.respond({
                topic: request.topic,
                response: {
                  id: request.id,
                  jsonrpc: "2.0",
                  result: signature,
                },
              });

              await this.client.sendMessage(
                chatId,
                "✅ *Message Signed*\n\n" +
                  `*Network:* ${chain.name}\n` +
                  `*Signature:* \`${signature}\`\n\n` +
                  "Your message has been signed successfully!"
              );
            }
          } catch (error) {
            console.error("Transaction/signing error:", error);

            let errorMessage = "Transaction failed. ";
            if (error instanceof Error) {
              errorMessage += error.message.split("\n")[0];
            } else {
              errorMessage += String(error);
            }

            await this.client.sendMessage(
              chatId,
              "❌ *Transaction Failed*\n\n" + errorMessage
            );
            return;
          }
        }
      } else if (emoji === "👎") {
        if (pendingRequest.type === "transaction") {
          await this.signClient?.respond({
            topic: pendingRequest.data.request.topic,
            response: {
              id: pendingRequest.data.request.id,
              jsonrpc: "2.0",
              error: { code: 4001, message: "User rejected" },
            },
          });

          await this.client.sendMessage(
            chatId,
            "❌ *Request Rejected*\n\nYou have rejected the request."
          );
        }
      }

      this.pendingRequests.delete(messageId);
    } catch (error) {
      console.error("Error handling reaction:", error);
      const chatId = reaction.msgId.remote;
      await this.client.sendMessage(
        chatId,
        "❌ *Error*\n\n" +
          "Something went wrong while processing your request.\n" +
          "Error: " +
          (error instanceof Error
            ? error.message.split("\n")[0]
            : String(error))
      );
    }
  }

  private findChatIdForSession(sessionId: string): string | null {
    for (const [chatId, wallet] of this.chatWallets.entries()) {
      if (wallet.wcSessions.has(sessionId)) {
        return chatId;
      }
    }
    return null;
  }

  public async getWalletAddress(chatId: string): Promise<string> {
    const wallet = this.getChatWallet(chatId);
    return wallet.account.address;
  }
}
