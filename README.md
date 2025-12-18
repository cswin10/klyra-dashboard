# Klyra Dashboard

A private AI assistant interface that runs on local hardware. Built with Next.js 14, FastAPI, and integrates with Ollama for local LLM inference.

## Features

- **Private & Offline**: Runs 100% locally - no external API calls
- **RAG-powered Chat**: Upload documents and chat with your data
- **User Management**: Multi-user support with admin/user roles
- **Dashboard Analytics**: Track usage, queries, and system health
- **Document Processing**: Support for PDF, DOCX, and TXT files
- **Real-time Streaming**: See AI responses as they're generated

## Prerequisites

- Python 3.11+
- Node.js 18+
- [Ollama](https://ollama.ai/) installed and running
- Required Ollama models:
  ```bash
  ollama pull llama3
  ollama pull nomic-embed-text
  ```

## Quick Start

1. **Install dependencies**:
   ```bash
   chmod +x install.sh start.sh
   ./install.sh
   ```

2. **Start the application**:
   ```bash
   ./start.sh
   ```

3. **Access the dashboard**:
   - Open http://localhost:3000 in your browser
   - Login with default credentials:
     - Email: `admin@klyra.local`
     - Password: `admin123`

## Manual Setup

### Backend

```bash
cd backend
pip install -r requirements.txt
python seed.py  # Create default admin user
uvicorn main:app --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Architecture

```
klyra-dashboard/
├── frontend/          # Next.js 14 with App Router
│   ├── app/          # Pages and layouts
│   ├── components/   # Reusable UI components
│   └── lib/          # API client, auth, utilities
│
├── backend/          # FastAPI Python backend
│   ├── routes/       # API endpoint handlers
│   ├── models.py     # SQLAlchemy database models
│   ├── rag.py        # Document processing & search
│   └── ollama.py     # Ollama API client
│
└── data/             # Local data storage
    ├── klyra.db      # SQLite database
    ├── chroma/       # Vector embeddings
    └── uploads/      # Uploaded documents
```

## Pages

- **Overview**: Dashboard with stats and analytics
- **Chat**: AI chat interface with RAG support
- **Documents**: Upload and manage documents
- **Users**: User management (admin only)
- **System**: System stats and controls (admin only)
- **Logs**: Query logs and history (admin only)
- **Settings**: Profile and password management

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /api/auth/login` | Authenticate user |
| `GET /api/auth/me` | Get current user |
| `GET /api/chats` | List user's chats |
| `POST /api/chats/{id}/messages` | Send message (streaming) |
| `GET /api/documents` | List all documents |
| `POST /api/documents` | Upload document |
| `GET /api/stats` | Dashboard statistics |
| `GET /api/system/stats` | System information |

## Configuration

Environment variables can be set in `backend/.env`:

```env
SECRET_KEY=your-secret-key
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3
OLLAMA_EMBED_MODEL=nomic-embed-text
```

## Tech Stack

**Frontend:**
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Recharts
- Lucide Icons

**Backend:**
- FastAPI
- SQLAlchemy + SQLite
- ChromaDB (vector store)
- PyJWT (authentication)
- LangChain (text splitting)

## Security Notes

- Change the default admin password immediately after installation
- The JWT secret key should be changed in production
- CORS is configured for localhost only
- All data is stored locally on your machine

## Troubleshooting

**Ollama not responding:**
```bash
# Ensure Ollama is running
ollama serve
```

**Port already in use:**
```bash
# Kill processes on ports 3000 and 8000
lsof -ti:3000 | xargs kill -9
lsof -ti:8000 | xargs kill -9
```

**Reset database:**
```bash
rm data/klyra.db
cd backend && python seed.py
```

## License

MIT License - feel free to use and modify for your needs.
