import { TradingService } from "../../utils/gmx/TradingService";

/**
 * Load all available services
 */
export async function loadServices(agent: any) {
  const services = [TradingService];

  const results = await Promise.all(
    services.map(async (Service) => {
      try {
        const service = new Service(agent);
        await service.start();
        if (service) {
          console.log(`✅ ${service.name} service initialized`);
          return service;
        }
        return null;
      } catch (error) {
        console.error("Failed to initialize service:", error);
        return null;
      }
    })
  );

  // Filter out any null results
  return results.filter((service: any) => service !== null);
}
