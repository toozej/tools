# Demo plans

These synthetic, credential-free Terraform plan JSON files exercise different
parts of the graph viewer. Load any file with **Load plan JSON** in the UI, or
start the CLI with `-plan examples/<file>.json`.

| File | Scenario | Highlights |
| --- | --- | --- |
| `aws-small-change.json` | Small AWS web stack | create, update, delete, and unchanged resources |
| `aws-eks-modules.json` | Larger AWS EKS-style stack | nested modules, `for_each` instances, replacement, sensitive and unknown values |
| `azure-app-service.json` | Azure application | resource dependencies, data-source read, and a deleted resource retained from prior state |
| `gcp-platform-drift.json` | GCP platform | resource drift, deferred changes, and an import |
| `aws-saas-platform-large.json` | Multi-tier AWS SaaS platform | 30 resources across four modules, with dense dependency chains and mixed actions |

They resemble the public `terraform show -json` format but do not represent
real infrastructure and contain no secrets. They are deliberately small enough
to make the graph behaviour easy to demonstrate.
