## 9. Conclusion

The steering-operator lens earns its place only if it changes what a reader does with the next agent workflow they read, design, or debug.
This paper's one reusable artifact for that purpose is a five-question checklist, distilled from the operator table (Section 4), the seven worked analyses (Section 5), and the seven reversal conditions (Section 6):

1. **Impulse.**
   What move does this operator make on the document trajectory: fix a start point, manufacture stand-ins, re-derive from execution feedback, spend serial computation, branch, interact with tools, or search a tree?
2. **Target region.**
   What region of acceptable documents is this operation trying to reach?
3. **Signal.**
   What signal does this move use: prompt conditioning, generated stand-ins, returned tool output, extra tokens, branch comparison, tool observations, or a value estimate?
4. **Referent validation.**
   What external state checks whether the trajectory reached the acceptable region — a compiler, a test, a retrieved fact, a visible change — and is that validation absent, implicit, repeated, or merely proxied?
5. **Evidence.**
   What evidence — cited literature, a production trace, or a worked example — supports that this specific impulse, signal, and validation path works, which Section 6 condition marks where it should reverse, and what is that evidence's own boundary?
   A hand-picked trace is not a base rate; an established result about sampling is not automatically a claim about document-space regions.

A workflow that cannot answer these five questions is not wrong, but it is unexamined: the lens has not yet been applied to it.
Applying it is this paper's claim to usefulness, and Section 8's Lit Group transfer test is exactly this checklist, run on a workflow the reader has not seen before, scored against whether the reader's own answers anticipate the failure mode this paper's analysis would find.
