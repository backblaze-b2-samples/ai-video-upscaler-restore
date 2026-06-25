<!-- last_verified: 2026-06-24 -->
# Security

Security principles and implementation for `ai-video-upscaler-restore`.

## Trust Boundaries

- **Frontend -> API**: CORS-restricted to configured origins, scoped to `GET/POST/PUT/DELETE/OPTIONS`
- **API -> B2**: Authenticated via `B2_APPLICATION_KEY_ID` + `B2_APPLICATION_KEY`, signature v4. The S3 endpoint is derived from `B2_REGION` (`https://s3.<B2_REGION>.backblazeb2.com`) — no endpoint is configured directly.
- **Client -> B2**: Presigned URLs for download / before-after serving (10-min expiry)

## Standardized B2 environment variables

| Var | Purpose |
|-----|---------|
| `B2_APPLICATION_KEY_ID` | Application key ID |
| `B2_APPLICATION_KEY` | Application key secret |
| `B2_BUCKET_NAME` | Target bucket |
| `B2_REGION` | Region; the S3 endpoint is derived from it |
| `B2_PUBLIC_URL_BASE` | Optional public base URL (blank for private buckets) |

There are no `B2_KEY_ID` / `B2_ENDPOINT` aliases — those legacy names are not used anywhere.

## Restoration weights download

- Running a restoration auto-downloads model weights on first use over HTTPS from the official OSS releases:
  - Real-ESRGAN: `RealESRGAN_x4plus.pth` from the [Real-ESRGAN](https://github.com/xinntao/Real-ESRGAN) GitHub releases
  - GFPGAN (when face-restore is on): `GFPGANv1.3.pth` from the [GFPGAN](https://github.com/TencentARC/GFPGAN) GitHub releases
- The weights are cached locally by the `realesrgan`/`gfpgan` libraries. No weights are committed to this repo. The heavy ML stack lives in `requirements-restore.txt` and is only needed to run restorations.

## Upload Validation

- Filename sanitization: path traversal, null bytes, unsafe chars stripped
- MIME/extension consistency check against allowlist
- Chunked streaming with size enforcement (500MB default — source footage can be large)
- Content-type allowlist (images, PDFs, text, archives, audio/video)
- Empty file rejection

## File Key Validation

- Empty keys rejected
- Path traversal patterns rejected (`../`, `%2e%2e`, backslashes, null bytes)
- The bucket is the only access boundary — add prefix scoping in
  `services/api/app/service/files.py::validate_key` if your deployment
  shares a bucket with other workloads
- **Job deletion is prefix-scoped:** deleting a Restoration Job removes its
  manifest and only the objects under its own `restored/<id>/` prefix
  (`repo/manifests.py::delete_manifest_and_outputs` → `delete_prefix`). It
  never touches sources or other jobs' outputs.

## Download Safety

- Presigned URLs force `Content-Disposition: attachment`
- Prevents inline rendering of user-uploaded content (XSS mitigation)

## Secrets Management

- All secrets loaded via environment variables (pydantic-settings)
- Never committed to source control
- `.env.example` documents required variables without values

## Agent Security Rules

- Never commit `.env`, credentials, or API keys
- Never weaken validation without explicit instruction
- Never bypass CORS, auth, or input sanitization
- Always validate at system boundaries
