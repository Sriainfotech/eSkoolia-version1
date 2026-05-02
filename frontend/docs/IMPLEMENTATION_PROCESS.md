# Implementation Process (Mandatory)

This document defines how every update is executed and tracked so nothing is missed.

## Required documents

- Planning and feature scope: MODULE_TASK_TRACKER.md
- Change-by-change execution log: IMPLEMENTATION_LOG.md

Both documents must be updated for every implementation step.

## Step-by-step process for each update

1. Select the next task from MODULE_TASK_TRACKER.md based on dependencies.
2. Mark selected task as in-progress (`[-]`) in MODULE_TASK_TRACKER.md.
3. Implement backend and frontend changes for that task.
4. Run local validation for changed scope (lint/test/type checks where available).
5. Mark task as done (`[x]`) or keep in-progress if partially complete.
6. Append one entry to IMPLEMENTATION_LOG.md with exact details.

## Required IMPLEMENTATION_LOG entry format

Every update must include these fields:

- Update ID
- Date
- Module
- Tasks completed
- Files changed
- Validation performed
- Risks or blockers
- Next immediate task

## Definition of done

A task is done only when all are true:

- Code implemented
- Basic validation done
- Tracker updated
- Implementation log entry added

## Module execution order

1. Platform foundation hardening
2. Role and Permission
3. Admissions and Enquiry
4. Student Information
5. Academics
6. Attendance
7. Examination and Result
8. Fees and Finance
9. Communication and Notification
10. Reports and Analytics
11. Remaining parity modules and integrations

## Ownership rule

No code update is considered complete unless both documents are updated in the same work cycle.
