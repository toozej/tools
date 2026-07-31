# terraform-plan-graph

`terraform-plan-graph` is a local, interactive browser view for Terraform plans. It displays the complete resource graph — including unchanged state — and overlays the actions in the plan: creates, updates, replacements, deletions, reads, and drift.

The program uses HashiCorp's supported external interfaces:

- [`github.com/hashicorp/terraform-json`](https://github.com/hashicorp/terraform-json) for Terraform's documented `terraform show -json` plan representation.
- [`github.com/hashicorp/terraform-json/sanitize`](https://pkg.go.dev/github.com/hashicorp/terraform-json/sanitize) to remove values marked sensitive before they are sent to the browser.
- [`github.com/hashicorp/hcl/v2`](https://github.com/hashicorp/hcl) to parse optional local `.tf` files and link root-module resources to their source locations.

It does not import Terraform Core internals. A binary `.tfplan` is first converted using the installed Terraform CLI because the binary plan file is not a public Go API.

## What it provides

- An SVG dependency graph with pan and zoom.
- A module/resource tree with search and action filters.
- Details for every resource: action, provider, action reason, source location, dependencies, dependents, planned values, and changed attributes.
- One-hop and two-hop focus modes for tracing impact outward or inward from a resource.
- Existing unchanged resources from `planned_values`, and resources only present in `prior_state` when they are being removed.
- Sensitive values redacted before the frontend receives the graph data. The server binds to loopback by default.

## Tools deployment

The tools-repo service is available at `/tfgr/`. It starts without retaining a
plan: choose a `terraform show -json` output file in the UI to render it.
Uploaded JSON is processed for that request only, after Terraform-sensitive
values have been redacted. The hosted service accepts plans up to 64 MiB.

For local CLI use, `-plan` remains supported and can load either a JSON plan
or a binary plan (when the Terraform CLI is installed).

## Build

```sh
go build ./cmd/terraform-plan-graph
```

## Use

Create a saved plan and start the viewer:

```sh
terraform plan -out=tfplan
terraform-plan-graph -plan tfplan -config-dir .
```

Or pass pre-rendered JSON, which is useful in CI:

```sh
terraform show -json tfplan > tfplan.json
terraform-plan-graph -plan tfplan.json -open=false
```

By default the program listens at `http://127.0.0.1:8765` and attempts to open that URL. Useful flags:

```text
-plan PATH            Saved binary plan or terraform show -json output (required)
-config-dir DIR       Optional root module directory for .tf source locations
-terraform PATH       Terraform executable for binary plans (default "terraform")
-listen ADDRESS       Local address to serve (default "127.0.0.1:8765")
-open=false           Do not launch the browser
```

Plans may contain sensitive infrastructure information. Do not expose this server on an untrusted network or commit plan files. Values marked sensitive by Terraform are redacted, but the remaining metadata is still valuable operational information.

## Browser controls

- Click a resource in the graph or tree to inspect it.
- Use **1 hop** and **2 hops** to traverse its dependencies and dependents; choose **whole graph** to return to the complete plan.
- Search resource addresses or types, then filter by action using the checkboxes.
- Drag the graph background to pan; use the mouse wheel or trackpad to zoom.
- With the graph focused, use **Left** and **Right** to follow dependencies and
  dependents; use **Up** and **Down** to cycle through the visible resources.

## Test

```sh
go test ./...
```
