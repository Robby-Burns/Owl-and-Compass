# Atlas Guides — Deployer Examples

**Companion to:** `deployer-directive.md`. Load once for orientation. Not required reading on every boot.

---

## Why the Destroy/Replace Gate Exists

A code bug is recoverable — revert the commit. A `terraform destroy` on the wrong resource, or a replace that drops a database, often is not. The same self-review weakness that justifies Fixer/Debugger applies here, with higher stakes: the person who wrote the plan is bad at spotting what it actually does to production. So the rule is mechanical, not a judgment call — if `terraform plan` shows `destroy` or `forces replacement` on ANY resource, you stop and the Auditor reads the plan before you run `apply`. Routine adds and in-place updates do not require this — gating every deploy would make the framework theater. Gating destructive ones is the actual best practice that real infra teams already follow.

This is also why the gate is mechanical rather than judgment-based: "does this destroy seem fine" is exactly the kind of question a single mind under deadline pressure answers wrong. `terraform plan`'s own output — the literal word `destroy` or the literal phrase `forces replacement` — is unambiguous and doesn't depend on anyone's read of the situation. Mechanical triggers don't get rationalized away the way judgment calls do.

---

## Worked Example: A Plan Report That Should Trigger the Gate

**Scenario:** Deployer is asked to change an RDS instance's storage type from `gp2` to `gp3` for cost savings. Seems like a routine update.

**Phase 2, Step 2 — Plan output (abbreviated):**
```
# aws_db_instance.main must be replaced
-/+ resource "aws_db_instance" "main" {
      ~ storage_type = "gp2" -> "gp3" # forces replacement
      ...
    }

Plan: 1 to add, 0 to change, 1 to destroy.
```

**Phase 2, Step 3 — Classification:** This plan contains `forces replacement`. Per the Autonomy Policy table, this is a mandatory stop regardless of how routine the change felt going in. Storage type changes on RDS don't always force replacement — depends on the engine and existing configuration — but this one does, and Terraform says so explicitly. Don't second-guess the plan output; read it.

**Plan Report produced for the Auditor:**
```
=== PLAN REPORT ===
Target: AWS, us-west-2, account 482910xxxxxx
Triggered by: forces replacement

CHANGE SUMMARY
  Intent: Change RDS storage type from gp2 to gp3 for cost savings, no data or schema change intended.
  Resources affected: aws_db_instance.main — replace

DESTROY/REPLACE DETAIL
  Resource: aws_db_instance.main
  Action: replace
  Why Terraform says this is needed: storage_type change from gp2 to gp3 is not
    modifiable in-place for this engine version per the provider's current behavior —
    forces a full resource replacement rather than an in-place storage type change.
  Data/state at risk: Primary application database — all production data.
  Have you confirmed a backup/snapshot exists? No — deploy-spec.md has no backup policy
    entry for aws_db_instance.main. This is a gap. Do not proceed without human sign-off.

FULL PLAN OUTPUT
  [verbatim plan output pasted here]

ROLLBACK PLAN
  deploy-spec.md's Rollback Procedure does not cover database replacement scenarios —
  only application-tier rollback via previous image tag. This specific change is not
  covered by the documented procedure.
=== END PLAN REPORT ===
```

**Why this is the right outcome:** What looked like a cheap, routine cost optimization ("change a storage type") turned out to force a full database replacement with no backup policy on file and no documented rollback path for this specific case. A Deployer running solo, confident this was routine, might have applied it without a second look — and Terraform's `forces replacement` is easy to skim past if you're reading for the resource count summary instead of the actual plan body. This is exactly the scenario the gate exists for: a change that's innocuous in intent but destructive in mechanism, caught before `apply` rather than after.
