# API

Flask backend for workflow-display.

## Setup

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Copy `.env.example` to `.env` and fill in values:

```
DB_USERNAME=
DB_PASSWORD=
DB_CONNECTION=project:region:instance   # GCP Cloud SQL connection name
DB_NAME=
```

## Running

```bash
# Development
flask --app run run

# Production-like (gunicorn)
gunicorn run:app --bind 0.0.0.0:8081 --timeout 60

# Docker
docker build -t workflow-display .
docker run -p 8081:8081 --env-file .env workflow-display
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/api/v1/workflow` | List all workflows |
| POST | `/api/v1/workflow` | Create a workflow |
| GET | `/api/v1/workflow/:id` | Get workflow with steps, options, and actions |
| GET | `/api/v1/workflow/:id/actions` | List actions for a workflow |
| POST | `/api/v1/workflow/:id/save` | Save workflow changes (new/reordered steps, options, action links) |

### `/save` payload

The editor sends a single batch of changes:

| Field | Description |
|-------|-------------|
| `new_steps` | Steps to create (`name`, `display_name`, `ordinal`) |
| `reorder_steps` | Existing steps whose ordinal changed (`id`, `ordinal`); renumbered to a contiguous `1..N` sequence |
| `new_options` / `remove_options` | Options to create / delete (options reference their step by name) |
| `new_actions` | New action records to create |
| `new_action_links` / `remove_action_links` | Option-to-action links to add / remove |

New steps are inserted first (options reference steps by name), then reorders, removals, and additions are applied.

## Architecture

- **Blueprint** `api_v1` mounted at `/api/v1`; CORS applied to the blueprint
- **TransactionalMiddleware** wraps every request in a scoped SQLAlchemy session (commit on success, rollback on error)
- **Database** connects to GCP Cloud SQL PostgreSQL via `cloud-sql-python-connector` + `pg8000`
- **Queries** use raw SQL via `db/query.py`: `query()` for SELECT (returns list of dicts), `execute()` for mutations
- **JSON serialization** handles `datetime`, `date`, `UUID`, `Decimal`, and `set` via a custom encoder
