import { Message, Client as WhatsAppClient } from "whatsapp-web.js";
import { WalletManager } from "./WalletManager";
import { getBalance, sendTransaction } from "viem/actions";
import { hederaTestnet } from "viem/chains";

let walletManager: WalletManager | undefined;

export async function initializeMessageHandler(client: WhatsAppClient) {
  walletManager = new WalletManager(client);
}

export async function handleMessage(message: Message) {
  if (!walletManager) {
    await message.reply(
      "Wallet manager not initialized. Please try again later."
    );
    return;
  }

  // Check if message is from a group
  const chat = await message.getChat();
  if (chat.isGroup) {
    await message.reply("Please message me directly to use wallet commands.");
    return;
  }

  // Check if message starts with a command
  if (!message.body.startsWith("/")) {
    await message.reply(
      'Please use a command starting with "/". Type /help for available commands.'
    );
    return;
  }

  const [command, ...args] = message.body.slice(1).split(" ");

  switch (command.toLowerCase()) {
    case "start":
      await message.reply(
        "Welcome to TraderDaddy! I can help you manage your crypto wallet. Type /help for available commands."
      );
      break;
    case "help":
      await message.reply(
        "Available commands:\n" +
          "/create - Create a new wallet\n" +
          "/balance - Check your wallet balance\n" +
          "/send <amount> <address> - Send crypto to an address\n" +
          "/connect - Connect your existing wallet\n" +
          "/disconnect - Disconnect your wallet\n" +
          "/info - Get wallet information"
      );
      break;
    case "create":
      await handleCreateWallet(message);
      break;
    case "balance":
      await handleBalance(message);
      break;
    case "send":
      await handleSend(message, args);
      break;
    case "connect":
      await handleConnect(message);
      break;
    case "disconnect":
      await handleDisconnect(message);
      break;
    case "info":
      await handleInfo(message);
      break;
    default:
      await message.reply(
        "Unknown command. Type /help for available commands."
      );
  }
}

async function handleCreateWallet(message: Message) {
  try {
    const wallet = walletManager!.getChatWallet(message.from);
    await message.reply(
      `Wallet created successfully!\nAddress: ${wallet.account.address}`
    );
  } catch (error) {
    await message.reply(
      `Error creating wallet: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

async function handleBalance(message: Message) {
  try {
    const wallet = walletManager!.getChatWallet(message.from);
    const client = walletManager!.getWalletClient(message.from, 296); // Use Hedera testnet by default
    const balance = await getBalance(client, {
      address: wallet.account.address,
    });
    await message.reply(`Your balance: ${balance} HBAR`);
  } catch (error) {
    await message.reply(
      `Error getting balance: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

async function handleSend(message: Message, args: string[]) {
  if (args.length !== 2) {
    await message.reply("Usage: /send <amount> <address>");
    return;
  }

  const [amount, toAddress] = args;
  try {
    const wallet = walletManager!.getChatWallet(message.from);
    const client = walletManager!.getWalletClient(message.from, 296); // Use Hedera testnet by default
    const tx = await sendTransaction(client, {
      account: wallet.account,
      to: toAddress as `0x${string}`,
      value: BigInt(amount),
      chain: hederaTestnet,
    });
    await message.reply(`Transaction sent! Hash: ${tx}`);
  } catch (error) {
    await message.reply(
      `Error sending transaction: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

async function handleConnect(message: Message) {
  try {
    await walletManager!.handleWalletConnectUri(message);
  } catch (error) {
    await message.reply(
      `Error connecting wallet: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

async function handleDisconnect(message: Message) {
  try {
    const wallet = walletManager!.getChatWallet(message.from);
    for (const [topic] of wallet.wcSessions) {
      await walletManager!.handleSessionDelete({ topic });
    }
    await message.reply("Wallet disconnected successfully.");
  } catch (error) {
    await message.reply(
      `Error disconnecting wallet: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

async function handleInfo(message: Message) {
  try {
    const wallet = walletManager!.getChatWallet(message.from);
    const hederaClient = walletManager!.getWalletClient(message.from, 296);
    const arbitrumClient = walletManager!.getWalletClient(message.from, 421614);
    const hederaBalance = await getBalance(hederaClient, {
      address: wallet.account.address,
    });
    const arbitrumBalance = await getBalance(arbitrumClient, {
      address: wallet.account.address,
    });

    await message.reply(
      `Wallet Information:\n` +
        `Address: ${wallet.account.address}\n` +
        `Connected dApps: ${wallet.wcSessions.size}\n` +
        `Hedera Balance: ${hederaBalance} HBAR\n` +
        `Arbitrum Balance: ${arbitrumBalance} HBAR`
    );
  } catch (error) {
    await message.reply(
      `Error getting wallet info: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}
