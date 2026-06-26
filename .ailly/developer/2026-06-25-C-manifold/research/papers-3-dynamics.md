# Papers — CLAIM AREA 3: Text generation as a trajectory / dynamical system / stochastic process

Scope: prior art for modeling LLM generation as a *wander* / trajectory through document
(token or representation) space, sometimes landing in a "correct" region and sometimes a
"buggy" one. Each entry carries an IEEE citation, a one-line annotation, and a
**VERIFICATION FLAG**: *verified* (arXiv abstract page and/or published venue confirmed
directly this session) vs *aggregator-only* (seen only via search-engine snippet, metadata
not independently fetched).

A standing caution: several entries are rigorous *formalisms*; several others are *loose
metaphor* dressed in dynamical-systems vocabulary. The two are separated explicitly in each
subsection and in the closing synthesis. Do not let metaphor inherit the credibility of the
theorems.

---

## 1. Autoregressive decoding as a stochastic process / Markov chain; sampling geometry

The chain-rule factorization of an autoregressive model is, by construction, a stochastic
process; the substantive question is what *additional* structure (Markovianity over a
finite context, a stationary distribution, a temperature-controlled convergence rate) can be
proven. This is the most rigorously grounded strand of the claim area.

- **Zekri et al. (2024/25)** [1] give the cleanest formal statement: a transformer LM with
  vocabulary `T` and context window `K` is a Markov chain on a finite state space of size
  `O(T^K)`, where a state is a token history and the transition appends the next token. They
  derive existence of a stationary distribution, a convergence rate to it, and the effect of
  temperature on convergence. This is the strongest published grounding for "generation =
  walk on a state space with a transition kernel." VERIFIED.

- **Holtzman et al. (2019/ICLR 2020)** [2] — *The Curious Case of Neural Text
  Degeneration* — is the canonical empirical study of the *geometry* of the next-token
  distribution: maximization-based decoding (beam search) collapses into repetitive loops,
  motivating nucleus (top-p) sampling, which truncates the unreliable tail and samples the
  dynamic high-mass nucleus. Directly relevant to "which region of token space the walk is
  steered into." VERIFIED.

- **Meister et al. (2022/TACL 2023)** [3] — *Locally Typical Sampling* — frames decoding
  information-theoretically: sample tokens whose surprisal sits near the model's conditional
  entropy. This is a *geometry-of-the-step* result (which slice of the simplex each step is
  drawn from), and an alternative to top-p for avoiding degenerate regions. VERIFIED.

> Established vs metaphor: the Markov-chain reduction [1] and the sampling-geometry results
> [2], [3] are established. "Temperature warps the geometry" is a precise, provable statement
> here, not a metaphor.

## 2. Energy-based / score-based views; LLMs as energy landscapes; diffusion LMs as movement through continuous space

Here the "landscape" language is partly earned (EBMs literally define an energy surface) and
partly aspirational (the bijection results are recent and narrow).

- **Deng, Bakhtin, Ott, Szlam, Ranzato (2020/ICLR 2020)** [4] — *Residual Energy-Based
  Models for Text Generation* — sequence-level (globally normalized) energy on top of a
  pretrained locally-normalized LM, trained by noise-contrastive estimation. The foundational
  "text has an energy surface" paper; generation = sampling low-energy sequences. VERIFIED.

- **Blondel, Sander, Vivier-Ardisson, Liu, Roulet (2025/26)** [5] — *Autoregressive
  Language Models are Secretly Energy-Based Models* — proves an explicit bijection between
  ARMs and EBMs in function space, casting next-token prediction as a special case of the
  soft Bellman equation in max-entropy RL, and using it to explain lookahead/planning. This
  is the strongest recent bridge between the autoregressive walk and an energy landscape.
  VERIFIED (arXiv 2512.15605, v1 Dec 2025, latest v4 May 2026 — recent, single-source; treat
  as a fresh result, not settled consensus).

- **Li, Thickstun, Gulrajani, Liang, Hashimoto (2022/NeurIPS 2022)** [6] — *Diffusion-LM*
  — embeds discrete tokens into a continuous space and iteratively denoises Gaussian vectors
  into word vectors; generation is *literally* a trajectory through a continuous latent space,
  with gradient-based control steering toward target regions. This is the cleanest realization
  of "movement through continuous space → text." VERIFIED.

> Established vs metaphor: residual EBMs [4] and Diffusion-LM [6] are established
> constructions where "landscape" / "continuous trajectory" are not metaphors. The ARM↔EBM
> bijection [5] is rigorous but recent; the popular gloss "all LLMs are energy landscapes you
> descend" overreaches what [5] proves (a function-space correspondence, not a descent
> dynamics over the token walk).

## 3. Trajectories in hidden-state space across layers/tokens (logit lens / tuned lens / emergent world models)

This strand reads the *internal* trajectory rather than the token-output trajectory, and is
where "distance to a target region" has the most empirical (probing) traction.

- **Belrose et al. (2023)** [7] — *Eliciting Latent Predictions from Transformers with the
  Tuned Lens* — trains a per-layer affine probe (minimizing KL to the final distribution) to
  decode each layer's hidden state into vocabulary space, formalizing the *logit lens* folk
  technique. The prediction trajectory "converges smoothly to the final output distribution,"
  each layer lowering perplexity — i.e., the across-layer walk is a directed approach to a
  target distribution. VERIFIED. (The original *logit lens*, nostalgebraist 2020, is a blog
  post, not a paper — cited as community prior art only.)

- **Li, Hopkins, Bau, Viégas, Pfister, Wattenberg (2022/ICLR 2023, oral)** [8] — *Emergent
  World Representations* (Othello-GPT) — a sequence model trained only on legal-move
  prediction develops an internal, probeable representation of board state that is *causal*
  for its predictions. Evidence that the hidden-state trajectory tracks a structured world,
  not just surface tokens. VERIFIED.

- **Nanda et al. (2023)** [9] — follow-up showing the Othello-GPT world model is *linearly*
  represented ("my-color vs opponent-color"), strengthening the linear-representation
  hypothesis and the readability of the trajectory. Published as ACL BlackboxNLP 2023 /
  arXiv 2309.00941; the widely-cited write-up is also a blog post. VERIFIED (arXiv id),
  aggregator-only for the exact BlackboxNLP page.

> Established vs metaphor: tuned lens [7] and emergent-world-model probing [8], [9] are
> established. "The hidden state walks toward the answer across layers" is empirically
> supported, with the important caveat that it describes the *depth* trajectory of one
> forward pass, not the *token* trajectory across a generation.

## 4. Dynamical-systems / control-theory framings of transformers

The depth axis of a transformer is a discrete-time dynamical system by direct analogy to
ResNets; the in-context-learning results give the iterated map a learned-optimizer reading.

- **Geshkovski, Letrouit, Polyanskiy, Rigollet (2023/Bull. AMS 2025)** [10] — *A
  Mathematical Perspective on Transformers* — analyzes attention as an interacting
  particle system on the sphere and proves tokens cluster in long time. The most rigorous
  dynamical-systems treatment of the transformer map; published in a top math venue.
  VERIFIED.

- **Weinan E (2017); Haber & Ruthotto (2017); Chen et al. (NeurIPS 2018, Neural ODEs)** [11]
  — the foundational chain: a residual update is a forward-Euler step of an ODE, deep nets
  are discretized continuous flows, training is optimal control. This is the substrate the
  transformer-as-iterated-map framings build on. VERIFIED (well-established canon),
  aggregator-only for the exact individual abstract pages this session.

- **von Oswald et al. (2022/ICML 2023)** [12] — *Transformers Learn In-Context by Gradient
  Descent* — a linear self-attention layer's forward pass is equivalent to a step of gradient
  descent on a regression loss; stacked layers iterate it. Recasts in-context generation as a
  trajectory of an *optimizer* converging toward a solution. VERIFIED (arXiv id; ICML 2023
  acceptance aggregator-reported).

- **von Oswald et al. (2023)** [13] — *Uncovering Mesa-Optimization Algorithms in
  Transformers* — extends [12]: autoregressively trained transformers install an
  in-context optimizer in the forward pass. Supports the "each step descends toward a target"
  reading at the mechanism level. VERIFIED (arXiv 2309.05858).

> Established vs metaphor: [10], [11] are established mathematics. [12], [13] are established
> for restricted (often linear-attention, synthetic-task) settings; the leap to "general LLM
> generation is gradient descent toward the correct region" is *not* established — it is an
> extrapolation from constructions, flagged repeatedly in the literature itself.

## 5. Degeneration / mode collapse / hallucination framed geometrically

- **Holtzman et al. (2019/2020)** [2] (above) is the geometric origin point: degeneration as
  collapse into a high-probability repetitive region of token space.

- **Xu et al. (Apple, 2022)** [14] — *Learning to Break the Loop* — quantifies the
  *self-reinforcement* effect: repetition probability rises almost monotonically with the
  number of prior repetitions — a positive-feedback dynamic, i.e., a sink the walk falls into.
  VERIFIED (arXiv 1908.04319 / Apple ML Research), aggregator-confirmed.

- **Wang, Li, Yan, Cheng, Zhang (2025)** [15] — *Unveiling Attractor Cycles in LLMs* —
  reframes successive paraphrasing as a discrete dynamical system and shows convergence to
  *2-period attractor cycles* (limit cycles), not fixed points. The most explicit published
  use of attractor / limit-cycle / basin language for LLM *output* dynamics. VERIFIED.

> Established vs metaphor: the self-reinforcement feedback [14] is established empirically.
> The attractor-cycle framing [15] is a genuine dynamical-systems analysis but of the
> *iterated-model-on-its-own-output* loop (paraphrase-of-paraphrase), which is a narrower
> setting than single-pass generation — important not to over-generalize.

## 6. "Distance to a target region" / "basin of attraction" for desired outputs

This is where the claim area is **weakest in published grounding**. The vocabulary exists,
but almost entirely for the iterated-interaction loop (Section 5), not for single-pass
generation, and "distance to a correct region" is rarely a formally defined object.

- **Wang et al. (2025)** [15] is the one paper that formally instantiates basins/attractors
  for LLM outputs — but only in the successive-paraphrasing regime.

- Adjacent but *not* about LLM token generation: classical attractor-network models of lexical
  processing [16] and the general dynamical-systems definitions of attractor/basin [17] supply
  the borrowed vocabulary. Cited to be explicit that the "basin of attraction for a correct
  answer" picture is, for *single-pass autoregressive generation*, currently **metaphor
  awaiting formalism** rather than a published result. [16] VERIFIED (journal), [17]
  aggregator-only (encyclopedic/reference, not peer-reviewed on the fetched page).

> Established vs metaphor: nothing in the surveyed literature defines a "buggy region" and a
> "correct region" in document space with a metric and proves the walk's basin structure over
> them for ordinary generation. The closest rigorous objects are the stationary distribution
> [1], the energy surface [4], [5], and the paraphrase-loop attractors [15].

---

## Verification summary

| # | Claim strength | Flag |
|---|---|---|
| [1] LLMs as Markov chains | rigorous, recent | VERIFIED |
| [2] Neural text degeneration / nucleus | established, canonical | VERIFIED |
| [3] Locally typical sampling | established | VERIFIED |
| [4] Residual EBMs for text | established | VERIFIED |
| [5] ARMs are secretly EBMs | rigorous, very recent, single-source | VERIFIED |
| [6] Diffusion-LM | established | VERIFIED |
| [7] Tuned lens | established | VERIFIED |
| [8] Emergent world representations | established (ICLR oral) | VERIFIED |
| [9] Othello-GPT linear world model | established | VERIFIED (id); aggregator (venue page) |
| [10] Mathematical perspective on Transformers | rigorous (Bull. AMS) | VERIFIED |
| [11] ResNets/Neural ODEs as dynamical systems | established canon | aggregator-only (this session) |
| [12] Transformers learn ICL by gradient descent | established (restricted setting) | VERIFIED |
| [13] Mesa-optimization in transformers | established (restricted setting) | VERIFIED |
| [14] Self-reinforcement of repetition | established empirically | VERIFIED |
| [15] Attractor cycles in LLMs | rigorous, narrow regime | VERIFIED |
| [16] Attractor model of lexical processing | established (not LLM) | VERIFIED |
| [17] Attractors / basins (reference) | textbook definitions | aggregator-only |

No DOIs were fabricated. Two community-canonical artifacts (the *logit lens* blog post,
nostalgebraist 2020; the Nanda Othello write-up) are explicitly flagged as blog posts, not
papers, and are not cited as peer-reviewed sources.

---

**Sources**

[1] O. Zekri, A. Odonnat, A. Benechehab, L. Bleistein, N. Boullé, and I. Redko, "Large Language Models as Markov Chains," arXiv:2410.02724, 2024 (rev. Feb. 2025). [Online]. Available: https://arxiv.org/abs/2410.02724

[2] A. Holtzman, J. Buys, L. Du, M. Forbes, and Y. Choi, "The Curious Case of Neural Text Degeneration," in *Proc. Int. Conf. Learn. Represent. (ICLR)*, 2020; arXiv:1904.09751, 2019. [Online]. Available: https://arxiv.org/abs/1904.09751

[3] C. Meister, T. Pimentel, G. Wiher, and R. Cotterell, "Locally Typical Sampling," *Trans. Assoc. Comput. Linguist. (TACL)*, 2023; arXiv:2202.00666, 2022. [Online]. Available: https://arxiv.org/abs/2202.00666

[4] Y. Deng, A. Bakhtin, M. Ott, A. Szlam, and M. Ranzato, "Residual Energy-Based Models for Text Generation," in *Proc. Int. Conf. Learn. Represent. (ICLR)*, 2020; arXiv:2004.11714. [Online]. Available: https://arxiv.org/abs/2004.11714

[5] M. Blondel, M. E. Sander, G. Vivier-Ardisson, T. Liu, and V. Roulet, "Autoregressive Language Models are Secretly Energy-Based Models: Insights into the Lookahead Capabilities of Next-Token Prediction," arXiv:2512.15605, 2025 (rev. May 2026). [Online]. Available: https://arxiv.org/abs/2512.15605

[6] X. L. Li, J. Thickstun, I. Gulrajani, P. Liang, and T. B. Hashimoto, "Diffusion-LM Improves Controllable Text Generation," in *Adv. Neural Inf. Process. Syst. (NeurIPS)*, 2022; arXiv:2205.14217. [Online]. Available: https://arxiv.org/abs/2205.14217

[7] N. Belrose, I. Ostrovsky, L. McKinney, Z. Furman, L. Smith, D. Halawi, S. Biderman, and J. Steinhardt, "Eliciting Latent Predictions from Transformers with the Tuned Lens," arXiv:2303.08112, 2023. [Online]. Available: https://arxiv.org/abs/2303.08112

[8] K. Li, A. K. Hopkins, D. Bau, F. Viégas, H. Pfister, and M. Wattenberg, "Emergent World Representations: Exploring a Sequence Model Trained on a Synthetic Task," in *Proc. Int. Conf. Learn. Represent. (ICLR)*, 2023 (oral); arXiv:2210.13382, 2022. [Online]. Available: https://arxiv.org/abs/2210.13382

[9] N. Nanda, A. Lee, and M. Wattenberg, "Emergent Linear Representations in World Models of Self-Supervised Sequence Models," in *Proc. BlackboxNLP Workshop (ACL)*, 2023; arXiv:2309.00941. [Online]. Available: https://arxiv.org/abs/2309.00941

[10] B. Geshkovski, C. Letrouit, Y. Polyanskiy, and P. Rigollet, "A Mathematical Perspective on Transformers," *Bull. Amer. Math. Soc.*, vol. 62, pp. 427–479, 2025; arXiv:2312.10794, 2023. [Online]. Available: https://arxiv.org/abs/2312.10794

[11] W. E, "A Proposal on Machine Learning via Dynamical Systems," *Commun. Math. Stat.*, vol. 5, no. 1, pp. 1–11, 2017; E. Haber and L. Ruthotto, "Stable Architectures for Deep Neural Networks," *Inverse Problems*, 2017; R. T. Q. Chen, Y. Rubanova, J. Bettencourt, and D. Duvenaud, "Neural Ordinary Differential Equations," in *Adv. Neural Inf. Process. Syst. (NeurIPS)*, 2018; arXiv:1806.07366. [Online]. Available: https://arxiv.org/abs/1806.07366

[12] J. von Oswald, E. Niklasson, E. Randazzo, J. Sacramento, A. Mordvintsev, A. Zhmoginov, and M. Vladymyrov, "Transformers Learn In-Context by Gradient Descent," in *Proc. Int. Conf. Mach. Learn. (ICML)*, 2023; arXiv:2212.07677, 2022. [Online]. Available: https://arxiv.org/abs/2212.07677

[13] J. von Oswald et al., "Uncovering Mesa-Optimization Algorithms in Transformers," arXiv:2309.05858, 2023. [Online]. Available: https://arxiv.org/abs/2309.05858

[14] J. Xu, X. Liu, J. Yan, D. Cai, H. Li, and J. Li, "Learning to Break the Loop: Analyzing and Mitigating Repetitions for Neural Text Generation," in *Adv. Neural Inf. Process. Syst. (NeurIPS)*, 2022; arXiv:1908.04319. [Online]. Available: https://arxiv.org/abs/1908.04319

[15] Z. Wang, Y. Li, J. Yan, Y. Cheng, and Y. Zhang, "Unveiling Attractor Cycles in Large Language Models: A Dynamical Systems View of Successive Paraphrasing," arXiv:2502.15208, 2025. [Online]. Available: https://arxiv.org/abs/2502.15208

[16] D. C. Plaut and J. R. Booth, "An attractor model of lexical conceptual processing: simulating semantic priming," *Cognitive Science*, 1999. [Online]. Available: https://www.sciencedirect.com/science/article/abs/pii/S0364021399000051

[17] "Attractors and Their Basins of Attraction," dynamical-systems reference (encyclopedic). [Online]. Available: https://www.bohrium.com/en/sciencepedia/feynman/dynamical_systems_undergraduate-attractors_and_their_basins_of_attraction
