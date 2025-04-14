import readline from "node:readline/promises";
import process from "node:process";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent, ToolNode } from "@langchain/langgraph/prebuilt";
import { HumanMessage } from "@langchain/core/messages";
import { HederaAgentKit, createHederaTools } from "hedera-agent-kit";
import { ChatOpenAI } from "@langchain/openai";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

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

const rlp = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function readUserPrompt(): Promise<string> {
  const line = await rlp.question("");
  return line;
}

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

async function main(): Promise<void> {
  while (true) {
    console.log("You:\n");
    const userPrompt = await readUserPrompt();

    console.log("Agent:\n");
    const agentReply = await obtainAgentReply(userPrompt);
    console.log(agentReply);
  }
}

main().catch(console.error);
