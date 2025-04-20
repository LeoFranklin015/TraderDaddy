import process from "node:process";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent, ToolNode } from "@langchain/langgraph/prebuilt";
import { HumanMessage } from "@langchain/core/messages";
import { HederaAgentKit, createHederaTools } from "hedera-agent-kit";
import { ChatOpenAI } from "@langchain/openai";
import * as dotenv from "dotenv";
import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;
import qrcode from "qrcode-terminal";
import { walletConnectManager } from "./walletconnect.js";

// Load environment variables
dotenv.config();

// Create a new WhatsApp client instance
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    timeout: 60000,
  },
});

// Create OpenAI LLM instance
const llm = new ChatOpenAI({
  modelName: "gpt-4o-mini",
  temperature: 0.7,
  maxTokens: 1000,
});

// Initialize Hedera client with account ID and private key from environment variables
const hederaAgentKit = new HederaAgentKit(
  process.env.HEDERA_ACCOUNT_ID!,
  process.env.HEDERA_ACCOUNT_PRIVATE_KEY!,
  process.env.HEDERA_ACCOUNT_PUBLIC_KEY!,
  "testnet"
);
const hederaAgentKitTools = createHederaTools(hederaAgentKit);

const toolsNode = new ToolNode(hederaAgentKitTools);

const checkpointSaver = new MemorySaver();

const agent = createReactAgent({
  llm,
  tools: toolsNode,
  checkpointSaver,
});

// Command handlers
type CommandHandler = (message: any) => Promise<string>;
type CommandHandlers = {
  [key: string]: CommandHandler;
};

const commandHandlers: CommandHandlers = {
  "/connect": async (message: any) => {
    try {
      if (walletConnectManager.isConnected(message.from)) {
        return "You're already connected to a wallet. Use /disconnect first to connect to a different wallet.";
      }

      const uri = await walletConnectManager.createSession(message.from);

      // Generate QR code for the URI
      return `Scan this QR code with your Web3 wallet to connect:\n\n${uri}`;
    } catch (error) {
      console.error("Error creating WalletConnect session:", error);
      return "Sorry, there was an error creating the wallet connection.";
    }
  },

  "/disconnect": async (message: any) => {
    try {
      await walletConnectManager.disconnect(message.from);
      return "Wallet disconnected successfully.";
    } catch (error) {
      console.error("Error disconnecting wallet:", error);
      return "Sorry, there was an error disconnecting the wallet.";
    }
  },

  "/sign": async (message: any) => {
    try {
      if (!walletConnectManager.isConnected(message.from)) {
        return "Please connect your wallet first using /connect";
      }

      const messageToSign = message.body.replace("/sign", "").trim();
      if (!messageToSign) {
        return "Please provide a message to sign. Usage: /sign <message>";
      }

      const signature = await walletConnectManager.signMessage(
        message.from,
        messageToSign
      );
      return `Message signed successfully!\nSignature: ${signature}`;
    } catch (error) {
      console.error("Error signing message:", error);
      return "Sorry, there was an error signing the message.";
    }
  },

  "/wallet": async (message: any) => {
    try {
      const session = walletConnectManager.getSession(message.from);
      if (!session) {
        return "No wallet connected. Use /connect to connect your wallet.";
      }

      const account = session.namespaces.eip155.accounts[0].split(":")[2];
      return `Connected wallet address: ${account}`;
    } catch (error) {
      console.error("Error getting wallet info:", error);
      return "Sorry, there was an error retrieving wallet information.";
    }
  },
};

// WhatsApp client event handlers
client.on("qr", (qr) => {
  console.log("QR RECEIVED", qr);
  qrcode.generate(qr, { small: true });
});

client.once("ready", () => {
  console.log("WhatsApp Client is ready!");
});

client.on("message_create", async (message) => {
  console.log(
    "\n\nFrom",
    message.from.toString(),
    "Message",
    message.body,
    "To: ",
    message.to.toString(),
    "Type: ",
    message.type
  );

  if (message.body && message.from.toString() != "918682028711@c.us") {
    try {
      // Check if the message is a command
      const command = message.body.split(" ")[0].toLowerCase();
      if (command in commandHandlers) {
        const response = await commandHandlers[command](message);
        await message.reply(response);
        return;
      }

      // Handle regular messages with the agent
      const walletAddress = walletConnectManager.isConnected(message.from)
        ? walletConnectManager
            .getSession(message.from)
            ?.namespaces.eip155.accounts[0].split(":")[2]
        : "";

      const response = await agent.invoke({
        messages: [
          new HumanMessage(
            message.body +
              " From: " +
              message.from.toString() +
              " Chat ID: " +
              message.from.toString() +
              " Wallet Address: " +
              walletAddress
          ),
        ],
      });

      const lastMessage = response.messages[response.messages.length - 1];
      const agentReply =
        typeof lastMessage.content === "string"
          ? lastMessage.content
          : JSON.stringify(lastMessage.content);

      await message.reply(agentReply);
    } catch (error) {
      console.error("Error processing request:", error);
      await message.reply(
        "Sorry, I encountered an error processing your request."
      );
    }
  }
});

async function main(): Promise<void> {
  try {
    // Initialize WalletConnect
    await walletConnectManager.initialize();
    console.log("WalletConnect initialized successfully!");
  } catch (error) {
    console.error("Error initializing WalletConnect:", error);
    process.exit(1);
  }

  // Initialize WhatsApp client with retry logic
  let initAttempts = 0;
  const maxAttempts = 3;

  const initializeWithRetry = async () => {
    try {
      console.log("Attempting to initialize WhatsApp client...");
      await client.initialize();
      console.log("WhatsApp client initialized successfully!");
    } catch (error) {
      console.error("Error during initialization:", error);
      initAttempts++;

      if (initAttempts < maxAttempts) {
        console.log(
          `Retrying initialization (attempt ${
            initAttempts + 1
          }/${maxAttempts})...`
        );
        // Wait 5 seconds before retrying
        await new Promise((resolve) => setTimeout(resolve, 5000));
        await initializeWithRetry();
      } else {
        console.error("Failed to initialize after maximum attempts");
        process.exit(1);
      }
    }
  };

  await initializeWithRetry();
}

main().catch(console.error);
