<!--
==================================================================
BRD TEMPLATE
AI: Read this whole header before writing anything.

PLATFORM MODEL — use these terms exactly; never invent others:
  • Platform  — the vendor-side whole (run by Allocate Space staff).
  • Workspace — a customer's container. Holds the customer's Solutions,
                its End Users, and its Workspace Admin Users
                (workspace roles: Owner, Collaborator).
  • Solution  — a configured application inside a Workspace (e.g. GT Safe).
                Defines its own roles and members; contains workflows.
  • End User  — a person who uses a Solution; an identity authenticated
                via phone number + WhatsApp OTP.

TERMINOLOGY GUARDRAILS:
  • Do NOT use "project" or "team" as platform tiers. The platform tier
    that groups workflows is the SOLUTION. The word "project" may ONLY
    appear meaning a real-world construction project / job site, and if
    so, say "project (construction site)" the first time.
  • Platform name is "Allo8". The vendor/company is "Allocate Space".
    Do not write "AlloB8", "Allocate Checks", or mix these. If a source
    uses a different product name, keep the source's word only inside a
    verbatim quote and flag it under Assumptions & Open Items.

GOLDEN RULES (the most common mistakes — avoid all of them):
  1. SOURCE-ONLY. Every requirement, metric, channel, persona, and number
     must come from a source CRD/SOW. If it does not, either omit it or
     put it under "Assumptions & Open Items" marked [UNSOURCED] — never
     state it as fact. (Past errors: invented "99%", "50%", "within a day",
     an email channel, a "collection changes" trigger.)
  2. LEAD WITH THE UNIQUE CAPABILITY. The first acceptance criterion must
     be the thing ONLY this BRD delivers. Platform machinery this BRD
     merely uses (forms, roles, routing, notifications, PDF generation)
     is reworded as "configured via / delivered by [other BRD]", not
     claimed as new here.
  3. STATE BOUNDARIES. Fill in Scope and Dependencies & Boundaries. If two
     BRDs could both seem to own something, say which one does.
  4. PHASE HONESTLY. Mark anything not in current scope as future-phase /
     out of scope rather than implying it is delivered.
  5. MAP PERSONAS to defined roles (Workspace Admin / a named Solution
     role). Do not invent actor names; if the source uses an informal
     term, map it (e.g. "site supervisor (Job Supervisor role)").
==================================================================
-->

# [Business Requirement Name]

<!-- AI: Plain-English name of the business capability, e.g. "Permit Applications", "User Management". No IDs, no client names. -->

**Business Requirements**

**BRD ID:** <!-- AI: This BRD's own identifier (e.g. B-03). Distinct from the CR ID and the source-requirement ID. If the scheme is unsettled, write "[TBC]" — do NOT reuse a CR ID here. -->

**First Created:** <!-- AI: Today's date, YYYY-MM-DD. -->

**Originating CR(s):** <!-- AI: The client request(s) this derives from, as "CR-ID – Client Name". Mark the primary one if there is more than one, e.g. "C-SP – SunPro (primary); C-GTCTC – Gim Tian". -->

**Source Requirement(s):** <!-- AI: The specific requirement(s) inside the CRD(s) this implements, e.g. "C-GTS BR-04; C-GTS BR-05 (notification portion)". This is how the BRD traces back to the request. -->

**Written By:** <!-- AI: Leave blank unless a source explicitly names the author. Do not invent a name. -->

---

## Executive Summary

<!-- AI: One direct sentence per field, in italics. Platform-level perspective, not a single client's words. -->

**Key Solution Objective:** 
*[What this BRD delivers at the platform level — lead with the capability unique to it.]*

**Business Objective:** 
*[The broader outcome this enables for Allo8 customers.]*

**Market Considerations:** 
*[Market/competitive/regulatory context — only if grounded in a source; otherwise omit.]*

**Key Acceptance Criteria:** 
*[The single top-level condition for this BRD to be considered complete.]*

### Business Goals — 
*Our Allo8 Platform's business goals*

<!-- AI: Bullets, one distinct platform-level goal each. Short. No filler. -->

-

### Success Criteria

<!-- AI: Bullets, one measurable condition each. Metrics must be sourced. If a target is not in the source, write the criterion without the number and append "[target to be confirmed]". Do not invent figures. -->

-

---

## Solution Background

### Problem Statement

<!-- AI: 2–4 sentences, business/platform perspective. The core problem this solves. -->

### Why Now

<!-- AI: 1–3 bullets. One reason per bullet for why this is a priority now. -->

-

---

## User Story and Acceptance Criteria

### Key User Stories

<!-- AI: Bullets. "As a [defined persona/role], I need to [action] so that [outcome]." Personas must map to the platform model (Workspace Admin, a named Solution role, End User). Tag each with this BRD's ID in parentheses for traceability, e.g. (B-03) — NOT the CR ID. -->

-

### Key Acceptance Criteria

<!-- AI: Bullets, each specific and testable. FIRST bullet = the capability unique to this BRD. Reword shared platform behaviour as "configured via / delivered by [other BRD]". Mark phase-dependent items, e.g. "(depends on [BRD])". Tag with this BRD's ID. -->

-

---

## OOPSI

<!-- AI: Each subsection is a bullet list. One thing per bullet. No compound sentences. -->

### Outcomes

-

### Outputs

-

### Processes

-

### Scenarios

<!-- AI: Concrete, source-grounded examples. Prefer named roles/solutions from the source over generic actors. -->

-

### Inputs

-

---

## Assumptions & Open Items

<!-- AI: List anything NOT directly stated in a source CRD/SOW that you nonetheless wrote or inferred, plus genuine open questions. Mark inferences [UNSOURCED] and unconfirmed targets [TO CONFIRM]. Examples to watch for: invented metrics; an assumed delivery channel; an inferred persona; a future-phase feature; a product-naming conflict; an overloaded term ("project"). This section is mandatory — if empty, state "None — all content traces to source." -->

-

---

## Existing Reference Material

<!-- AI: Bullets. Format: "[CR ID] – [Client Name] ([source requirement, e.g. BR-04]) — [what it contributed]." List every source CRD/SOW used. -->

-