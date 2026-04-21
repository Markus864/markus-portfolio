# n8n Automations

A collection of n8n workflow JSON files for AI-powered social media content automation. Each workflow can be imported directly into any n8n instance.

---

## Workflows

### [`african-history-telegram-scheduler.json`](./african-history-telegram-scheduler.json)
**African History Telegram Auto-Scheduler**

Scheduled workflow that auto-generates African American history content and delivers it to a Telegram channel. Uses a Google Sheet as a caption queue — reads the top entry, generates AI images via Flux, synthesizes narration audio via ElevenLabs, and sends both to Telegram. Automatically refills the caption sheet when it runs low.

**Stack:** OpenAI GPT-4 · ElevenLabs TTS · FAL.ai Flux (image generation) · Google Sheets · Telegram · Cron Scheduler

---

### [`anubis-tiktok-ai-avatar-pipeline.json`](./anubis-tiktok-ai-avatar-pipeline.json)
**Anubis TikTok AI Avatar Pipeline**

Telegram-triggered workflow that produces TikTok-ready short videos featuring the Anubis AI character. Send a photo + caption to the bot → Perplexity searches current trends → GPT-4 writes an in-character script → ElevenLabs voices it → VEED.io Fabric lip-syncs the avatar → final video is returned to Telegram with a GPT-generated caption.

**Stack:** OpenAI GPT-4o-mini · Perplexity · ElevenLabs · FAL.ai · VEED.io Fabric · Google Sheets · Telegram

---

### [`automation-mentor-tiktok-ai-avatar-pipeline.json`](./automation-mentor-tiktok-ai-avatar-pipeline.json)
**AI Automation Mentor TikTok Pipeline**

Same pipeline architecture as the Anubis workflow but uses an Industrial Automation Mentor persona — educational, authoritative content targeting engineers and technicians. Scripts focus on PLC logic, reliability, safety, and career growth in automation.

**Stack:** OpenAI GPT-4o-mini · Perplexity · ElevenLabs · FAL.ai · VEED.io Fabric · Google Sheets · Telegram

---

### [`ai-character-telegram-video-pipeline.json`](./ai-character-telegram-video-pipeline.json)
**AI Character Telegram Video Pipeline**

Advanced image-to-video pipeline for a consistent AI character. Send a prompt to the bot → GPT-4o generates image and video prompts → Nano Banana 2 (FAL.ai) edits a reference image with the prompt for identity consistency → Kling 2.6 Pro animates it → video is uploaded to Cloudinary and delivered back via Telegram.

**Stack:** OpenAI GPT-4o · FAL.ai Nano Banana 2 · FAL.ai Kling · Cloudinary · Telegram

---

## Setup

1. Import any `.json` file into your n8n instance via **Workflows → Import from file**
2. Fill in your credentials in the **Configuration / Workflow Configuration** node:
   - `elevenLabsApiKey` → your ElevenLabs API key
   - `falApiKey` → your FAL.ai API key
   - `cloudinaryCloudName` → your Cloudinary cloud name
3. Connect your own n8n credential accounts (Telegram, OpenAI, Google Sheets, Perplexity)
4. Update Google Sheets document IDs to point to your own sheets
5. Activate the workflow
