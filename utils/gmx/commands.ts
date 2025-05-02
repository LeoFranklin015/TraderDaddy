import type { Message } from "whatsapp-web.js";
import { WalletManager } from "../WalletManager";

export async function handleGMXCommand(
  message: Message,
  walletManager: WalletManager
): Promise<string> {
  const text = message.body.toLowerCase();
  const parts = text.split(" ");

  if (parts.length < 2) {
    return "Invalid GMX command. Try 'gmx help' for available commands.";
  }

  const command = parts[1];

  switch (command) {
    case "trade":
      // Handle trade commands (long/short)
      if (parts.length < 5) {
        return "Invalid trade format. Use: gmx trade <long/short> <market> <amount>";
      }
      const action = parts[2];
      const market = parts[3];
      const amount = parts[4];
      return `Processing ${action} trade for ${amount} on ${market}...`;

    case "close":
      // Handle position closing
      if (parts.length < 3) {
        return "Invalid close format. Use: gmx close <position-id>";
      }
      return `Closing position ${parts[2]}...`;

    case "positions":
      // Show open positions
      return "Fetching your open positions...";

    default:
      return "Unknown GMX command. Try 'gmx help' for available commands.";
  }
}
