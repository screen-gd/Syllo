# Pivot from learning workspace to product workspace

The repo shipped as Roadmap Studio for learners (local-first study workspaces with Roadmap Intake). We decided on a full rewrite to Closure: a unified product workspace with Roadmap Items (Under review → Planned → In progress → Shipped), open-voting Feedback Posts, and Changelog Entries derived from shipped items, local-first for v1.

Considered Options: keep both models side by side; incremental repurpose of learning modules into roadmap columns. Rejected because the learning vocabulary (Workspace as study collection, Learning Session, Learning Record) conflicts with the product vocabulary at every seam, and carrying both doubles the domain without a shared user.

Consequences: existing `app/(studio)`, notes, SRS, quiz, and gallery code is slated for removal in the rewrite tickets; marketing routes move to `/website/` so root `app/` holds only the product app.
