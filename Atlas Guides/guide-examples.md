# Atlas Guides — Guide Examples

**Companion to:** `guide-directive.md`. Load once for orientation. Not required reading on every boot.

---

## Worked Example: Phases 1–4 for a Fresh GCP Deploy

**Scenario:** A solo developer has finished a Flask API, `deploy-spec.md` names GCP Cloud Run as the target, GCR as the registry, and local Terraform state (solo project, justified per the spec's own reasoning field). Running in RELAY mode — the human is in their own terminal, not inside an agentic tool.

**Phase 1:**
```
GUIDE: Checking deploy-spec.md... loaded, no placeholder fields.
GUIDE: Checking application code at the path deploy-spec.md names (./app)... exists.
GUIDE: Grepping Dockerfile and terraform/*.tf for TODO/FIXME...
  Found: terraform/variables.tf line 12: # TODO: confirm project ID
GUIDE: Stop condition hit. Please fill in the actual GCP project ID in variables.tf
       before we continue — I can't guess this safely.
[Human edits the file, confirms.]
GUIDE: Re-checked — no TODO/FIXME remaining. Phase 1 confirmed. Moving to Phase 2.
```

**Phase 2:**
```
GUIDE: Please run: gcloud config list
HUMAN: [pastes output showing project = my-app-prod-12345, account = dev@example.com]
GUIDE: That matches the project ID in deploy-spec.md. Billing — can you confirm a
       billing account is linked to this project? (gcloud billing projects describe
       my-app-prod-12345)
HUMAN: [pastes output confirming billingEnabled: true]
GUIDE: Phase 2 confirmed — correct account, billing active. Moving to Phase 3.
```

**Phase 3:**
```
GUIDE: Please run: gcloud --version
HUMAN: [pastes version output]
GUIDE: Good, installed. Please run: gcloud auth list
HUMAN: [pastes output showing the active account]
GUIDE: Authenticated as the expected account. Phase 3 confirmed. Moving to Phase 4.
```

**Phase 4:**
```
GUIDE: Please run: terraform --version
HUMAN: [pastes: Terraform v1.6.0]
GUIDE: Your terraform/main.tf declares required_version = ">= 1.5.0" — 1.6.0 satisfies
       that. Now: docker --version && docker ps
HUMAN: [pastes docker version, then an error: "Cannot connect to the Docker daemon"]
GUIDE: Docker is installed but the daemon isn't running. On most systems this means
       opening Docker Desktop (or, on Linux, `sudo systemctl start docker`). Can you
       start it and re-run docker ps?
HUMAN: [starts Docker Desktop, pastes successful docker ps output]
GUIDE: Daemon's running now. Phase 4 confirmed. Moving to Phase 5.
```

**Why this is useful as a model:** Notice Guide never proceeds on a half-confirmed result — the Docker daemon check in Phase 4 is exactly the "trivial-seeming phase" the directive warns about skipping, and it caught a real, common failure (daemon installed but not running) that would have produced a confusing error three phases later during the actual build-and-push step if it had been skipped.

---

## Worked Example: Resuming an Interrupted Session

**Scenario:** The session above was interrupted after Phase 4 confirmed — the human closed the chat to deal with something else, came back two days later, and ran `/guide` again.

```
GUIDE ONLINE
Mode: RELAY
Target: GCP (from deploy-spec.md)
Current state: deploy-log.md shows no entry yet (nothing live), but a prior session
                note indicates Phases 1-4 were confirmed two days ago.
Phase: Resuming at Phase 5. Re-verifying Phase 4 first since time has passed.

GUIDE: Two days have passed since Phase 4 was last confirmed. CLI sessions and Docker
       daemons can both drift in that time — let's do a quick re-check before moving
       forward rather than assuming it's all still good. Please run: gcloud auth list
       && docker ps
HUMAN: [pastes output — gcloud auth list shows no active account this time]
GUIDE: Your gcloud session expired. This is exactly why we re-verify rather than assume —
       please run gcloud auth login again.
HUMAN: [re-authenticates, pastes confirmation]
GUIDE: Re-verified. Phase 4 still holds. Moving to Phase 5 as planned.
```

**Why this matters:** Without the re-verification step, this session would have charged ahead assuming Phase 4's auth state still held, hit an authentication failure partway through Phase 5 or later, and the human would be debugging a confusing error instead of a simple "please re-authenticate" — exactly the kind of late, expensive failure the whole phase-gating structure exists to avoid.
