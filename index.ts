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
import { WalletManager } from "./utils/WalletManager.js";
import { HederaWalletManager } from "./utils/HederaWalletManager.js";
import { createPriceTool } from "./tools/price.js";
import { createHederaTransferTool } from "./tools/hederaTransfer.js";
import { createHederaUrlVerifyTool } from "./tools/hederaUrlVerify.js";
import { createGMXTradingTool } from "./tools/gmxTrading.js";
import { handleGMXCommand } from "./utils/gmx/commands.js";
import * as fs from "fs-extra";
import * as path from "path";
import {
  HELP_MESSAGE,
  GMX_HELP_MESSAGE,
  HEDERA_HELP_MESSAGE,
} from "./utils/constants.js";

dotenv.config();

// Function to clear all session data
async function clearAllSessionData() {
  try {
    const authDir = path.join(process.cwd(), ".wwebjs_auth");
    const cacheDir = path.join(process.cwd(), ".wwebjs_cache");

    if (fs.existsSync(authDir)) {
      await fs.remove(authDir);
      console.log("Auth session data cleared successfully");
    }

    if (fs.existsSync(cacheDir)) {
      await fs.remove(cacheDir);
      console.log("Cache data cleared successfully");
    }
  } catch (error) {
    console.error("Error clearing session data:", error);
  }
}

// Create a new WhatsApp client instance
const client = new Client({
  authStrategy: new LocalAuth({
    clientId: "new-session-" + Date.now(),
    dataPath: path.join(process.cwd(), ".wwebjs_auth"),
  }),
  puppeteer: {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    executablePath:
      process.env.CHROME_PATH ||
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    timeout: 60000,
  },
});

// Initialize WalletManager for multi-chain support (Hedera and Arbitrum Sepolia)
const walletManager = new WalletManager(client);

// Initialize WalletManager for Hedera-specific functionality
const hederaManager = new HederaWalletManager(
  (process.env.HEDERA_NETWORK as "mainnet" | "testnet") || "testnet"
);

// Function to restart WhatsApp Web session
async function restartWhatsAppSession() {
  try {
    console.log("Restarting WhatsApp Web session...");
    await clearAllSessionData();
    await client.destroy();
    await client.logout();
    await client.initialize();
    console.log("WhatsApp Web session restarted successfully!");
  } catch (error: unknown) {
    console.error("Error restarting WhatsApp Web session:", error);
    throw error;
  }
}

(async (): Promise<void> => {
  await clearAllSessionData();

  // WhatsApp client event handlers
  client.on("qr", (qr) => {
    console.log("QR RECEIVED", qr);
    qrcode.generate(qr, { small: true });
  });

  client.once("ready", () => {
    console.log("WhatsApp Client is ready!");
  });

  // Handle WalletConnect and Hedera messages
  client.on("message", async (message) => {
    try {
      // Handle WalletConnect URIs
      if (message.body.startsWith("wc:")) {
        await walletManager.handleWalletConnectUri(message);
        return;
      }

      // Try to handle Hedera commands
      const hederaResponse = await hederaManager.handleMessage(message);
      if (hederaResponse) {
        message.reply(hederaResponse);
        return;
      }
    } catch (error) {
      console.error("Error in message handling:", error);
    }
  });

  client.on("message_create", async (message) => {
    if (message.from.toString() === "918682028711@c.us") {
      // Bot's own messages, ignore
      return;
    }

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

    try {
      // Make sure message body exists
      const messageText = message.body || "";
      const command = messageText.trim().toLowerCase();

      // Show help message for new users or when requested
      if (!command || command === "help" || command === "commands") {
        await message.reply(HELP_MESSAGE);
        return;
      }

      if (command === "gmx help") {
        await message.reply(GMX_HELP_MESSAGE);
        return;
      }

      if (command === "hedera help") {
        await message.reply(HEDERA_HELP_MESSAGE);
        return;
      }

      // Handle WalletConnect URIs
      if (messageText.startsWith("wc:")) {
        await walletManager.handleWalletConnectUri(message);
        return;
      }

      // Handle Hedera commands
      const hederaResponse = await hederaManager.handleMessage(message);
      if (hederaResponse) {
        await message.reply(hederaResponse);
        return;
      }

      // Handle GMX commands
      if (command.startsWith("gmx ")) {
        const gmxResponse = await handleGMXCommand(message, walletManager);
        if (gmxResponse) {
          await message.reply(gmxResponse);
          return;
        }
      }

      // Create wallet reminder for any other command
      if (!(await walletManager.getWalletAddress(message.from.toString()))) {
        await message.reply(
          "You don't have a wallet yet! Please create one first by sending 'create wallet' or 'create hedera wallet'."
        );
        return;
      }

      // For any other command, use a simple response
      await message.reply(
        "I didn't understand that command. Please try 'help' for a list of available commands."
      );
    } catch (error) {
      console.error("Error processing request:", error);
      await message.reply(
        "Sorry, I encountered an error processing your request. Please try again with 'help' to see available commands."
      );
    }
  });

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
        await new Promise((resolve) => setTimeout(resolve, 5000));
        await initializeWithRetry();
      } else {
        console.error("Failed to initialize after maximum attempts");
        process.exit(1);
      }
    }
  };

  await initializeWithRetry();
})();
