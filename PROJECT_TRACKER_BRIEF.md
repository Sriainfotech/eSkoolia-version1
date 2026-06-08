# Startup Project Tracker Brief

## Context

This project started from a simple project management need for a startup: keeping track of projects, their developers, status, and daily progress without creating a heavy or complicated system.

The goal is to build a standalone, simple project tracker with an easy UI and a lightweight database.

## Project Manager Responsibilities

As a project manager in a startup, the main responsibility is to make sure the right work gets done by the right people at the right time, with as little confusion as possible.

Key responsibilities include:

- Clarifying goals and success criteria.
- Breaking projects into tasks, milestones, owners, and timelines.
- Coordinating between developers, designers, founders, clients, and other stakeholders.
- Prioritizing work based on business needs and available resources.
- Tracking project progress, blockers, risks, and deadlines.
- Communicating updates clearly.
- Removing blockers and helping the team move forward.
- Managing project scope.
- Improving team processes over time.
- Making sure useful work is shipped, not just planned.

## Team Tracking Approach

The tracking system should stay simple:

- One place for all project work.
- One clear owner for each task or update.
- One regular rhythm for daily or weekly progress updates.

Useful tracking fields:

- Project name
- Assigned developers
- Status
- Priority
- Due date
- Daily progress
- Blockers
- Next steps

Suggested workflow:

- Use a board or dashboard with project status.
- Hold short check-ins or collect written daily updates.
- Track blockers separately so they can be resolved quickly.
- Review progress weekly.
- Watch for overloaded developers, unclear ownership, delayed tasks, and repeated blockers.

## Product Idea

Build a lightweight web app called:

**Startup Project Tracker**

The app should help a startup project manager answer these questions quickly:

- Which projects are active?
- Who is working on what?
- What changed today?
- What is blocked?
- What is due soon?

## Core Features

The first version should include:

- Add, edit, and delete projects.
- Add and manage developers.
- Assign developers to projects.
- Update project status.
- Add daily progress updates.
- View project update history.
- See a dashboard summary.

## Project Statuses

Use a small fixed set of statuses:

- Not Started
- In Progress
- Blocked
- Review
- Done

## Main Screens

### Dashboard

Shows a quick overview:

- Total projects
- Active projects
- Blocked projects
- Completed projects
- Today’s updates
- Upcoming due dates

### Projects List

Each project should show:

- Project name
- Status
- Assigned developers
- Priority
- Due date
- Last update

### Project Detail

Each project detail page should show:

- Project description
- Assigned developers
- Current status
- Priority
- Due date
- Daily progress timeline
- Blockers
- Next steps

### Daily Update Form

Each update should capture:

- Project
- Developer
- Date
- What was done today
- What is planned next
- Any blockers
- Progress percentage

### Developers Page

Each developer should show:

- Name
- Role
- Email
- Assigned projects
- Current workload or status

## Suggested Database

Use SQLite for the first version because it is simple and does not require a separate database server.

### projects

```text
id
name
description
status
priority
start_date
due_date
created_at
updated_at
```

### developers

```text
id
name
role
email
created_at
updated_at
```

### project_developers

```text
id
project_id
developer_id
created_at
```

### daily_updates

```text
id
project_id
developer_id
update_date
progress_text
next_step
blocker
progress_percent
created_at
updated_at
```

## Suggested Tech Stack

Recommended simple stack:

- Next.js for frontend and backend.
- SQLite for local database.
- Prisma for database schema and queries.
- A clean dashboard UI with tables, forms, badges, and simple navigation.

Alternative simple stack:

- React frontend.
- Express backend.
- SQLite database.

## UI Direction

The interface should feel like a calm internal admin dashboard:

- Left sidebar navigation.
- Main dashboard area.
- Tables for projects and developers.
- Status badges with clear colors.
- Simple forms for creating projects, developers, and updates.
- Project detail page with a progress timeline.
- Clear primary action buttons, such as Add Project and Add Daily Update.

Avoid making the app too complex in the first version. The first goal is usefulness and clarity.

## MVP Scope

The MVP should not include:

- Complex authentication.
- Role-based permissions.
- Notifications.
- Chat.
- Advanced analytics.
- Client portals.
- Time tracking.
- Payroll or billing.

These can be added later only if needed.

## First Build Goal

Create a working standalone app where a project manager can:

1. Create projects.
2. Create developers.
3. Assign developers to projects.
4. Update project status.
5. Add daily progress updates.
6. View all current project activity from a dashboard.

