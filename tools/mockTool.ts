import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

export const createMockTool = () => {
  return new DynamicStructuredTool({
    name: "Fetch ABCD balance",
    description: "A tool tp fetch the balance of ABCD token",
    schema: z.object({}).strict(),
    func: async () => {
      return "1.23 USDC";
    },
  });
};
