# CI Deployment Architecture

This note explains why the GitHub Actions production deploy
(`.github/workflows/azure-deploy.yml`) cannot run end-to-end today, what
we're doing in the meantime, and the right long-term direction.

## The problem with the current pattern

The workflow uses `appleboy/ssh-action` from a GitHub-hosted runner to SSH
into the production VM (`20.217.84.100`) and execute `swarm-deploy` there.
That pattern fails for two reinforcing reasons.

### 1. The Azure NSG (correctly) blocks public SSH

The VM's NSG has `DenyAllInbound` at priority 65500; tcp/22 is not allowed
from public internet. This is the right security posture for a medical
application. GitHub-hosted runners come from Azure's enormous public IP
pool; allowlisting them would mean opening tcp/22 to a large fraction of
the internet — a strict regression.

### 2. The pattern violates "build once, promote that artifact"

Even if SSH worked, the workflow does the build _on the production VM_
(`docker-compose up -d --build` or `swarm-deploy` invoking
`docker build`). This blurs the boundary between build and run:

- We cannot prove "what shipped to prod is what tests passed against,"
  because what tests pass against is whatever a different runner built,
  not what prod will build.
- Build-time errors surface during deploy windows instead of CI windows.
- Disk pressure on the VM is constant (image cache).
- Rollback means rebuilding a previous git SHA on the VM, not switching
  to a previously-built image.

This violates **97/61 (One Binary)** and **12-Factor V (build/release/run
separation)**.

## What we do today

Production deploys are **manual** via `swarm-deploy` from a developer
laptop, with a temporary NSG inbound rule for the developer's current IP.
Documented in:

- [`AZURE_DEPLOYMENT.md`](AZURE_DEPLOYMENT.md) — the canonical command and
  prerequisites
- [`../TROUBLESHOOTING.md#azure-vm-access-issues`](../TROUBLESHOOTING.md#azure-vm-access-issues)
  — when SSH times out or no key is authorized

The CI workflow file, secrets, and `production` GitHub Environment are all
configured (commits `e9e750a`, `df8939a`, `50b7ccf` on the
`ci/repair-deploy-pipeline` branch). They become useful once we move off
the SSH-from-CI pattern.

## The right architecture (Option C — to be implemented)

**Build images in CI, push to GHCR, have the VM pull.**

```
┌────────────────────┐                  ┌────────────────────┐
│  GitHub Actions    │                  │  ghcr.io/at2024    │
│  (push to main)    │ ─── push ─────▶  │  /ala-api:<sha>    │
│                    │                  │  /ala-frontend:<sha│
│  - docker build    │                  └────────────────────┘
│  - docker push     │                            │
│  - notify VM       │                            │ docker pull
└────────────────────┘                            ▼
                                          ┌────────────────┐
                                          │   Azure VM     │
                                          │   (NSG tight,  │
                                          │   no inbound   │
                                          │   SSH needed)  │
                                          │                │
                                          │   docker stack │
                                          │   deploy       │
                                          └────────────────┘
```

Properties:

- **Builds run in CI**, on stateless runners. Tests run against the same
  artifact that ships. (97/61, 12F/V satisfied.)
- **CI never SSHes into prod.** The NSG can stay tight; no GH IP allowlist
  needed.
- **VM only initiates outbound HTTPS to ghcr.io**, which the NSG already
  allows.
- **Rollback is a tag swap**, not a rebuild.

How the VM is told to deploy a new tag — pick one (decision deferred):

- Tiny systemd timer/cron on the VM that polls a GHCR tag every minute.
- Watchtower (`containrrr/watchtower`) auto-pulling tagged images.
- A webhook receiver on the VM (still inbound, but on HTTPS not SSH;
  signed with a secret).
- GitHub Actions `workflow_run` posting to an Azure Service Bus / Event
  Grid endpoint that the VM listens to.

### Estimated cost

~1 day of focused work. Adds:

- A workflow that builds and pushes to GHCR.
- A VM-side puller (a few-line script + systemd unit).
- Updated `docker-stack.yml` referencing GHCR image refs.
- Documentation for rotating the GHCR pull token.

### Interim alternative if we need automation sooner

A **self-hosted GitHub Actions runner** installed on the production VM.
The runner is registered to the repo and polls outbound for jobs. CI jobs
run inside the VM's network — no SSH required. Setup is ~30 min; ongoing
cost is keeping the runner updated and watching for runner-process
crashes.

This is a solid stop-gap but introduces a new long-running process on the
prod VM, which we'd rather avoid for a medical app. Prefer Option C for
the durable solution; reach for self-hosted runner only if Option C
slips and the team needs hands-off deploys before then.

## What this doc is _not_

It is not a step-by-step Option C implementation guide. That belongs in a
follow-up plan when we actually do the migration. This doc exists so the
next time anyone (engineer, reviewer, future-Claude) wonders "why don't
we just push a fix to `azure-deploy.yml` and call it done?", they have
the architectural answer in two minutes.

## References

- [`97/61` _One Binary_](https://github.com/97-things/97-things-every-programmer-should-know/tree/master/en) — Steve Freeman
- [`12-Factor V` _Build, release, run_](https://12factor.net/build-release-run)
- [`AZURE_DEPLOYMENT.md`](AZURE_DEPLOYMENT.md) — current manual path
- [`../TROUBLESHOOTING.md#azure-vm-access-issues`](../TROUBLESHOOTING.md#azure-vm-access-issues)
  — when SSH itself doesn't work
- The three commits on `ci/repair-deploy-pipeline`: `e9e750a`, `df8939a`,
  `50b7ccf`
