import { Webhook } from 'svix';
import { Request, Response } from 'express';
import { db } from './db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

export async function handleClerkWebhook(req: Request, res: Response) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    console.error('[Clerk Webhook] CLERK_WEBHOOK_SECRET not configured');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  const svix_id = req.headers["svix-id"] as string;
  const svix_timestamp = req.headers["svix-timestamp"] as string;
  const svix_signature = req.headers["svix-signature"] as string;

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return res.status(400).json({ error: 'Missing svix headers' });
  }

  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: any;

  try {
    const payload = JSON.stringify(req.body);
    evt = wh.verify(payload, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    });
  } catch (err: any) {
    console.error('[Clerk Webhook] Verification failed:', err.message);
    return res.status(400).json({ error: err.message });
  }

  const eventType = evt.type;

  if (eventType === 'user.created' || eventType === 'user.updated') {
    const { id, email_addresses, first_name, last_name, image_url, external_accounts } = evt.data;

    const primaryEmail = email_addresses?.[0]?.email_address;

    const discordAccount = external_accounts?.find((acc: any) => acc.provider === 'oauth_discord');
    const discordUserId = discordAccount ? discordAccount.provider_user_id : null;

    try {
      await db.insert(users).values({
        id: id,
        email: primaryEmail,
        firstName: first_name,
        lastName: last_name,
        profileImageUrl: image_url,
        discordUserId: discordUserId,
        role: 'free',
      }).onConflictDoUpdate({
        target: users.id,
        set: {
          email: primaryEmail,
          firstName: first_name,
          lastName: last_name,
          profileImageUrl: image_url,
          discordUserId: discordUserId,
          updatedAt: new Date(),
        }
      });

      console.log(`[Clerk Webhook] User ${id} synced. Discord ID: ${discordUserId || 'Not linked'}`);
    } catch (dbError) {
      console.error('[Clerk Webhook] Database error:', dbError);
      return res.status(500).json({ error: 'Database sync failed' });
    }
  }

  return res.status(200).json({ success: true });
}
