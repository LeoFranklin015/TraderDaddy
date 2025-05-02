import { ethers } from "ethers";

export const OrderType = {
  MarketSwap: 0,
  LimitSwap: 1,
  MarketIncrease: 2,
  LimitIncrease: 3,
  MarketDecrease: 4,
  LimitDecrease: 5,
  StopLossDecrease: 6,
  Liquidation: 7,
  StopIncrease: 8,
};

export const DecreasePositionSwapType = {
  NoSwap: 0,
  SwapPnlTokenToCollateralToken: 1,
  SwapCollateralTokenToPnlToken: 2,
};

interface MarketParams {
  indexToken: string;
  longToken: string;
  shortToken: string;
  marketType: string;
}

/**
 * Generates the initial market salt
 * @param params Market parameters
 * @returns bytes32 salt as a hex string
 */
export function getMarketSalt(params: MarketParams): string {
  const { indexToken, longToken, shortToken, marketType } = params;

  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  const encoded = abiCoder.encode(
    ["string", "address", "address", "address", "bytes32"],
    ["GMX_MARKET", indexToken, longToken, shortToken, marketType]
  );

  return ethers.keccak256(encoded);
}

/**
 * Calculates the final market salt hash
 * @param salt Initial salt generated from getMarketSalt
 * @returns bytes32 hash as a hex string
 */
export function getMarketSaltHash(salt: string): string {
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  const MARKET_SALT = ethers.keccak256(
    abiCoder.encode(["string"], ["MARKET_SALT"])
  );

  const encoded = abiCoder.encode(["bytes32", "bytes32"], [MARKET_SALT, salt]);

  return ethers.keccak256(encoded);
}

interface ConversionResult {
  assetPriceInUSD: bigint;
  amountInUSD: bigint;
  amountInETH: bigint;
}

interface PriceData {
  tokenSymbol: string;
  minPriceFull: string;
  maxPriceFull: string;
}

interface ApiResponse {
  signedPrices: PriceData[];
}

/**
 * Converts ETH to asset value
 */
export async function convertEthToAsset(
  chain: string,
  native: string,
  asset: string,
  amount: string | number
): Promise<ConversionResult> {
  const pricesResponse = await fetch(
    chain == "43113" || chain == "43114"
      ? "https://avalanche-api.gmxinfra.io/signed_prices/latest"
      : "https://arbitrum-api.gmxinfra.io/signed_prices/latest"
  );
  const { signedPrices } = (await pricesResponse.json()) as ApiResponse;
  const ethPriceData = signedPrices.find(
    (price: PriceData) => price.tokenSymbol === native
  );
  const assetPriceData = signedPrices.find(
    (price: PriceData) => price.tokenSymbol === asset
  );

  if (!ethPriceData || !assetPriceData) {
    throw new Error(`Price data not found for ${native} or ${asset}`);
  }

  const avgEthPrice =
    (BigInt(ethPriceData.minPriceFull) + BigInt(ethPriceData.maxPriceFull)) /
    BigInt(2);
  console.log("ETH Price");
  console.log(avgEthPrice);
  const avgAssetPrice =
    (BigInt(assetPriceData.minPriceFull) +
      BigInt(assetPriceData.maxPriceFull)) /
    BigInt(2);
  console.log("Asset Price");
  console.log(avgAssetPrice);
  const amountNum = typeof amount === "string" ? parseFloat(amount) : amount;
  const usdAmount = BigInt(amountNum * 10 ** 12) * avgEthPrice;

  return {
    assetPriceInUSD:
      avgAssetPrice * 10n ** (asset == "SOL" || asset == "SUI" ? 9n : 10n),
    amountInUSD: usdAmount * 10n ** 6n,
    amountInETH: expandDecimals(amountNum * 10 ** 6, 12),
  };
}

/**
 * Expands a number by the specified number of decimals
 */
export function expandDecimals(n: number, decimals: number): bigint {
  return BigInt(n) * BigInt(10) ** BigInt(decimals);
}

/**
 * Converts a decimal to float representation
 */
export function decimalToFloat(value: number, decimals: number = 0): bigint {
  return expandDecimals(value, 30 - decimals);
}

/**
 * Gets the market token address
 */
export async function getMarketTokenAddress(
  dataStore: ethers.Contract,
  indexToken: string,
  longToken: string,
  shortToken: string,
  marketType: string
): Promise<string> {
  const marketSaltHash = getMarketSaltHash(
    getMarketSalt({
      indexToken,
      longToken,
      shortToken,
      marketType,
    })
  );
  console.log("Market Salt Hash");
  console.log(marketSaltHash);
  return await dataStore["getAddress(bytes32)"](marketSaltHash);
}
