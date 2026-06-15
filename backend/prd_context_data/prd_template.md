# [XX] - [Feature Name] PRD

<!--
AI Instructions:
- Replace the H1 title with the format: [Feature Abbreviation] - [Feature Name] PRD
  Example: "RB2 - Report Builder PRD", "WB2 - Workflow Builder PRD"
- Derive the abbreviation from the feature name (e.g. "Report Builder V2.0" → RB2, "Workflow Builder V2.0" → WB2)
- Never use "XX" literally in the final output.
-->

---

## Document Info

<!--
AI Instructions:
- Extract all four fields from the source documents.
- If a field is not present, leave it blank — do not write "TBD" or "N/A".
- Format: **Field Name:** value (inline, not as bullet points)
-->

**Feature Name:**

**Product Manager:**

**Product Owner:**

**Target Release:**

---

## Executive Summary

<!--
AI Instructions:
- Write 2–4 short paragraphs summarising what this feature is, who it is for, and what it does at a high level.
- Cover the main functional scope without going into individual requirements.
- Keep language plain and accessible — no jargon.
- After the summary paragraphs, add a Prototype subsection listing any prototype or design links found in the source documents.
- Format each link as a bold label on its own line, followed by the URL on the next line. Example:
  **Prototype**
  http://...
  **Figma Design (Lo Fi)**
  https://www.figma.com/...
- If no prototype or design links are present, omit the Prototype subsection entirely.
-->

---

## Problem Statement

<!--
AI Instructions:
- Use bold text for subsection labels (Problem, Current State, Pain Points) — do not use H3 headings.
- Current State label should reflect the version if known, e.g. "Current State (V1.0)".
-->

**Problem**

<!--
AI Instructions:
- Write 1–3 sentences clearly stating the core problem this feature is solving.
- Focus on the business or user problem, not the solution.
-->

**Current State**

<!--
AI Instructions:
- Describe the current state of the product or process being changed.
- What exists today? What are its limitations?
- 2–4 sentences.
-->

**Pain Points**

<!--
AI Instructions:
- List each distinct pain point as a separate bullet point.
- Focus on what users or stakeholders are currently unable to do or are struggling with.
- Each point should describe one specific issue, not a combination.
-->

-
-
-

---

## Proposed Solution

<!--
AI Instructions:
- Write 1–3 paragraphs summarising the overall solution scope for this PRD.
- State what this PRD covers and what it explicitly defers to other PRDs or future versions.
- Then list every Feature Requirement ID and title with a blank line between each entry (required for Markdown line breaks):
  Example:
  [RB2-FR1] Rich Text Editor Canvas

  [RB2-FR2] Variable Insertion Menu (@ Menu)
- After the FR list, include any prototype or design links again if present in the source documents.
- Add a note about any related PRDs or future versions if mentioned in the source documents.
- Never use "XX" literally — always replace with the derived feature abbreviation.
-->

---

## [XX-FR1] Feature Requirement Title

<!--
AI Instructions:
- Use H2 (##) for each Feature Requirement section — not H3.
- Replace [XX-FR1] with the actual ID and title, e.g. "## [RB2-FR1] Rich Text Editor Canvas"
- Repeat this section for each Feature Requirement. Number them sequentially.
- Use bold text for subsection labels (Purpose, Expected Behaviour, Lo Fi) — do not use headings.
- Within Expected Behaviour, use bold italic for sub-groupings (e.g. **_Triggering_**, **_Tabs_**).
- Lo Fi: write "_(To be provided by the team)_" unless design notes or Lo Fi descriptions are present in the source documents. If present, describe them in plain text.
-->

**Purpose**

<!--
AI Instructions:
- Write 1–2 sentences explaining what this requirement is for and why it is needed.
-->

**Expected Behaviour**

<!--
AI Instructions:
- Describe what the user should be able to do and how the system should respond.
- Use bullet points for lists of actions, states, or rules.
- Group related behaviours under bold italic sub-labels where the source document does so.
- Keep language user-facing — do not describe implementation details.
-->

**Lo Fi**

_(To be provided by the team)_

---

## [XX-FR2] Feature Requirement Title

**Purpose**

**Expected Behaviour**

**Lo Fi**

_(To be provided by the team)_

---

## [XX-FR3] Feature Requirement Title

**Purpose**

**Expected Behaviour**

**Lo Fi**

_(To be provided by the team)_

---

## Exclusions

<!--
AI Instructions:
- List anything explicitly called out as out of scope in the source documents.
- If no exclusions are mentioned, leave the section blank.
- Use bullet points.
-->

-
-
-
