import { ethers, ContractTransactionResponse } from "ethers";
import {
  assets,
  orderVaultDeployments,
  exchangeRouterAbi as exchangeRouterABI,
} from "./constants";
import dotenv from "dotenv";
import { zeroAddress } from "viem";
import dataStore from "./abis/data-store";
import exchangeRouter from "./exchange-router";
import {
  convertEthToAsset,
  expandDecimals,
  getMarketTokenAddress,
} from "./utils";

dotenv.config();

// Define types for assets and chain
type ChainId = "421614" | "42161" | "43114" | "43113";
type AssetType = "ETH" | "AVAX" | "USDC";

export async function placeTrade(
  pKey: string,
  native: string,
  _asset: string,
  _chain: string,
  leverage: string,
  positionSizeInNative: string,
  takeProfit: string,
  stopLoss: string,
  isLong: boolean
): Promise<ContractTransactionResponse> {
  console.log("Starting placeTrade function...");
  const chain = "421614" as ChainId;
  const asset = "ETH" as AssetType;
  console.log("Input parameters:", {
    pKey,
    native,
    asset,
    chain,
    leverage,
    positionSizeInNative,
    takeProfit,
    stopLoss,
    isLong,
  });
  const dataStoreAbi = dataStore.abi;
  const rpcUrl =
    chain == "421614"
      ? "https://arb-sepolia.g.alchemy.com/v2/" + process.env.ALCHEMY_API_KEY
      : "https://avax-fuji.g.alchemy.com/v2/" + process.env.ALCHEMY_API_KEY;

  console.log("RPC URL:", rpcUrl);

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(pKey, provider);
  console.log("Wallet address:", await wallet.getAddress());

  // Fix: Use provider.getBalance() instead of wallet.getBalance()
  const balance = await provider.getBalance(await wallet.getAddress());
  console.log("Balance: ", balance);
  if (balance < BigInt("2000000000000000")) {
    throw "Insufficient funds to perform the trade";
  }
  const exchangeRouterAbi = exchangeRouterABI[chain];
  // console.log(assets);

  // Type assertion to handle the asset indexing
  const addresses = {
    wnt: assets[chain === "421614" ? "ETH" : "AVAX"][
      chain as keyof (typeof assets)[AssetType]
    ],
    token: assets[asset][chain as keyof (typeof assets)[AssetType]],
    usdc: assets["USDC"][chain as keyof (typeof assets)["USDC"]],
    exchangeRouter: exchangeRouter[chain as keyof typeof exchangeRouter],
    dataStore: dataStore[chain as keyof typeof dataStore],
  };

  console.log("Resolved addresses:", addresses);

  const executionFee =
    chain == "421614" ? expandDecimals(5, 14) : expandDecimals(1, 16);

  console.log("Execution fee:", executionFee.toString());

  const params = {
    rpcUrl: rpcUrl,
    chain: chain,
    native: native,
    assetName: asset,
    positionSizeInETH: positionSizeInNative,
    takeProfit: takeProfit,
    stopLoss: stopLoss,
    leverage: leverage,
    slippage: 1,
    isLong: isLong,
    executionFee: executionFee,
  };

  if (addresses.token == undefined) {
    throw (
      "Token " +
      addresses.token +
      " is not configured for chain " +
      params.chain
    );
  }

  // Fix: Ensure proper typing for the contract interfaces
  const exchangeRouterContract = new ethers.Contract(
    addresses.exchangeRouter,
    JSON.parse(JSON.stringify(exchangeRouterAbi)),
    wallet
  );
  const dataStoreContract = new ethers.Contract(
    addresses.dataStore as string,
    JSON.parse(JSON.stringify(dataStoreAbi)),
    wallet
  );

  console.log("Fetching asset price...");
  const { assetPriceInUSD, amountInUSD, amountInETH } = await convertEthToAsset(
    params.chain,
    params.native,
    params.assetName,
    parseFloat(params.positionSizeInETH)
  );
  console.log("Asset price details:", {
    assetPriceInUSD,
    amountInUSD,
    amountInETH,
  });

  console.log("Fetching market token address...");
  const marketTokenAddress = await getMarketTokenAddress(
    dataStoreContract,
    addresses.token,
    addresses.token,
    addresses.usdc,
    "0x4bd5869a01440a9ac6d7bf7aa7004f402b52b845f20e2cec925101e13d84d075"
  );
  console.log("Market token address:", marketTokenAddress);

  const ethUsdMarket = await getMarketTokenAddress(
    dataStoreContract,
    addresses.wnt,
    addresses.wnt,
    addresses.usdc,
    "0x4bd5869a01440a9ac6d7bf7aa7004f402b52b845f20e2cec925101e13d84d075"
  );
  console.log("ETH/USD market token address:", ethUsdMarket);

  console.log("Preparing order parameters...");
  const walletAddress = await wallet.getAddress();
  const createOrderParams =
    params.chain == "421614"
      ? [
          {
            addresses: {
              receiver: walletAddress,
              callbackContract: zeroAddress,
              uiFeeReceiver: zeroAddress,
              market: marketTokenAddress,
              initialCollateralToken: addresses.wnt,
              swapPath: params.assetName == params.native ? [] : [ethUsdMarket],
            },
            numbers: {
              sizeDeltaUsd: (amountInUSD * BigInt(params.leverage)).toString(),
              initialCollateralDeltaAmount: amountInETH.toString(),
              triggerPrice: 0,
              acceptablePrice: !params.isLong
                ? (
                    assetPriceInUSD -
                    (assetPriceInUSD * BigInt(params.slippage)) / BigInt(100)
                  ).toString()
                : (
                    assetPriceInUSD +
                    (assetPriceInUSD * BigInt(params.slippage)) / BigInt(100)
                  ).toString(),
              executionFee: params.executionFee.toString(),
              callbackGasLimit: 0,
              minOutputAmount: 0,
              validFromTime: 0,
            },
            orderType: 2,
            decreasePositionSwapType: 0,
            isLong: params.isLong,
            shouldUnwrapNativeToken: true,
            referralCode:
              "0x0000000000000000000000000000000000000000000000000000000000000000",
          },
        ]
      : [
          {
            addresses: {
              receiver: walletAddress,
              cancellationReceiver: zeroAddress,
              callbackContract: zeroAddress,
              uiFeeReceiver: zeroAddress,
              market: marketTokenAddress,
              initialCollateralToken: addresses.wnt,
              swapPath: params.assetName == params.native ? [] : [ethUsdMarket],
            },
            numbers: {
              sizeDeltaUsd: (amountInUSD * BigInt(params.leverage)).toString(),
              initialCollateralDeltaAmount: amountInETH.toString(),
              triggerPrice: 0,
              acceptablePrice: !params.isLong
                ? (
                    assetPriceInUSD -
                    (assetPriceInUSD * BigInt(params.slippage)) / BigInt(100)
                  ).toString()
                : (
                    assetPriceInUSD +
                    (assetPriceInUSD * BigInt(params.slippage)) / BigInt(100)
                  ).toString(),
              executionFee: params.executionFee.toString(),
              callbackGasLimit: 0,
              minOutputAmount: 0,
              validFromTime: 0,
            },
            orderType: 2,
            decreasePositionSwapType: 0,
            isLong: params.isLong,
            shouldUnwrapNativeToken: true,
            autoCancel: false,
            referralCode:
              "0x0000000000000000000000000000000000000000000000000000000000000000",
          },
        ];
  console.log("Order parameters:", createOrderParams);

  console.log("Sending transaction...");

  // Get the order vault address
  const orderVault =
    orderVaultDeployments[chain as keyof typeof orderVaultDeployments];
  const totalValue = amountInETH + params.executionFee;

  console.log("Transaction details:", {
    orderVault,
    totalValue: totalValue.toString(),
    createOrderParams,
  });

  try {
    // First send WNT
    console.log("Sending WNT...");
    const sendWntTx = await exchangeRouterContract.sendWnt(
      orderVault,
      totalValue,
      { value: totalValue }
    );
    console.log("WNT sent, waiting for confirmation...");
    const sendWntReceipt = await sendWntTx.wait();
    if (!sendWntReceipt) {
      throw new Error("sendWnt failed - no receipt received");
    }
    console.log("WNT transfer confirmed");

    // Then create order
    console.log("Creating order...");
    const createOrderTx = await exchangeRouterContract.createOrder(
      createOrderParams[0],
      { gasLimit: 2000000 }
    );
    console.log("Order creation sent, waiting for confirmation...");
    const createOrderReceipt = await createOrderTx.wait();
    if (!createOrderReceipt) {
      throw new Error("createOrder failed - no receipt received");
    }
    console.log("Order creation confirmed");

    return createOrderTx as ContractTransactionResponse;
  } catch (error: any) {
    console.error("Transaction failed:", error);
    throw new Error(`Transaction failed: ${error.message}`);
  }
}
