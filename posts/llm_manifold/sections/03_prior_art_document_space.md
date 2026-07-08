## 2. Prior Art and Novelty Boundaries

Before stating this paper's picture, name the risk directly: nearly every
piece of the manifold, categorical, and phase-space vocabulary used below is
already published, in several places, often under close to the exact word.
This section states what is already formalized, draws the boundary against
the closest prior art specifically, and names the one place this paper adds
anything at all.

### The closest prior art: Bradley, Terilla, and Vlassopoulos

Bradley, Terilla, and Vlassopoulos construct a `[0,1]`-enriched category of
texts [@bradley2021]: documents are objects, and a morphism between two
documents is valued in the unit interval rather than being a plain arrow —
text compatibility is a categorical structure, not merely a metric one. Their
2025 follow-up enriches the same category with a trained language model's own
next-token probabilities [@bradley2025], directly connecting an LM's output
distribution to that categorical structure. Concretely, this is a *formal
document-space category equipped with an LM-native probabilistic distance* —
the single closest published construction to this paper's "document space,"
and it already carries more mathematical weight, an actual enriched-category
structure rather than an analogy, than anything introduced here.

**Where this paper's reading stops overlapping.** Bradley et al.'s enriched
category is a static, structural object: it establishes that texts and
probabilities form a well-defined categorical space. It does not ask, and
does not answer, how a specific agentic workflow's sequence of operations —
a retry, a retrieved document, a subagent's branch — moves through that space
over the course of a task, or which of those operations are reliable levers
under which conditions. This paper's claim sits entirely at that second,
workflow-diagnostic level: it borrows the informal *picture* of a document
space, not their categorical apparatus, and asks what happens to a
trajectory through it under specific, named agentic operators. If Bradley et
al.'s enriched category is the space, this paper offers a lens for reading
motion inside it — nothing about the space itself is new here.

### The rest of the field this paper does not reinvent

DisCoCat already treats language compositionally as a functorial,
categorical structure connecting grammar to meaning [@coecke2010]; "language
as a functor" is decades-settled vocabulary, not new here. Information
geometry is the rigorous, decades-old theory of a statistical manifold — a
Riemannian (Fisher) metric on a family of probability distributions
[@amari1998]; any "phase space of a model" language risks silently
reinventing this, and this paper adds nothing to it and claims no metric on
anything it discusses. The Union of Manifolds Hypothesis shows that real
high-dimensional data — verified for images, and the caution this paper
carries forward for documents — sits on a *disconnected* set of
varying-dimension pieces, not one smooth surface [@brown2023]; this paper's
document-space picture is a union, never a single manifold, precisely
because of this result. Transformer formal-language theory gives the
rigorous capability frame for what a fixed-depth or chain-of-thought-
augmented transformer can compute [@strobl2024; @li2024; @merrill2023];
Section 5.3's serial-depth claim is drawn from here, not from a geometric
restatement. Program synthesis already defines "search over program space
toward a specification" as the field's own founding frame [@gulwani2017];
Section 3 imports this directly rather than treating it as new.

### What this paper adds

**Table 2. Already formalized vs. what this paper adds.**

| Territory | Already formalized by | What this paper adds |
| --- | --- | --- |
| A categorical, probabilistic space of texts | Bradley, Terilla, and Vlassopoulos [@bradley2021; @bradley2025] | Nothing to the space itself; reads agentic operators as moves within it |
| Language as a compositional functor | DisCoCat [@coecke2010] | Nothing; acknowledged, not used |
| A statistical manifold with a rigorous metric | Information geometry [@amari1998] | Nothing; this paper's geometry is never metric |
| Real data as a union of varying-dimension manifolds | Union of Manifolds Hypothesis [@brown2023] | Adopted as a caveat, not introduced as a novel claim |
| Transformer expressivity and serial-computation limits | Formal-language and CoT-expressivity results [@strobl2024; @li2024; @merrill2023] | Read as a steering operator's mechanism (Section 5.3), not new theory |
| Search over program space toward a specification | Program synthesis [@gulwani2017] | Section 3's document-space model borrows this frame directly |
| A workflow-level diagnostic reading of agentic operators as moves toward or away from a target region | No existing paper unifies these strands this way | **This paper's contribution** (Sections 4-6) |

This paper's only new claim is the bottom row of Table 2.

## 3. The Document-Space Model

This section introduces only the geometry Sections 4-6 actually need:
functions, programs, documents, and generation as a trajectory. The hard
caveats are stated here, up front, so nothing later can be read as claiming
more than this.

### Functions, programs, and documents

Treat the set of computable functions as the object of ultimate interest,
and a program as one syntactic realization of a function. Denotational
semantics assigns each program text a denotation — the function it computes
— and Milner's full-abstraction result is precisely the statement that two
programs denote the same function exactly when no context can distinguish
their behavior [@milner1977]: many programs implement one function, and the
map from programs to functions is many-to-one by construction, not by
analogy. This gives the paper's second load-bearing reframing: a bug is not
merely wrong code, it is the correct implementation of a neighboring,
unintended function. That is not a metaphor either — it is exactly what a
non-equivalent mutant is in mutation testing, and a neutral-landscape result
shows empirically that a large fraction of random program mutations are
functionally neutral, meaning neighboring programs genuinely cluster by the
function they compute [@schulte2014].

**Caveat to carry.** The step from "programs cluster by function under
mutation" to "there is a continuous metric on program space whose geometry
tracks function identity" is this paper's own analogy, not an established
result: mutation testing measures neighborhoods under discrete edits, not a
continuous space, and denotational semantics gives a topology on
*denotations*, not on program *syntax*.

### Documents and generation as trajectory

A large language model is trained to place high probability on token
continuations that keep a document within the shape of naturally occurring
text — the same low-effective-dimension structure long observed in learned
representations generally, and specifically confirmed for contextual
language-model hidden states, whose intrinsic dimensionality sits far below
the raw embedding width [@valeriani2023; @tulchinskii2023]. Generation, in
this picture, is a trajectory: starting from a prompt, each new token is a
step that a well-trained model keeps inside the neighborhood of documents
that look like the training distribution.

**Caveats to carry, verbatim, through the rest of the paper.**

1. *Contextual hidden states, not raw token embeddings.* The
   low-dimensional structure above is a property of contextual hidden
   states produced while processing a document, not of the static
   token-embedding matrix. Raw token embeddings have been shown to violate
   the manifold hypothesis outright under a direct statistical test
   [@robinson2025]; the document-space picture in this paper is only ever a
   claim about contextual states.
2. *A union of manifolds, not one smooth surface.* Real high-dimensional
   data — established for images, and the caution this paper extends to
   documents — sits on a disconnected collection of pieces of varying
   dimension, not a single smooth manifold [@brown2023]. Wherever this
   paper says "document space," read it as shorthand for a union of
   task-local, varying-dimension pieces, never a single global surface.
3. *"Basin of attraction" is this paper's analogy, not a theorem.* Later
   sections describe a workflow "moving toward a correct region" or
   "falling into an incorrect basin." No published result establishes a
   basin-of-attraction structure for a single autoregressive forward pass;
   the closest formal anchor is that autoregressive decoding is a Markov
   chain with a stationary distribution [@zekri2024], which says nothing
   about the shape of that distribution's support. The basin language is
   scaffolding for intuition, not a claim this paper can cite.

These three caveats are the load-bearing boundary of everything from Section
4 onward: every operator in Table 1 acts on a trajectory through
contextual-state space, understood as a union of task-local regions, moving
toward or away from a region this paper never claims is a literal geometric
basin.
