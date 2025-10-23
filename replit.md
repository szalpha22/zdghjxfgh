# ClipHub - Discord Bot & Web Platform

## Overview
ClipHub is a comprehensive Discord bot and web application designed to manage clip campaigns, track submissions, handle payouts, and provide detailed analytics for content creators. The platform integrates Discord bot functionality with a full-featured web dashboard, focusing on business vision, market potential, and project ambitions within the content creation economy.

## User Preferences
- Project imported from GitHub
- Prefer maintaining existing code structure and conventions
- Database: SQLite (existing setup maintained)
- Authentication: Discord OAuth2 (existing setup maintained)

## System Architecture

### Technology Stack
- **Backend:** Node.js with Express.js
- **Database:** SQLite3 (better-sqlite3)
- **Discord Bot:** Discord.js v14
- **Authentication:** Passport.js with Discord OAuth2
- **View Engine:** EJS templates

### UI/UX Decisions
The platform features a modern, consistent UI/UX with a prominent red and black color scheme applied across all pages and components. This includes:
- Redesigned campaign cards with live badges and budget trackers.
- Individual campaign pages detailing requirements and statistics.
- A centralized "Submit" action button in the mobile navigation.
- Consistent branding with a circular "CH" logo.

### Technical Implementations & Feature Specifications

**Discord Bot Features:**
- **Campaign Management:** Create, manage, and end clip campaigns with `/addcampaign`, `/editcampaign` commands. Supports Clipping, Reposting, and UGC campaign types.
- **Submission System:** Users submit clips for automatic view tracking, supporting YouTube, TikTok, Instagram, and Twitter.
- **Payout Management:** Request and process payouts with proof verification.
- **Intelligent Account Verification:** A three-tier system for verifying social media accounts: API-first, Web Scraping fallback, and automated ticket creation for manual review.
- **Moderation Tools:** Comprehensive tools including ban, kick, warn, timeout, and nuke protection.
- **Invite Tracking:** Reward users for invites.
- **Ticket System:** Automated support ticket creation, including for verification failures.
- **Analytics:** Detailed statistics, leaderboards, and historical view data.

**Web Dashboard Features:**
- **Secure Authentication:** Discord OAuth login.
- **User Interface:** Browse active campaigns, submit clips, request payouts, view leaderboards.
- **Admin Panel:** Manage campaigns, approve submissions, process payouts, and manage database.

**System Design Choices:**
- **Project Structure:** Clear separation of bot (`src/`), web (`web/`), and cron (`cron/`) functionalities.
- **Database Persistence:** SQLite (`clipmaster.db`) is used for persistent storage, with the database file excluded from version control to maintain state across restarts. Manual backups are supported.
- **Internal API:** An internal API server facilitates communication between the Discord bot and the web application for transactional campaign creation and editing, ensuring data consistency with automatic rollbacks.
- **Automated View Tracking:** Hourly cron jobs fetch and update view counts from various social media platforms.
- **Deployment:** Designed for persistent VM deployment, running both Discord bot and web server simultaneously via `start.js`.

## External Dependencies
- **Discord API:** Via `discord.js` for bot functionality and `passport-discord` for OAuth2 authentication.
- **YouTube Data API v3:** For fetching YouTube video data and view counts.
- **RapidAPI:** Used for TikTok and Twitter scraping/data retrieval.
- **node-cron:** For scheduling automated tasks like view tracking and account re-verification.

## Recent Changes

### October 23, 2025 - Enhanced Features Update
1. **Multiple Social Media Accounts Per Platform**
   - Removed UNIQUE constraint from `social_accounts` table
   - Users can now link multiple accounts for the same platform (e.g., multiple YouTube channels)
   - Updated `/linkaccount` command to support this functionality

2. **Unlimited Video Submissions Per Campaign**
   - Removed the duplicate submission check that limited users to one submission per campaign
   - Users can now submit unlimited videos to the same campaign
   - Each submission is still tracked and approved individually

3. **Manual View Updates for Admins**
   - New `/updateviews` command allows admins to manually update view counts for approved submissions
   - Automatically recalculates earnings and updates user balance
   - Updates campaign budget tracking
   - Logs all view updates to view_logs table

4. **Enhanced Approval Process**
   - `/approveclip` command now requires admin to input current view count
   - Ensures accurate initial view tracking at approval time
   - Eliminates reliance on potentially failing API calls during approval

5. **Website UI Updates**
   - Added purple gradient buttons for campaign actions (View Details, etc.)
   - Improved campaign card styling with purple accents
   - Maintained red/black theme for primary branding

6. **Database Schema Updates**
   - Added `updated_at` column to `submissions` table for better tracking
   - Migrated `social_accounts` table to support multiple accounts per platform
   - All migrations applied automatically on startup