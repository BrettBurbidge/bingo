# Bingo

A multiplayer bingo game built with SvelteKit, Supabase, Prisma, and Tailwind CSS. Perfect for group activities where multiple players can join games and compete on shared bingo boards!

## Features

- 🎮 **Multiplayer Bingo Games**: Create games and invite friends
- 🏆 **Real-time Leaderboards**: See how you stack up against other players
- 🎯 **5x5 Bingo Boards**: Classic bingo format with customizable content
- 👤 **User Authentication**: Secure login/signup with Supabase
- 📱 **Responsive Design**: Works great on desktop and mobile
- 🎨 **Modern UI**: Built with shadcn/ui and Tailwind CSS
- 🔧 **Type-Safe Database**: Prisma ORM for robust database operations

## Game Rules

- Each bingo board is 5x5 with 25 squares
- The center square is always FREE (automatically marked)
- Players can mark squares they've completed
- Score is tracked as completed squares out of 25
- Only game masters can create games and invite players
- Players can only see games they're invited to

## Tech Stack

- **Frontend**: SvelteKit + TypeScript
- **UI**: Tailwind CSS + shadcn/ui components
- **Backend**: Supabase (Database + Authentication)
- **ORM**: Prisma for type-safe database operations
- **Deployment**: Vercel (recommended)

## Setup Instructions

### 1. Clone the Repository

\`\`\`bash
git clone <your-repo-url>
cd Bingo
npm install
\`\`\`

### 2. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Copy the values from `env.example` to create your `.env.local` file
3. You can find the required values in your Supabase project settings:
   - Go to Settings → API for the URL and anon key
   - Go to Settings → Database for the connection string

### 3. Environment Variables

Copy `env.example` to `.env.local` and fill in your actual values:

\`\`\`bash
cp env.example .env.local
\`\`\`

Then edit `.env.local` with your actual Supabase credentials:

\`\`\`env
PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
DATABASE_URL=postgresql://postgres:your_password@db.your-project-ref.supabase.co:5432/postgres
\`\`\`

### 4. Database Setup with Prisma

Since we're using Prisma as our ORM, you have two options:

#### Option A: Use Prisma Migrate (Recommended for new databases)

\`\`\`bash

# Generate the Prisma client

npx prisma generate

# Apply the database schema

npx prisma db push
\`\`\`

#### Option B: Use existing Supabase database with RLS policies

If you already have a Supabase database, run this SQL in your Supabase SQL editor:

\`\`\`sql
-- Enable Row Level Security and create policies
-- (This is important for Supabase authentication integration)

-- Create profiles table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS public.profiles (
id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
email TEXT NOT NULL UNIQUE,
display_name TEXT,
created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create games table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS public.games (
id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
name TEXT NOT NULL,
board_data JSONB NOT NULL,
game_master_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create game_participants table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS public.game_participants (
id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
completed_cells INTEGER[] DEFAULT ARRAY[12],
score INTEGER DEFAULT 1,
joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
UNIQUE(game_id, user_id)
);

-- Create game_invites table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS public.game_invites (
id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
invited_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED')),
created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
UNIQUE(game_id, user_id)
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_invites ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (same as before)
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles
FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile." ON public.profiles
FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile." ON public.profiles
FOR UPDATE USING (auth.uid() = id);

-- Add other RLS policies as needed...
\`\`\`

### 5. Set up HTTPS for Development (Required for Supabase Auth)

Supabase authentication requires HTTPS. Set up SSL certificates:

\`\`\`bash

# Install mkcert (if not already installed)

brew install mkcert

# Install the local certificate authority

mkcert -install

# Create SSL certificates

mkdir -p certs
mkcert -key-file certs/localhost-key.pem -cert-file certs/localhost.pem localhost 127.0.0.1 ::1

# Check SSL setup

npm run ssl:check
\`\`\`

### 6. Generate Prisma Client and Run the Application

\`\`\`bash

# Generate the Prisma client (do this after setting up your database)

npx prisma generate

# Start the development server with HTTPS

npm run dev
\`\`\`

The application will be available at \`https://localhost:5173\` (note the HTTPS)

### 6. Database Management Commands

Useful Prisma commands for ongoing development:

\`\`\`bash

# View your database in Prisma Studio

npx prisma studio

# Reset your database (careful - this deletes all data!)

npx prisma db push --force-reset

# Generate Prisma client after schema changes

npx prisma generate

# Push schema changes to database

npx prisma db push
\`\`\`

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Connect your GitHub repo to Vercel
3. Add your environment variables in Vercel's dashboard:
   - `PUBLIC_SUPABASE_URL`
   - `PUBLIC_SUPABASE_ANON_KEY`
   - `DATABASE_URL`
4. Deploy!

### Environment Variables for Production

Make sure to add these environment variables in your deployment platform:

- `PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anonymous key
- `DATABASE_URL` - Your Postgres connection string

## Development

### Adding New Features

When adding new database features:

1. Update the Prisma schema in `prisma/schema.prisma`
2. Run `npx prisma db push` to apply changes
3. Run `npx prisma generate` to update the client
4. Update your application code with the new types

### Database Schema

The application uses these main models:

- `Profile` - User profiles linked to Supabase auth
- `Game` - Bingo games with board data
- `GameParticipant` - Players in games with their scores
- `GameInvite` - Invitations to join games

## Usage

1. **Sign Up/Sign In**: Create an account or sign in with existing credentials
2. **Create a Game**: Click "Create New Game" on the dashboard
3. **Customize Board**: Edit the default bingo board content to match your activities
4. **Invite Players**: Share the game by inviting players via email
5. **Play**: Players can mark completed squares and see real-time leaderboards
6. **Track Progress**: Monitor scores and compete with friends!

## Project Structure

\`\`\`
src/
├── lib/
│ ├── components/ui/ # Reusable UI components
│ ├── auth.ts # Authentication utilities
│ ├── games.ts # Game management functions
│ ├── prisma.ts # Prisma client instance
│ ├── supabase.ts # Supabase client
│ └── utils.ts # Utility functions
├── routes/
│ ├── +layout.svelte # Main layout with navigation
│ ├── +page.svelte # Login/signup page
│ ├── dashboard/ # Dashboard route
│ └── game/[id]/ # Individual game route
├── app.css # Global styles with Tailwind
prisma/
└── schema.prisma # Database schema
\`\`\`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with your local database
5. Submit a pull request

## License

MIT License - feel free to use this project for your own bingo games!
