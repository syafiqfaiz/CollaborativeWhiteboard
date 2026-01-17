# UniBoard Lite

UniBoard Lite is a minimal collaborative whiteboard designed to teach realtime architecture concepts without backend complexity. It allows multiple anonymous users to draw on a shared canvas using an ephemeral, stateless architecture.

The system relies on Supabase Realtime as a message broker and utilizes a Peer-to-Peer "Handshake" for state synchronization, eliminating the need for a persistent database.

## Features

- **Anonymous Access**: Join simply by entering a display name.
- **Real-time Collaboration**: Live drawing and cursor tracking.
- **P2P State Sync**: The "oldest" user in the room acts as the host to sync state to new users.
- **Tools**: Pen (Black, Red, Blue, Green) and Eraser.
- **Stateless Architecture**: No database persistence; all state is ephemeral to the session.

## Setup & Installation

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd uniboard-lite
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Environment Configuration:**
    Copy the example environment file:
    ```bash
    cp .env.example .env
    ```
    Open `.env` and populate it with your Supabase credentials:
    -   `VITE_SUPABASE_URL`: Your Supabase Project URL.
    -   `VITE_SUPABASE_KEY`: Your Supabase Anon Public Key.

    *Note: You need to enable "Broadcast" and "Presence" in your Supabase project settings.*

## Running Development Server

To start the local development server:

```bash
npm run dev
```

Open your browser to `http://localhost:5173`. Open multiple tabs or windows to simulate multiple users.

## Testing

To run the unit tests:

```bash
npm test
```

## Deployment

To build the application for production:

```bash
npm run build
```

This will generate static assets in the `dist` folder, which can be deployed to any static site host (e.g., Vercel, Netlify, GitHub Pages, or an S3 bucket).

**Deployment Note:**
Ensure that your production environment also has the `VITE_SUPABASE_URL` and `VITE_SUPABASE_KEY` environment variables set.
