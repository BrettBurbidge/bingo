# 🚀 Vercel Deployment Guide

This guide will help you deploy your Bingo application to Vercel.

## 📋 Prerequisites

Before deploying, ensure you have:

1. **Supabase Project** - Set up with authentication and database
2. **Resend Account** - For email functionality
3. **Vercel Account** - Free tier is sufficient
4. **Domain (Optional)** - For custom email addresses

## 🔧 Step 1: Prepare Your Services

### Supabase Setup

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Navigate to your project → **Settings** → **API**
3. Copy these values:
   - `Project URL` → `PUBLIC_SUPABASE_URL`
   - `anon public` → `PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY`

4. Navigate to **Settings** → **Database**
5. Copy the connection strings:
   - **Connection pooling** → `DATABASE_URL`
   - **Direct connection** → `DIRECT_URL`

### Resend Setup

1. Go to [Resend Dashboard](https://resend.com/api-keys)
2. Create an API key → Copy as `RESEND_API_KEY`
3. **(Production)** Verify your domain at [Resend Domains](https://resend.com/domains)
4. Use verified domain for `RESEND_FROM_EMAIL`

## 🚀 Step 2: Deploy to Vercel

### Option A: GitHub Integration (Recommended)

1. **Connect Repository**

   ```bash
   # Ensure your code is pushed to GitHub
   git add .
   git commit -m "Prepare for Vercel deployment"
   git push origin main
   ```

2. **Import to Vercel**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click **"New Project"**
   - Import your GitHub repository: `BlueHoss/bingo`
   - Framework: **SvelteKit** (auto-detected)

### Option B: Direct Deployment

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy from your project directory
vercel --prod
```

## ⚙️ Step 3: Configure Environment Variables

In your Vercel project dashboard:

1. Go to **Settings** → **Environment Variables**
2. Add these variables for **Production**:

| Variable Name               | Value                            | Required |
| --------------------------- | -------------------------------- | -------- |
| `PUBLIC_SUPABASE_URL`       | `https://your-id.supabase.co`    | ✅       |
| `PUBLIC_SUPABASE_ANON_KEY`  | Your Supabase anon key           | ✅       |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key   | ✅       |
| `DATABASE_URL`              | Supabase connection pooling URL  | ✅       |
| `DIRECT_URL`                | Supabase direct connection URL   | ✅       |
| `RESEND_API_KEY`            | Your Resend API key              | ✅       |
| `RESEND_FROM_EMAIL`         | `Bingo <noreply@yourdomain.com>` | ✅       |

### 🔑 Where to Find These Values:

#### Supabase Values:

```
Dashboard → Your Project → Settings → API:
- PUBLIC_SUPABASE_URL: Project URL
- PUBLIC_SUPABASE_ANON_KEY: anon public key
- SUPABASE_SERVICE_ROLE_KEY: service_role key

Dashboard → Your Project → Settings → Database:
- DATABASE_URL: Connection pooling string
- DIRECT_URL: Direct connection string
```

#### Resend Values:

```
https://resend.com/api-keys:
- RESEND_API_KEY: Create new API key

For production (verify domain first):
- RESEND_FROM_EMAIL: Bingo <noreply@yourdomain.com>

For testing:
- RESEND_FROM_EMAIL: Bingo <onboarding@resend.dev>
```

## 🗄️ Step 4: Database Migration

Your Prisma database should be set up through Supabase. If you need to run migrations:

```bash
# Run this locally with production DATABASE_URL
npx prisma db push
```

## ✅ Step 5: Verify Deployment

1. **Check Build Logs** - Ensure no errors in Vercel deployment
2. **Test Authentication** - Sign up/login functionality
3. **Test Email** - Send a game invitation
4. **Test Game Flow** - Create game, invite players, play
5. **Check Mobile** - Verify responsive design

## 🌍 Step 6: Custom Domain (Optional)

1. **In Vercel Dashboard:**
   - Go to **Settings** → **Domains**
   - Add your custom domain
   - Configure DNS records as instructed

2. **Update Email Domain:**
   - Verify your domain in Resend
   - Update `RESEND_FROM_EMAIL` to use your domain

## 🔧 Troubleshooting

### Common Issues:

**Build Fails:**

- Check environment variables are set
- Ensure all dependencies in `package.json`

**Database Connection:**

- Verify DATABASE_URL and DIRECT_URL
- Check Supabase project is active

**Email Not Sending:**

- Verify RESEND_API_KEY
- Check domain verification for production
- Use resend.dev domain for testing

**Authentication Issues:**

- Verify Supabase URL and keys
- Check Supabase auth settings

## 📞 Support

- **Vercel Docs:** [vercel.com/docs](https://vercel.com/docs)
- **SvelteKit Adapter:** [kit.svelte.dev/docs/adapter-vercel](https://kit.svelte.dev/docs/adapter-vercel)
- **Supabase Docs:** [supabase.com/docs](https://supabase.com/docs)

---

🎯 **Your Bingo app will be live at:** `https://your-project.vercel.app`
