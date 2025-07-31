-- CreateEnum
CREATE TYPE "GameMasterInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "GameInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('SETUP', 'ACTIVE', 'COMPLETED');

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "display_name" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "games" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "game_master_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "GameStatus" NOT NULL DEFAULT 'SETUP',
    "winner_id" UUID,
    "word_list" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "card_types" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "published_at" TIMESTAMPTZ(6),
    "bonus_square" INTEGER,
    "wildcard_square" INTEGER,
    "square_mark_history" JSONB[] DEFAULT ARRAY[]::JSONB[],

    CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_participants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "game_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "completed_cells" INTEGER[] DEFAULT ARRAY[12]::INTEGER[],
    "score" INTEGER NOT NULL DEFAULT 1,
    "score_breakdown" JSONB[] DEFAULT ARRAY[]::JSONB[],
    "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "board_data" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "card_type_data" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "photo_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "media_urls" JSONB[] DEFAULT ARRAY[]::JSONB[],
    "media_types" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "has_won" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "game_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_participants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "game_id" UUID NOT NULL,
    "email" TEXT NOT NULL DEFAULT '',
    "guest_name" TEXT,
    "completed_cells" INTEGER[] DEFAULT ARRAY[12]::INTEGER[],
    "score" INTEGER NOT NULL DEFAULT 1,
    "score_breakdown" JSONB[] DEFAULT ARRAY[]::JSONB[],
    "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "board_data" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "card_type_data" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "photo_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "media_urls" JSONB[] DEFAULT ARRAY[]::JSONB[],
    "media_types" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "has_won" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "guest_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_invites" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "game_id" UUID NOT NULL,
    "user_id" UUID,
    "invited_by" UUID NOT NULL,
    "status" "GameInviteStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "email" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "token" TEXT NOT NULL DEFAULT gen_random_uuid(),

    CONSTRAINT "game_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_masters" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "game_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_masters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_master_invites" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "game_id" UUID NOT NULL,
    "user_id" UUID,
    "invited_by" UUID NOT NULL,
    "status" "GameMasterInviteStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "email" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "token" TEXT NOT NULL DEFAULT gen_random_uuid(),

    CONSTRAINT "game_master_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "profiles_email_key" ON "profiles"("email");

-- CreateIndex
CREATE UNIQUE INDEX "game_participants_game_id_user_id_key" ON "game_participants"("game_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "guest_participants_game_id_email_key" ON "guest_participants"("game_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "game_invites_token_key" ON "game_invites"("token");

-- CreateIndex
CREATE UNIQUE INDEX "game_invites_game_id_email_key" ON "game_invites"("game_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "game_masters_game_id_user_id_key" ON "game_masters"("game_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "game_master_invites_token_key" ON "game_master_invites"("token");

-- CreateIndex
CREATE UNIQUE INDEX "game_master_invites_game_id_email_key" ON "game_master_invites"("game_id", "email");

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_game_master_id_fkey" FOREIGN KEY ("game_master_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_winner_id_fkey" FOREIGN KEY ("winner_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_participants" ADD CONSTRAINT "game_participants_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_participants" ADD CONSTRAINT "game_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_participants" ADD CONSTRAINT "guest_participants_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_invites" ADD CONSTRAINT "game_invites_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_invites" ADD CONSTRAINT "game_invites_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_invites" ADD CONSTRAINT "game_invites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_masters" ADD CONSTRAINT "game_masters_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_masters" ADD CONSTRAINT "game_masters_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_master_invites" ADD CONSTRAINT "game_master_invites_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_master_invites" ADD CONSTRAINT "game_master_invites_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_master_invites" ADD CONSTRAINT "game_master_invites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
