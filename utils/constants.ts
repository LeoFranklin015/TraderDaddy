export const HELP_MESSAGE = `
*Available Commands:*

*Hedera (RSK) Wallet Commands:*
- create wallet - Create a new RSK wallet
- import wallet <mnemonic> - Import wallet from recovery phrase
- show mnemonic - Display your recovery phrase
- my address - Show your RSK address
- balance - Check your HBAR balance
- send <amount> HBAR to <address> - Send HBAR tokens
- verify url <url> - Verify Hedera dApp URL

*GMX Trading Commands (Arbitrum Sepolia):*
- gmx help - Show GMX trading commands
- gmx markets - View available markets and prices
- gmx account - Check your GMX account balance
- gmx trade buy ETH-PERP <amount> <leverage> - Open long position
- gmx trade sell BTC-PERP <amount> <leverage> - Open short position
- gmx close <position-id> - Close a position
- gmx positions - View your open positions

*WalletConnect Commands:*
- Paste WalletConnect URI to connect to dApps
- Use 👍 or 👎 reactions to approve/reject transactions

Note: You must create a wallet before using GMX trading commands.`;

export const GMX_HELP_MESSAGE = `
*GMX Trading Commands:*

*Market Information:*
- gmx markets - List available markets
- gmx price <symbol> - Get current price
- gmx stats - Show trading statistics

*Trading Operations:*
- gmx trade buy <market> <amount> <leverage> - Open long position
- gmx trade sell <market> <amount> <leverage> - Open short position
- gmx close <position-id> - Close an open position
- gmx positions - List all open positions

*Account Management:*
- gmx balance - Check trading balance
- gmx deposit <amount> - Deposit funds for trading
- gmx withdraw <amount> - Withdraw funds

Example: gmx trade buy ETH-PERP 0.1 5
This opens a 5x leveraged long position with 0.1 ETH collateral`;

export const HEDERA_HELP_MESSAGE = `
*Hedera (RSK) Commands:*

*Wallet Management:*
- create wallet - Create a new RSK wallet
- import wallet <mnemonic> - Import existing wallet
- show mnemonic - Show recovery phrase
- my address - Show your RSK address
- balance - Check HBAR balance

*Transactions:*
- send <amount> HBAR to <address> - Send HBAR tokens
- verify url <url> - Verify if URL is a legitimate Hedera dApp

*dApp Connections:*
- Paste WalletConnect URI to connect to dApps
- Use 👍 or 👎 to approve/reject transactions`;
