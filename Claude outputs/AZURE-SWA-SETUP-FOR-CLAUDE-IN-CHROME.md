# Task for Claude in Chrome: deploy the frontend to Azure Static Web Apps

You are driving a real browser session (Azure Portal + GitHub) to finish deploying
`web/` from the `pchenatwork/osh-maf-poc` repo. Do the phases in order — Phase 2
depends on a file Phase 1 creates, and Phase 3 depends on a URL Phase 1 produces.

**Before starting:** confirm the human is already signed into `portal.azure.com`
and `github.com` in this Chrome profile. If either sign-in (or an MFA prompt)
appears, stop and hand control back rather than guessing credentials.

**Fill-in value you need from the human before Phase 3:** the Render API URL from
the earlier deployment step (something like `https://osh-maf-api.onrender.com`).
If you don't have it, ask before Phase 3 rather than guessing.

---

## Phase 1 — Create the Static Web App (Azure Portal)

1. Go to `https://portal.azure.com`.
2. Use the top search bar → search `Static Web Apps` → open the **Static Web Apps** service page.
3. Click **+ Create**.
4. **Basics** tab — fill in exactly:
   | Field | Value |
   |---|---|
   | Subscription | *(ask the human which one if more than one is listed)* |
   | Resource Group | *(ask the human — or click "Create new" and name it `osh-maf-poc-rg` if they have no preference)* |
   | Name | `osh-maf-web` |
   | Plan type | **Free** |
   | Region for staticwebapp | *(ask the human, or pick the closest to their prior selection; region availability is limited for the Free plan — the wizard will only show valid options)* |
5. **Deployment details**, still on Basics:
   | Field | Value |
   |---|---|
   | Source | **GitHub** |
   Click **Sign in with GitHub** if prompted, and authorize Azure to access the account that owns `pchenatwork/osh-maf-poc` (this may open a GitHub OAuth consent screen — accept it).
   | Organization | `pchenatwork` |
   | Repository | `osh-maf-poc` |
   | Branch | `main` |
6. **Build Details**, still on Basics:
   | Field | Value |
   |---|---|
   | Build Presets | **Custom** (if React is offered as a distinct preset, prefer Custom so the paths below are respected exactly) |
   | App location | `/web` |
   | Api location | *(leave blank)* |
   | Output location | `dist` |
7. Click **Review + create**, wait for validation to pass, then click **Create**.
8. Wait for the deployment notification ("Your deployment is complete") — this can take a minute or two. Click **Go to resource**.
9. On the resource's **Overview** page, copy the **URL** shown near the top (looks like `https://<random-name>.azurestaticapps.net`). **Report this URL back to the human** — it's needed for Phase 3 and for the Render CORS setting from the earlier deployment doc.

Creating this resource automatically:
- adds a deployment secret to the GitHub repo, and
- commits a new workflow file to `.github/workflows/azure-static-web-apps-<random>.yml` on the `main` branch, which will immediately kick off a first GitHub Actions run.

Let that first run happen — it will build without `VITE_API_BASE_URL` set, so it will succeed but the deployed site will call a relative `/fhir/...` path with no backend behind it. Phase 2 fixes that.

---

## Phase 2 — Patch the generated workflow so it points at the API (GitHub)

The build reads `VITE_API_BASE_URL` at **build time** (Vite inlines it into the JS bundle), so it has to live in the GitHub Actions workflow itself, not as an Azure app setting.

1. Go to `https://github.com/pchenatwork/osh-maf-poc/tree/main/.github/workflows`.
2. Open the file named `azure-static-web-apps-<something>.yml` (the one just created in Phase 1 — there should be exactly one).
3. Click the **pencil/edit icon** to edit the file in GitHub's web editor.
4. Find the step that looks like this:
   ```yaml
         - name: Build And Deploy
           id: builddeploy
           uses: Azure/static-web-apps-deploy@v1
           with:
             azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN_<SOMETHING> }}
             repo_token: ${{ secrets.GITHUB_TOKEN }}
             action: "upload"
             app_location: "/web"
             api_location: ""
             output_location: "dist"
   ```
5. Add an `env:` block directly under `uses:` and before `with:`, so it reads:
   ```yaml
         - name: Build And Deploy
           id: builddeploy
           uses: Azure/static-web-apps-deploy@v1
           env:
             VITE_API_BASE_URL: https://osh-maf-api.onrender.com
           with:
             azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN_<SOMETHING> }}
             repo_token: ${{ secrets.GITHUB_TOKEN }}
             action: "upload"
             app_location: "/web"
             api_location: ""
             output_location: "dist"
   ```
   Replace `https://osh-maf-api.onrender.com` with the actual Render URL from the human (see the fill-in note at the top) if it differs. Leave everything else in the file untouched.
6. Scroll down, add a commit message like `Set VITE_API_BASE_URL for build`, choose **Commit directly to the `main` branch**, and click **Commit changes**.
7. Go to the repo's **Actions** tab and confirm a new workflow run started for this commit. Wait for it to finish (green check).

---

## Phase 3 — Point the API's CORS setting at the new site (Render)

This isn't the Azure portal, but the deployment isn't functional without it — the browser will reject cross-origin calls from the new site until this is set.

1. Go to `https://dashboard.render.com`.
2. Open the `osh-maf-api` web service (created in the earlier Render deployment step).
3. Go to its **Environment** tab.
4. Find (or add) the variable `Cors__AllowedOrigins__0` and set its value to the Azure URL from Phase 1, **no trailing slash** — e.g. `https://osh-maf-web-xyz123.azurestaticapps.net`.
5. Save. Render will redeploy the service automatically — wait for the deploy to finish (Render's dashboard shows a "Live" status).

---

## Verification

1. Open the Azure URL from Phase 1 in a new tab.
2. Confirm the app loads (the MAF form renderer, not a blank page or a 404).
3. Open the browser DevTools console/network tab and confirm requests to `/fhir/...` go to the Render URL and succeed (no CORS errors, no failed requests). A `404`/`no active Questionnaire` response is fine if no definition has been published yet — that's a separate, expected step, not a deployment failure.
4. Report back: the final Azure URL, whether the GitHub Actions run in Phase 2 succeeded, and whether the console showed any CORS or network errors.

If anything fails at a step above (a form field that doesn't match what's described, a permission error, a build failure in Actions), stop and report exactly what you saw rather than improvising a workaround.
