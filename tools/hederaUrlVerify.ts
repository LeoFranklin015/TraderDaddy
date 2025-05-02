import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { HederaWalletManager } from "../utils/HederaWalletManager";

/**
 * Initialize the Hedera URL verification tool
 */
export const createHederaUrlVerifyTool = (
  HederaWalletManager: HederaWalletManager
) => {
  return new DynamicStructuredTool({
    name: "verify_hedera_url",
    description: "Verify if a URL is a valid Hedera domain or dApp",
    schema: z
      .object({
        url: z.string().describe("The URL to verify"),
      })
      .strict(),
    func: async (input: any) => {
      try {
        console.log(
          `🔧 Executing Hedera URL verification tool with input:`,
          input
        );

        if (!input.url) {
          throw new Error("URL is required for verification");
        }

        const isValid = HederaWalletManager.verifyHederaUrl(input.url);

        const result = {
          success: true,
          url: input.url,
          isValidHederaUrl: isValid,
          message: isValid
            ? `The URL ${input.url} is a verified Hedera domain.`
            : `The URL ${input.url} is NOT a verified Hedera domain. Proceed with caution.`,
          timestamp: new Date().toISOString(),
        };

        return JSON.stringify(result);
      } catch (error) {
        console.error("Error with Hedera URL verification tool:", error);
        if (error instanceof Error) {
          return JSON.stringify({
            success: false,
            message: `Error verifying URL: ${error.message}`,
          });
        }
        return JSON.stringify({
          success: false,
          message: "Error verifying URL: An unknown error occurred.",
        });
      }
    },
  });
};
