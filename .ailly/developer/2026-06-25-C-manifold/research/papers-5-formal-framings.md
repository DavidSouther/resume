# Papers (Claim Areas 5+6): Existing formal, geometric, information-theoretic, and category-theoretic framings of LLMs and language

Scope: prior art that the planned paper's "Fuzzy Homomorphic Endofunctors" vocabulary (manifold-of-documents, LLM-as-endofunctor/homomorphism, generation-as-wander, "phase space," "isomorphic contours") would land on top of. The goal is to neither reinvent nor overclaim. Verification flags: **[VERIFIED]** = primary source (arXiv abstract / publisher page) fetched or directly returned by a scholarly index; **[INDEXED]** = returned by a reputable search index (arXiv listing, MIT Press, Wikipedia/nLab) but not individually opened this session; **[AGGREGATOR]** = surfaced only via a non-authoritative aggregator and not corroborated.

## Findings

### A. Category theory applied to NLP / linguistics (DisCoCat and successors)

The single most load-bearing prior art. **DisCoCat** (categorical compositional distributional semantics) already formalizes language meaning using compact-closed / rigid monoidal categories, with grammatical derivations interpreted as **linear maps (functors)** acting on tensor-product word vectors [1]. This is precisely the "homomorphism / functor between spaces" register the seed blog reaches for, published since 2010 and mature. It originated as an application of categorical quantum mechanics; the structural insight is that pregroup grammars and quantum processes are both rigid categories [1], [2]. Concrete models with empirical NLP evaluations followed [3], so the framework is not merely a metaphor — it has been instantiated and measured.

The closest existing work to "LLM probabilities as a categorical/semantic structure" is **Bradley, Terilla, Vlassopoulos, "An Enriched Category Theory of Language: from syntax to semantics"** [4], which models text as a category **enriched over the unit interval [0,1]**, objects = expressions, hom-objects = conditional probabilities that one expression extends another, and recovers semantics via the **Yoneda embedding** into unit-interval-valued copresheaves. A 2025 follow-up defines a category of texts enriched by actual next-token LM probabilities and studies its **magnitude** [5]. This is the most direct overlap with a "fuzzy" (interval-valued = fuzzy/quantale-enriched) categorical treatment of a language model — the word "fuzzy" in the seed title is essentially [0,1]-enrichment, which [4] already does.

**Sheaf-theoretic** semantics of natural language also exists: Abramsky and Sadrzadeh, "Semantic Unification: A Sheaf-Theoretic Approach to Natural Language" [6], formulates discourse meaning as sheaf **gluing** of local sentence semantics, with a distributions functor for ranked multivalued gluings. So "sheaf" is also already claimed for language.

### B. Category theory for ML generally (functorial / compositional learning)

Broad and active. Surveys: "Category Theory in Machine Learning" [7] and "Towards a Categorical Foundation of Deep Learning: A Survey" [8], plus a 2025 "Category-Theoretical and Topos-Theoretical Frameworks in Machine Learning: A Survey" [9]. The canonical result is the **categorical semantics of gradient-based learning** via lenses, parametrised maps, and reverse-derivative categories (Cruttwell, Gavranović, Ghani, Wilson, et al.), with a maintained bibliography of the subfield [10]. Takeaway: "ML as functors/composition" is a populated field, not open ground. Notably, networks/learners are usually modeled as **morphisms** in a parametrised category; an LLM-as-a-single-endofunctor framing would need to differentiate from this established morphism-level treatment.

### C. LLMs as maps between spaces / linear-representation geometry

The "LLM as a map between spaces" intuition is the mainstream mechanistic-interpretability framing, not a novel one. The **Linear Representation Hypothesis** (Park, Choe, Veitch) formalizes concepts as directions in embedding/unembedding space with a causal inner product [11]. Recent work models hidden states as lying on a **latent semantic manifold** — a low-dimensional submanifold of ambient embedding space [12] — and finds semantics in low-dimensional linear subspaces. So "manifold of representations" and "generation as movement through a representation space" are explicitly in the 2023-2026 literature.

### D. Information geometry / statistical manifold

Amari's **information geometry** (since ~1980) is the rigorous, decades-old theory of the **statistical manifold** of a parametric model: a Riemannian (Fisher) metric plus dual affine connections on the parameter space, with the natural-gradient method as its ML payoff [13], [14]. Any "phase space of a model" or "manifold of parameters" language must cite this or risk reinventing it. This is the strongest "you would be renaming Amari" risk.

### E. Loss-landscape / representation geometry (grounds "phase space," "isomorphic contours")

**Mode connectivity** (Garipov et al.; Draxler et al., both 2018) shows independently-trained minima are joined by near-constant-loss paths in weight space [15], directly relevant to "isomorphic contours" / level-set language about the loss surface. For the *data*/representation side, the **manifold hypothesis** [16] is the standard claim that data lies near a low-dim manifold, and its sharpest critique — the **Union of Manifolds Hypothesis** (Brown et al.) — shows real image data lies on a *disconnected* set of varying intrinsic dimension, i.e. *not* one smooth manifold [17]. This is the key caution against a single-smooth-"manifold-of-documents" framing.

### F. Formal-language theory of transformers (theoretical-CS capability framing)

Mature and precise. The survey "What Formal Languages Can Transformers Express?" (Strobl, Merrill, Weiss, Chiang, Angluin, TACL 2024) [18] consolidates results placing transformer expressivity inside circuit/logic classes; Merrill and Sabharwal show fixed-depth transformer reasoning sits in **TC⁰ / FO(M)** (first-order logic with majority) [18], and that chain-of-thought extends this [19]. If the paper makes capability claims, this is the rigorous frame and must be cited rather than restated geometrically.

### G. Critiques / cautions about over-applying math metaphors

Direct, citable skepticism is thinner but real. The n-Category Café records the working characterization that "category theory is a solution in search of problems" for ML [20]. The Union-of-Manifolds result [17] is itself the strongest empirical rebuttal of naive manifold talk. Methodologically, a recent position paper argues ML venues should add a "Refutations and Critiques" track [21], indicating the field acknowledges an overclaiming problem. No single authoritative "category-theory-for-ML is hype" paper surfaced — the critique lives in blog/discussion form [20], so the paper should phrase its own humility carefully rather than lean on a definitive takedown citation.

## Novelty assessment

Blunt verdict: **most of the seed's vocabulary is already formalized, often under the exact terms.**

- "LLM/language as functor/homomorphism between spaces" → DisCoCat does grammar-as-functor to linear maps [1]-[3]; categorical ML does learners-as-morphisms [7]-[10]. **Not novel.**
- "Fuzzy" categorical model of a language model → [0,1]-enriched category of text is exactly Bradley-Terilla-Vlassopoulos [4], [5]; "fuzzy" = unit-interval enrichment. **Strongly anticipated; high collision risk.**
- "Manifold of documents / representations" + "generation as wander" → latent-semantic-manifold and linear-representation-geometry work [11], [12]. **Not novel; actively crowded.**
- "Phase space / statistical manifold of the model" → Amari information geometry [13], [14]. **Not novel; renaming risk.**
- "Isomorphic contours / phase-space topology of the loss surface" → mode connectivity and loss-landscape geometry [15]. **Not novel.**
- "Sheaf"/gluing of meaning → Abramsky-Sadrzadeh [6]. **Not novel.**

What could be a *genuine* contribution is narrow and must be framed against the above: (1) treating the LLM specifically as an **endofunctor on a single category of documents/texts** (self-map, generation = iterated application toward a fixed point/attractor) is a sharper, less-explored claim than the morphism-level categorical-ML treatments — but it must engage [4]/[5], which already enrich the category of texts and would be the natural home for an endofunctor on it. (2) An explicit, *empirically instantiated* link between the loss-landscape "phase space" [15] and the document-manifold semantics [12] — most cited work treats parameter-space and representation/data-space geometry separately. (3) Honest incorporation of the Union-of-Manifolds critique [17] (documents do *not* form one smooth manifold) would itself differentiate the paper from naive manifold talk. Absent one of these, the paper risks restating Amari + DisCoCat + Bradley in new metaphor — the exact embarrassment to avoid.

## Sources

[1] B. Coecke, M. Sadrzadeh, and S. Clark, "Mathematical Foundations for a Compositional Distributional Model of Meaning," *Linguistic Analysis* (Lambek Festschrift), 2010, arXiv:1003.4394. [Online]. Available: https://arxiv.org/abs/1003.4394 — Founding DisCoCat paper; grammar derivations as linear maps over tensored word vectors. **[VERIFIED]**

[2] nLab / Wikipedia, "Categorical compositional distributional semantics (DisCoCat)." [Online]. Available: https://ncatlab.org/nlab/show/categorical+compositional+distributional+semantics and https://en.wikipedia.org/wiki/DisCoCat — Reference exposition: pregroup grammars and quantum processes as rigid categories. **[INDEXED]**

[3] E. Grefenstette and M. Sadrzadeh et al., "Concrete Models and Empirical Evaluations for the Categorical Compositional Distributional Model of Meaning," *Computational Linguistics*, vol. 41, no. 1, pp. 71-118, 2015, MIT Press. [Online]. Available: https://direct.mit.edu/coli/article/41/1/71/1501 — Instantiated, measured DisCoCat models. **[INDEXED]**

[4] T.-D. Bradley, J. Terilla, and Y. Vlassopoulos, "An Enriched Category Theory of Language: from Syntax to Semantics," *La Matematica*, 2022, arXiv:2106.07890. [Online]. Available: https://arxiv.org/abs/2106.07890 — [0,1]-enriched category of texts; Yoneda to semantic copresheaves. Closest "fuzzy categorical language model." **[VERIFIED]**

[5] (Bradley/Terilla/Vlassopoulos lineage), "The Magnitude of Categories of Texts Enriched by Language Models," 2025, arXiv:2501.06662. [Online]. Available: https://arxiv.org/abs/2501.06662 — Uses actual next-token LM probabilities to enrich a category of texts; computes magnitude. **[VERIFIED]**

[6] S. Abramsky and M. Sadrzadeh, "Semantic Unification: A Sheaf-Theoretic Approach to Natural Language," 2014, arXiv:1403.3351 (also Springer LNCS). [Online]. Available: https://arxiv.org/abs/1403.3351 — Discourse meaning as sheaf gluing; distributions functor for ranked gluings. **[VERIFIED]**

[7] D. Shiebler, B. Gavranović, and P. Wilson, "Category Theory in Machine Learning," 2021, arXiv:2106.07032. [Online]. Available: https://arxiv.org/abs/2106.07032 — Survey of categorical ML (gradient-based, probabilistic, invariance-based). **[INDEXED]**

[8] F. Gavranović et al., "Towards a Categorical Foundation of Deep Learning: A Survey," 2024, arXiv:2410.05353. [Online]. Available: https://arxiv.org/pdf/2410.05353 — Survey toward categorical foundations of deep learning. **[INDEXED]**

[9] Y. Jia, G. Peng, Z. Yang, and T. Chen, "Category-Theoretical and Topos-Theoretical Frameworks in Machine Learning: A Survey," *Axioms*, vol. 14, no. 3, art. 204, 2025; arXiv:2408.14014. [Online]. Available: https://www.mdpi.com/2075-1680/14/3/204 — Four-perspective survey incl. functorial manifold learning. **[INDEXED]**

[10] B. Gavranović, "Category Theory ∩ Machine Learning" bibliography. [Online]. Available: https://github.com/bgavran/Category_Theory_Machine_Learning — Maintained list incl. lens/parametrised-map/reverse-derivative semantics of gradient learning. **[INDEXED]**

[11] K. Park, Y. J. Choe, and V. Veitch, "The Linear Representation Hypothesis and the Geometry of Large Language Models," 2023, arXiv:2311.03658. [Online]. Available: https://arxiv.org/abs/2311.03658 — Concepts as directions; causal inner product unifying embedding/unembedding. **[INDEXED]**

[12] "Latent Semantic Manifolds in Large Language Models," 2026, arXiv:2603.22301. [Online]. Available: https://arxiv.org/pdf/2603.22301 — Hidden states as a low-dimensional latent semantic submanifold of embedding space. **[AGGREGATOR]** (recent preprint; abstract not individually verified this session)

[13] S. Amari and H. Nagaoka, *Methods of Information Geometry*; and S. Amari, "Information Geometry of Neural Networks — An Overview," in *Neural Networks and Statistical Learning*, Springer. [Online]. Available: https://link.springer.com/chapter/10.1007/978-1-4615-6099-9_2 — Fisher metric + dual connections on the statistical manifold of a parametric model. **[INDEXED]**

[14] S. Amari, "Natural Gradient Works Efficiently in Learning," *Neural Computation*, 1998 — natural-gradient method using parameter-space geometry. [Online]. Available: https://www.kyotoprize.org/en/laureates/shun-ichi_amari/ (laureate bio corroborating contribution). **[INDEXED]**

[15] T. Garipov, P. Izmailov, D. Podoprikhin, D. Vetrov, and A. G. Wilson, "Loss Surfaces, Mode Connectivity, and Fast Ensembling of DNNs," NeurIPS 2018, arXiv:1802.10026; and F. Draxler et al., "Essentially No Barriers in Neural Network Energy Landscape," ICML 2018. [Online]. Available: https://arxiv.org/pdf/1802.10026 — Independent minima joined by near-constant-loss paths. **[VERIFIED]** (arXiv listing)

[16] "Manifold hypothesis," Wikipedia (entry point to Fefferman/Mitter/Narayanan and Bengio et al. 2013). [Online]. Available: https://en.wikipedia.org/wiki/Manifold_hypothesis — Standard statement: data near a low-dim manifold. **[INDEXED]**

[17] B. C. A. Brown, A. L. Caterini, et al., "Verifying the Union of Manifolds Hypothesis for Image Data," ICLR 2023, arXiv:2207.02862. [Online]. Available: https://arxiv.org/pdf/2207.02862 — Real data lies on a disconnected union of manifolds of varying intrinsic dimension; rebuts single-smooth-manifold assumption. **[INDEXED]**

[18] L. Strobl, W. Merrill, G. Weiss, D. Chiang, and D. Angluin, "What Formal Languages Can Transformers Express? A Survey," *TACL*, 2024, arXiv:2311.00208. [Online]. Available: https://arxiv.org/abs/2311.00208 — Survey placing transformer expressivity in circuit/logic classes (TC⁰, FO(M)). **[VERIFIED]**

[19] W. Merrill and A. Sabharwal, "The Expressive Power of Transformers with Chain of Thought," ICLR 2024. [Online]. Available: https://openreview.net/pdf?id=CDmerQ37Zs — CoT extends transformer expressivity beyond TC⁰ at cost of parallelism. **[INDEXED]**

[20] "Category Theory in Machine Learning," The n-Category Café (discussion). [Online]. Available: https://golem.ph.utexas.edu/category/2007/09/category_theory_in_machine_lea.html — Source of the "solution in search of problems" caution. **[AGGREGATOR]** (discussion thread, not peer-reviewed)

[21] "Position: Machine Learning Conferences Should Establish a 'Refutations and Critiques' Track," 2025, arXiv:2506.19882. [Online]. Available: https://arxiv.org/pdf/2506.19882 — Field-level acknowledgement of an overclaiming/replication problem. **[INDEXED]**
