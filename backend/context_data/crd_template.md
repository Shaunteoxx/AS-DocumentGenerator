# Client Request Docs (CRD)

---

## Document Control

| Field | Value |
|---|---|
| **Docs ID** | <!-- AI: Use the exact same value as the generated filename for this document. Do not generate a new ID. --> |
| **Client Name** | <!-- AI: Extract the client company name from the source documents --> |
| **Prepared By** | <!-- AI: Leave blank — for the team to fill in --> |
| **Date Prepared** | <!-- AI: Use today's date in YYYY-MM-DD format --> |
| **Status** | <!-- AI: Always set to "Draft" --> |
| **Linked BRD** | <!-- AI: Leave blank — for the team to fill in once the BRD is created --> |

---

## 1. Client Information

<!--
AI Instructions:
- Extract all client details from the source documents.
- If a field cannot be found, leave it blank and flag it in Open Issues & Questions.
- POC and Request Raised By can be the same person — note this if applicable.
- For Source, list every type of document provided e.g. "Meeting Notes, Proposal Document". Do not select just one.
- For Account Type, infer from company size, headcount, or revenue signals if not explicitly stated. Flag as inferred in Open Issues.
- For ARR, extract only if explicitly stated. Do not estimate.
-->

| Field | Value |
|---|---|
| **Client Name** | |
| **Point of Contact (POC)** | _(name and role)_ |
| **Account Type** | Enterprise / SMB / Other |
| **Annual Recurring Revenue (ARR)** | |
| **Request Raised By** | _(name and role — can be same as POC)_ |
| **Date of Request** | YYYY-MM-DD |
| **Source** | _(list all that apply e.g. Meeting Notes, Proposal Document, Email)_ |

---

## 2. Request Summary

### 2.1 Underlying Problems

<!--
AI Instructions:
- List each distinct problem the client is experiencing as a separate numbered point.
- Focus on the ROOT problem — what is actually going wrong — not what the client is asking for.
- Each problem point should describe one specific issue, not a combination of issues.
- Write in plain, simple language that anyone can understand.
- These problem points provide the context for the normalized requirements in §3, which are based on the desired outcomes in §2.2.

Example:
1. SunPro has no way to monitor energy generation and consumption across multiple sites in real time.
2. SunPro cannot automate billing for clients under Power Purchase Agreements (PPAs).
-->

1.
2.
3.

### 2.2 Desired Outcome

<!--
AI Instructions:
- Write a short plain-language summary of what the client wants to achieve overall.
- This is the high-level "end state" the client is working toward.
- 2–4 sentences maximum.
- Do not repeat the individual problem points from §2.1.
- The normalized requirements in §3 will be derived from this section — make sure it captures all the key things the client is asking for.
- After writing the desired outcome, cross-check every problem point listed in §2.1. Make sure each problem point is reflected in the desired outcome. If any problem point is not addressed, add it to the desired outcome before finishing this section.
-->

### 2.3 Trigger Event

<!--
AI Instructions:
- Describe the specific event or change that prompted this request now.
- This could be a regulatory deadline, a new business opportunity, a contract commitment, a competitive pressure, or an internal decision.
- If multiple trigger events are mentioned, list each one separately.
- If no trigger event is explicitly stated, infer from context and flag as inferred in Open Issues.
-->

### 2.4 Request Constraints

<!--
AI Instructions:
- List any limitations or conditions that apply to this client's request as a whole.
- These are client-level constraints e.g. budget cap, existing system integrations, regulatory requirements, preferred vendors.
- Do not list constraints that are specific to individual requirements — those go in the Normalized Requirements table in §3.
- If no constraints are mentioned, leave blank and flag in Open Issues.

Example:
- Must integrate with existing Huawei and SunGrow inverters
- Solution must be deployable on-site within 12 months
- Payment processing must support PayNow
-->

-
-

---

## 3. Business Requirements

<!--
AI Instructions:
- Create one row for each distinct business requirement the client is asking for, based on §2.2 Desired Outcome.
- Each row is a requirement-level need — not a granular feature or sub-requirement. Group related actions into one row.
- BRD ID: use the format BR-01, BR-02, BR-03 and so on, incrementing for each requirement.
- Business Name: write a short plain English name for the requirement — no acronyms, no jargon. e.g. "Permit application management", "Attendance taking", "Solar Energy monitoring and reporting". Spell out any technical terms in full.
- Description: write 2-4 sentences describing what the requirement should do from the client's perspective. Cover what the user needs to do, how it should work at a high level, and what the expected outcome is. Do not describe technical implementation. Write as if explaining to someone with no product knowledge.
- Constraints: list any constraints specific to this requirement only — not client-level constraints. These may come from §2.4 or the source documents. Leave blank if none apply.
- After completing the table, cross-check every problem point in §2.1 to make sure each one is addressed by at least one row. Add missing rows if needed.
-->

| BRD ID | Business Name | Description | Constraints |
|---|---|---|---|
| BR-01 | _(Short plain English name)_ | _(What the requirement should do and what outcome it delivers for the client)_ | |
| BR-02 | | | |
| BR-03 | | | |

---

## 4. Impact & Priority Signals

<!--
AI Instructions:
- Extract all priority and impact information from the source documents.
- For Criticality, assess based on the urgency and tone of the client's language:
  - High: the client is actively escalating, or the issue significantly impacts their core business operations
  - Medium: the client has a workaround but is asking for improvement
  - Low: the client mentioned it casually with no urgency
- For Timeline, extract any specific dates or deadlines mentioned. If a range is given, use the earliest deadline.
- For Estimated Deal Value, extract only the contracted deal value — not internal project costs. If only a project cost is available, note this explicitly and flag in Open Issues.
- For Likelihood, assess based on signals in the documents e.g. signed LOI, confirmed interest, active negotiation.
- Leave blank and flag in Open Issues if not found.
-->

| Field | Value |
|---|---|
| **Criticality** | High / Medium / Low |
| **Client's Required Timeline or Deadline** | YYYY-MM-DD / Not stated |
| **Estimated Deal Value** | _(contracted deal value, not project cost)_ |
| **Likelihood of Closing / Retaining** | High / Medium / Low |

**Criticality Scale:**
- **High** — significantly impacts the client's workflow or business. They are actively escalating
- **Medium** — causes inconvenience but the client has a workaround. They are asking for it but not urgently
- **Low** — nice to have. The client mentioned it but it is not affecting their day-to-day

---

## 5. Supporting Evidence

<!--
AI Instructions:
- Extract direct quotes that support or explain the problems and requirements identified above.
- Preserve the exact original wording of every quote — do not paraphrase.
- For each quote, identify the source document and include a timestamp, slide number, or page reference where available.
- List every source document used to fill in this docs in the Linked Source Documents table.
-->

**Direct Quotes**

| Source | Reference *(timestamp / slide / page)* | Quote |
|---|---|---|
| | | |
| | | |

**Linked Source Documents**

| Document Name | Type | Link / Location |
|---|---|---|
| | Meeting Notes / Email / Transcript / Proposal / Presentation / Other | |
| | | |

---

## 6. Internal Notes

<!--
AI Instructions:
- Leave this entire section blank.
- This section is for the team to fill in manually after reviewing the AI-generated content.
-->

**Additional Context**

_(Any additional context not captured in the source documents)_

**Linked BRD**

_(URL — added once the BRD is created)_

---

## Open Issues & Questions

<!--
AI Instructions:
- List every field or section that could not be filled in from the source documents.
- List every inference you made e.g. "Account Type inferred as SMB based on company headcount — team to verify".
- List any contradictions or unclear information found across the source documents.
- Keep the language neutral and factual — do not speculate or suggest answers.
- Number each issue sequentially starting from 1.
-->

| # | Issue / Question | Raised By | Status |
|---|---|---|---|
| 1 | | AI-generated | Open |
| 2 | | AI-generated | Open |

---

*This docs was auto-generated from unstructured source documents. All content should be reviewed and validated by the team before use.*