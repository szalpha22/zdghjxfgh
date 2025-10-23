# ClipHub - Complete Feature Documentation

**A comprehensive Discord bot and web platform for managing video clip campaigns across multiple social media platforms.**

---

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Discord Bot Features](#discord-bot-features)
4. [Web Dashboard Features](#web-dashboard-features)
5. [Internal API Communication](#internal-api-communication)
6. [Database Schema](#database-schema)
7. [Automation & Cron Jobs](#automation--cron-jobs)
8. [Security Features](#security-features)

---

## 🎯 System Overview

ClipHub is an enterprise-grade platform designed for content creators and agencies managing video clip campaigns. It seamlessly integrates Discord bot functionality with a full-featured web dashboard, enabling:

- **Multi-platform support**: YouTube, TikTok, Instagram, Twitter/X
- **Automated tracking**: Hourly view count updates via API integrations
- **Smart verification**: Three-tier account verification system with automatic fallbacks
- **Payout management**: User balance system with proof-of-payment verification
- **Campaign lifecycle**: From creation to completion with budget tracking and milestone alerts
- **Role-based access**: Granular permissions for admins, staff, and verified clippers

### Key Statistics
- **63 slash commands** deployed across 3 categories (Admin, User, Utility)
- **8 event handlers** for comprehensive Discord monitoring
- **Supports 3 campaign types**: Clipping, Reposting, UGC
- **4 social platforms**: Full integration with view tracking APIs
- **Single instance lock**: Prevents duplicate processing and message sending

---

## 🏗️ Architecture

### Technology Stack

**Backend:**
- Node.js with Express.js
- SQLite3 (better-sqlite3) for persistent storage
- Discord.js v14 for bot functionality
- Passport.js with Discord OAuth2 for web authentication

**Frontend:**
- EJS templating engine
- TailwindCSS for responsive design
- Chart.js for analytics visualization
- Mobile-optimized with ClipHub red branding

**External Integrations:**
- YouTube Data API v3 for video metadata and view counts
- RapidAPI for TikTok and Twitter data scraping
- Instagram RapidAPI for Instagram content verification
- Discord OAuth2 for seamless authentication

### Project Structure

```
ClipHub/
├── src/                          # Discord Bot
│   ├── commands/
│   │   ├── admin/               # 35 admin commands
│   │   ├── user/                # 19 user commands
│   │   └── utility/             # 9 utility commands
│   ├── events/                  # 8 Discord event handlers
│   ├── utils/                   # Helper functions & systems
│   └── index.js                 # Bot entry point + Internal API server
│
├── web/                         # Web Dashboard
│   ├── routes/                  # Express routes
│   ├── views/                   # EJS templates
│   ├── public/                  # Static assets
│   ├── middleware/              # Auth & logging middleware
│   ├── api/                     # Bot API client
│   └── server.js                # Web server entry point
│
├── cron/                        # Scheduled tasks
│   ├── viewTracker.js          # Hourly view updates
│   ├── autoVerify.js           # Account re-verification
│   └── budgetChecker.js        # Campaign budget alerts
│
├── start.js                     # Main launcher with single instance lock
└── clipmaster.db               # SQLite database (persistent)
```

### System Flow

```
User → Discord Bot → SQLite Database ← Web Dashboard ← User Browser
              ↓                              ↑
        Internal API (Port 5001) ─────────────┘
              ↓
         Cron Jobs → External APIs (YouTube, TikTok, etc.)
```

---

## 🤖 Discord Bot Features

### Campaign Management (Admin Only)

#### `/addcampaign` - Create New Campaign
Creates a new campaign with automatic role and channel setup.

**Parameters:**
- `name`: Campaign name
- `type`: Clipping | Reposting | UGC
- `description`: Campaign details and requirements
- `budget`: Total budget in USD
- `rate`: Pay per 1000 views
- `min_views`: Minimum views required for payout
- `platforms`: YouTube, TikTok, Instagram, Twitter (multi-select)

**Automated Actions:**
1. Creates dedicated campaign role with ClipHub red color
2. Creates private campaign channel in designated category
3. Sets channel permissions (only role members can view)
4. Posts campaign announcement with all details
5. Logs action to admin logs channel

**Internal API Call:** Web dashboard can also create campaigns via POST `/api/campaigns/create`

---

#### `/editcampaign` - Modify Existing Campaign
Edit any campaign parameter including platforms.

**Parameters:**
- `campaign_id`: Campaign to edit
- `name`, `description`, `budget`, `rate`, `min_views`, `platforms`: (all optional)

**Features:**
- Real-time budget validation (cannot set below current spent amount)
- Updates Discord role name automatically
- Logs all changes to moderation logs
- Notifies campaign channel members of changes

**Internal API Call:** Web admin panel can edit via POST `/api/campaigns/edit`

---

#### `/endcampaign` - Close Campaign
Gracefully closes a campaign with cleanup.

**Actions:**
1. Sets campaign status to "ended"
2. Deletes campaign Discord role
3. Archives campaign channel
4. Sends final statistics to campaign channel
5. Logs completion to admin logs

---

#### `/pausecampaign` - Pause Campaign
Temporarily pauses new submissions without ending campaign.

**Features:**
- Prevents new clip submissions
- Existing submissions continue tracking
- Can be resumed later
- Updates campaign channel topic

---

### Submission System (User Commands)

#### `/submit` - Submit Clip for Campaign
Users submit their content for approval and tracking.

**Parameters:**
- `campaign`: Select active campaign
- `link`: Content URL (YouTube, TikTok, Instagram, Twitter)
- `title`: Submission title
- `description`: Optional notes

**Automated Processing:**
1. Validates URL format and platform
2. Checks campaign platform compatibility
3. Extracts video ID from URL
4. Fetches initial view count via API
5. Creates pending submission in database
6. Posts to flagged clips channel with approve/reject buttons
7. Sends confirmation DM to user

**Admin Review Interface:**
- Interactive Discord buttons for instant approval/rejection
- Approve button: Updates status, notifies user, adds views to tracking
- Reject button: Updates status, allows reason entry, notifies user with reason

**View Tracking:**
- Hourly cron job updates view counts
- Calculates earnings: `(current_views - initial_views) / 1000 * campaign_rate`
- Updates user balance automatically
- Sends milestone notifications (100K, 500K, 1M views)

---

#### `/linkaccount` - Link Social Media Account
Links social media account to Discord profile for submission verification.

**Supported Platforms:**
- YouTube (channel URL)
- TikTok (username)
- Instagram (username)
- Twitter (username)

**Three-Tier Verification System:**

**Tier 1 - API Verification (Instant)**
- YouTube: Uses Google YouTube Data API to verify channel exists and get metadata
- Twitter: Uses RapidAPI scraper to fetch profile data
- TikTok: Uses RapidAPI to verify user exists
- Instagram: Uses Instagram RapidAPI for profile verification

**Tier 2 - Web Scraping Fallback (5-10 seconds)**
- Cheerio-based scraping if API fails or rate limits hit
- Extracts profile information from public pages
- Validates account ownership indicators

**Tier 3 - Manual Review Ticket (If both fail)**
- Automatically creates Discord ticket channel (`ticket-123-verification`)
- Tags support staff for manual review
- User provides proof of ownership (screenshot, bio mention, etc.)
- Staff can `/verifyuser` or `/unverifyuser` after review
- Ticket can be closed with `/closeticket`

**Success Actions:**
- Saves account to database with platform metadata
- Assigns "Verified Clipper" role
- Sends success notification with account details
- Enables submission to compatible campaigns

**Re-verification:**
- Cron job re-verifies all accounts every 30 minutes
- Detects deleted/suspended accounts
- Auto-removes "Verified Clipper" role if account invalid
- Notifies user of account status changes

---

#### `/myaccounts` - View Linked Accounts
Displays all linked social media accounts with verification status.

**Information Shown:**
- Platform name with emoji
- Account username/channel name
- Verification status (✅ Verified / ❌ Failed)
- Follower/subscriber count (if available)
- Link to account

---

#### `/mystats` - Personal Statistics
Comprehensive user statistics dashboard.

**Metrics Displayed:**
- Total submissions (approved, pending, rejected)
- Total views across all clips
- Total earnings from approved clips
- Current account balance
- Campaign participation breakdown
- Top performing clip
- Average views per submission
- Clips by platform distribution

---

#### `/requestpayout` - Request Balance Payout
Users can withdraw their earned balance.

**Parameters:**
- `amount`: Amount to withdraw (must be ≤ current balance)
- `payment_method`: PayPal, Venmo, CashApp, Bank Transfer, etc.
- `payment_info`: Email or account identifier

**Processing Flow:**
1. Validates sufficient balance
2. Creates payout request in database
3. Deducts amount from user balance (reserved)
4. Posts to payout logs channel with approve/reject buttons
5. Admin reviews proof of payment
6. `/approvepayout` or `/rejectpayout` with reason
7. If approved: Marks paid, logs transaction
8. If rejected: Returns balance to user, notifies with reason

**Admin Commands:**
- `/approvepayout`: Confirm payment sent
- `/rejectpayout`: Return funds with explanation

---

### User Profile System

#### `/profile` - View User Profile
Rich embed displaying user information.

**Data Shown:**
- Discord avatar and username
- Account creation date
- Server join date
- Current roles
- Total submissions and earnings
- Account balance
- Verified accounts count
- Server invite count

---

#### `/rank` - User Rank Card
Displays user's leaderboard position.

**Features:**
- Current rank based on total earnings
- Total views and earnings
- Account balance
- Progress to next rank milestone

---

#### `/leaderboard` - Top Performers
Shows top 10 users by earnings.

**Categories:**
- Total earnings
- Total views
- Total approved submissions
- Current balance

**Filters:**
- All-time
- By specific campaign
- By platform
- By date range

---

### Moderation Tools (Admin Only)

#### User Management
- `/ban` - Ban user with reason and optional duration
- `/kick` - Remove user from server
- `/warn` - Issue warning to user
- `/warnings` - View user's warning history
- `/timeout` - Temporarily mute user
- `/mute` / `/unmute` - Permanent mute/unmute
- `/unban` - Remove ban

#### Channel Management
- `/lock` / `/unlock` - Lock/unlock channel to prevent messages
- `/slowmode` - Set slowmode delay (0-21600 seconds)
- `/clear` - Bulk delete messages (up to 100)
- `/prune` - Delete messages from specific user

#### Server Protection
- `/nuke` - Advanced anti-raid protection
  - Kicks all members joined in last X minutes
  - Locks down all channels
  - Requires special "Nuke Master" role
  - Creates detailed nuke report
  
- `/nukeinfo` - View nuke history and statistics
- `/restorenuke` - Restore server after nuke (unlock channels)

#### Campaign-Specific Moderation
- `/banclipper` - Ban user from all campaigns
  - Rejects all pending submissions
  - Prevents future submissions
  - Removes from campaign channels
  
- `/approveclip` - Manually approve submission
- `/rejectclip` - Manually reject submission with reason
- `/flagclip` - Flag submission for review

#### Admin Actions
- `/bonus` - Add bonus balance to user
- `/setpayout` - Set user's payout info (admin override)
- `/verifyuser` - Manually verify social account
- `/unverifyuser` - Manually remove verification

---

### Utility Commands

#### Information Commands
- `/help` - Interactive help menu with all commands
- `/botinfo` - Bot statistics and system information
- `/serverinfo` - Server statistics and details
- `/userinfo` - Detailed user information lookup
- `/channelinfo` - Channel details and permissions
- `/campaigns` - List all active campaigns with quick join

#### User Tools
- `/ping` - Check bot latency
- `/uptime` - Bot uptime statistics
- `/avatar` - Get user's avatar URL
- `/calculator` - Calculate earnings from views
- `/feedback` - Send feedback to developers
- `/invites` - Check your server invites
- `/topinvites` - Top inviters leaderboard

#### Advanced Admin Tools
- `/announce` - Send announcement to specific channel
- `/poll` - Create interactive poll with reactions
- `/massdm` - Send DM to all members (with confirmation)
- `/eval` - Execute JavaScript code (developer only)
- `/reload` - Reload specific command without restart
- `/exportdata` - Export campaign/user data to JSON
- `/roleadd` / `/roleremove` - Manage user roles

---

### Event Handlers

#### 1. **interactionCreate** - Command & Button Handler
Processes all slash commands and button interactions with:
- Permission validation
- Error handling with user-friendly messages
- Admin action logging (non-blocking)
- Command usage statistics
- Interaction timeout handling (3-second Discord limit)

#### 2. **messageCreate** - Message Monitoring
- Logs all messages to database
- Tracks message statistics per user
- Auto-moderation triggers (spam, links, caps)
- Custom prefix commands (legacy support)

#### 3. **messageDelete** - Deletion Logging
Logs deleted messages to moderation channel:
- Message content
- Author
- Channel
- Deletion timestamp
- Attached files (if any)

#### 4. **messageUpdate** - Edit Logging
Logs message edits:
- Original content
- New content
- Author and channel
- Edit timestamp

#### 5. **guildMemberAdd** - Welcome System
- Sends welcome message to welcome channel
- Logs join to member logs
- Caches invite codes to track who invited
- Auto-role assignment (if configured)

#### 6. **guildMemberRemove** - Leave Tracking
- Logs leaves to member logs
- Shows who invited the member
- Tracks invite attribution

#### 7. **guildMemberUpdate** - Role Change Tracking
Logs role changes:
- Roles added/removed
- Member boosting status
- Nickname changes
- Timeout changes

#### 8. **clientReady** - Bot Initialization
- Loads all commands
- Registers slash commands to Discord
- Caches server invites
- Starts internal API server
- Initializes cron jobs
- Sets bot presence/status

---

## 🌐 Web Dashboard Features

### Public Pages

#### Home Page (`/`)
**Not logged in:**
- ClipHub branding and mission statement
- "Login with Discord" button
- Feature highlights
- Live campaign counter

**Logged in:**
- Personalized welcome
- Quick stats: Balance, Total Earnings, Pending Submissions
- Active campaigns grid with "Join" buttons
- Recent activity feed
- Quick actions: Submit Clip, Request Payout, Link Account

---

#### Campaigns Page (`/campaigns`)
Browse all active campaigns with detailed cards.

**Campaign Card Information:**
- Campaign name and type badge (Clipping/Reposting/UGC)
- Description and requirements
- Budget tracker: `$X / $Y spent` with progress bar
- Pay rate per 1000 views
- Minimum views requirement
- Supported platforms (YouTube, TikTok, Instagram, Twitter icons)
- "LIVE" badge for active campaigns
- "PAUSED" badge for paused campaigns
- Participant count
- "View Details" button

**Campaign Detail Page (`/campaigns/:id`):**
- Full campaign information
- Requirements and guidelines
- Statistics: Total submissions, total views, total paid
- Top performers leaderboard
- Platform breakdown chart
- Submit button (if user has verified account for that platform)
- Campaign timeline

---

#### Submit Page (`/submit`)
Submission form with real-time validation.

**Form Fields:**
- Campaign dropdown (only shows campaigns user can join)
- Platform auto-detection from URL
- Content URL input with format validation
- Title (required)
- Description (optional)
- Preview of submission before submit

**Validation:**
- Checks if user has verified account for platform
- Validates URL format
- Ensures campaign accepts that platform
- Checks if campaign is active
- Prevents duplicate submissions

**Submission Flow:**
1. User fills form
2. Frontend validates input
3. Sends to web backend
4. Web backend calls Internal API
5. Bot processes submission
6. Returns success/error to user
7. Redirects to "My Submissions" page

---

#### My Submissions (`/submissions`)
Personal submission dashboard.

**Features:**
- Filterable table (All, Pending, Approved, Rejected)
- Submission cards showing:
  - Thumbnail (if available)
  - Title and description
  - Campaign name
  - Platform
  - Current view count
  - Initial view count
  - Views gained
  - Earnings so far
  - Status badge
  - Submitted date
  - Last updated

**Actions:**
- View submission details
- Delete pending submission
- Report issue with submission

---

#### Leaderboard (`/leaderboard`)
Public leaderboard with filters.

**Leaderboard Types:**
- Top Earners (all-time)
- Top Views (all-time)
- Top Submissions (count)
- By Campaign
- By Platform
- By Month

**User Cards:**
- Rank badge (🥇🥈🥉 for top 3)
- Avatar and username
- Total earnings
- Total views
- Submission count
- View profile button

---

#### Profile Page (`/profile/:userId`)
Public user profile.

**Information:**
- Avatar and username
- Join date and account age
- Total earnings and views
- Current balance (if viewing own profile)
- Verified accounts list
- Submission statistics
- Top performing clips
- Achievement badges
- Activity graph (views over time)

---

### Authenticated User Pages

#### Dashboard (`/dashboard`)
Personal command center after login.

**Widgets:**
- **Balance Widget**: Current balance, pending earnings, request payout button
- **Quick Stats**: Total submissions, total views, total earnings, approval rate
- **Recent Activity**: Last 5 submissions with status
- **Active Campaigns**: Join/view campaigns
- **Performance Chart**: Earnings over last 30 days
- **Linked Accounts**: Social media connections with verify buttons

---

#### My Account (`/account`)
Account management.

**Sections:**
1. **Discord Profile**
   - Avatar, username, discriminator
   - Account created date
   - Server roles

2. **Linked Social Accounts**
   - List of linked accounts with platform icons
   - Verification status
   - Follower counts
   - "Link New Account" button
   - Unlink button (with confirmation)

3. **Payout Settings**
   - Default payment method
   - Payment information
   - Edit payout preferences

4. **Statistics**
   - All-time earnings
   - Platform breakdown
   - Campaign participation history
   - View count milestones

---

#### Payout History (`/payouts`)
All payout requests and history.

**Table Columns:**
- Request date
- Amount
- Payment method
- Status (Pending, Approved, Rejected)
- Processed date
- Admin notes (if rejected)

**Actions:**
- Request new payout
- View payout details
- Cancel pending request

---

### Admin Panel (Staff+ Role Required)

#### Admin Dashboard (`/admin`)
Central admin control panel.

**Metrics:**
- Total users, verified users, active clippers
- Total campaigns (active, paused, ended)
- Total submissions (pending, approved, rejected)
- Total earnings paid out
- Platform usage statistics
- Recent admin actions log

**Quick Actions:**
- Create campaign
- Review pending submissions
- Review pending payouts
- View flagged content
- Export data

---

#### Campaign Management (`/admin/campaigns`)
Full campaign CRUD interface.

**Features:**
- Campaign table with filters (Active, Paused, Ended, All)
- Create campaign button (opens modal)
- Edit campaign button (inline editing)
- End campaign button (with confirmation)
- Pause/Resume toggle
- Budget tracking progress bars
- Participant count per campaign
- View campaign statistics

**Create/Edit Modal:**
- Campaign name input
- Type selector (Clipping, Reposting, UGC)
- Description textarea
- Budget input (USD)
- Rate input (per 1000 views)
- Minimum views input
- Platform multi-select checkboxes
- Create/Save button

**Internal API Integration:**
- Uses `web/api/botClient.js` to call bot API
- POST `/api/campaigns/create` - Creates campaign via bot
- POST `/api/campaigns/edit` - Edits campaign via bot
- Ensures Discord channels/roles are created automatically
- Real-time validation and error handling

---

#### Submission Review (`/admin/submissions`)
Review and manage all submissions.

**Filter Options:**
- Status: Pending, Approved, Rejected, All
- Campaign filter
- Platform filter
- User filter
- Date range

**Submission Cards:**
- User avatar and name
- Campaign name
- Platform badge
- Content thumbnail
- Title and description
- Current views / Initial views
- Views gained and earnings
- Submission date
- Actions: Approve, Reject, Flag, View Details

**Bulk Actions:**
- Approve selected
- Reject selected
- Export selected

**Detail Modal:**
- Full submission information
- Link to content
- View count history graph
- Earnings timeline
- Admin notes
- Approve/Reject with reason

---

#### Payout Management (`/admin/payouts`)
Process payout requests.

**Payout Queue:**
- Pending requests at top
- User information
- Amount requested
- Payment method and info
- Request date
- User's total earnings and submission count

**Actions:**
- Approve payout (with proof upload)
- Reject payout (with reason)
- Mark as processing
- Contact user (sends DM via bot)

**Payout History:**
- All processed payouts
- Search by user, date, amount
- Export for accounting

---

#### User Management (`/admin/users`)
Manage all users.

**User Table:**
- Avatar, username, Discord ID
- Join date
- Total earnings
- Balance
- Submissions count
- Verified accounts count
- Roles
- Status (Active, Banned, Muted)

**User Actions:**
- View full profile
- Add/remove roles
- Ban/unban from campaigns
- Adjust balance (add bonus)
- View submission history
- Send DM

**Search & Filters:**
- Search by username or Discord ID
- Filter by role
- Filter by verification status
- Sort by earnings, submissions, balance

---

#### Database Management (`/admin/database`)
Direct database operations (careful use).

**Features:**
- View table schemas
- Run SELECT queries
- Export tables to JSON/CSV
- Database backup
- View database statistics
- User data deletion (GDPR compliance)

**Safety:**
- Read-only mode by default
- Destructive queries require confirmation
- All actions logged
- Automatic backups before modifications

---

#### Logs Viewer (`/admin/logs`)
View all system logs.

**Log Categories:**
1. **Command Logs**: All Discord commands executed
2. **Submission Logs**: New submissions
3. **Payout Logs**: Payout requests and processing
4. **Moderation Logs**: Bans, kicks, warnings, timeouts
5. **Admin Actions**: Campaign edits, user modifications
6. **Error Logs**: System errors and exceptions
7. **Login Activity**: Web dashboard logins

**Features:**
- Real-time log streaming
- Search and filter
- Date range selection
- Export logs
- Error highlighting

---

### Authentication System

#### Discord OAuth2 Flow
1. User clicks "Login with Discord"
2. Redirects to Discord OAuth page
3. User authorizes application
4. Discord redirects to callback URL with code
5. Server exchanges code for access token
6. Fetches user profile from Discord API
7. Creates/updates user in database
8. Creates session cookie
9. Logs login activity (IP, timestamp, user agent)
10. Redirects to dashboard

**Session Management:**
- Express-session with secure cookies
- 7-day session expiration
- Auto-refresh on activity
- Logout clears session and cookie

**Security:**
- CSRF protection
- Session secret rotation
- IP-based rate limiting
- Login attempt monitoring

---

## 🔗 Internal API Communication

### Architecture Overview

The Internal API is a **critical bridge** between the Discord bot and web dashboard, enabling seamless data synchronization and transactional operations.

**API Server Location:** `src/index.js` (runs inside bot process)  
**API Port:** 5001 (localhost only, not publicly accessible)  
**Authentication:** Shared API key via environment variable  
**Client:** `web/api/botClient.js` (used by web routes)

---

### Why Internal API?

**Problem:** Direct database access from both bot and web can cause:
- Race conditions
- Inconsistent Discord state (channels/roles not created)
- Complex error handling
- Duplicate business logic

**Solution:** Bot controls all Discord-related operations via API:
- Web calls API → Bot processes → Updates Discord + Database
- Ensures Discord channels/roles are created atomically
- Single source of truth for campaign logic
- Automatic rollback on errors

---

### API Endpoints

#### 1. **POST `/api/campaigns/create`**
Creates a new campaign with Discord integration.

**Request Body:**
```json
{
  "name": "Summer Promo 2024",
  "type": "Clipping",
  "description": "Create gaming highlights...",
  "budget": 5000,
  "rate": 25,
  "minViews": 1000,
  "platforms": ["YouTube", "TikTok"]
}
```

**Process:**
1. Validates all parameters
2. Creates campaign in database (begins transaction)
3. Creates Discord role with name and color
4. Creates Discord channel in category
5. Sets channel permissions
6. Posts announcement message
7. Commits transaction
8. Returns campaign ID and Discord IDs

**Response:**
```json
{
  "success": true,
  "campaignId": 42,
  "roleId": "1234567890",
  "channelId": "9876543210"
}
```

**Error Handling:**
- If Discord operations fail → Rolls back database transaction
- Returns specific error message
- Web displays error to admin

**Used By:** `/admin/campaigns` create campaign form

---

#### 2. **POST `/api/campaigns/edit`**
Edits existing campaign and updates Discord.

**Request Body:**
```json
{
  "campaignId": 42,
  "name": "Updated Campaign Name",
  "budget": 7500,
  "platforms": ["YouTube", "TikTok", "Instagram"]
}
```

**Process:**
1. Fetches campaign from database
2. Validates changes (e.g., budget ≥ spent amount)
3. Updates database
4. Updates Discord role name (if name changed)
5. Updates channel topic (if description changed)
6. Posts update announcement to channel
7. Logs change to moderation logs

**Response:**
```json
{
  "success": true,
  "message": "Campaign updated successfully"
}
```

**Used By:** `/admin/campaigns` edit campaign modal

---

#### 3. **GET `/api/campaigns/:id`**
Fetches campaign details including Discord metadata.

**Response:**
```json
{
  "id": 42,
  "name": "Summer Promo 2024",
  "type": "Clipping",
  "status": "active",
  "budget": 5000,
  "spent": 2340.50,
  "rate": 25,
  "minViews": 1000,
  "platforms": ["YouTube", "TikTok"],
  "roleId": "1234567890",
  "channelId": "9876543210",
  "participants": 47,
  "totalSubmissions": 156,
  "totalViews": 4500000,
  "createdAt": "2024-06-01T00:00:00.000Z"
}
```

**Used By:** Campaign detail pages, admin panel

---

#### 4. **POST `/api/submissions/create`**
Processes new clip submission.

**Request Body:**
```json
{
  "userId": "123456789",
  "campaignId": 42,
  "platform": "YouTube",
  "link": "https://youtube.com/watch?v=...",
  "title": "Epic Gaming Moment",
  "description": "Check out this clutch!"
}
```

**Process:**
1. Validates user has verified account for platform
2. Extracts video ID from URL
3. Fetches initial view count from YouTube/TikTok/Instagram API
4. Creates submission in database
5. Posts to flagged clips Discord channel with approve/reject buttons
6. Sends DM to user confirming submission
7. Updates campaign statistics

**Response:**
```json
{
  "success": true,
  "submissionId": 789,
  "initialViews": 15420,
  "estimatedEarnings": "TBD (pending approval)"
}
```

**Used By:** `/submit` page submission form

---

#### 5. **POST `/api/submissions/approve`**
Approves pending submission (admin action).

**Request Body:**
```json
{
  "submissionId": 789,
  "adminId": "987654321"
}
```

**Process:**
1. Updates submission status to "approved"
2. Adds to hourly view tracking list
3. Sends approval notification to user
4. Updates Discord message (removes buttons, adds ✅)
5. Logs admin action

**Used By:** `/admin/submissions` review interface

---

#### 6. **POST `/api/payouts/approve`**
Processes payout approval.

**Request Body:**
```json
{
  "payoutId": 123,
  "adminId": "987654321",
  "proofUrl": "https://i.imgur.com/proof.png"
}
```

**Process:**
1. Updates payout status to "approved"
2. Marks balance as paid (doesn't restore)
3. Logs transaction
4. Sends success DM to user with proof
5. Updates Discord payout log message
6. Records admin who processed

**Used By:** `/admin/payouts` payout processing

---

### API Client (`web/api/botClient.js`)

**Purpose:** Abstracts Internal API calls for web routes.

**Features:**
- Automatic API key injection
- Error handling and retry logic
- Timeout handling
- Response parsing

**Example Usage:**
```javascript
const botClient = require('./api/botClient');

// In web route
router.post('/admin/campaigns/create', async (req, res) => {
  try {
    const result = await botClient.createCampaign({
      name: req.body.name,
      type: req.body.type,
      budget: req.body.budget,
      rate: req.body.rate,
      minViews: req.body.minViews,
      platforms: req.body.platforms
    });
    
    res.json({ success: true, campaign: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

**Security:**
- Internal API only listens on `127.0.0.1` (localhost)
- Not accessible from public internet
- Shared API key validates requests
- Rate limiting on endpoints

---

### API Communication Flow Example

**Scenario:** Admin creates campaign from web dashboard

```
1. Admin fills form at /admin/campaigns
   ↓
2. Frontend sends POST to /admin/campaigns/create
   ↓
3. Web route handler validates input
   ↓
4. Calls botClient.createCampaign(data)
   ↓
5. botClient sends POST to http://127.0.0.1:5001/api/campaigns/create
   ↓
6. Bot API receives request, validates API key
   ↓
7. Bot creates database entry (transaction begins)
   ↓
8. Bot creates Discord role with campaign name
   ↓
9. Bot creates Discord channel in category
   ↓
10. Bot sets channel permissions
    ↓
11. Bot posts announcement to channel
    ↓
12. Bot commits database transaction
    ↓
13. Bot returns success + IDs to web
    ↓
14. Web returns success to frontend
    ↓
15. Frontend shows success message + redirects to campaign page
```

**If Discord step fails:**
```
7. Bot creates database entry (transaction begins)
8. Bot creates Discord role ✓
9. Bot creates Discord channel ❌ (error: missing permissions)
10. Bot catches error
11. Bot rolls back database transaction
12. Bot deletes Discord role
13. Bot returns error to web
14. Web returns error to frontend
15. Frontend shows error: "Failed to create channel - check bot permissions"
```

---

## 📊 Database Schema

### Tables Overview

**Total Tables:** 12

1. `users` - Discord user profiles
2. `campaigns` - Campaign information
3. `submissions` - Clip submissions
4. `social_accounts` - Linked social media
5. `payouts` - Payout requests
6. `warnings` - User warnings
7. `bans` - Ban records
8. `invites` - Invite tracking
9. `command_logs` - Command usage
10. `login_logs` - Web login activity
11. `admin_actions` - Admin action audit trail
12. `view_history` - Historical view data

---

### users

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,              -- Discord user ID
  username TEXT NOT NULL,            -- Discord username
  discriminator TEXT,                -- Discord discriminator
  avatar TEXT,                       -- Avatar URL
  balance REAL DEFAULT 0,            -- Current balance (USD)
  total_earned REAL DEFAULT 0,       -- Lifetime earnings
  total_views INTEGER DEFAULT 0,     -- Total views across all clips
  is_banned INTEGER DEFAULT 0,       -- Banned from campaigns
  default_payout_method TEXT,        -- PayPal, Venmo, etc.
  default_payout_info TEXT,          -- Email/account
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

### campaigns

```sql
CREATE TABLE campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL,                -- Clipping, Reposting, UGC
  description TEXT,
  budget REAL NOT NULL,              -- Total budget (USD)
  spent REAL DEFAULT 0,              -- Amount spent so far
  rate REAL NOT NULL,                -- Pay per 1000 views
  min_views INTEGER DEFAULT 0,       -- Minimum views for payout
  platforms TEXT NOT NULL,           -- JSON array: ["YouTube", "TikTok"]
  status TEXT DEFAULT 'active',      -- active, paused, ended
  role_id TEXT,                      -- Discord role ID
  channel_id TEXT,                   -- Discord channel ID
  created_by TEXT,                   -- Admin Discord ID
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  ended_at DATETIME
);
```

---

### submissions

```sql
CREATE TABLE submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,             -- Discord user ID
  campaign_id INTEGER NOT NULL,
  platform TEXT NOT NULL,            -- YouTube, TikTok, Instagram, Twitter
  link TEXT NOT NULL,
  video_id TEXT NOT NULL,            -- Extracted video/post ID
  title TEXT NOT NULL,
  description TEXT,
  initial_views INTEGER DEFAULT 0,   -- Views when submitted
  current_views INTEGER DEFAULT 0,   -- Latest view count
  earnings REAL DEFAULT 0,           -- Calculated earnings
  status TEXT DEFAULT 'pending',     -- pending, approved, rejected
  rejection_reason TEXT,
  submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  approved_at DATETIME,
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
);
```

---

### social_accounts

```sql
CREATE TABLE social_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,             -- Discord user ID
  platform TEXT NOT NULL,            -- YouTube, TikTok, Instagram, Twitter
  account_id TEXT NOT NULL,          -- Channel ID, username
  account_name TEXT,                 -- Display name
  account_url TEXT,                  -- Profile URL
  followers INTEGER DEFAULT 0,       -- Follower/subscriber count
  verified INTEGER DEFAULT 0,        -- 1 = verified, 0 = pending/failed
  verification_method TEXT,          -- api, scrape, manual
  linked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_verified DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(user_id, platform)
);
```

---

### payouts

```sql
CREATE TABLE payouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  amount REAL NOT NULL,
  payment_method TEXT NOT NULL,
  payment_info TEXT NOT NULL,
  status TEXT DEFAULT 'pending',     -- pending, approved, rejected
  proof_url TEXT,                    -- Payment proof screenshot
  rejection_reason TEXT,
  requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME,
  processed_by TEXT,                 -- Admin Discord ID
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

### view_history

```sql
CREATE TABLE view_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id INTEGER NOT NULL,
  views INTEGER NOT NULL,
  earnings REAL NOT NULL,
  recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (submission_id) REFERENCES submissions(id)
);
```

**Purpose:** Historical view tracking for charts and analytics.

---

## ⏰ Automation & Cron Jobs

### 1. View Tracker (`cron/viewTracker.js`)

**Schedule:** Every 60 minutes  
**Purpose:** Update view counts and calculate earnings

**Process:**
1. Fetches all approved submissions
2. For each submission:
   - Calls appropriate API (YouTube, TikTok, Instagram, Twitter)
   - Fetches current view count
   - Compares with previous views
   - Calculates views gained
   - Calculates earnings: `(current - initial) / 1000 * rate`
   - Updates submission record
   - Adds entry to view_history
   - Updates user balance and total_earned
   - Updates campaign spent amount
3. Sends milestone notifications (100K, 500K, 1M, 5M views)
4. Logs total submissions updated

**API Usage:**
- **YouTube:** `googleapis` library with YouTube Data API v3
- **TikTok:** RapidAPI scraper
- **Instagram:** RapidAPI Instagram scraper
- **Twitter:** RapidAPI Twitter scraper

**Error Handling:**
- If API fails: Retries 3 times with exponential backoff
- If video deleted: Marks submission as "video_unavailable"
- Logs errors to error logs channel

---

### 2. Auto-Verification (`cron/autoVerify.js`)

**Schedule:** Every 30 minutes  
**Purpose:** Re-verify linked social accounts

**Process:**
1. Fetches all verified social accounts
2. For each account:
   - Attempts to fetch account data via API/scraping
   - If account exists: Updates follower count, last_verified
   - If account not found: Marks as unverified, removes "Verified Clipper" role
   - Notifies user if verification status changed
3. Logs re-verification results

**Benefits:**
- Detects deleted/suspended accounts
- Maintains data accuracy
- Prevents fraud (users submitting content from deleted accounts)

---

### 3. Budget Milestone Checker (`cron/budgetChecker.js`)

**Schedule:** Every 30 minutes  
**Purpose:** Monitor campaign budgets and send alerts

**Process:**
1. Fetches all active campaigns
2. For each campaign:
   - Calculates budget used: `(spent / budget) * 100`
   - If 50% reached: Sends notification to campaign channel
   - If 75% reached: Sends warning to admins
   - If 90% reached: Sends urgent alert to admins
   - If 100% reached: Auto-pauses campaign, notifies admins
3. Updates campaign status if needed

**Notifications Sent To:**
- Campaign Discord channel (50% milestone)
- Admin logs channel (75%, 90%, 100%)
- Campaign creator DM (100%)

---

## 🔐 Security Features

### 1. Single Instance Lock
- File-based lock (`.bot-lock`) prevents duplicate bot instances
- Prevents duplicate message sending and command processing
- Auto-cleanup on shutdown/crash
- Exits immediately if lock exists

### 2. Non-Blocking Interaction Logging
- Admin actions logged asynchronously
- Prevents Discord 3-second interaction timeout
- Uses fire-and-forget pattern
- Errors caught and logged separately

### 3. Role-Based Access Control
- **Admin Commands:** Require Administrator permission
- **Staff Commands:** Require specific staff role
- **User Commands:** Available to verified users
- **Web Admin Panel:** Requires staff role in Discord server

### 4. API Authentication
- Internal API requires shared secret key
- API only accessible on localhost (not public)
- Request validation on all endpoints
- Rate limiting per IP

### 5. SQL Injection Prevention
- All database queries use parameterized statements
- Input sanitization on all user inputs
- No direct string concatenation in SQL

### 6. Discord OAuth Security
- State parameter validation (CSRF protection)
- Secure session cookies (httpOnly, secure flags)
- Session expiration (7 days)
- IP-based login monitoring

### 7. Input Validation
- URL format validation for submissions
- Budget/rate validation (prevents negative values)
- Discord ID validation
- Platform whitelisting

### 8. Error Handling
- All errors caught and logged
- User-friendly error messages (no stack traces exposed)
- Error logging to dedicated Discord channel
- Automatic error recovery where possible

### 9. Data Protection
- Database file excluded from git (`.gitignore`)
- Secrets stored in environment variables
- No hardcoded API keys
- Regular database backups

### 10. Login Activity Logging
- Logs all web dashboard logins
- Records IP address, user agent, timestamp
- Detects suspicious login patterns
- Alerts on login from new location

---

## 🚀 Deployment

### Requirements
- Node.js 16+
- SQLite3
- Discord Bot Token
- Discord OAuth Application
- YouTube API Key
- RapidAPI Key (for TikTok/Twitter/Instagram)
- Environment Variables (see below)

### Environment Variables

```bash
# Discord Bot
DISCORD_TOKEN=your_bot_token

# Discord OAuth
CLIENT_IDD=your_client_id
CLIENT_SECRET=your_client_secret
OAUTH_CALLBACK_URL=https://yourdomain.com/auth/callback

# Discord Server Configuration
GUILD_ID=your_server_id
STAFF_ROLE=your_staff_role_id
VERIFIED_CLIPPER_ROLE=your_verified_role_id
DEVELOPER_ID=your_discord_user_id
NUKE_MASTER_ROLE_ID=your_nuke_role_id

# Discord Channel IDs
WELCOME_CHANNEL=channel_id
SUPPORT_CHANNEL=channel_id
ANNOUNCEMENTS_CHANNEL=channel_id
SUBMISSION_LOGS_CHANNEL=channel_id
FLAGGED_CLIPS_CHANNEL=channel_id
PAYOUT_LOGS_CHANNEL=channel_id
MODERATION_LOGS_CHANNEL=channel_id
COMMAND_LOGS_CHANNEL=channel_id
ERROR_LOGS_CHANNEL=channel_id
MEMBER_LOGS_CHANNEL=channel_id
MESSAGE_LOGS_CHANNEL=channel_id
INVITE_LOGS_CHANNEL=channel_id
ACTIVE_CAMPAIGNS_CHANNEL=channel_id
TICKET_CATEGORY=category_id

# External APIs
YOUTUBE_API_KEY=your_youtube_api_key
RAPIDAPI_KEY=your_rapidapi_key
INSTAGRAM_RAPIDAPI_KEY=your_instagram_rapidapi_key

# Internal API
INTERNAL_API_KEY=random_secret_string

# Session Secret
SESSION_SECRET=random_secret_string
```

### Installation

```bash
# Install dependencies
npm install

# Start the application
npm start
```

**What Runs:**
- `start.js` launches both bot and web server
- Bot starts on port 5001 (Internal API)
- Web starts on port 5000 (public)
- Cron jobs initialize automatically
- Single instance lock prevents duplicates

### Deployment Platform
- Designed for **persistent VM** (always running)
- Suitable for VPS, dedicated server, cloud VM
- **Not** suitable for serverless (needs persistent connection)
- Requires persistent storage for SQLite database

---

## 📈 Scalability

### Current Capacity
- **Users:** Unlimited (Discord server limit: 500K+)
- **Campaigns:** Unlimited
- **Submissions:** Unlimited (database scales well)
- **Concurrent API Calls:** ~100/sec with current rate limits

### Bottlenecks & Solutions

**1. API Rate Limits**
- **YouTube:** 10,000 quota/day → Solution: Implement quota management, cache results
- **RapidAPI:** Varies by plan → Solution: Upgrade plan or add retry queues
- **Discord:** 50 requests/sec → Solution: Request queue system

**2. Database Performance**
- **Current:** SQLite (single file, fast for <1M records)
- **Scaling:** Migrate to PostgreSQL for >1M records
- **Indexes:** Already optimized on user_id, campaign_id, platform

**3. View Tracking Cron**
- **Current:** Sequential processing (slow for >1000 submissions)
- **Solution:** Parallel processing with worker threads
- **Solution:** Batch API requests (YouTube allows 50 IDs per call)

---

## 💼 Business Value

### Revenue Potential
- **Subscription Model:** $X/month per server
- **Per-Campaign Fee:** $X per campaign created
- **Transaction Fee:** X% of payouts processed
- **White-Label Solution:** $X one-time license

### Market Differentiation
- **Multi-Platform:** Competitors focus on single platform
- **Automated Verification:** Saves hours of manual account checks
- **Real-Time Tracking:** Hourly updates vs daily/manual
- **Integrated Solution:** Bot + Web in one seamless product

### Use Cases
- **Gaming Organizations:** Manage clip campaigns across multiple creators
- **Marketing Agencies:** Run UGC campaigns for brands
- **Content Creator Networks:** Coordinate reposting campaigns
- **Influencer Collectives:** Track and pay collaborators

---

## 📞 Support & Maintenance

### Monitoring
- Error logs automatically posted to Discord channel
- Daily health check cron job
- Database backup automation
- Uptime monitoring via Discord presence

### Common Issues & Solutions

**Issue:** Bot not responding to commands  
**Solution:** Check bot is online, verify permissions, run `/reload`

**Issue:** Submissions not tracking views  
**Solution:** Check API keys, verify cron job running, check error logs

**Issue:** Discord channels not creating  
**Solution:** Verify bot has "Manage Channels" and "Manage Roles" permissions

**Issue:** Web login not working  
**Solution:** Verify OAuth callback URL, check CLIENT_IDD/SECRET

---

## 🎯 Future Enhancement Opportunities

### Feature Roadmap
1. **Advanced Analytics Dashboard**
   - Predictive earnings modeling
   - ROI calculator per campaign
   - Trend analysis and forecasting

2. **Multi-Server Support**
   - Run bot across multiple Discord servers
   - Centralized admin panel
   - Cross-server leaderboards

3. **Mobile App**
   - React Native app for iOS/Android
   - Push notifications for approvals/payouts
   - Quick submission from mobile

4. **Affiliate System**
   - Invite other users, earn commission
   - Multi-level referral tracking
   - Bonus tiers

5. **Content Moderation AI**
   - Auto-detect inappropriate content
   - Brand safety scanning
   - Duplicate content detection

6. **Payment Gateway Integration**
   - Automated payouts via Stripe, PayPal API
   - Instant balance withdrawals
   - Crypto payment support

7. **Campaign Templates**
   - Pre-built campaign types
   - Industry-specific templates
   - One-click campaign cloning

8. **Advanced Scheduling**
   - Campaign start/end dates
   - Auto-posting schedule
   - Timezone-aware notifications

---

## 📄 License & Terms

This documentation is provided for evaluation purposes for potential buyers of the ClipHub source code. 

**What's Included in Purchase:**
- Complete source code (bot + web + cron)
- Database schema and setup scripts
- All 63 Discord commands
- Internal API system
- Documentation and setup guide
- 30 days of technical support

**What's NOT Included:**
- API keys (YouTube, RapidAPI, etc.)
- Discord bot token and OAuth application
- Hosting/server infrastructure
- Custom feature development
- Ongoing support beyond 30 days

---

## 🏁 Conclusion

ClipHub represents a **complete, production-ready solution** for managing clip campaigns at scale. With its robust Discord bot, feature-rich web dashboard, intelligent automation, and seamless internal API integration, it provides everything needed to run a successful content creator platform.

**Key Strengths:**
- ✅ Comprehensive feature set (63 commands, full web dashboard)
- ✅ Multi-platform support (YouTube, TikTok, Instagram, Twitter)
- ✅ Automated systems (view tracking, verification, budget alerts)
- ✅ Scalable architecture (designed for growth)
- ✅ Professional codebase (clean, documented, maintainable)
- ✅ Security-focused (RBAC, input validation, error handling)

**Perfect For:**
- Content creator networks
- Gaming organizations
- Marketing agencies
- Influencer collectives
- Anyone running video clip campaigns

**Total Lines of Code:** ~15,000+  
**Development Time:** 200+ hours  
**Technologies:** 15+ integrations

---

**Questions? Contact for Demo or Purchase Inquiry.**

*Last Updated: October 21, 2025*
