# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

```
workflow-display/
├── api/        # Flask backend
│   ├── run.py
│   ├── config.py
│   ├── encoder.py
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── schema_ddl.sql
│   └── db/
│       ├── database.py
│       └── query.py
└── ui/         # React + TypeScript + Vite frontend
    ├── src/
    └── package.json
```

## Commands

```bash
# --- Backend (api/) ---
cd api

# Set up environment
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run locally (dev)
flask --app run run

# Run with gunicorn (prod-like)
gunicorn run:app --bind 0.0.0.0:8081 --timeout 60

# Build Docker image
docker build -t workflow-display .
docker run -p 8081:8081 --env-file .env workflow-display

# --- Frontend (ui/) ---
cd ui
npm install
npm run dev       # dev server
npm run build     # production build
npm run preview   # preview production build
```

## Configuration

Copy `.env.example` to `api/.env` and fill in values:

```
DB_USERNAME=
DB_PASSWORD=
DB_CONNECTION=project:region:instance   # GCP Cloud SQL connection name
DB_NAME=
```

Settings are loaded via `api/config.py` using `pydantic-settings` from the `.env` file.

## Architecture

**Flask app** (`api/run.py`): Single blueprint `api_v1` at `/api/v1`. Routes are defined on the blueprint before it's registered. CORS is applied to the blueprint, not the app. A custom JSON provider handles serialization of `datetime`, `date`, `UUID`, `Decimal`, and `set` types.

**Transaction middleware** (`api/run.py` + `api/db/database.py`): Every request is wrapped in a transaction via `TransactionalMiddleware`. The `@transactional` decorator uses a `ContextVar` (`transaction_context`) to scope SQLAlchemy sessions per request — each request gets a unique UUID as its transaction ID, which is used as the `scopefunc` for `scoped_session`. Session is committed on success or rolled back on exception, then removed.

**Database** (`api/db/database.py`): Connects to Google Cloud SQL PostgreSQL using `cloud-sql-python-connector` with the `pg8000` driver. The engine uses a creator function instead of a connection string.

**Querying** (`api/db/query.py`): Raw SQL via `exec_driver_sql`. Use `query()` for SELECT (returns list of dicts) and `execute()` for mutations. A `conversion_fn` parameter handles type coercion of result values (UUIDs → str, datetime → ISO string, Decimal → float).

**Frontend** (`ui/`): React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui components, react-router-dom for routing.

## Domain Model

The database (`api/schema_ddl.sql`) represents a legal case management system. Key entities:
- `person` — clients/users identified by `profile_id` (text, not the integer `id`)
- `matter` — legal cases linked to a person; has `workflow`, `workflow_step_name`, `workflow_id`
- `workflow` / `workflow_step` / `workflow_action` / `workflow_option` — workflow definition tables
- `workflow_display` / `workflow_display_step` — display configuration for workflow UI
- `services_bundle` — groups of services associated with a person
- `court`, `person_case`, `person_charge` — court and case record data

Foreign keys on `person` use `profile_id` (text), not the integer PK.
