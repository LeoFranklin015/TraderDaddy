import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { HederaWalletManager } from "../utils/HederaWalletManager";

/**
 * Initialize the Hedera transfer tool
 */
export const createHederaTransferTool = (
  HederaWalletManager: HederaWalletManager
) => {
  return new DynamicStructuredTool({
    name: "hedera_transfer",
    description: "Send HBAR from the user's Hedera wallet to another address",
    schema: z
      .object({
        amount: z.string().describe("The amount of HBAR to transfer"),
        recipient: z.string().describe("The recipient's Hedera address"),
        memo: z
          .string()
          .optional()
          .describe("Optional memo to include with the transaction"),
        chatId: z
          .string()
          .describe("The chat ID to identify the sender's wallet"),
      })
      .strict(),
    func: async (input: any) => {
      try {
        console.log(`🔧 Executing Hedera transfer tool with input:`, input);

        if (!input.chatId) {
          throw new Error(
            "Chat ID is required to identify the sender's wallet"
          );
        }

        if (!HederaWalletManager.hasWallet(input.chatId)) {
          return JSON.stringify({
            success: false,
            message:
              "You don't have a Hedera wallet yet. Create one first with 'create hedera wallet'.",
          });
        }

        const balance = await HederaWalletManager.getBalance(input.chatId);

        if (parseFloat(balance) < parseFloat(input.amount)) {
          return JSON.stringify({
            success: false,
            message: `Insufficient balance. You have ${balance} HBAR, but tried to send ${input.amount} HBAR.`,
          });
        }

        const txHash = await HederaWalletManager.sendHBAR(
          input.chatId,
          input.recipient,
          input.amount,
          input.memo
        );

        const result = {
          success: true,
          amount: input.amount,
          recipient: input.recipient,
          txHash: txHash,
          message: `Successfully sent ${input.amount} HBAR to ${input.recipient}`,
          timestamp: new Date().toISOString(),
        };

        return JSON.stringify(result);
      } catch (error) {
        console.error("Error with Hedera transfer tool:", error);
        if (error instanceof Error) {
          return JSON.stringify({
            success: false,
            message: `Error executing transfer: ${error.message}`,
          });
        }
        return JSON.stringify({
          success: false,
          message: "Error executing transfer: An unknown error occurred.",
        });
      }
    },
  });
};
