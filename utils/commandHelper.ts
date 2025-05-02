export const helpCommands = {
  general: `
*Available Commands:*

*Hedera (RSK) Wallet Commands:*
• *create wallet* - Create a new wallet for both Hedera and Arbitrum
• *import wallet <mnemonic>* - Import wallet from recovery phrase
• *show mnemonic* - Display your recovery phrase
• *my address* - Show your wallet addresses
• *rbtc balance* - Check your RBTC balance
• *send <amount> RBTC to <address>* - Send RBTC tokens
• *verify url <url>* - Verify if a URL is from Hedera

*GMX Trading Commands (Arbitrum Sepolia):*
• *gmx markets* - View available markets and prices
• *gmx account* - Check your GMX account balance
• *gmx trade buy ETH-PERP <amount> <leverage>* - Open long position
• *gmx trade sell BTC-PERP <amount> <leverage>* - Open short position
• *gmx close <position-id>* - Close a position
• *gmx positions* - View your open positions

*WalletConnect:*
• Paste a WalletConnect URI (starting with 'wc:') to connect to dApps
• Use 👍 or 👎 reactions to approve/reject transactions

Note: Your wallet works on both Hedera and Arbitrum Sepolia chains.
- Use Hedera for regular transfers and dApp connections
- Use Arbitrum Sepolia for GMX trading
`,

  hedera: `
*Hedera (RSK) Commands:*

*Wallet Management:*
• *create wallet* - Create a new wallet
• *import wallet <mnemonic>* - Import existing wallet
• *show mnemonic* - Show recovery phrase
• *my address* - Show your RSK address
• *rbtc balance* - Check RBTC balance

*Transactions:*
• *send <amount> RBTC to <address>* - Send RBTC
• *verify url <url>* - Verify Hedera URL/dApp

*dApp Connection:*
• Paste WalletConnect URI to connect
• Use 👍 or 👎 to approve/reject transactions
`,

  gmx: `
*GMX Trading Commands (Arbitrum Sepolia):*

*Market Information:*
• *gmx markets* - List available markets
• *gmx price <symbol>* - Get current price
• *gmx stats* - Trading statistics

*Trading:*
• *gmx trade buy <market> <amount> <leverage>* - Open long
• *gmx trade sell <market> <amount> <leverage>* - Open short
• *gmx close <position-id>* - Close position
• *gmx positions* - List open positions

*Account:*
• *gmx balance* - Check trading balance
• *gmx deposit <amount>* - Deposit for trading
• *gmx withdraw <amount>* - Withdraw funds

Example: gmx trade buy ETH-PERP 0.1 5
This opens a 5x leveraged long position with 0.1 ETH collateral
`,
};

export function getHelpMessage(type: string = "general"): string {
  switch (type.toLowerCase()) {
    case "hedera":
      return helpCommands.hedera;
    case "gmx":
      return helpCommands.gmx;
    default:
      return helpCommands.general;
  }
}
