## 2. Prior Art

<!--The document-space model builds on categorical semantics of language, geometric accounts of statistical and representation spaces, and program-space accounts of generated code.
Mathematical literature supplies a vocabulary of manifolds, trajectories, probability distributions, and equivalence classes.
This section summarizes the results needed before the model is stated.-->

### Categorical and probabilistic models of language

The DisCoCat framework from [@coecke2010] structures grammar and distributional meaning via categorical connections.
Pregroup grammar reductions supply the syntactic structure of a sentence, word meanings live in vector spaces, and the sentence meaning is obtained by applying corresponding linear maps.
The key result is that compositional language semantics can be made functorial: grammatical composition is not merely a metaphor for vector composition, but a formal map from syntax to distributional semantics.

Bradley, Terilla, and Vlassopoulos give the closest categorical account of a space of texts [@bradley2021].
They construct a category enriched over `[0,1]`, with linguistic expressions as objects and unit-interval values encoding how one expression extends or relates to another.
Using enriched-category machinery, including teh Yoneda embedding, moves moves from syntactic relations among expressions toward semantic representations.
The key result is a formal text category whose arrows are graded rather than Boolean: compatibility among texts is represented as structure in the category.

Their later work connects that category directly to language-model probabilities [@bradley2025].
Instead of using a generic graded relation, the enrichment is supplied by the next-token probabilities of a trained language model, and the paper studies the magnitude of the resulting category of texts.
The key result is that a language model's own predictive distribution can be used to enrich a category of text prefixes and continuations.
This is a probabilistic, model-native document space.

### Manifolds, representation, and text

Amari's information geometry gives the rigorous version of a statistical manifold in machine learning [@amari1998].
A parametric statistical model is treated as a manifold equipped with the Fisher information metric, and the natural gradient follows the information geometry rather than following the Euclidean geometry of raw parameters.
The key result is not a claim about text, but a warning about vocabulary: "manifold" and "metric" have precise meanings in statistical learning, and a document-space model does not imply a specific Fisher metric or Riemannian structure.

Brown and coauthors test the union-of-manifolds hypothesis for image data [@brown2023].
Their result supports a more fragmented picture than the simple manifold hypothesis: real high-dimensional data are better modeled as a disconnected union of pieces with varying intrinsic dimension than as one smooth global manifold.
The key consequence here is cautionary.
If documents have manifold-like structure at all, the safer model is a union of local regions, not one continuous surface of all possible text.

Valeriani and coauthors study hidden representations in large transformer models [@valeriani2023].
They estimate intrinsic dimension across layers and find structured, low-effective-dimensional behavior in transformer hidden states, with semantic information concentrated in particular low-dimensional regimes.
Tulchinskii and coauthors apply intrinsic-dimension estimation to contextual language representations for human and AI-generated text [@tulchinskii2023].
They treat a text as a point cloud of contextual token representations and find that intrinsic dimension is informative enough to help distinguish human text from generated text.
Together, these papers support a limited claim: contextual representations of text can exhibit low-dimensional structure inside a much larger ambient vector space.

Robinson, Dey, and Chiang give an alternative to that claim [@robinson2025].
They test raw token embeddings against the manifold hypothesis and find that the static token-embedding matrix is not well modeled as a manifold or even as a fiber bundle.
Any document-space model grounded in manifold-like structure must refer to contextual hidden states or document-level representations, not to raw token embeddings.

Zekri and coauthors model large language models as Markov chains [@zekri2024].
Autoregressive decoding moves from one text state to the next by sampling a token from the model's conditional distribution.
The key result is that generation can be formalized as a stochastic process over text states, with a stationary-distribution analysis available at that level.
That result supports the use of "trajectory" for the sequence of generated prefixes, but it does not establish basins of attraction or a smooth dynamical system over documents.

### Transformer computation and program space

Strobl, Merrill, Weiss, Chiang, and Angluin survey the formal-language expressive power of transformers [@strobl2024].
Their survey places transformer architectures in precise computational classes and distinguishes what fixed-depth attention can and cannot express.
Li, Liu, Zhou, and Ma show that chain-of-thought tokens let transformers solve inherently serial problems that bounded-depth computation cannot solve directly [@li2024].
Merrill and Sabharwal characterize how intermediate chain-of-thought steps increase transformer expressivity as the number of generated steps grows [@merrill2023].
The shared key result is computational rather than geometric: extra generated tokens can add serial computation, but these papers do not describe that computation as movement on a manifold.

Gulwani, Polozov, and Singh define program synthesis as the task of finding a program in an underlying language that satisfies a user's intent or specification [@gulwani2017].
<!--For generated code, the key result is that "search over program space" is the standard frame of a mature field, not a new metaphor.-->
Program synthesis treats the space as a discrete search space of programs, usually organized by grammar, constraints, examples, and specifications.

Milner's full-abstraction result gives a semantic basis for many programs implementing one behavior [@milner1977].
In a fully abstract model, denotational equality coincides with observational equivalence: two programs have the same denotation when no other program can distinguish them by their outputs.
Program texts map many-to-one onto semantic behavior.
A function is represented by an equivalence class of programs, not by a single canonical source string.

Schulte, Fry, Fast, Weimer, and Forrest study software mutational robustness [@schulte2014].
They find that many random program mutations are neutral with respect to the tested behavior, producing a neutral landscape of nearby program variants.
Syntactically nearby programs often preserve behavior, while non-neutral mutations move to different behavior.
This supports treating buggy code as a nearby program that implements a different function or specification, while still stopping short of proving a continuous metric on program syntax.

<!-- ### Boundary carried into the model

The literature above already supplies formal text categories, statistical manifolds, contextual representation geometry, Markov-chain generation, program-space search, and semantic equivalence classes of programs.
The model in the next section uses those results as constraints.
It treats documents as discrete token sequences with contextual representations; it treats generation as a stochastic trajectory through prefixes; it treats code documents as program texts mapped many-to-one onto functions; and it treats "near," "region," and "manifold" as local modeling terms unless a concrete metric is named. -->

## 3. The Document-Space Model

Let a document be a finite token sequence over a model's tokenizer.
A prompt, an answer, a program, an error message, a retrieved passage, or a transcript are all documents in this sense.
For a fixed language model, each document prefix has two associated objects: the next-token distribution `P(token | prefix)` and the contextual hidden states produced while processing that prefix.
The document-space model concerns those prefixes, distributions, and contextual states.
It does not identify document space with the static token-embedding matrix.

### Documents, prefixes, and trajectories

Generation is a sequence of prefixes.
Starting from an initial document `d_0`, the model samples or selects a token `x_t` from `P(x | d_t)` and forms `d_{t+1} = d_t x_t`.
The finite sequence `d_0, d_1, d_2, ..., d_T` is the generation trajectory.
This is a discrete trajectory through token-prefix states, not a continuous path through a proven smooth manifold.
The Markov-chain account of autoregressive language models supplies the formal stochastic-process basis for this view [@zekri2024].

<!-- A Diagram of a trajectory in document space. The contuours of the space are representations of the probabilities of likely trajetories. From a prefix, a likely continuation is a "steepr" valley on the terrain; a region of several likely continuations is a flatter plain, and an impossible continuation would be another hill or peak; a prefix could be prompted to start there, or a redirection technique could move the trajectory to include that peak, but it won't continue that direction on its own. -->

A neighborhood in document space can be induced in several ways, with the choice leading to alternate interpretations depending on the task or purpose.
Two documents may be close because one is a high-probability continuation of the other under the model; because their contextual hidden-state summaries are near under a chosen embedding distance; because their program texts are close under edits or mutations; or because their denotations are observationally equivalent.
There is no single global distance that all of these notions share, but they are generally complementary descriptions of the notion of nearness.
Each notion allows for further modifications in a number of directions, depending on the goal of the user or developer of the agentic system.

### Programs as documents with denotations

Code is a special case of document generation.
A program document is both a token sequence and, when it is well formed, a syntactic realization of a denotation.
Write `[[p]] = f` for the function or behavior `f` denoted by program text `p`.
Many program texts can denote the same function, as full abstraction and observational equivalence make precise [@milner1977].
Program synthesis searches this space for a program satisfying a specification [@gulwani2017].
Mutation-testing and mutational-robustness results show that small syntactic changes often leave behavior unchanged, while other small changes produce a different behavior [@schulte2014].

This gives a direct model of a code-generation target.
For a specification `S`, the acceptable region is `R_S = { p | p satisfies S }` or, when the specification denotes a target behavior `f_S`, `R_S = { p | [[p]]=f_S }`

In practice, automated test suites, compilers, type checkers, linters, benchmarks, and human reviews approximate membership in `R_S`.
A bug is a program document outside that acceptable region.
More specifically, it is often a nearby program document that denotes a similar but subtly different behavior from the one intended.

### Contextual document regions

For non-code text, a target region is not usually a denotational equivalence class.
It is a set of documents satisfying task constraints: a faithful summary, a valid proof sketch, a correctly cited literature review, a user-acceptable email, or a transcript state that accurately reports what happened.
The region is defined by the task and its referents, not by fluency alone.

Contextual hidden states supply the representation-space side of this model.
The evidence from transformer representation geometry and intrinsic-dimension estimation supports local low-dimensional structure in contextual states [@valeriani2023; @tulchinskii2023].
That evidence does not imply that all documents lie on one smooth surface.
It also does not apply to raw token embeddings, which have been shown not to satisfy the manifold hypothesis [@robinson2025].

Accordingly, "document space" can mean a collection of task-local regions over document prefixes and their contextual representations.
Those regions may be disconnected, may have different intrinsic dimensions, and may overlap only under a particular representation or task.
The union-of-manifolds result for image data suggests some caution here: natural data should not be assumed to form one global manifold [@brown2023].

<!-- ### What the model claims

The model makes four limited claims.

1. A generated artifact can be represented as a trajectory of document prefixes.
2. A task defines an acceptable region of documents, sometimes by denotation
   and sometimes by external constraints.
3. Contextual representations of those documents can have local
   low-dimensional structure, but raw token embeddings are not the relevant
   object.
4. Any geometric word such as "near," "region," "manifold," or "basin" must be
   read relative to the concrete representation and distance being used.

The model does not claim a global metric on documents, a Riemannian manifold of texts, or a proven basin-of-attraction structure for autoregressive decoding.
It is a local model of generated documents, their contextual representations, and the task-defined regions those documents are meant to reach. -->
