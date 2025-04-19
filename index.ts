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

async function obtainAgentReply(userPrompt: string): Promise<string> {
  const reply = await agent.invoke(
    {
      messages: [new HumanMessage(userPrompt)],
    },
    {
      configurable: { thread_id: "0x0001" },
    }
  );

  const lastMessage = reply.messages[reply.messages.length - 1];
  const agentReply =
    typeof lastMessage.content === "string"
      ? lastMessage.content
      : JSON.stringify(lastMessage.content);
  return agentReply;
}

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

  // Handle other messages with the agent
  if (message.body && message.from.toString() != "918682028711@c.us") {
    try {
      // Get the chat's wallet address

      const response = await agent.invoke({
        messages: [
          new HumanMessage(
            message.body +
              " From: " +
              message.from.toString() +
              " Chat ID: " +
              message.from.toString() +
              " Wallet Address: "
          ),
        ],
      });

      const lastMessage = response.messages[response.messages.length - 1];
      const agentReply =
        typeof lastMessage.content === "string"
          ? lastMessage.content
          : JSON.stringify(lastMessage.content);

      // Send the agent's response back to WhatsApp
      await message.reply(agentReply);
    } catch (error) {
      console.error("Error processing agent request:", error);
      await message.reply(
        "Sorry, I encountered an error processing your request."
      );
    }
  }
});

async function main(): Promise<void> {
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
