---
name: commit
description: Analyze repository changes and create convention-aligned Korean Git commits when the user asks to commit or save changes.
---

# Commit

Use this skill when the user asks to commit changes, save changes, or otherwise requests a Git commit.

## Workflow

1. Inspect the repository state with `git status --short` and analyze the changes with `git diff`. Include `git diff --cached` when staged changes exist. Do not discard, overwrite, or reset any changes.
2. Group the changes into logical, independently meaningful commit units. Explain the proposed files and Korean commit message for each unit. Do not include unrelated existing changes in a commit.
3. Write each message in Korean using this form:

   ```text
   <type>: <한국어 요약>
   ```

   Use `feat`, `fix`, `refactor`, or `chore` as appropriate. Keep the summary concise and describe the resulting change rather than the implementation process.
4. Treat a user request to commit or save changes as authorization to stage and commit the logical units identified above. Stage each unit with explicit file paths, create its commit, and report the commit hash and message.
5. If any Git command fails, stop and report the failure without retrying destructive actions.

## Boundaries

- Do not request a separate approval before committing when the user has asked to commit or save changes.
- Never amend, force-push, reset, or change Git configuration unless the user explicitly asks.
- If the working tree is clean, say that there is nothing to commit.
- If the repository has no usable Git metadata, explain that a commit cannot be created.
