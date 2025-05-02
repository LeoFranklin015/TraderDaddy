import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

/**
 * Initialize the transaction tool
 */
export const createTransactionTool = () => {
  return new DynamicStructuredTool({
    name: "transaction",
    description: "Can perform an encoded tx data if passed in the prompt",
    schema: z
      .object({
        data: z.string().describe("The encoded transaction data to execute"),
        to: z.string().describe("The recipient address"),
        value: z
          .string()
          .optional()
          .describe("The amount of ETH to send (in wei)"),
        gasLimit: z
          .string()
          .optional()
          .describe("Optional gas limit for the transaction"),
      })
      .strict(),
    func: async (input: any) => {
      try {
        console.log(`🔧 Executing transaction tool with input:`, input);

        // Implement your tool logic here
        // This is where you'd call your API or perform your function

        // Mock response - replace with actual implementation
        const result = {
          input,
          result: "Your implementation here",
          timestamp: new Date().toISOString(),
        };

        return JSON.stringify(result);
      } catch (error) {
        console.error("Error with transaction tool:", error);
        if (error instanceof Error) {
          throw new Error(`Error executing transaction: ${error.message}`);
        }
        throw new Error(
          "Error executing transaction: An unknown error occurred."
        );
      }
    },
  });
};
