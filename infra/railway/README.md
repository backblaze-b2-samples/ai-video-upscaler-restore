# Railway Deployment

Deploy both services (web + api) on Railway.

## Setup

1. Create a new Railway project
2. Add two services from the same repo:

### Web Service (Next.js)
- **Root Directory**: `apps/web`
- **Build Command**: `pnpm install && pnpm build`
- **Start Command**: `pnpm start`
- **Port**: `3000`

### API Service (FastAPI)
- **Root Directory**: `services/api`
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`

> **Running restorations needs the engine.** The base API build above serves the
> UI, manages jobs/manifests, and runs all B2 features — but it cannot *run* a
> restoration. To actually execute Real-ESRGAN, the service (or a dedicated
> worker) must additionally `pip install -r requirements-restore.txt`. That pulls
> torch + the ML stack, so expect a **much longer build** and a larger image,
> and ideally GPU-backed compute. A common pattern is to keep the API service on
> base deps and add a separate worker with the restore stack installed.

## Environment Variables

Set these on the API service (standardized `B2_*` names; the S3 endpoint is
derived from `B2_REGION`):

| Variable | Value |
|----------|-------|
| `B2_APPLICATION_KEY_ID` | Your B2 application key ID |
| `B2_APPLICATION_KEY` | Your B2 application key |
| `B2_BUCKET_NAME` | Your bucket name |
| `B2_REGION` | Your bucket's region, e.g. `us-west-004` |
| `B2_PUBLIC_URL_BASE` | Optional public base URL (omit for private buckets) |
| `API_CORS_ORIGINS` | Your web service URL (e.g., `https://web-production-xxx.up.railway.app`) |

Set this on the Web service:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | Your API service URL (e.g., `https://api-production-xxx.up.railway.app`) |
