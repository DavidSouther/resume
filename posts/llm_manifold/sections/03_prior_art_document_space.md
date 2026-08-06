## 2. Prior Art

Three lines of work support different parts of the proposed lens: formal spaces of text, representation geometry, and computation or search over generated sequences.
Their results constrain the analogy rather than proving it.

### Texts, probabilities, and trajectories

DisCoCat composes grammatical structure with distributional word meanings through functorial maps [@coecke2010].
Bradley, Terilla, and Vlassopoulos construct a `[0,1]`-enriched category whose objects are linguistic expressions and whose graded arrows describe relations among texts [@bradley2021].
Their later work uses a language model's next-token probabilities to enrich a category of prefixes and continuations [@bradley2025].
These accounts provide formal structures over texts, but they do not analyze multi-step agent workflows.

Zekri and coauthors model autoregressive generation as a Markov chain over text states [@zekri2024].
That supplies a direct basis for calling the sequence of generated prefixes a trajectory.
It does not establish a smooth dynamical system or basins of attraction.

### Representation geometry

Information geometry gives “manifold” a precise meaning for parametric statistical models equipped with the Fisher information metric [@amari1998].
This paper does not claim such a metric for documents.
Evidence about transformer representations is narrower.
Valeriani and coauthors find low intrinsic dimension in particular regimes of contextual hidden states [@valeriani2023].
Tulchinskii and coauthors use intrinsic dimension in contextual token representations to distinguish human from generated text [@tulchinskii2023].
Robinson, Dey, and Chiang find that static token embeddings do not satisfy the manifold hypothesis [@robinson2025].
The relevant object, if manifold-like language is useful at all, is therefore a task-specific contextual representation rather than the token-embedding table.

Brown and coauthors find that image data are better described by disconnected pieces of varying intrinsic dimension than by one smooth global manifold [@brown2023].
Their evidence concerns images, not text.
It is useful here only as a conceptual bounding that trajectories over certain regions are likely to generate "similar" documents.

### Serial computation and program space

Transformer expressivity provides a computational account of trajectory length.
Chain-of-thought tokens allow additional serial computation on problems that fixed-depth computation cannot solve directly [@li2024].
Expressivity increases with the number of intermediate steps [@merrill2023].
This supports treating intermediate tokens as computational steps, not as evidence of geometric curvature.

Program synthesis already treats code generation as search through a discrete space of programs constrained by examples, grammars, or specifications [@gulwani2017].
Milner's full-abstraction result equates denotational equality with contextual equivalence for the typed calculus and semantic model he studies [@milner1977].
It motivates a many-to-one relation between source forms and behavior, but does not establish that relation for arbitrary modern programs.
Schulte and coauthors find that many mutations preserve behavior under the available tests [@schulte2014].
This is evidence of test-suite-relative neutral neighborhoods, not proof of semantic equivalence or a continuous program metric.

## 3. The Document-Prefix Model

Let a document be a finite token sequence.
A prompt, answer, program, retrieved passage, tool result, or transcript is a document in this broad sense.
For a fixed language model, a prefix `d_t` determines a next-token distribution `P(x | d_t)` and contextual hidden states.
Sampling or selecting `x_t` forms `d_{t+1} = d_t x_t`; the finite sequence `d_0, d_1, ..., d_T` is the generation trajectory.

This trajectory is discrete.
“Document space” names the prefixes and task-specific representations or relations used to compare them.
Two documents might be near because one is a probable continuation of the other or because their contextual summaries are close under a chosen embedding distance.
They might instead be near because their source texts differ by a small edit or their observable behavior is equivalent.
These notions are not interchangeable, and the model assumes no global distance shared by all of them.

A task defines an acceptable set of documents.
For code, it may be the programs that satisfy a specification or pass a test suite.
For prose, it may be the documents that are faithful to sources and satisfy the requested form.
Tests, compilers, retrieval results, application state, and human review are imperfect observations of membership in that set.

An agentic harness changes the trajectory by adding context, spending more generation steps, branching, selecting, or incorporating an observation.
Calling these changes steering operators is an analogy at the workflow level.
It does not imply that all documents occupy one manifold, that local regions are basins of attraction, or that a named geometric metric exists.
