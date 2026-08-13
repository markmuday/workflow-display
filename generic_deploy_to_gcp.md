# Deploying a Repo to GCP Cloud Run (IAP-gated)

A reusable recipe for shipping **any** repo as a single container to Cloud Run in the
`development-utils-with-iap` project, behind Identity-Aware Proxy, optionally wired to the
shared Cloud SQL Postgres instance. The concrete values below are the ones already in use
(the `work-item-editor` service is a worked example); reuse the **shared infrastructure**
values verbatim and change only the **per-app** values.

---

## Shared infrastructure (already provisioned — reuse as-is)

| Thing | Value |
|---|---|
| Deploy project ID | `development-utils-with-iap` |
| Deploy project number | `450637338046` |
| Region | `us-central1` |
| Artifact Registry repo | `apps` (Docker, in the deploy project / `us-central1`) |
| Runtime service account | `450637338046-compute@developer.gserviceaccount.com` (default compute SA) |
| IAP access group | `tech@rasa-legal.com` (`roles/iap.httpsResourceAccessor`) |
| IAP service agent | `service-450637338046@gcp-sa-iap.iam.gserviceaccount.com` (needs `roles/run.invoker`) |
| **Cloud SQL** project ID | `gold-mode-331618` (a **different** project) |
| Cloud SQL project number | `1067640388100` |
| Cloud SQL instance | `gold-mode-331618:us-central1:postgres-court` |
| Databases on that instance | `rasa-events` (prod), `rasa-events-dev` (dev) |
| DB user | `postgres` |
| DB port | `5432` |
| DB password secret | `RASA_CLOUD_SQL_DEV_PWD` (in `gold-mode-331618`) — holds the `postgres` user password |
| Secret resource path | `projects/1067640388100/secrets/RASA_CLOUD_SQL_DEV_PWD:latest` |

The Cloud SQL instance and the password secret live in `gold-mode-331618`, so the deploy
project's compute SA is granted `roles/cloudsql.client` and `roles/secretmanager.secretAccessor`
**on that project** (see [Cross-project IAM](#cross-project-iam-one-time-per-project-pair)).

### Required APIs (enable once per project)

`run`, `cloudbuild`, `artifactregistry`, `secretmanager`, `iap`, `sqladmin`, `cloudresourcemanager`.

```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com secretmanager.googleapis.com iap.googleapis.com \
  sqladmin.googleapis.com cloudresourcemanager.googleapis.com \
  --project development-utils-with-iap
```

---

## Per-app values (set these for your new service)

| Variable | Meaning | Example |
|---|---|---|
| `SERVICE` | Cloud Run service name (also the image name) | `my-new-app` |
| `DB_NAME` | Database to use on the shared instance (omit if the app has no DB) | `rasa-events` |
| App env vars | Whatever your app reads (see [reference](#environment-variable-reference)) | `RUST_LOG=info` |

---

## Container contract

Your repo must build into **one** container image that:

- Listens for HTTP on the port given by the `PORT` env var (Cloud Run sets `PORT`; default to `8080`).
- Binds to `0.0.0.0`, not `127.0.0.1`.
- If it needs Postgres, connects over the Cloud SQL **Unix socket** `/cloudsql/<DATABASE_INSTANCE>`
  (Cloud Run mounts it when you pass `--add-cloudsql-instances`), not TCP.
- Is self-contained (serves its own static assets / SPA if it has a frontend — there is no
  separate static host).

A repo-root `Dockerfile` is used by `gcloud builds submit --tag` automatically. Keep the build
context small with a `.gcloudignore` that excludes `target/`, `node_modules/`, `dist/`, `.env`,
logs, and `.git`.

---

## Build + deploy

Run from the repo root. Set the two per-app values at the top, then the rest is boilerplate.

```bash
# ---- per-app ----
SERVICE=my-new-app          # <-- change
DB_NAME=rasa-events         # <-- change (or drop the DB flags below if no database)

# ---- shared (leave as-is) ----
PROJECT=development-utils-with-iap
REGION=us-central1
REPO=apps
INSTANCE=gold-mode-331618:us-central1:postgres-court
IMAGE=$REGION-docker.pkg.dev/$PROJECT/$REPO/$SERVICE

# 1. Build + push the image (context is the repo root; uses ./Dockerfile)
gcloud builds submit --tag $IMAGE --project=$PROJECT

# 2. Deploy (IAP-gated, cross-project Cloud SQL + secret)
gcloud run deploy $SERVICE \
  --image $IMAGE --region $REGION --project $PROJECT \
  --no-allow-unauthenticated \
  --add-cloudsql-instances $INSTANCE \
  --set-env-vars DB_NAME=$DB_NAME,DB_USER=postgres,DB_PORT=5432,DATABASE_INSTANCE=$INSTANCE,RUST_LOG=info \
  --set-secrets DB_PASS=projects/1067640388100/secrets/RASA_CLOUD_SQL_DEV_PWD:latest
```

- **No database?** Drop `--add-cloudsql-instances`, the `DB_*`/`DATABASE_INSTANCE` env vars, and
  the `--set-secrets` line. Keep any app-specific env vars.
- `--no-allow-unauthenticated` is required so IAP is the only way in (see below).
- Deploying again with the same `SERVICE` creates a new revision and shifts 100% of traffic to it.

---

## IAP setup (one-time per service)

```bash
# Enable built-in IAP on the service (auto-provisions the OAuth client + IAP service agent)
gcloud beta run services update $SERVICE --region $REGION --project $PROJECT --iap

# Let the IAP service agent invoke the service
gcloud run services add-iam-policy-binding $SERVICE --region $REGION --project $PROJECT \
  --member="serviceAccount:service-450637338046@gcp-sa-iap.iam.gserviceaccount.com" \
  --role=roles/run.invoker

# Grant the access group entry through IAP
gcloud beta iap web add-iam-policy-binding --resource-type=cloud-run --service=$SERVICE \
  --region=$REGION --project=$PROJECT \
  --member="group:tech@rasa-legal.com" --role=roles/iap.httpsResourceAccessor
```

Behind IAP, the authenticated user's email is forwarded to your container in the
`X-Goog-Authenticated-User-Email` header (value `accounts.google.com:<email>`). Use it if the
app needs to know who the caller is.

---

## Cross-project IAM (one-time per project pair)

Only needed if the app uses the shared Cloud SQL instance / secret (they live in
`gold-mode-331618`). Grant the deploy project's compute SA access **on the Cloud SQL project**:

```bash
SA=450637338046-compute@developer.gserviceaccount.com

gcloud projects add-iam-policy-binding gold-mode-331618 \
  --member="serviceAccount:$SA" --role=roles/cloudsql.client

gcloud projects add-iam-policy-binding gold-mode-331618 \
  --member="serviceAccount:$SA" --role=roles/secretmanager.secretAccessor
```

---

## Database access & migrations

The app connects to Cloud SQL over the Unix socket in production. For local access and for
running schema migrations, use the Cloud SQL Auth Proxy:

```bash
# Start the proxy (any free local port, e.g. 5434)
cloud-sql-proxy gold-mode-331618:us-central1:postgres-court --port 5434

# Connect with psql
psql "postgresql://postgres@localhost:5434/rasa-events-dev"   # dev
psql "postgresql://postgres@localhost:5434/rasa-events"       # prod
```

**Run migrations against each target DB *before* deploying code that depends on the schema.**
Cloud Run containers here do **not** auto-migrate at startup. Use whatever migration tool your
repo uses, pointed at the proxy, e.g. with `sqlx`:

```bash
DATABASE_URL=postgresql://postgres@localhost:5434/rasa-events-dev <migrate command>   # dev
DATABASE_URL=postgresql://postgres@localhost:5434/rasa-events     <migrate command>   # prod
```

> The `rasa-events` instance is **shared** with other apps (it also holds unrelated tables).
> Scope every migration to your own tables; never drop/rename what you don't own.

---

## Environment variable reference

These are the variables the example service consumes. A DB-less app needs none of the `DB_*`
ones; app-specific vars (like `RUST_LOG`, `STATIC_DIR`) vary per repo.

| Variable | Set via | Description |
|---|---|---|
| `PORT` | Cloud Run (automatic) | HTTP port the container must listen on (default `8080`). |
| `DB_NAME` | `--set-env-vars` | Database name on the instance (`rasa-events` / `rasa-events-dev`). |
| `DB_USER` | `--set-env-vars` | Database user (`postgres`). |
| `DB_PORT` | `--set-env-vars` | Postgres port (`5432`) — used only for TCP fallback. |
| `DATABASE_INSTANCE` | `--set-env-vars` | Cloud SQL connection name `gold-mode-331618:us-central1:postgres-court`; makes the app connect over `/cloudsql/<instance>`. |
| `DB_PASS` | `--set-secrets` | Password for `DB_USER`, from Secret Manager (`RASA_CLOUD_SQL_DEV_PWD`). |
| `DATABASE_URL` | (optional) `--set-env-vars` | Full connection string; if set, overrides all `DB_*`. Socket form: `postgresql://user:pass@/db?host=/cloudsql/<instance>`. |
| `RUST_LOG` | `--set-env-vars` | Example app-specific log filter (`info`). |
| `STATIC_DIR` | `--set-env-vars` | Example app-specific: dir of built SPA assets (default `static`). |

### Local development

For local runs, point `DATABASE_URL` at the proxy in a `.env` file (special characters in the
password must be percent-encoded):

```
DATABASE_URL=postgresql://postgres:<url-encoded-pw>@localhost:5434/rasa-events-dev
```

---

## Verify & troubleshoot

```bash
# Revision health (expect Ready / ConfigurationsReady / RoutesReady = True)
gcloud run services describe $SERVICE --region $REGION --project $PROJECT \
  --format="value(status.conditions[].type, status.conditions[].status, status.latestReadyRevisionName)"

# Startup logs (look for your "listening on 0.0.0.0:$PORT" line and any DB errors)
gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE" \
  --project $PROJECT --limit 20 --freshness=10m --format="value(textPayload)"
```

- **`Reauthentication failed. cannot prompt during non-interactive execution`** during a build/deploy
  → your gcloud token expired. Run `gcloud auth login` (plain form — it uses a localhost callback
  and needs no code pasted back), then retry.
- **Container fails to start / `STARTUP TCP probe failed`** → the app isn't listening on `$PORT`
  or is bound to `127.0.0.1`. Bind `0.0.0.0:$PORT`.
- **DB connection errors** → confirm `--add-cloudsql-instances`, `DATABASE_INSTANCE`, and the
  cross-project IAM grants; the app must use the `/cloudsql/<instance>` socket in production.
- **403 from the service** → the caller isn't in `tech@rasa-legal.com`, or the IAP bindings above
  weren't applied.
