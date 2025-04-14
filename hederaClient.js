import { AccountId, Client, Hbar, PrivateKey } from "@hashgraph/sdk";

import dotenv from "dotenv";

dotenv.config({ path: "./.env" });

function createInstance(params) {
  let { id, privateKey, network, privateKeyType } = params || {};
  id = id || process.env.HEDERA_ACCOUNT_ID;
  privateKey = privateKey || process.env.HEDERA_ACCOUNT_PRIVATE_KEY;
  network = network || process.env.HEDERA_ACCOUNT_NETWORK || "testnet";
  privateKeyType =
    privateKeyType || process.env.HEDERA_ACCOUNT_PRIVATE_KEY_TYPE || "ECDSA";

  console.log("hedera client createInstance", {
    network,
    id,
    privateKey: privateKey.substring(0, 5) + "...",
    privateKeyType,
  });

  if (!id || !privateKey) {
    throw new Error(
      "Must set env vars: HEDERA_ACCOUNT_ID and HEDERA_ACCOUNT_PRIVATE_KEY"
    );
  }

  const operatorId = AccountId.fromString(id);
  let operatorKey;
  switch (privateKeyType.toLowerCase()) {
    case "ecdsa":
      operatorKey = PrivateKey.fromStringECDSA(privateKey);
      break;
    case "eddsa":
      operatorKey = PrivateKey.fromStringED25519(privateKey);
      break;
    default:
      throw new Error(`Unsupported private key type: ${privateKeyType}`);
  }

  let client;
  switch (network) {
    case "testnet":
      client = Client.forTestnet().setOperator(operatorId, operatorKey);
      break;
    case "mainnet":
      client = Client.forMainnet().setOperator(operatorId, operatorKey);
      break;
    case "previewnet":
      client = Client.forPreviewnet().setOperator(operatorId, operatorKey);
      break;
    case "localnode":
      client = Client.forLocalNode().setOperator(operatorId, operatorKey);
      break;
    default:
      throw new Error(`Unsupported network: ${network}`);
  }

  client.setDefaultMaxQueryPayment(new Hbar(50));
  client.setDefaultMaxTransactionFee(new Hbar(100));

  return client;
}
export { createInstance };
