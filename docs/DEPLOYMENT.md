# Deployment — Render (API) + Azure Static Web Apps (frontend)

Free-tier deployment for the two halves of this repo. The API and the frontend
each need to know the other's URL, so the order below breaks that chicken-and-egg
problem: deploy the API first (get its URL), build the frontend against that URL,
then come back and tell the API which frontend origin to trust.

## 0. Prerequisites

- Repo pushed to GitHub (`origin` is already `pchenatwork/osh-maf-poc`).
- A [Render](https://render.com) account, connected to that GitHub account.
- An [Azure](https://portal.azure.com) subscription, connected to the same GitHub account.

---

## A. Deploy the API to Render (Docker, free tier)

`api/Dockerfile` is already written for this — it reads `PORT` from Render at
runtime and exposes `/healthz`. Nothing to change in code.

1. Render dashboard → **New +** → **Web Service** → connect the
   `pchenatwork/osh-maf-poc` GitHub repo.
2. Configure:
   | Field | Value |
   |---|---|
   | Name | `osh-maf-api` (or anything — this becomes part of the URL) |
   | Root Directory | `api` |
   | Runtime | Docker (auto-detected from `api/Dockerfile`) |
   | Branch | `main` |
   | Instance Type | **Free** |
3. **Health Check Path** (Advanced settings): `/healthz`
4. Environment variables (Render → Environment tab) — add now, edit later:
   | Key | Value |
   |---|---|
   | `ASPNETCORE_ENVIRONMENT` | `Production` |
   | `Cors__AllowedOrigins__0` | *(leave blank for now — set in step C)* |
   | `ConnectionStrings__Maf` | *(optional — see §D below)* |
5. **Create Web Service.** First build takes a few minutes. You'll get a URL like:
   ```
   https://osh-maf-api.onrender.com
   ```
6. Verify: `curl https://osh-maf-api.onrender.com/healthz` → `ok`

**Free tier behavior to expect:** the instance spins down after 15 minutes with
no traffic, and the next request pays a ~30–50s cold-start while it boots back
up. That's normal for the free plan, not a broken deploy.

---

## B. Deploy the frontend to Azure Static Web Apps (free tier)

`web/public/staticwebapp.config.json` already exists and Vite copies it into
`dist/` on build, so Azure picks it up automatically — no routing config needed.

1. Azure Portal → **Create a resource** → **Static Web App**.
2. Configure:
   | Field | Value |
   |---|---|
   | Plan type | **Free** |
   | Deployment source | GitHub → authorize → `pchenatwork/osh-maf-poc`, branch `main` |
   | Build Presets | Custom (or React) |
   | App location | `/web` |
   | Api location | *(leave blank — this repo has no Azure Functions API)* |
   | Output location | `dist` |
3. Creating the resource auto-commits a GitHub Actions workflow file to the repo
   (`.github/workflows/azure-static-web-apps-<random-name>.yml`) and adds a
   deployment token as a repo secret. That workflow runs `npm run build` inside
   `web/`.
4. `VITE_API_BASE_URL` is inlined into the JS bundle **at build time** (see
   `web/.env.example`), so it must be set inside that GitHub Actions workflow,
   not as an Azure app setting. Edit the generated workflow: in the `build_and_deploy_job`
   step, add an `env:` block with the Render URL from step A:
   ```yaml
         - name: Build And Deploy
           uses: Azure/static-web-apps-deploy@v1
           env:
             VITE_API_BASE_URL: https://osh-maf-api.onrender.com
           with:
             ...
   ```
5. Commit and push that edit. GitHub Actions rebuilds and deploys. You'll get a
   URL like:
   ```
   https://<random-name>.azurestaticapps.net
   ```

---

## C. Close the loop — allow the frontend's origin on the API

Back in Render → Environment tab:

```
Cors__AllowedOrigins__0 = https://<random-name>.azurestaticapps.net
```

(no trailing slash) → Save. Render redeploys automatically. `Program.cs` reads
this into the CORS policy — without it, every request from the deployed frontend
is rejected by the browser even though the API itself is healthy.

Open the Azure URL and confirm requests to `/fhir/*` succeed with no CORS errors
in the browser console.

---

## D. About the database (read this before you assume submissions work)

Form **definitions** now ship inside the image (`api/Osh.Maf.Data/_formDef/*.json`,
`CopyToOutputDirectory`), so `GET /fhir/Questionnaire` works with **no database at
all** — you can deploy steps A–C above and demo the read side on Render's free tier
as-is.

A database is only needed for `POST`/`PUT /fhir/QuestionnaireResponse` (submissions)
and the extraction pipeline, via `ConnectionStrings__Maf`. Render's free tier has
**no free SQL Server offering**. If you want submissions working on free infrastructure:

- Use the **Azure SQL Database free offer** (one per subscription, serverless,
  auto-pause, 32GB) instead of paying for Render's Postgres/SQL add-ons.
- Run the numbered migrations in `api/Osh.Maf.Data/Migrations/` against it.
- Azure SQL's firewall defaults to Azure-only access — Render is not Azure and
  has no static outbound IP on the free tier, so you'd need to open the firewall
  to `0.0.0.0`–`255.255.255.255`. **That's acceptable for a throwaway POC only** —
  never do this with real data.
- Set on Render:
  ```
  ConnectionStrings__Maf = Server=tcp:<server>.database.windows.net,1433;Database=OSH_MAF;User ID=<user>;Password=<pw>;Encrypt=True;TrustServerCertificate=False;
  ```

If you don't need submissions for the demo, just leave `ConnectionStrings__Maf`
unset — the repo is already designed to deploy read-only without failing startup.
