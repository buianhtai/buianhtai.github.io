# 06 — Decision Layer: Deterministic Rules, Jev-Like Models, and LLM Fallback

**Status:** Proposed — no decision-model integration is implemented by these docs.
**Extension contract:** Rules, DMN, Jev-like models and structured-output classifiers implement a replaceable `DecisionProviderAdapter`; provider installation/validation and tenant-scoped bindings follow [08 — Plug-and-play Adapter Architecture](./08-plugin-and-adapter-architecture.md).
**Related:** [Invocation routing](./01-invocation-and-routing.md) · [Tool execution](./04-tool-registry-and-external-execution.md) · [Agent-to-agent](./05-agent-to-agent-orchestration.md)

## 1. Why a separate Decision Service?

Many workflows need a decision, **not** an agent that generates prose or repeatedly invokes tools:

- Route a support request to `documentation`, `technical`, or `human`.
- Classify whether an issue merits deeper investigation.
- Score urgency on a defined scale.
- Choose between a simple workflow and a bounded reasoning agent.
- Decide whether *additional human review* may be needed (but never waive required approval).
- Decide whether to invoke a costlier model based on ambiguity.

These can be structured outputs interpreted by ordinary application code. **Jev** is a recently announced TypeSafe AI decision model oriented around typed choices, scores, and probabilities; [TypeSafe's September 15, 2026 announcement](https://typesafe.ai/blog/introducing-system-one-models-and-jev) describes it as early-access System One technology. Vendor performance/efficiency claims should be **independently benchmarked** against our actual workloads; a well-typed result can still choose the *wrong* category.

Also consider **DMN decision tables / FEEL** for deterministic business rules. A deterministic policy engine is not the same as a probabilistic decision model.

## 2. Decision layers in priority order

~~~mermaid
flowchart TD
    IN["Trusted event + minimized input"] --> RULES["Deterministic rules / policy / DMN"]
    RULES --> DIRECT{"Known branch?"}
    DIRECT -->|Yes| ACTION["Run approved workflow / agent"]
    DIRECT -->|No| TYPE["Decision provider: Jev-like / classifier"]
    TYPE --> OUT["Typed choice/score + confidence/probabilities"]
    OUT --> GUARD["Schema + calibrated threshold + policy"]
    GUARD --> PASS{"Accepted, in scope?"}
    PASS -->|Yes| ACTION
    PASS -->|No| FALL["Clarify / human / bounded LLM fallback"]
    FALL --> VERIFY["Validate fallback decision and permissions"]
    VERIFY --> ACTION
~~~

**Hard policy is outside the model.** A decision model is allowed to *suggest* a route or risk signal; it cannot authorize tool access, grant roles, approve financial transactions, bypass safety gates, or override a deterministic deny.

### Recommended policy chain

`RuleEngine -> DecisionProvider (optional) -> Validator -> ThresholdPolicy -> AgentRouter/Workflow -> ToolGateway`

The `DecisionProvider` is a replaceable adapter (Jev, a small structured-output LLM, a local classifier). The rules engine can use normal code, a rules service, or a DMN engine. It is useful even if the decision model provider is unavailable.

## 3. Configuration and registration

Define **DecisionDefinition**, **DecisionVersion**, and **DecisionBinding** independently from `AgentDefinition`:

~~~yaml
apiVersion: agent-platform/v1alpha1
kind: DecisionDefinition
metadata:
  id: classify-support-request
  version: 1
spec:
  inputSchemaRef: generic-support-request@1
  providerProfileRef: decision-economical@1
  question:
    type: choice
    id: request_type
    instructions: Select the best supported category
    options:
      documentation: How-to or documentation questions
      technical: Error diagnosis / technical troubleshooting
      unclear: Unclassifiable or insufficient information
  thresholdPolicy:
    acceptMinProbability: 0.85  # EXAMPLE ONLY, not calibrated
    minMargin: 0.15             # EXAMPLE ONLY
    onLowConfidence: human_review
    onProviderError: deterministic_fallback
  output:
    type: decision
    includeModelVersion: true
  limits:
    timeoutMs: 1000
    maxCostUsd: 0.005
~~~

This is **our platform contract**, not Jev's native request shape. Thresholds above are placeholders until evaluated on labeled data. Real provider response distributions and interpretation differ; each adapter must map explicitly into the platform's shared shape.

Normalized result:

~~~json
{
  "decisionId": "dec-demo-001",
  "decisionVersion": 1,
  "provider": "jev",
  "providerModelVersion": "record-exact-pinned-version",
  "outcome": {
    "type": "choice",
    "value": "technical",
    "probabilities": {
      "documentation": 0.03,
      "technical": 0.91,
      "unclear": 0.06
    }
  },
  "acceptedByPolicy": true,
  "policyVersion": "triage-threshold@1",
  "nextAction": "route_to_eligible_troubleshooting_agent"
}
~~~

This response is fictional; scores are explanatory only and not test results.

### Provider interface

~~~python
class DecisionProvider(Protocol):
    async def evaluate(
        self,
        definition: "PublishedDecisionVersion",
        minimal_state: dict,
        context: "DecisionContext",
    ) -> "TypedDecision": ...
~~~

Implementations may include:

- `RulesDecisionProvider` — deterministic exact mappings or DMN, **no model cost**.
- `JevDecisionProvider` — typed choice/score/probability API where available and reviewed.
- `StructuredLLMDecisionProvider` — constrained JSON/enum outputs from a small LLM. Its "confidence" is not inherently calibrated.
- `HumanDecisionProvider` — explicit review/escalation for cases that cannot be safely automated.

**Do not confuse DecisionProvider with ModelProfile for conversational agent generation.** The former outputs a bounded, machine-actionable decision; the latter can generate text and invoke tools. A single account/gateway may support both provider types but the contracts remain different.

## 4. Where decisions appear in the execution graph

| Stage | Example use | Source of final authority |
| --- | --- | --- |
| Trigger prefilter | Route known webhook event types | Verified integration config + rules |
| Agent selection | Decide among eligible documentation, troubleshooting and report agents | Authorized candidate set + routing policy |
| Workflow branching | Decide when to request more information | Reviewed workflow + threshold policy |
| Model choice | Select low-cost vs higher-capability approved model profile | Capability registry + model-routing limits |
| Quality control | Judge if retrieved evidence seems sufficient | Code requirements, calibrated assessment, human escalation |
| Write safety | Detect uncertain/high-risk write request | **Tool policy + mandatory approval always wins** |
| Agent delegation | Choose among *bound* subagents only | Delegation bindings, ACL, budget and depth limits |

### Important: do not route without authorization

~~~mermaid
sequenceDiagram
    participant U as UI / Connector
    participant P as Platform API
    participant REG as Agent Registry/Policy
    participant D as Decision Service
    participant W as Run Worker

    U->>P: New, unbound request
    P->>REG: Authorized candidate list
    REG-->>P: IDs + safe routing metadata only
    P->>D: Choose from exactly these options
    D-->>P: Typed decision + probabilities
    P->>P: Validate schema, threshold, permissions
    alt decision accepted
      P->>W: Queue pinned selected agent version
    else low confidence or error
      P-->>U: Clarify / human / deterministic fallback
    end
~~~

The decision model should not see unauthorized agent identities or private tool descriptions. Its output **must match one of the supplied eligible options**, and the platform rechecks eligibility after it returns.

## 5. Jev-like integration: important caveats

According to [TypeSafe's announcement](https://typesafe.ai/blog/introducing-system-one-models-and-jev), Jev targets fast, typed probabilistic judgments instead of free-form strings. Evaluate it for **routing, classification, scoring, and bounded decision questions**, not tool execution or long-form reasoning.

Before adoption:

1. Verify current official API/schema, provider availability, licensing and data-residency requirements with primary documentation.
2. Test outputs for `choice` / `score` / yes-or-no probability (the exact question type label is provider-specific).
3. Pin an explicitly supported model revision and log provider/model version with every decision.
4. Build a dataset of manually labeled cases; compare false positives/negatives, confusion matrix, calibration and selective accuracy (accuracy at each acceptance threshold).
5. Compare measured end-to-end latency, per-decision price, retry/failure behavior, throughput and operational availability against a small structured-output LLM and plain rules.
6. Reject out-of-schema results, over-budget calls or outputs outside authorized options. Fail closed or ask a human.
7. Limit payload to minimum necessary data; do not send secrets, unredacted personal data or restricted tool outputs to a third-party model.

**Do not adopt a vendor's "no hallucinations" marketing claim as a reliability guarantee.** Preventing invalid output types is distinct from ensuring a prediction is factually correct or safe for automation.

## 6. Deterministic DMN/rules vs probabilistic decisions

A [DMN](https://www.omg.org/spec/DMN/) rules engine encodes explicitly defined business decision tables and can be executed predictably. Jev-like models address **ambiguous semantic input**, not known validation rules.

| Question | Code / DMN / FEEL | Decision model | LLM agent |
| --- | --- | --- | --- |
| Is a CSV row missing a required field? | Best | Not needed | Not needed |
| Is a support email about technical trouble? | Exact rules for known templates | Good fit | Usually unnecessary |
| Which deployed agent is likely relevant? | Mapping for explicit intents | Good fit among prefiltered choices | Rarely needed |
| May a user modify a protected record? | **Must enforce** | Never authoritative | Never authoritative |
| How do multiple APIs relate to an error? | Workflow for known paths | Triage first | Bounded tool-using agent |
| Write a nuanced technical analysis? | Not sufficient | Not sufficient | Suitable with evidence/review |

DMN/FEEL can be a great **optional adapter** for configurable decision tables. No need to make every if/else a DMN service in MVP.

## 7. Budget and latency model

A request can traverse zero or more AI components. Charge each to the same run budget:

~~~text
total_run_cost =
  routing_decision_cost
  + model_generation_cost
  + delegated_agent_cost
  + tool_job_cost
  + storage/third_party_fees

p95_run_latency ≠ simply the sum of average model latencies;
queues, remote tasks and parallel fanout matter.
~~~

Typical strategies:
- Explicit selected agent: no router decision model.
- Fixed webhook/schedule: no router decision model.
- Auto-route: one cheap, bounded decision call only after rules fail.
- Known workflow: zero or one decision call; zero generative calls unless a draft/explanation is needed.
- Complex research: bounded LLM plus tools/subagents, explicit maximum cost.

Decision outputs and cost accounting must be recorded with `decisionId`, `runId`, model/profile version, policy version, latency, and usage. Falling back to a more expensive model requires available budget and permitted residency.

## 8. Acceptance tests

- Explicitly selected agent and fixed trigger skip all AI-based routing.
- A Jev-like provider returns a valid typed choice but it references a forbidden agent => **deny**.
- Provider returns `unknown`, low margin, timeout or malformed output => clarify/escalate, no privileged fallback.
- Two similar input texts receive differing decisions => evaluation flags instability and a human review route.
- A revoked agent fails the final eligibility check even if decision model ranked it highest.
- A decision model suggests approval for a write requiring human approval => mandatory approval remains.
- DMN/code rules and model classification disagree => predefined deterministic policy wins for safety constraints.
- Measured cost/latency/quality is compared on a fixed labeled dataset before production enablement.

## References

- [TypeSafe AI — Introducing System One Models & Jev, September 15, 2026](https://typesafe.ai/blog/introducing-system-one-models-and-jev)
- [TypeSafe AI — primary documentation](https://docs.typesafe.ai/)
- [Object Management Group — Decision Model and Notation](https://www.omg.org/spec/DMN/)
- [Camunda 8 — BPMN, DMN and FEEL](https://docs.camunda.io/docs/components/concepts/bpmn-dmn-feel/)
- [Drools — DMN decision modeling](https://docs.drools.org/latest/drools-docs/drools/DMN/index.html)

**Status note:** These docs propose a replaceable decision capability. They do not imply Jev, DMN, or any provider is currently available in this platform.
