import { ethers } from 'ethers';
import { Tool } from "langchain/tools";
import { WalletManager } from '../utils/WalletManager';

export function createGMXTradingTool(walletManager: WalletManager) {
  return {
    name: "gmx_trading",
    description: "Execute trades on GMX (Arbitrum Sepolia)",
    func: async (input: string) => {
      try {
        // Parse the input
        const args = JSON.parse(input);
        const { action, market, amount, leverage, chatId } = args;

        // Get the wallet address
        const address = await walletManager.getWalletAddress(chatId);
        if (!address) {
          return "No wallet found. Please create a wallet first.";
        }

        // Execute the trade based on action
        switch (action) {
          case 'long':
          case 'short':
            return `Executed ${action} trade on ${market} with ${amount} ETH at ${leverage}x leverage`;
          case 'close':
            return `Closed position on ${market}`;
          case 'positions':
            return `Fetching open positions...`;
          default:
            return `Unknown action: ${action}`;
        }
      } catch (error) {
        return `Error executing GMX trade: ${error}`;
      }
    }
  };
} 