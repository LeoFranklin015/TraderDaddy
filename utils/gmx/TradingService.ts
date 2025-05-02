import { placeTrade } from "./index.js";
import { processCandles } from "../candles.js";
import { processSentimentCryptoPanic } from "./abis/cryptopanic.js";
import { generateEmbeddings } from "./supavec.js";

interface Agent {
  getBalance: () => Promise<bigint>;
  getPrivateKey: () => Promise<string>;
  processAnalysis: (data: any, embeddings: any) => Promise<Decision>;
  getTradeById: (id: string) => Promise<Trade>;
  addTradingData: (data: TradingData) => Promise<void>;
}

interface Decision {
  action: "buy_more" | "close_position" | "stay_idle";
  reason: string;
  data?: {
    trade_id?: string;
    leverage?: number;
    amount?: string;
    isLong?: boolean;
  };
}

interface Trade {
  isLong: boolean;
  leverage: number;
  amount: string;
}

interface TradingData {
  action: {
    "%allot": string;
  };
  trade_data?: {
    is_long: {
      "%allot": string;
    };
    asset: {
      "%allot": string;
    };
    leverage: {
      "%allot": string;
    };
    amount: {
      "%allot": string;
    };
    tx_hash?: {
      "%allot": string;
    };
    reference_trade_id?: {
      "%allot": string;
    };
  };
  explanation: {
    "%allot": string;
  };
}

export class TradingService {
  public name: string;
  public agent: Agent;
  public timer: NodeJS.Timeout | null;

  constructor(agent: Agent) {
    this.name = "Trading";
    this.agent = agent;
    this.timer = null;
  }

  async start(): Promise<void> {
    await this.executeTradeLogic();
    // Start the periodic trading logic
    this.timer = setInterval(async () => {
      await this.executeTradeLogic();
    }, 10 * 60 * 1000); // 10 minutes in milliseconds

    console.log("Trading service started, will run every 10 minutes");
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log("Trading service stopped");
    }
  }

  async executeTradeLogic(): Promise<{ success: boolean } | undefined> {
    try {
      console.log("Starting trade logic execution...");

      // 1. Check balance first
      console.log("Checking balance...");
      const balance = await this.agent.getBalance();
      console.log(`Current balance: ${balance}`);

      if (balance < BigInt("2000000000000000")) {
        console.log(
          "Insufficient balance (< 0.002 ETH) to perform trade operations"
        );
        return {
          decision: "stay_idle",
          reason: "Insufficient balance (< 0.002 ETH)",
        } as any;
      }

      // 3. Gather all necessary trading data
      console.log("Gathering trading data...");
      const [candleStickData, socialSentiment] = await Promise.all([
        processCandles("ETH"),
        processSentimentCryptoPanic("ETH", this.agent),
      ]);
      console.log("Trading data gathered successfully.");

      // 4. Generate embeddings using RAG service
      console.log("Generating embeddings...");
      const embeddingsData = await generateEmbeddings(
        "ETH",
        candleStickData,
        socialSentiment
      );
      console.log("Embeddings generated successfully.");

      console.log("Processing analysis for decision-making...");
      const decision = await this.agent.processAnalysis(
        {
          marketData: candleStickData,
          socialSentiment: socialSentiment,
        },
        embeddingsData
      );
      console.log(`Decision made: ${JSON.stringify(decision)}`);

      let selectedTrade: Trade | null = null;
      if (decision.action === "close_position" && decision.data?.trade_id) {
        console.log(
          `Fetching trade details for trade ID: ${decision.data.trade_id}`
        );
        selectedTrade = await this.agent.getTradeById(decision.data.trade_id);
        console.log(`Selected trade: ${JSON.stringify(selectedTrade)}`);
      }

      // 6. Execute the decision
      console.log("Executing decision...");
      const result = await this.executeDecision(decision, selectedTrade);
      console.log("Decision executed successfully:", result);

      return result;
    } catch (error) {
      console.error("Error in trading execution:", error);
    }
  }

  async executeDecision(
    decision: Decision,
    selectedTrade: Trade | null
  ): Promise<{ success: boolean }> {
    switch (decision.action) {
      case "buy_more":
        if (
          !decision.data?.leverage ||
          !decision.data?.amount ||
          decision.data?.isLong === undefined
        ) {
          throw new Error("Missing required data for buy_more action");
        }
        const { hash } = await placeTrade(
          await this.agent.getPrivateKey(),
          "ETH",
          "ETH",
          "421614",
          decision.data.leverage.toString(),
          decision.data.amount,
          "",
          "",
          decision.data.isLong
        );
        await this.agent.addTradingData({
          action: {
            "%allot": "buy_more",
          },
          trade_data: {
            is_long: {
              "%allot": decision.data.isLong.toString(),
            },
            asset: {
              "%allot": "ETH",
            },
            leverage: {
              "%allot": decision.data.leverage.toString(),
            },
            amount: {
              "%allot": decision.data.amount.toString(),
            },
            tx_hash: {
              "%allot": hash,
            },
          },
          explanation: {
            "%allot": decision.reason,
          },
        });
        return {
          success: true,
        };

      case "close_position":
        if (!selectedTrade || !decision.data?.trade_id) {
          throw new Error("Missing required data for close_position action");
        }
        await this.agent.addTradingData({
          action: {
            "%allot": "close_position",
          },
          trade_data: {
            is_long: {
              "%allot": selectedTrade.isLong.toString(),
            },
            asset: {
              "%allot": "ETH",
            },
            leverage: {
              "%allot": selectedTrade.leverage.toString(),
            },
            amount: {
              "%allot": selectedTrade.amount.toString(),
            },
            reference_trade_id: {
              "%allot": decision.data.trade_id,
            },
          },
          explanation: {
            "%allot": decision.reason,
          },
        });
        return {
          success: true,
        };
      case "stay_idle":
      default:
        await this.agent.addTradingData({
          action: {
            "%allot": "stay_idle",
          },
          explanation: {
            "%allot": decision.reason,
          },
        });
        return {
          success: true,
        };
    }
  }
}
