# n8n Self-Hosted on Fly.io

Automated customer outreach workflows triggered by Stripe events.

## Deploy

```bash
cd n8n

# Create the Fly app
fly apps create n8n-resumetailor

# Create persistent volume for n8n data (workflows, credentials, DB)
fly volumes create n8n_data --region iad --size 1

# Set secrets (required)
fly secrets set \
  N8N_BASIC_AUTH_USER=admin \
  N8N_BASIC_AUTH_PASSWORD=your-secure-password \
  N8N_ENCRYPTION_KEY=$(openssl rand -hex 32)

# Deploy
fly deploy
```

## Access

Once deployed, visit https://n8n-resumetailor.fly.dev and log in with your basic auth credentials.

## Workflows to Set Up

### 1. Cancellation Feedback Email
- **Trigger**: Stripe Webhook → `customer.subscription.deleted`
- **Steps**:
  1. Stripe webhook receives cancellation event
  2. Extract customer email + cancellation comment from Stripe
  3. OpenAI generates personalized email from template
  4. Send email via Gmail/SMTP

### 2. Trial Started Welcome
- **Trigger**: Stripe Webhook → `customer.subscription.created` (trial)
- **Steps**: Welcome email with tips

### 3. Inactive Trial User Nudge
- **Trigger**: Cron (daily) → check Stripe for trial users
- **Steps**: Query your DB or Stripe for users who haven't used the product, send nudge

### 4. Trial Ending Reminder
- **Trigger**: Stripe Webhook → `customer.subscription.trial_will_end`
- **Steps**: Reminder email with value prop

## Stripe Webhook Setup

In Stripe Dashboard → Developers → Webhooks:
- Endpoint URL: `https://n8n-resumetailor.fly.dev/webhook/stripe`
- Events to listen for:
  - `customer.subscription.deleted`
  - `customer.subscription.created`
  - `customer.subscription.trial_will_end`
  - `customer.subscription.updated`

## Cost

Fly.io free tier includes:
- 3 shared-cpu-1x VMs (256mb) — we use 1 with 512mb
- ~$3-5/month for the 512mb VM if you exceed free tier
- 1GB persistent volume free

**vs n8n Cloud at $20/month**, this saves ~$15-17/month.

## Backup

The SQLite database is on the Fly volume. To backup:
```bash
fly ssh console -C "cat /home/node/.n8n/database.sqlite" > n8n-backup.sqlite
```
