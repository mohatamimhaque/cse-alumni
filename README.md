# DUET Reunion 2025 - Alumni Directory & Analytics Platform

A modern, production-ready web application for managing and displaying DUET alumni members with real-time analytics, bulk import capabilities, and admin dashboard.

## 🌟 Features

### Member Management
- **Dynamic Alumni Directory** - Display all members with filterable profiles
- **Member Cards** - Beautiful profile cards with photos, contact info, and designation
- **Advanced Search** - Filter members by name, ID, designation, and more
- **Profile Photos** - Optimized image delivery via Cloudflare R2

### Admin Dashboard
- **Member Management** - Add, edit, delete members directly
- **Bulk Upload** - Import members from Excel/CSV files with alias support
- **Analytics Dashboard** - Real-time analytics with visualizations
- **Storage Management** - Monitor R2 bucket usage and statistics

### Analytics & Tracking
- **Page View Tracking** - Track member directory visits
- **Card View Analytics** - Monitor individual member card views
- **Geographic Data** - Country and city-level visitor analytics
- **30-Day Insights** - Automatic cleanup and rolling analytics window
- **IP Privacy** - Hashed IP addresses for visitor privacy

### Security & Authentication
- **Session-Based Auth** - 24-hour encrypted session tokens
- **Admin Password** - Secure admin panel access
- **Parameterized Queries** - SQL injection protection
- **Data Sanitization** - Input validation and XSS prevention
- **CORS Protection** - Secure cross-origin requests

## 🛠️ Tech Stack

### Frontend
- **Framework**: Next.js 15.3.1
- **UI Library**: React 19.1.0
- **Styling**: Tailwind CSS
- **Icons**: Material Symbols Outlined
- **HTTP Client**: Axios

### Backend
- **Runtime**: Node.js (via Next.js API Routes)
- **Database**: PostgreSQL (Neon Serverless)
- **Storage**: Cloudflare R2 (S3-compatible)
- **Authentication**: CryptoJS AES Encryption

### DevOps & Deployment
- **Hosting**: Vercel (Automatic Deployments)
- **Database**: Neon PostgreSQL Serverless
- **Object Storage**: Cloudflare R2
- **Version Control**: Git/GitHub

## 📋 Prerequisites

- **Node.js**: v18+ or higher
- **npm**: v9+ or higher
- **PostgreSQL Account**: Neon free tier or equivalent
- **Cloudflare Account**: For R2 bucket (optional, can use any S3-compatible service)
- **GitHub Account**: For version control and Vercel deployment

## 🚀 Installation & Setup

### 1. Clone Repository
```bash
git clone https://github.com/your-username/duet-reunion-v2.git
cd duet-reunion-v2
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration

Create `.env.local` file in the project root:

```env
# PostgreSQL Database (Neon)
DATABASE_URL=postgresql://username:password@endpoint.neon.tech/dbname?sslmode=require

# Admin Authentication
SESSION_SECRET=your-session-secret-24-chars-minimum
ADMIN_PASSWORD=your-secure-password

# Cloudflare R2 (Object Storage)
R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_BUCKET_NAME=your-bucket-name
```

**Environment Variable Guide:**

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string (Neon) | `postgresql://user:pass@endpoint/db` |
| `SESSION_SECRET` | Encryption key for session tokens (min 24 chars) | `duet_reunion_v2_session_secret_2025` |
| `ADMIN_PASSWORD` | Admin panel login password | Secure password |
| `R2_ENDPOINT` | Cloudflare R2 endpoint URL | `https://[account-id].r2.cloudflarestorage.com` |
| `R2_ACCESS_KEY_ID` | R2 API access key ID | R2 API credentials |
| `R2_SECRET_ACCESS_KEY` | R2 API secret key | R2 API credentials |
| `R2_BUCKET_NAME` | R2 bucket name for photo storage | Your bucket name |

### 4. Initialize Database

```bash
npm run seed
```

This script will:
- Create required tables (members, analytics)
- Insert seed data (optional)
- Configure default settings

### 5. Start Development Server

```bash
npm run dev
```

Server runs at `http://localhost:3000`

## 📊 Database Schema

### Members Table
```sql
CREATE TABLE members (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE,
  mobile VARCHAR(20),
  student_id VARCHAR(50),
  blood VARCHAR(10),
  designation VARCHAR(255),
  organization VARCHAR(255),
  location VARCHAR(255),
  photo VARCHAR(500),
  visible BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Analytics Table
```sql
CREATE TABLE analytics (
  id SERIAL PRIMARY KEY,
  type VARCHAR(50),
  member_id INTEGER,
  member_name VARCHAR(255),
  ip VARCHAR(50),
  ip_hash VARCHAR(16),
  user_agent TEXT,
  country VARCHAR(100),
  city VARCHAR(100),
  timestamp TIMESTAMP DEFAULT NOW()
);
```

## 🔌 API Endpoints

### Members API
- `GET /api/members` - List all members (paginated)
- `POST /api/members` - Create new member
- `PUT /api/members/[id]` - Update member
- `DELETE /api/members/[id]` - Delete member

### Analytics API
- `POST /api/analytics/track` - Track page/card views
- `GET /api/analytics` - Get analytics data with visualizations

### Admin API
- `POST /api/auth` - Admin login
- `GET /api/admin/stats` - Dashboard statistics

### File Upload API
- `POST /api/upload` - Upload single photo
- `POST /api/bulk-upload` - Bulk import members from CSV/Excel

### Image Proxy API
- `GET /api/image` - Retrieve photos from R2

## 📁 Project Structure

```
project-root/
├── app/
│   ├── layout.js              # Root layout
│   ├── page.js                # Home page
│   ├── admin/
│   │   ├── page.js            # Admin dashboard
│   │   └── dashboard/
│   │       └── page.js        # Analytics dashboard
│   └── api/
│       ├── members/           # Members endpoints
│       ├── analytics/         # Analytics tracking
│       ├── upload/            # File uploads
│       ├── bulk-upload/       # Bulk import
│       ├── image/             # Image proxy
│       └── auth/              # Authentication
├── lib/
│   ├── db.js                  # Database connection
│   ├── auth.js                # Authentication utilities
│   └── mongodb.js             # Legacy (unused)
├── scripts/
│   ├── seed.js                # Database seeding
│   ├── migrate-photos.js      # Photo migration
│   └── check-r2-config.js     # R2 configuration check
├── .env.local                 # Environment variables (local)
├── next.config.mjs            # Next.js configuration
└── package.json               # Dependencies
```

## 🎯 Admin Features

### Login
Navigate to `/admin` and enter your `ADMIN_PASSWORD`.

### Member Management
- **Add Member** - Fill form with member details
- **Edit Member** - Modify existing member information
- **Delete Member** - Remove members from directory
- **View Photos** - Manage member profile pictures

### Bulk Import
- **Upload CSV/Excel** - Import multiple members at once
- **Flexible Columns** - Supports various column name aliases
- **Photo Linking** - Associate photo files with members
- **Validation** - Automatic data validation

### Analytics Dashboard
- **Page Views** - 30-day trend chart
- **Card Views** - Member-level engagement
- **Geographic Distribution** - Visitor countries/cities
- **Storage Stats** - R2 bucket usage and average file size

## 📤 Bulk Import Format

Support for Excel/CSV files with flexible column headers:

```
Name | Student ID | Email | Mobile | Blood | Designation | Organization | Location | Photo
```

**Supported Column Aliases:**
- Name: `name`, `full name`, `member name`
- Student ID: `id`, `student id`, `roll`, `student_id`
- Email: `email`, `e-mail`
- Mobile: `mobile`, `phone`, `contact`, `cell`
- Blood: `blood`, `blood group`
- Designation: `designation`, `title`, `position`
- Organization: `organization`, `company`, `institution`
- Location: `location`, `city`, `address`
- Photo: `photo`, `image`, `picture`, `photo filename`

## 🔒 Security Features

### Data Protection
- ✅ **Parameterized Queries** - SQL injection prevention
- ✅ **Input Sanitization** - XSS protection
- ✅ **IP Hashing** - Visitor privacy (SHA256)
- ✅ **CORS Configuration** - Secure cross-origin requests
- ✅ **Session Encryption** - AES-256 token encryption

### File Upload Security
- ✅ **Size Limit** - Max 10MB per file
- ✅ **Type Validation** - JPEG, PNG, GIF, WebP only
- ✅ **Filename Sanitization** - Prevents path traversal
- ✅ **R2 Storage** - Separate from application server

### Authentication
- ✅ **Password Protection** - Admin panel requires `ADMIN_PASSWORD`
- ✅ **Session Tokens** - 24-hour expiry
- ✅ **Encrypted Cookies** - CryptoJS AES encryption

## 📈 Analytics Features

### Tracking
- **Page Views** - Directory access analytics
- **Card Views** - Individual member profile views
- **Visitor Geo** - Country and city information
- **User Agents** - Browser and device tracking

### Data Privacy
- **IP Hashing** - Original IPs not stored
- **30-Day Window** - Automatic data cleanup
- **Anonymous Tracking** - Optional member association

## 🚢 Deployment to Vercel

### 1. Push to GitHub
```bash
git add .
git commit -m "Production ready: v2.0"
git push origin main
```

### 2. Create Vercel Project
- Connect GitHub repository to Vercel
- Select project root: `v2` (or your project folder)
- Framework: `Next.js`

### 3. Set Environment Variables
In Vercel Dashboard → Settings → Environment Variables:

```
DATABASE_URL
SESSION_SECRET
ADMIN_PASSWORD
R2_ENDPOINT
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
```

### 4. Deploy
```bash
git push origin main  # Automatic deployment triggers
```

## 🔧 Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Seed database
npm run seed

# Check R2 configuration
npm run check-r2

# Migrate photos to R2
npm run migrate-photos
```

## 📋 Configuration Files

### `.env.local` (Local Development)
Create this file with your local environment variables. Never commit this file.

### `next.config.mjs`
Next.js configuration with image optimization settings.

### `jsconfig.json`
Path aliases and TypeScript configuration.

## 🐛 Troubleshooting

### Database Connection Issues
- Verify `DATABASE_URL` in `.env.local`
- Check Neon dashboard for active database
- Ensure SSL mode is enabled in connection string

### R2 Upload Errors
- Verify R2 credentials in `.env.local`
- Check bucket exists and is accessible
- Ensure proper IAM permissions for API key

### Photo Not Displaying
- Check R2 bucket URL configuration
- Verify photo file exists in bucket
- Check CORS settings on R2 bucket

### Admin Login Issues
- Verify `ADMIN_PASSWORD` is set in `.env.local`
- Clear browser cookies and retry
- Check session encryption with `SESSION_SECRET`

## 📞 Support

For issues or questions:
1. Check `.env.local` configuration
2. Review error messages in server logs
3. Consult deployment documentation
4. Check database schema and migrations

## 📄 License

MIT License - See LICENSE file for details

## 👥 Contributors

- Development Team - DUET Reunion 2025

## 🙏 Acknowledgments

- Next.js and React community
- Vercel for hosting platform
- Neon for database services
- Cloudflare for R2 storage

---

**Last Updated:** April 2025  
**Version:** 2.0.0  
**Status:** Production Ready ✅

For detailed deployment instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md)  
For security guidelines, see [SECURITY_AND_CLEANUP.md](./SECURITY_AND_CLEANUP.md)
# DUET Reunion 2025 — Version 2 (Dynamic)

A dynamic full-stack version of the DUET CSE Alumni Member Directory. Same frontend design, powered by PostgreSQL (Neon) + Cloudflare R2 + Next.js.

## Features

- **Public Page** — Identical card-grid member directory with search, series/org filters, modal ID card viewer, download
- **Admin Panel** (`/admin`) — Password-protected dashboard with:
  - Member management (add, edit, delete)
  - Photo storage via Cloudflare R2
  - Visitor analytics (page views, card views, unique visitors, most viewed members)
- **Analytics** — Automatic tracking of page visits and member card views with IP hashing
- **API** — RESTful endpoints for all operations

## Setup

### 1. Install dependencies
```bash
cd v2
npm install
```

### 2. Configure environment
Edit `v2/.env.local` (already created with your credentials):
```
MONGODB_URI=<your MongoDB Atlas connection string>
# Optional fallback when mongodb+srv DNS fails in Node runtime:
# MONGODB_URI_DIRECT=mongodb://<user>:<pass>@ac-z4locrt-shard-00-00.0fui7c7.mongodb.net:27017,ac-z4locrt-shard-00-01.0fui7c7.mongodb.net:27017,ac-z4locrt-shard-00-02.0fui7c7.mongodb.net:27017/<db>?ssl=true&authSource=admin&replicaSet=atlas-jhbpkn-shard-0&retryWrites=true&w=majority
R2_ACCOUNT_ID=<your R2 account ID>
R2_ACCESS_KEY=<your R2 access key>
R2_SECRET_KEY=<your R2 secret key>
R2_BUCKET=<your R2 bucket name>
R2_ENDPOINT=<your R2 endpoint URL>
ADMIN_PASSWORD
SESSION_SECRET=<any random string>
```

### 3. Seed the database
This imports all members from `profiles.json` and uploads all photos to Cloudflare R2:
```bash
npm run seed
```
> ⚠️ This uploads ~1162 photos — may take several minutes depending on your connection.

### 4. Run locally
```bash
npm run dev
```
- Public page: http://localhost:3000
- Admin login: http://localhost:3000/admin

### 5. Deploy to your hosting provider
```bash
vercel
```
Make sure to set the environment variables in your deployment platform:
- `MONGODB_URI`
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY`, `R2_SECRET_KEY`, `R2_BUCKET`, `R2_ENDPOINT`
- `ADMIN_PASSWORD`
- `SESSION_SECRET`

## Project Structure

```
v2/
├── app/
│   ├── page.js              # Public member directory
│   ├── layout.js             # Root layout
│   ├── admin/
│   │   ├── page.js           # Admin login
│   │   └── dashboard/page.js # Admin dashboard + CRUD
│   └── api/
│       ├── members/          # GET all, POST new
│       │   └── [id]/         # PUT update, DELETE
│       ├── upload/           # POST photo → R2
│       ├── analytics/        # GET stats
│       │   └── track/        # POST view event
│       └── auth/             # POST login
├── lib/
│   ├── mongodb.js            # DB connection
│   └── auth.js               # Auth helpers
├── scripts/
│   └── seed.js               # Data migration
└── public/assests/logo/      # DUET & CSE logos
```
