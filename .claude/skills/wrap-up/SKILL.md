---
name: wrap-up
description: Finish a Dungeons of Demons session — verify, commit the work on a feature branch, push it, and tear down the dev server. Use when Jonny says he is done for now, or asks to "wrap up", "commit and push", "finish up", "pack up", "shut it down", or "commit, push, tear down the server". Also use when a play session ends and work is left uncommitted on disk with a dev server still running.
---

# Wrapping up a session

Jonny is the parent and an engineer, and he handles infrastructure. Talk to him
normally — this skill is never for his son. If the session was in kid mode, drop it
here: the report goes to Jonny.

The flow is **verify → branch → commit → push → tear down**, in that order. Verifying
last is no good once the work is already pushed, and tearing the server down first
means the browser check cannot be redone if verification fails.

## 1. Verify before committing anything

```bash
npm run typecheck && npm test && npm run build
```

All three must pass. **If any fail, stop and tell him — do not commit.** A red build
pushed to a branch is worse than an uncommitted working tree, because the working tree
is still in front of him and the branch is not.

If a feature was built this session and never driven in a real browser, say so plainly
in the report. Tests pass on code that crashes every frame; the kid-mode skill's
`references/browser-check.md` covers driving it, and it has caught a HUD field that
threw every frame, a tint cleared 60 times a second, and a bass loud enough to drown
the melody. None of those were visible to `npm test`.

## 2. Branch — never commit straight to main

```bash
git branch --show-current
```

If it is `main`, cut a feature branch first. The repo's convention is
`feature/<short-description>`, merged through a PR (see `git log` for the pattern).

```bash
git checkout -b feature/<short-description>
```

Name it for the features, not the date or the session.

## 3. Commit

```bash
git add -A && git status --short
```

Read that list before committing. Look for anything that should not be in the repo —
scratch drivers, screenshots, `.wav` renders, `dist/`. Session artefacts belong in the
scratchpad, not the project.

One commit for the session's work is right when the features were built in sequence and
their diffs interleave, which is usual here. Splitting them afterwards means staging by
hunk and is error-prone. Say which you did.

Write the message for the person reading `git log` in a year:

- Subject line: what shipped, in his son's language where it is the real name
  (`LESS`, `MORE!`, `TAKE THAT!`, the dark floors).
- A paragraph per feature: what it does, and **why it is built the way it is**. The
  non-obvious decisions are the point — why ids were not renamed alongside display
  names, why `damageMultiplier` has a floor, why the repaint box is per player.
- Any trap a future change would fall into. The `sheet`-not-`state` collision with
  Phaser's `GameObject` is the standing example.
- What was verified, and how. Name the bugs the browser check caught.

End every commit message with:

```
Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: <the current session URL>
```

## 4. Push

```bash
git push -u origin <branch>
```

Push the branch. **Do not open the PR unless he asks** — give him the URL that `git
push` prints and let him decide. Do not merge to `main` on your own.

## 5. Tear down the dev server

Stop the background task rather than killing processes by name, so the harness stops
tracking it:

- Find the task id from the earlier `npm run dev` tool result, and stop it with
  `TaskStop`.
- If the id is lost, `pgrep -af "node.*vite"` and kill that pid.

Then confirm it is actually gone — a "stopped" task that is still listening is the
failure worth catching, especially when it was bound to the LAN with `--host`:

```bash
ss -tln | grep 5173 && echo "STILL LISTENING" || echo "port 5173 closed"
pgrep -af "node.*vite" | grep -v pgrep || echo "no vite server processes"
```

Beware `pgrep -af vite` on its own: it matches the shell running the check, which reads
as a live server when nothing is running. Match on `node.*vite`.

## 6. Report

Short and factual, for Jonny:

- Branch name and commit sha, and the PR URL if he wants one.
- Test count, and that typecheck and build passed.
- Confirmation the port is closed.
- **Anything left open** — a question his son has not answered, a feature half
  designed, a decision taken under an assumption. This is the part that is easy to
  drop and the most expensive to lose between sessions.

## Things that bite

- **`git status` is a snapshot.** Re-run it before committing rather than trusting one
  from earlier in the session.
- **Untracked files do not show in `git diff`.** A new system file (`music.ts`) is
  invisible until `git add`. Check `git status --short` for `??`.
- **The server may be bound to the LAN.** If it was started with `--host` so his son
  could play on a tablet, tearing it down takes the game off the tablet too. Say so.
- **Do not `git add` the scratchpad.** Drivers, screenshots and rendered audio live in
  the session scratchpad and must never reach the repo.
