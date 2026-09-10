# Groq AI and Azure Deployment Fallback

This guide keeps EduFX usable when Vertex AI is disabled or the GCP project is
unavailable. Groq becomes the primary text-generation provider, while Azure
Container Apps provides a separate, manually triggered hosting path.

## What Changed

EduFX now uses a configurable text-provider chain:

```text
Fine-tuned quiz endpoint (quiz generation only, when configured)
  -> Groq
  -> Gemini API key
  -> Vertex AI
  -> deterministic application fallback
```

The order after the fine-tuned endpoint comes from `AI_PROVIDER_ORDER`. The
Azure workflow sets `groq,gemini,vertex` and sets `VERTEX_AI_ENABLED=false`, so
no Vertex request is attempted. Provider errors and rate limits are logged and
the next configured provider is tried.

The relevant implementation files are:

- `server/app/services/ai_service.py`: provider selection and fallback
- `server/app/core/config.py`: provider settings
- `server/app/core/clients.py`: enables AI features in Groq-only deployments
- `server/app/rag/embedder.py`: independent embedding-provider selection
- `.github/workflows/deploy-azure.yml`: Azure deployment
- `.github/workflows/deploy.yml`: GCP deployment with Groq-first generation

## Important: Generation and Embeddings Are Different

Groq is used for text generation, including the AI teacher, explanations, and
the general quiz fallback. The current Groq integration does not create the
`gemini-embedding-001` vectors used by EduFX RAG.

For Azure production, add an optional `GEMINI_API_KEY`. EduFX then uses the
Gemini API for embeddings without using the blocked Vertex project. This keeps
new query vectors compatible with the chemistry chunks already stored in
Supabase.

| Configuration | Text generation | RAG embeddings |
|---|---|---|
| Groq only | Works | Unavailable; retrieval returns no new query vector |
| Groq + Gemini API key | Groq first | Gemini API key |
| Vertex enabled | Configurable | Vertex first, Gemini API key fallback |

Do not switch to another embedding model unless all stored content chunks are
re-embedded with the same model and dimensions.

## 1. Create the Groq Production Key

1. Sign in at `https://console.groq.com`.
2. Open **API Keys** and create a key for EduFX production.
3. Copy it once and store it as the GitHub secret `GROQ_API_KEY`.
4. Never place it in the frontend, a `NEXT_PUBLIC_*` variable, source control,
   screenshots, or documentation.
5. Check the Groq model and rate-limit pages before a production demonstration.

The default model is `llama-3.3-70b-versatile`. It can be changed without a
code edit by setting the GitHub variable `GROQ_MODEL` to a currently supported
production model.

Azure deployment can still run before the Groq key is added if `GEMINI_API_KEY`
is already configured. In that temporary mode the provider order remains
`groq,gemini,vertex`, Groq is skipped because no key exists, Gemini handles text
generation and embeddings, and Vertex stays disabled.

## 2. Local Groq-First Configuration

Copy the server environment example to the repository root `.env`, then use:

```dotenv
DATA_BACKEND=supabase
DEMO_MODE=false

GROQ_API_KEY=gsk_replace_with_your_key
GROQ_MODEL=llama-3.3-70b-versatile
GROQ_BASE_URL=https://api.groq.com/openai/v1
GROQ_TIMEOUT_SECONDS=45
AI_PROVIDER_ORDER=groq,gemini,vertex

VERTEX_AI_ENABLED=false
GOOGLE_CLOUD_PROJECT=

# Optional but recommended to preserve RAG embeddings without Vertex.
GEMINI_API_KEY=
EMBEDDING_MODEL=gemini-embedding-001
EMBEDDING_DIMENSIONS=384
```

Start the backend and inspect the non-sensitive provider status:

```powershell
cd D:\PROJECTS\2ndYearProject\EduFX_MVC\server
uvicorn app.main:app --reload --port 8001
Invoke-RestMethod http://localhost:8001/health/providers
```

Expected Groq-first result:

```json
{
  "text_provider_order": ["groq", "gemini", "vertex"],
  "groq_configured": true,
  "gemini_configured": false,
  "vertex_enabled": false,
  "finetuned_endpoint_configured": false,
  "embedding_provider": "none"
}
```

`embedding_provider` becomes `gemini` when `GEMINI_API_KEY` is configured.
No endpoint response contains secret values.

## 3. Azure Resources

The workflow deploys two Linux containers to Azure Container Apps and builds
their images in Azure Container Registry. It is the automatic production path
for pushes to `main` (and can also be started manually), scales both apps to
zero when idle, and runs smoke checks for the frontend route and diagnostic
authentication contract.

Install Azure CLI, sign in, and create the base resources once:

```powershell
az login
az account set --subscription "<subscription-id>"

$location = "centralindia"
$resourceGroup = "edufx-production"
$acr = "edufxacr901ad003"
$environment = "edufx-environment"

az group create --name $resourceGroup --location $location
az acr create --name $acr --resource-group $resourceGroup --sku Basic
az extension add --name containerapp --upgrade --yes
az provider register --namespace Microsoft.App
az provider register --namespace Microsoft.OperationalInsights
az provider register --namespace Microsoft.ContainerRegistry
az containerapp env create `
  --name $environment `
  --resource-group $resourceGroup `
  --location $location `
  --logs-destination none
```

Azure Container Registry names must be globally unique and contain only
letters and numbers.

## 4. GitHub OIDC Authentication

Use OpenID Connect instead of storing an Azure client secret. Create an Entra
application and service principal:

```powershell
$appName = "edufx-github-deploy"
$appId = az ad app create --display-name $appName --query appId -o tsv
$spObjectId = az ad sp create --id $appId --query id -o tsv
$subscriptionId = az account show --query id -o tsv
$tenantId = az account show --query tenantId -o tsv
$resourceGroupId = az group show --name $resourceGroup --query id -o tsv
$acrId = az acr show --name $acr --resource-group $resourceGroup --query id -o tsv

az role assignment create `
  --assignee-object-id $spObjectId `
  --assignee-principal-type ServicePrincipal `
  --role Contributor `
  --scope $resourceGroupId

az role assignment create `
  --assignee-object-id $spObjectId `
  --assignee-principal-type ServicePrincipal `
  --role AcrPush `
  --scope $acrId

# Required because the workflow grants each Container App identity AcrPull.
az role assignment create `
  --assignee-object-id $spObjectId `
  --assignee-principal-type ServicePrincipal `
  --role "User Access Administrator" `
  --scope $acrId
```

Create `azure-federated-credential.json` locally:

```json
{
  "name": "edufx-github-production",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:thanoban/EduFX:environment:azure-production",
  "description": "EduFX Azure production deployment",
  "audiences": ["api://AzureADTokenExchange"]
}
```

Register it, then delete the local JSON file:

```powershell
az ad app federated-credential create `
  --id $appId `
  --parameters azure-federated-credential.json
Remove-Item -LiteralPath .\azure-federated-credential.json
```

The subject must exactly match the GitHub repository and Environment name.

## 5. GitHub Environment Configuration

In GitHub, open **Settings -> Environments**, create
`azure-production`, then add the following Environment secrets.

### Required secrets

| Secret | Purpose |
|---|---|
| `AZURE_CLIENT_ID` | `$appId` from the OIDC setup |
| `AZURE_TENANT_ID` | `$tenantId` |
| `AZURE_SUBSCRIPTION_ID` | `$subscriptionId` |
| `SUPABASE_URL` | Backend and frontend Supabase project URL |
| `SUPABASE_KEY` | Backend key only |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend service-role key only |
| `SUPABASE_JWT_SECRET` | Backend JWT verification secret |
| `SUPABASE_ANON_KEY` | Public anon/publishable key for the frontend |
`SUPABASE_ANON_KEY` is the only Supabase key compiled into the browser. Never
use an `sb_secret_...` or service-role value for it.

At least one text-generation key must exist: `GROQ_API_KEY` or
`GEMINI_API_KEY`. Groq is recommended for production fallback, but the Azure
workflow can deploy with Gemini only until the Groq key is added.

### Optional secrets

| Secret | Purpose |
|---|---|
| `GEMINI_API_KEY` | Recommended existing RAG embedding fallback and secondary text provider |
| `GROQ_API_KEY` | Recommended Groq production text-generation key |
| `FINETUNED_MODEL_URL` | External OpenAI-compatible QLoRA model endpoint |

Daily reminder automation is currently disabled. The availability settings
remain active because they drive the adaptive scheduler, but EduFX does not
present an email-reminder control or claim to send scheduled email until a
verified production mail provider is configured.

Add these Environment variables, which are non-sensitive:

| Variable | Example |
|---|---|
| `AZURE_RESOURCE_GROUP` | `edufx-production` |
| `AZURE_CONTAINER_REGISTRY` | `edufxacr901ad003` |
| `AZURE_CONTAINERAPPS_ENVIRONMENT` | `edufx-environment` |
| `AZURE_BACKEND_APP` | `edufx-backend` |
| `AZURE_FRONTEND_APP` | `edufx-frontend` |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` |

## 6. Deploy to Azure

1. Open the repository's **Actions** tab.
2. Select **Deploy Azure fallback**.
3. Select **Run workflow** on the intended branch.
4. Wait for the backend image, backend app, frontend image, and frontend app
   steps to finish.
5. Read the backend and frontend URLs from the final smoke-test log.

The workflow:

1. authenticates to Azure through GitHub OIDC;
2. builds both images in ACR;
3. creates or updates both Container Apps;
4. stores backend credentials as Container Apps secrets;
5. assigns managed identities for private ACR image pulls;
6. disables Vertex and selects Groq first;
7. sets the frontend URL as the backend CORS origin;
8. checks `/`, `/health/providers`, and the frontend home page.

## 7. Production Verification

Run these after deployment:

```powershell
$backend = "https://<backend-app>.<region>.azurecontainerapps.io"
$frontend = "https://<frontend-app>.<region>.azurecontainerapps.io"

Invoke-RestMethod "$backend/"
Invoke-RestMethod "$backend/health/providers"
Start-Process "$backend/docs"
Start-Process $frontend
```

Then verify authenticated product paths:

- sign in through the Azure frontend;
- ask the AI teacher a question and confirm a response;
- generate a quiz and submit it;
- request a wrong-answer explanation;
- when `GEMINI_API_KEY` is set, confirm grounded RAG context is returned;
- inspect Container App logs for provider fallback warnings.

Useful log command:

```powershell
az containerapp logs show `
  --name <backend-app> `
  --resource-group <resource-group> `
  --follow
```

## 8. Failover Behaviour

| Failure | Result |
|---|---|
| Vertex blocked | Skipped when `VERTEX_AI_ENABLED=false` |
| Groq unavailable or rate-limited | Gemini text fallback is attempted when its key exists |
| Groq and Gemini unavailable | Service returns its existing deterministic fallback where supported |
| Fine-tuned endpoint offline | Quiz generation continues through the configured provider order |
| No embedding provider | Core API remains available, but RAG retrieval cannot embed new queries |
| Azure cold start | First request can be slower because minimum replicas is zero |

## 9. Cost and Rollback

- Azure deployment is manual-only so it does not duplicate every GCP deploy.
- Both Container Apps use `min-replicas=0` and `max-replicas=3`.
- ACR image storage, logs, outbound traffic, Supabase, Groq, and optional Gemini
  API calls can still incur cost.
- Set budget alerts in Azure Cost Management and Groq usage limits before a
  demonstration.
- Stop using Azure by disabling ingress or deleting the two Container Apps.
  Delete the resource group only when every resource inside it is disposable.
- To restore Vertex generation, set `VERTEX_AI_ENABLED=true`, provide
  `GOOGLE_CLOUD_PROJECT`, and put `vertex` first in `AI_PROVIDER_ORDER`.

## 10. Troubleshooting

### AI features appear disabled

Call `/health/providers`. `groq_configured` must be `true`. The backend now
enables AI features when Groq, Gemini, Vertex, or the fine-tuned endpoint is
configured; a GCP project is no longer required.

### Groq returns 401

Replace the `GROQ_API_KEY` Environment secret and rerun the workflow. Do not
print the key in Actions logs.

### Groq returns 429

Check account rate limits, reduce simultaneous requests, or configure
`GEMINI_API_KEY` as the next provider. The service automatically tries the next
provider after an exception.

### RAG answers have no retrieved context

Set `GEMINI_API_KEY` and confirm `/health/providers` reports
`embedding_provider: gemini`. The Groq text key alone does not provide the
existing Gemini-compatible embeddings.

### Azure cannot pull an ACR image

Confirm the Container App has a system-assigned identity, that identity has
`AcrPull` on the registry, and the GitHub OIDC principal can create that role
assignment.

### Browser reports a CORS error

Confirm `FRONTEND_ORIGIN` matches the exact Azure frontend URL. EduFX also
allows HTTPS `*.azurecontainerapps.io` origins for Azure fallback deployments.
