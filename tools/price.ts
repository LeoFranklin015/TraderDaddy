import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

// Define type for token price data
interface TokenPrice {
  price: number;
  dayChange: string;
  volume: string;
}

// Define supported token types
type SupportedToken = 'SUI' | 'USDC';

/**
 * Initialize the price tool for SUI tokens
 */
export const createPriceTool = () => {
  return new DynamicStructuredTool({
    name: "price",
    description:
      "Fetches the current simulated price for SUI and related tokens",
    schema: z
      .object({
        symbol: z
          .string()
          .describe(
            "The token symbol to fetch price for (e.g., SUI, USDC)"
          ),
      })
      .strict(),
    func: async (input: any) => {
      try {
        const { symbol } = input;
        console.log(`🔧 Executing price tool with symbol: "${symbol}"`);

        // Normalize the symbol
        const normalizedSymbol = symbol.trim().toUpperCase();
        
        // Hardcoded values for supported tokens
        const tokenPrices: Record<SupportedToken, TokenPrice> = {
          "SUI": {
            price: 1.23,
            dayChange: "+2.45",
            volume: "35829423.87"
          },
          "USDC": {
            price: 1.00,
            dayChange: "+0.05",
            volume: "12532423.45"
          }
        };
        
        // Check if the requested token is supported
        if (!tokenPrices[normalizedSymbol as SupportedToken]) {
          return JSON.stringify({
            symbol: normalizedSymbol,
            error: `Token ${normalizedSymbol} is not supported. Supported tokens: SUI, USDC`
          });
        }
        
        const tokenData = tokenPrices[normalizedSymbol as SupportedToken];

        return JSON.stringify({
          symbol: normalizedSymbol,
          price: tokenData.price,
          dayChange: tokenData.dayChange,
          volume: tokenData.volume,
          message: `${normalizedSymbol} is currently trading at $${tokenData.price} (${tokenData.dayChange}% in 24h) with a volume of $${tokenData.volume}`
        });
      } catch (error) {
        console.error("Error with price tool:", error);
        if (error instanceof Error) {
          return JSON.stringify({
            error: `Error getting price: ${error.message}`
          });
        }
        return JSON.stringify({
          error: "An unknown error occurred getting the price."
        });
      }
    },
  });
};
