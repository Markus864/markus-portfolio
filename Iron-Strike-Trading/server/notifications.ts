import type { SelectPriceAlert, User } from "@shared/schema";
import { env, isSESConfigured } from "./config/env";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { sendUserAlert, sendWebhookAlert } from "./bot";
import { storage } from "./storage";

let sesClient: SESClient | null = null;

if (isSESConfigured()) {
  sesClient = new SESClient({
    region: env.ses.region,
    credentials: {
      accessKeyId: env.ses.accessKeyId,
      secretAccessKey: env.ses.secretAccessKey,
    },
  });
}

export async function sendNotificationsForAlert(alert: SelectPriceAlert, price: number) {
  const message = `🔔 ${alert.symbol} is now $${price.toFixed(2)} (${alert.condition} $${alert.targetPrice})`;
  const tasks: Promise<unknown>[] = [];

  // Get user settings for personalized notifications
  let user: User | undefined;
  if (alert.userId) {
    user = await storage.getUser(alert.userId);
  }

  if (alert.notifyTelegram) {
    const chatId = user?.telegramChatId;
    if (chatId) {
      tasks.push(sendTelegramAlertToUser(chatId, message));
    } else {
      // Legacy fallback: use global Telegram settings
      tasks.push(sendTelegramAlert(message));
    }
  }
  if (alert.notifyDiscord) {
    // Send DM if discordUserId is set, otherwise try user webhook, then global webhook
    if (user?.discordUserId) {
      tasks.push(sendUserAlert(user.discordUserId, message, `Price Alert: ${alert.symbol}`));
    } else if (user?.discordWebhookUrl) {
      tasks.push(sendWebhookAlert(user.discordWebhookUrl, message, `Price Alert: ${alert.symbol}`));
    } else {
      // Legacy fallback: use global Discord webhook
      tasks.push(sendDiscordAlert(message));
    }
  }
  if (alert.notifyEmail) {
    const email = user?.email;
    if (email) {
      tasks.push(sendEmailAlertToUser(email, alert, message));
    } else {
      // Legacy fallback: use global email settings
      tasks.push(sendEmailAlert(alert, message));
    }
  }

  await Promise.allSettled(tasks);
}

async function sendTelegramAlertToUser(chatId: string, message: string) {
  const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
  
  if (!telegramBotToken) {
    console.log("[Telegram] Bot token not configured, skipping notification");
    return;
  }
  
  try {
    const url = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
      }),
    });
    
    if (!response.ok) {
      console.error("[Telegram] Failed to send message:", await response.text());
    } else {
      console.log(`[Telegram] Alert sent to user ${chatId}`);
    }
  } catch (error) {
    console.error("[Telegram] Error sending alert:", error);
  }
}

async function sendTelegramAlert(message: string) {
  const { telegramBotToken, telegramChatId } = env.notifications;
  
  if (!telegramBotToken || !telegramChatId) {
    console.log("[Telegram] Bot token or chat ID not configured, skipping notification");
    return;
  }
  
  try {
    const url = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: telegramChatId,
        text: message,
      }),
    });
    
    if (!response.ok) {
      console.error("[Telegram] Failed to send message:", await response.text());
    } else {
      console.log("[Telegram] Alert sent successfully");
    }
  } catch (error) {
    console.error("[Telegram] Error sending alert:", error);
  }
}

async function sendDiscordAlert(message: string) {
  const { discordWebhookUrl } = env.notifications;
  
  if (!discordWebhookUrl) {
    console.log("[Discord] Webhook URL not configured, skipping notification");
    return;
  }
  
  try {
    const response = await fetch(discordWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: message }),
    });
    
    if (!response.ok) {
      console.error("[Discord] Failed to send message:", await response.text());
    } else {
      console.log("[Discord] Alert sent successfully");
    }
  } catch (error) {
    console.error("[Discord] Error sending alert:", error);
  }
}

export async function sendUserDiscordNotification(
  discordUserId: string | null | undefined,
  discordWebhookUrl: string | null | undefined,
  message: string,
  title: string = "Iron Strike Alert"
): Promise<void> {
  const tasks: Promise<boolean>[] = [];
  
  if (discordUserId) {
    tasks.push(sendUserAlert(discordUserId, message, title));
  }
  
  if (discordWebhookUrl) {
    tasks.push(sendWebhookAlert(discordWebhookUrl, message, title));
  }
  
  if (tasks.length > 0) {
    await Promise.allSettled(tasks);
  }
}

async function sendEmailAlertToUser(toEmail: string, alert: SelectPriceAlert, message: string) {
  if (!isSESConfigured() || !sesClient) {
    console.log("[Email] SES not configured, skipping email notification for", alert.symbol);
    return;
  }
  
  const { fromAddress } = env.ses;
  
  try {
    const subject = `Iron Strike Alert: ${alert.symbol} Price Target Hit`;
    const body = `
Iron Strike Trading Alert

${message}

Symbol: ${alert.symbol}
Current Price: $${alert.targetPrice}
Condition: ${alert.condition}

This is an automated alert from Iron Strike Trading.
    `.trim();
    
    const command = new SendEmailCommand({
      Destination: {
        ToAddresses: [toEmail],
      },
      Message: {
        Body: {
          Text: {
            Charset: "UTF-8",
            Data: body,
          },
        },
        Subject: {
          Charset: "UTF-8",
          Data: subject,
        },
      },
      Source: fromAddress,
    });

    await sesClient.send(command);
    console.log(`[Email] Alert sent to ${toEmail} via SES`);
  } catch (error) {
    console.error("[Email] Error sending SES email:", error);
  }
}

async function sendEmailAlert(alert: SelectPriceAlert, message: string) {
  if (!isSESConfigured() || !sesClient) {
    console.log("[Email] SES not configured, skipping email notification for", alert.symbol);
    return;
  }
  
  const { fromAddress } = env.ses;
  
  try {
    const toAddress = fromAddress;
    const subject = `Iron Strike Alert: ${alert.symbol} Price Target Hit`;
    const body = `
Iron Strike Trading Alert

${message}

Symbol: ${alert.symbol}
Current Price: $${alert.targetPrice}
Condition: ${alert.condition}

This is an automated alert from Iron Strike Trading.
    `.trim();
    
    const command = new SendEmailCommand({
      Destination: {
        ToAddresses: [toAddress],
      },
      Message: {
        Body: {
          Text: {
            Charset: "UTF-8",
            Data: body,
          },
        },
        Subject: {
          Charset: "UTF-8",
          Data: subject,
        },
      },
      Source: fromAddress,
    });

    await sesClient.send(command);
    console.log("[Email] Alert sent successfully via SES");
  } catch (error) {
    console.error("[Email] Error sending SES email:", error);
  }
}
