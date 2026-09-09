# Local Job Processor & Data Viewer

A modern, high-performance web dashboard built with **React 19**, **Vite**, **Tailwind CSS v4**, and **FastAPI**. Designed for job seekers managing high-volume job discovery, automated LLM screening pipelines, application tracking, and database curation.

---

## 🌟 Frontend Features Overview

The frontend interface is centered around the [`DataViewer`](file:///Users/dbearsong/Documents/projects/python/job_processor_and_frontend/frontend/src/components/DataViewer.jsx) component—an interactive, full-featured data grid tailored specifically for job tracking, reviewing AI analysis scores, and modifying database records directly from your browser.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ Local Job Processor                                                  [Settings] [DB Config] │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ [ Apply Queue ] [ Jobs & Companies ] [ Jobs By Date ] [ Cheap LLM ] [ Strong LLM ] ...      │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ 🔍 Query Parameters: [Job Title: ______] [Company: ______] [Date Added: ______] [Run Query] │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│  Actions: [Reset Columns] [👁 Columns ▾] [⬇ Export to CSV] [💾 Save Changes (3)]           │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│  Headers (Drag to reorder / Drag edge to resize / Instant filter per column / Click to sort)│
│ ┌───────────────┬───────────────────────────────┬──────────────┬──────────────┬───────────┐ │
│ │ Job Name ⇅ 🔍 │ Company ⇅ 🔍                  │ Fit Score ⇅  │ Applied ⇅    │ Link      │ │
│ ├───────────────┼───────────────────────────────┼──────────────┼──────────────┼───────────┤ │
│ │ Senior Eng... │ Acme Corp                     │ 92           │ [x]          │ ↗ Open    │ │
│ │ Tech Lead ... │ Beta Systems                  │ 85           │ [ ]          │ ↗ Open    │ │
│ └───────────────┴───────────────────────────────┴──────────────┴──────────────┴───────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 1. 📊 Interactive Data Grid & Table Engine

- **Inline Cell Editing**:
  - Edit job summaries, notes, text fields, numbers, and dates directly in table cells without leaving the view.
  - **Adaptive Multi-Line Textareas**: Cell editors automatically calculate height based on content length and column width (`calcCellHeight`), supporting manual vertical resizing for detailed job descriptions.
  - **Interactive Checkboxes**: Toggle boolean fields such as `applied`, `rejected`, or `skip` with a single click.
  - **Input Sanitization**: Number and float columns automatically sanitize input and parse valid numeric data.
  - **Primary Key Protection**: Primary keys (such as `id` and `job_id`) are protected and locked against accidental edits.

- **Dirty State Tracking & Batch Saving**:
  - Changes are tracked in real time and visually highlighted with accent styling.
  - A dynamic **"Save Changes (N)"** indicator counts pending updates across rows.
  - Updates are committed in a single transactional batch via the `/api/data/update` endpoint.

- **Dynamic Query Parameters Toolbar**:
  - Parameter controls are generated on demand from backend metadata (supporting text inputs, date pickers, number fields, and dropdown condition selectors like `after` / `on` / `before` or `greater` / `is` / `less`).
  - Modify parameters and trigger targeted SQL queries using the **"Run Query"** button.

- **Instant Column-Level Filtering**:
  - Every column header includes an embedded, live-search filter input.
  - Client-side filtering executes instantly without additional database queries.
  - Status indicator displays active matching row counts (e.g., *showing 15 of 100 matching column filters*).

- **Multi-Directional Sorting**:
  - Click any column header to toggle between **Ascending (▲)**, **Descending (▼)**, and default sorting.
  - Smart comparator handles both numeric and alphanumeric string values cleanly.

- **Drag-and-Drop Column Customization**:
  - **Reorder Columns**: Grab and drag any column header to rearrange the table layout.
  - **Drag-to-Resize Widths**: Drag column border handles to expand columns from 70px up to 1200px+.
  - **Column Visibility Selector**: Use the **"Columns"** dropdown to toggle individual columns on or off, or click the hover eye icon to hide a column.
  - **One-Click Reset**: The **"Reset Columns"** button restores original column visibility and ordering.

- **Smart URL Detection & Navigation**:
  - Automatically recognizes links in URL columns (`link`, `source`, etc.) and cell text.
  - Provides a one-click external link icon to launch the job posting or application page in a new browser tab.

- **CSV Data Export**:
  - Export currently filtered, sorted, and customized table views directly to CSV.
  - Includes UTF-8 BOM encoding for complete compatibility with Microsoft Excel, Apple Numbers, and Google Sheets.
  - Auto-names downloads by tab and date (e.g., `apply_queue_2026-09-09.csv`).

---

### 2. 🗂️ Workflow Tabs & Views

The frontend includes dedicated views for each stage of the job search and evaluation pipeline, accessible from the tab navigation bar in [`App.jsx`](file:///Users/dbearsong/Documents/projects/python/job_processor_and_frontend/frontend/src/App.jsx):

| Tab | Purpose & Features |
| :-- | :----------------- |
| 🎯 **Apply Queue** | Focuses on high-priority opportunities where the strong LLM recommended applying (`apply` or `maybe`), ranked by the final application queue score. Shows semantic similarity scores, fit scores, recruiter-bait likelihood, pay ranges, and application status. |
| 🏢 **Jobs & Companies Data** | Complete searchable directory joining jobs, company records, and office locations. Includes parameters to filter by Job Title and Company Name with adjustable row limits. |
| 📅 **Jobs By Date** | Time-based job discovery view. Filter by `date_added` with flexible condition operators (`after`, `on`, `before`), combined with job title and company filters. Displays full job requirements and responsibilities. |
| ⚡ **Cheap LLM Analysis** | High-level triage view powered by cost-efficient LLM screening. Filter by Fit Score (`greater`, `is`, `less`), date added, and title to review automated summaries, strengths, and concerns. |
| 🧠 **Strong LLM Analysis** | In-depth AI evaluation view featuring comprehensive final scores, apply recommendations, recruiter-bait detection, red flags, tailoring notes, and detailed fit analysis. |
| 📨 **Jobs Applied** | Dedicated tracking dashboard for submitted applications (`applied = True`), sorted chronologically by application date (`applied_on DESC`). Manage follow-up notes and application statuses. |
| ❌ **Jobs Rejected From** | Outcome analysis view for rejected roles (`rejected = True`), sorted by rejection date (`rejected_on ASC`). Track rejection reasons to refine your search strategy over time. |

---

### 3. 🎨 Design & Aesthetic System

- **Dark Mode Glassmorphism**: Tailored dark palette (`#0f172a` slate background) with blurred glass-panel cards (`backdrop-blur-md`) and custom borders.
- **Micro-Interactions**: Hover highlights, animated tab indicators, live spinner loaders for query execution, and pulsing indicators for unsaved edits.
- **Dual-Axis Scrolling**: Fixed header, sticky table headers, and dual-axis overflow containers (`max-h-[650px]`) for seamless viewing of wide datasets.
- **Lucide React Icons**: Consistent, clean iconography across controls, status badges, and action toolbars.

---

### 4. 🔒 Frontend Security & Architecture

- **Automatic Handshake Session Auth**:
  - The frontend automatically requests a session token from the backend via [`initSessionToken`](file:///Users/dbearsong/Documents/projects/python/job_processor_and_frontend/frontend/src/api/axiosClient.js).
  - All subsequent data queries and updates include the `X-Session-Token` header for request validation.
- **Decoupled Architecture**:
  - Built with React 19 and Vite for instant HMR development.
  - Backend credentials, SSH database tunnels, and API keys remain safely on the server.

---

## 🛠️ Tech Stack

- **Frontend**:
  - React 19
  - Vite
  - Tailwind CSS v4
  - Lucide React (Icons)
  - Axios (HTTP client with custom session interceptors)
- **Backend**:
  - FastAPI (Python 3.10+)
  - PostgreSQL (via SSH tunneling connector)
  - Uvicorn (ASGI server)

---

## 🚀 Quick Start

### 1. Prerequisites
- **Python 3.10+**
- **Node.js 18+** & **npm**
- **PostgreSQL Database** (configured in `.env`)

### 2. Environment Configuration (`.env`)
Create a `.env` file in the project root with your database credentials:
```env
# Database Credentials
DB_HOST=your_db_host
DB_PORT=5432
DB_NAME=your_db_name
DB_USER=your_db_user
DB_PASSWORD=your_db_password

# SSH Tunnel Credentials (if remote)
SSH_HOST=your_ssh_host
SSH_PORT=22
SSH_USERNAME=your_ssh_username
SSH_PASSWORD=your_ssh_password
SSH_KEY_PATH=

# Allowed CORS Origins (optional)
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

### 3. Running the Application

You can use the provided shell scripts or run commands manually:

#### Option A: Using Helper Scripts
In one terminal:
```bash
./start_backend.sh
```
In a second terminal:
```bash
./start_frontend.sh
```

#### Option B: Manual Startup

**Start the Backend:**
```bash
source .venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Start the Frontend:**
```bash
cd frontend
npm install
npm run dev
```

Open your browser to `http://localhost:5173` to access the dashboard.