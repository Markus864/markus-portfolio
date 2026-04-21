import { storage } from "./storage";
import { sendNotificationsForAlert } from "./notifications";

const POLL_INTERVAL_MS = 60_000;

export function startPriceAlertWorker() {
  console.log("[Price Alert Worker] Starting background worker (polling every 60s)");
  setInterval(checkAlerts, POLL_INTERVAL_MS);
  checkAlerts();
}

async function checkAlerts() {
  try {
    const alerts = await storage.getAlerts();
    const activeAlerts = alerts.filter((a) => a.status === "ACTIVE");
    
    if (activeAlerts.length === 0) {
      return;
    }
    
    console.log(`[Price Alert Worker] Checking ${activeAlerts.length} active alerts`);

    for (const alert of activeAlerts) {
      try {
        const price = await storage.getLatestPrice(alert.symbol);
        const target = Number(alert.targetPrice);
        
        const isTriggered =
          (alert.condition === "ABOVE" && price >= target) ||
          (alert.condition === "BELOW" && price <= target);

        if (isTriggered) {
          console.log(`[Price Alert Worker] Alert triggered: ${alert.symbol} @ $${price} (target: ${alert.condition} $${target})`);
          await storage.markAlertTriggered(alert.id);
          await sendNotificationsForAlert(alert, price);
        }
      } catch (err) {
        console.error(`[Price Alert Worker] Error checking alert ${alert.id}:`, err);
      }
    }
  } catch (err) {
    console.error("[Price Alert Worker] Error in worker:", err);
  }
}
