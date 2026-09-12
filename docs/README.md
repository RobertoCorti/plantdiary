# PlantDiary Documentation

The active supporting documentation lives in this directory. Each document has
one primary responsibility:

- [`PRD.md`](PRD.md) defines the product vision, requirements, roadmap, and
  product decisions.
- [`DESIGN.md`](DESIGN.md) defines the visual system and screen-level design
  direction.
- [`FEEDBACK.md`](FEEDBACK.md) is the active tester-feedback log, including
  device evidence, fixes, and unresolved observations. Actionable work can link
  from this log to a GitHub issue without replacing the original feedback.
- [`WORKFLOW.md`](WORKFLOW.md) defines how issues move through branches, pull
  requests, verification, and collaboration with an AI coding agent.
- [`OPERATIONS.md`](OPERATIONS.md) contains manual production procedures for
  migrations, deployments, hosted services, verification, and rollback.

Repository-level documents remain at the project root:

- [`README.md`](../README.md) is the public project entry point and setup guide.
- [`AGENTS.md`](../AGENTS.md) is the canonical instruction file for AI coding
  agents.
- [`CLAUDE.md`](../CLAUDE.md) is a compatibility pointer to `AGENTS.md`.
- [`CONTEXT.md`](../CONTEXT.md) is the current implementation memory and session
  handoff.

GitHub Issues hold actionable units of work, and the
[PlantDiary - Prod Launch](https://github.com/users/RobertoCorti/projects/4)
project organizes their delivery. Documents should link to issues rather than
copying a second task backlog.
