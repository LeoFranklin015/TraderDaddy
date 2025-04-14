import readline from "node:readline/promises";
import process from "node:process";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent, ToolNode } from "@langchain/langgraph/prebuilt";
import { HumanMessage } from "@langchain/core/messages";
import { HederaAgentKit, createHederaTools } from "hedera-agent-kit";
import { ChatOpenAI } from "@langchain/openai";
import * as dotenv from "dotenv";
import { createInstance } from "./hederaClient.js";

// Load environment variables
dotenv.config();

// Create OpenAI LLM instance
const llm = new ChatOpenAI({
  modelName: "gpt-4o-mini",
  temperature: 0.7,
  maxTokens: 1000,
});

// const hederaClient = createInstance({});

// Initialize Hedera client with account ID and private key from environment variables
const hederaAgentKit = new HederaAgentKit(
  process.env.HEDERA_ACCOUNT_ID,
  process.env.HEDERA_ACCOUNT_PRIVATE_KEY,
  process.env.HEDERA_ACCOUNT_PUBLIC_KEY,
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

const rlp = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function readUserPrompt() {
  const lines = [];
  while (true) {
    const line = await rlp.question("");
    if (line === "" && lines[lines.length - 1] === "") {
      return lines.join("\n");
    }
    lines.push(line);
  }
}

async function obtainAgentReply(userPrompt) {
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

async function main() {
  while (true) {
    console.log("You:\n");
    const userPrompt = await readUserPrompt();

    console.log("Agent:\n");
    const agentReply = await obtainAgentReply(userPrompt);
    console.log(agentReply);
  }
}

main().catch(console.error);
