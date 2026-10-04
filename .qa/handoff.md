# ECC Runner Loop Handoff

- **Merged this session:** #375→#397 … #381→#403
- **Next:** #382 PR-08 · Dependencies primary topology (in progress)
- **paused:** false
- **runMode:** loop
- **Queue remaining:** #382–#396

## Abarbeitungsreihenfolge (verbindlich)

Epic #374 — immer **numerisch PR-01→PR-22**, sequential merge auf `main`.  
**GitHub labels:** jedes Child-Issue trägt `order-01` … `order-22`.

### V1 — blocking (Gate: #392)

| Status     | Issue | PR                                        | Depends on       |
| ---------- | ----- | ----------------------------------------- | ---------------- |
| ✓          | #375  | PR-01 harness                             | —                |
| ✓          | #376  | PR-02 epistemic contracts                 | #375             |
| ✓          | #377  | PR-03 authoritative truth                 | #376             |
| ✓          | #378  | PR-04 capability coverage                 | #376             |
| ✓          | #379  | PR-05 SemanticSystemModel v2              | #378             |
| ✓          | #380  | PR-06 Atlas → v2                          | #379             |
| ✓          | #381  | PR-07 Architecture layers                 | #379             |
| → **NEXT** | #382  | PR-08 Dependencies topology               | #379             |
|            | #383  | PR-09 Execution trust layers              | #379             |
|            | #384  | PR-10 AppFlow frontier explore            | #378             |
|            | #385  | PR-11 AppFlow test sessions               | #384             |
|            | #386  | PR-12 Safe/Sandbox Explore                | #385             |
|            | #387  | PR-13 AppFlow coverage/termination        | #384, #385       |
|            | #388  | PR-14 Infra detection                     | #379             |
|            | #389  | PR-15 Infra honesty UI                    | #388, #378       |
|            | #390  | PR-16 Local/GitHub parity                 | #379, #387, #389 |
|            | #391  | PR-17 console-clean / incomplete surfaces | #380, #381, #382 |
|            | #392  | PR-18 final V1 certification gate         | #391             |

### V1.1 — erst nach V1 (#392)

| Status | Issue | PR                            | Depends on |
| ------ | ----- | ----------------------------- | ---------- |
|        | #393  | PR-19 LLM SemanticInterpreter | #392       |
|        | #394  | PR-20 Evolution complete      | #392       |
|        | #395  | PR-21 DataLineage model       | #392       |
|        | #396  | PR-22 DataLineage UI          | #395       |

## On main already

- Readiness harness + epistemic + authoritative truth + coverage
- SemanticSystemModel v2 + Atlas + Architecture cutover

## Resume

`@ecc-runner-loop continue`
