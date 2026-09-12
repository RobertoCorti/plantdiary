# PlantDiary Development Workflow

This guide describes how work moves from an idea to merged, verified code. It
applies to Roberto and any AI coding agent working on PlantDiary.

## Sources of truth

- [GitHub Issues](https://github.com/RobertoCorti/plantdiary/issues) describe
  individual, actionable pieces of work and their acceptance criteria.
- [PlantDiary - Prod Launch](https://github.com/users/RobertoCorti/projects/4)
  is the working queue and shows what is planned, active, and complete.
- GitHub milestones group issues by release: **Production beta** or
  **Public v1**.
- [`PRD.md`](PRD.md) defines the product direction and priorities.
- [`CONTEXT.md`](../CONTEXT.md) records the current implementation state,
  decisions, and pending work.
- [`AGENTS.md`](../AGENTS.md) defines mandatory repository instructions for
  coding agents.

When these sources disagree, stop and resolve the inconsistency before
implementation. Do not silently choose one interpretation.

## Issue structure

Each issue should explain one outcome and include:

- **Why:** the user, product, reliability, or security problem.
- **Scope:** what the issue includes.
- **Acceptance criteria:** observable conditions required for completion.
- **Triage:** Priority, Area, Effort, and Target.
- **Verification:** automated and manual checks when they are known in advance.
- **Out of scope:** boundaries that prevent the issue from growing, when useful.

The GitHub Project fields are the primary classification system. Repository
labels are optional and should not duplicate Project fields without a clear
reason.

### Project fields

- **Status:** `Todo`, `In Progress`, or `Done`.
- **Priority:** `P0` blocks a safe production beta; `P1` is important for a
  reliable release; `P2` is valuable but can follow the immediate blockers.
- **Area:** Mobile, Backend, Security, Release, Product/AI, or Docs. Select all
  areas that materially apply.
- **Effort:** `XS`, `S`, `M`, or `L`. This is a relative estimate, not a promise
  of elapsed time.
- **Target:** Production beta, Public v1, or Later.
- **Milestone:** the GitHub release milestone. It should agree with Target when
  Target names a release.

## One issue, one branch, one pull request

The default unit of delivery is:

> one issue -> one branch -> one pull request

If an issue is too large for a reviewable pull request, split it into smaller
issues before implementation. If investigation reveals unrelated work, create
or propose a follow-up issue instead of expanding the active branch.

## Delivery workflow

### 1. Pick an issue

Choose a `Todo` issue based on release target, priority, dependencies, and
readiness. Before starting, confirm that:

- the expected outcome is understandable;
- the acceptance criteria are testable;
- known dependencies are complete;
- the issue is small enough for one reviewable pull request;
- required credentials, services, or manual actions are available.

Assign the issue to Roberto and move it to `In Progress` only when work is
actually beginning.

### 2. Start from current `main`

The working tree should be understood before changing branches. Preserve any
unrelated user changes.

```bash
git switch main
git pull --ff-only origin main
git status
```

Create a branch that includes the issue number and a short description:

```bash
git switch -c issue/<number>-<short-name>
```

Example for issue #8:

```bash
git switch -c issue/8-upgrade-expo
```

### 3. Implement atomic changes

Read `CONTEXT.md`, the selected issue, and the relevant code and documentation
before editing. Break the issue into the smallest changes that can be explained,
reviewed, and verified independently.

Follow KISS: implement the simplest solution that satisfies the approved scope.
Do not move to a later step while the current step is broken.

Database changes require an incrementally numbered SQL migration in
`supabase/migrations/`. The agent must explicitly state when Roberto needs to
run a migration or complete another manual service action.

### 4. Verify the work

Verification must match the risk of the change. At minimum, TypeScript must
compile cleanly before the session ends:

```bash
npx tsc --noEmit
```

Run relevant unit, integration, Deno, Expo, and device checks as applicable.
Document anything that could not be tested and why. Never describe an untested
path as verified.

### 5. Update project memory

Update `CONTEXT.md` before ending the session. Record what changed, important
decisions, verification performed, manual steps, and remaining work. This edit
uses the same approval workflow as every other change.

### 6. Commit and push

Commits should be atomic and describe the outcome. Do not commit unrelated user
changes. A coding agent must wait for Roberto's separate approval of the proposed
commit message before committing.

Push the issue branch after the approved commit is ready:

```bash
git push -u origin issue/<number>-<short-name>
```

### 7. Open the pull request

The pull request should include:

- a short explanation of the outcome and why it matters;
- the important implementation decisions;
- automated and manual verification results;
- screenshots or recordings for meaningful UI changes;
- migration and deployment instructions;
- known limitations or follow-up work;
- `Closes #<number>` so merging closes the issue automatically.

Keep the pull request focused. CI must pass before merge.

### 8. Merge and close the loop

After review and successful verification:

1. Merge the pull request into `main`.
2. Confirm the linked issue closes.
3. Move the Project item to `Done` if automation did not do it.
4. Delete the merged branch.
5. Switch back to `main` and pull with `--ff-only`.
6. Confirm the working tree and Project reflect the completed work.

## Working with an AI coding agent

Roberto is learning while building PlantDiary. The agent must explain changes
clearly and use this approval sequence for every atomic code or documentation
change:

1. Read `CONTEXT.md`, the selected issue, and the relevant files.
2. Before editing, explain the proposed atomic change and why it is needed.
3. Allow discussion and wait for Roberto's explicit approval.
4. Implement only the approved change.
5. Run appropriate verification.
6. Present the result, diff, and verification evidence.
7. Wait for Roberto to approve the completed change.
8. Propose a commit message as a separate step.
9. Wait for Roberto to approve that exact commit message.
10. Commit only after that approval.
11. Repeat the sequence for the next atomic change.

Starting implementation, approving the completed result, and approving the
commit message are three distinct decisions. The agent must not combine them or
infer approval from silence.

If requirements are unclear, the agent should inspect safe, read-only context
first and then ask a focused question. If new information materially changes
the approved scope, stop and propose a revised change before continuing.

If blocked, the agent should report:

- what outcome is blocked;
- the concrete cause and evidence;
- what was already tried;
- the smallest decision or manual action needed from Roberto.

The agent must not silently move to another issue, execute manual production
steps on Roberto's behalf without authorization, or claim completion while
required work remains.

## Definition of done

An issue is `Done` only when:

- its acceptance criteria are satisfied;
- relevant automated checks pass;
- required manual or device checks are recorded;
- migrations and deployment steps are documented;
- `CONTEXT.md` reflects the result and remaining work;
- the pull request is merged into `main`;
- no required work is hidden in comments or an untracked local branch.

If any required condition remains, keep the issue open or create an explicitly
linked follow-up issue with a clear reason.
