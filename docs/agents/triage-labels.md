# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

These labels do not yet exist in `emsqrd/f1fantasyapp`. The `triage` skill will create them on first use via `gh label create`, or you can pre-create them with:

```bash
gh label create needs-triage --color FBCA04
gh label create needs-info --color D4C5F9
gh label create ready-for-agent --color 0E8A16
gh label create ready-for-human --color 1D76DB
gh label create wontfix --color CCCCCC
```

Edit the right-hand column to match whatever vocabulary you actually use.
