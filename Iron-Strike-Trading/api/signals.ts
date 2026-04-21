import type { GenerateSignalsPayload, SignalsResponse } from "@/types/signals";

export async function generateSignals(
  payload: GenerateSignalsPayload
): Promise<SignalsResponse> {
  const response = await fetch("/api/signals", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Request failed with status ${response.status}`);
  }

  return response.json();
}
