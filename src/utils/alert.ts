import axios from 'axios';

let lastSentAt = 0;

export async function sendAlert(
  webhookUrl: string | undefined,
  message: string,
  minIntervalMs: number = 60000
): Promise<void> {
  if (!webhookUrl) {
    return;
  }

  const now = Date.now();
  if (now - lastSentAt < minIntervalMs) {
    return;
  }

  lastSentAt = now;

  try {
    await axios.post(webhookUrl, { text: message }, { timeout: 5000 });
  } catch (error) {
    console.error('Failed to send alert:', error);
  }
}
