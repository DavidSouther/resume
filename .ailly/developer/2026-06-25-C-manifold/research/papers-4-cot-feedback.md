# Papers — CLAIM AREA 4: Conditioning, Chain-of-Thought, In-Context Learning, and Self-Correction with Execution Feedback

Scope: prior art for the section arguing that conditioning steers the generation trajectory — prompting repositions the start point, an appended error message nudges a near-miss toward the correct region, and "thinking tokens" / CoT widen the search.

Verification convention: **[VERIFIED]** = arXiv ID and authors confirmed via direct arXiv abstract fetch and/or multiple independent listings (arXiv + OpenReview/proceedings). **[VERIFIED-LISTING]** = confirmed via arXiv listing + a second index (Semantic Scholar / proceedings) but abstract not individually re-fetched in this session. No aggregator-only or unverifiable entries are included; nothing below is fabricated.

---

## 1. Formal expressivity of chain-of-thought ("thinking = wider/deeper search")

This is where the paper's "thinking tokens widen the search" intuition has the **strongest real support** — though the rigorous result is about *serial depth* (sequential computation steps), not literally "wider curves." The formal claim is: intermediate tokens convert a fixed-depth parallel circuit into one that can run for many sequential steps, strictly enlarging the computable class.

- CoT prompting elicits multi-step reasoning empirically (the origin of the claim) [1].
- Circuit-complexity account: constant-depth Transformers without intermediate steps live in TC⁰ (highly parallel, no inherently-serial computation); with CoT they escape it [2], [3], [4].
- The "filler / pause / thinking token" line shows the gain can come from *extra computation budget*, partly independent of token *content* — directly relevant to "thinking tokens widen the search" [5], [6], [7].

Key results:

- **CoT lets transformers solve inherently serial problems** [2]: without CoT, constant-depth finite-precision transformers solve only TC⁰ (constant-bit precision → AC⁰); with T steps of CoT, constant-depth constant-precision transformers with O(log n) embedding solve anything computable by size-T boolean circuits. This is the cleanest formal statement that intermediate tokens trade serial steps for circuit depth. **[VERIFIED]**
- **Expressive power of transformers with CoT** [3]: characterizes how many intermediate ("scratchpad") steps buy how much power; logarithmic steps stay near TC⁰, linear steps reach the class of problems decidable by transformers in their generation length, polynomial steps reach P. Provides the matching upper/lower bounds. **[VERIFIED-LISTING]**
- **Theoretical perspective on CoT** [4]: by circuit complexity, bounded-depth transformers cannot directly produce answers to basic arithmetic/equation tasks unless size grows super-polynomially, but constant-size autoregressive transformers suffice when allowed to emit CoT derivations. **[VERIFIED-LISTING]**
- **Pause tokens strictly increase expressivity** [5]: filler "pause" tokens are not just empirically helpful — without them constant-depth log-width transformers compute a strict subset of AC⁰; a polynomial number of pause tokens reaches all of AC⁰, and at log precision reaches TC⁰. Two-layer masked transformers learn parity *only* with pause tokens. This is the strongest formal evidence that *content-free* "thinking" tokens add computational power. **[VERIFIED]** (London & Kanade, 2025; abstract fetched directly.)
- **Let's Think Dot by Dot** [6]: empirically, transformers solve hard algorithmic tasks (e.g. 3SUM) using meaningless filler "......" in place of a chain of thought — performance gains can come from added tokens, not human-like decomposition. Caveat the paper itself raises: filler-token computation is *hidden / unauditable*, which complicates the clean "trajectory steering" metaphor. **[VERIFIED-LISTING]**
- **Think before you speak: training LMs with pause tokens** [7]: the empirical precursor — training and inference with appended `<pause>` tokens gives delayed-computation gains on QA/reasoning. **[VERIFIED-LISTING]**

**Support verdict:** "Thinking widens/extends the search" is **genuinely supported as formal expressivity** (serial-depth escape from TC⁰/AC⁰), strongest in [2], [3], [5]. The specific geometric phrasing ("wider curves") is metaphor; the rigorous object is added sequential computation steps / circuit size, not literal trajectory curvature.

---

## 2. In-context learning as implicit Bayesian inference / implicit gradient descent ("prompting locates a latent task")

This supports the "prompting repositions the start point" / "prompt as locating a latent task" claim. Two complementary mechanistic stories exist, and they are not the same claim:

- **Bayesian/latent-concept story** — the prompt makes the model *infer a latent task variable* and condition on it [8]. This is the most direct formal backing for "prompt = locate a latent task."
- **Implicit-algorithm story** — ICL is the forward pass *running a learning algorithm* (gradient descent / ridge regression) over the in-context examples [9], [10], [11].

Key results:

- **ICL as implicit Bayesian inference** [8] (Xie et al., ICLR 2022): when pretraining data has long-range coherence (a mixture of HMMs), ICL emerges because the model infers a shared latent concept across prompt examples; proved despite prompt/pretraining distribution mismatch. Directly grounds "prompt locates a latent task." **[VERIFIED]**
- **Transformers learn in-context by gradient descent** [9] (von Oswald et al., ICML 2023): a single linear self-attention layer can implement one GD step on a regression loss; trained transformers become "mesa-optimizers" matching GD in the forward pass. **[VERIFIED]**
- **What learning algorithm is ICL?** [10] (Akyürek et al., ICLR 2023): by construction transformers can implement GD and closed-form ridge regression for linear models; trained ICL learners empirically match GD / ridge / exact least-squares predictors. **[VERIFIED]**
- **Why can GPT learn in-context? LMs implicitly perform gradient descent as meta-optimizers** [11] (Dai et al.): frames ICL as implicit finetuning, drawing a dual between attention and GD. **[VERIFIED-LISTING]**

**Contrarian / boundary note:** the "implicit GD" equivalence is proven mainly for *linear* self-attention on synthetic regression and is contested as the explanation for real LLM ICL; treat [9]–[11] as existence/equivalence results in a restricted setting, not a claim about deployed models. The Bayesian story [8] and the GD story are distinct mechanisms, both partial. (For a balanced framing, the paper should not assert a single settled mechanism.)

---

## 3. Self-correction and execution feedback ("an appended error message nudges a near-miss toward correct")

This is the **genuinely disputed** area and the "error message nudges trajectory" claim must be stated carefully. The literature splits sharply on *external* vs *intrinsic* feedback.

### 3a. Methods that use feedback (often external / execution-grounded) — supportive

- **Self-Refine** [12] (Madaan et al., NeurIPS 2023): same LLM generates, critiques, refines its own output iteratively; ~20% avg gain across tasks. Feedback is *self*-generated (no external executor). **[VERIFIED-LISTING]**
- **Reflexion** [13] (Shinn et al., NeurIPS 2023): agents convert task feedback signals into verbal self-reflection stored in episodic memory across trials; gains depend on having a feedback signal (incl. environment/test results). **[VERIFIED-LISTING]**
- **Teaching LLMs to Self-Debug** [14] (Chen et al.): model debugs its predicted program by inspecting *execution results* and explaining its code ("rubber-duck debugging"); SOTA on Spider, TransCoder, MBPP. The execution result *is* the external nudge — directly the "error message moves a near-miss" mechanism. **[VERIFIED-LISTING]**
- **CRITIC** [15] (Gou et al., ICLR 2024): LLM validates and amends its outputs using *external tools* (search engine, code interpreter); consistent gains. Explicitly attributes success to tool/execution feedback, not introspection. **[VERIFIED-LISTING]**

### 3b. The critique line — intrinsic self-correction does NOT reliably work

- **LLMs Cannot Self-Correct Reasoning Yet** [16] (Huang et al., ICLR 2024): without external feedback, intrinsic self-correction often *fails to improve and can degrade* reasoning accuracy; reported prior gains often leaned on oracle labels or test feedback. The central contrarian result. **[VERIFIED]**
- **When Can LLMs Actually Correct Their Own Mistakes? A Critical Survey** [17] (Kamoi et al., TACL 2024): synthesizes the dispute. Conclusions: (1) no prior work shows successful self-correction with feedback from *prompted LLMs alone* except on tasks exceptionally suited to it; (2) self-correction *works well when reliable external feedback is available*; (3) large-scale fine-tuning can instill it. **[VERIFIED]**

**Support verdict for "error message nudges trajectory":** **Real and well-supported when the feedback is external and execution-grounded** (compiler/interpreter error messages, test failures, tool output) — [14], [15], and the conditional in [17]. It is **NOT supported as intrinsic introspection**: [16], [17] show a model re-reading its own un-executed output frequently fails to improve and can regress. The paper's framing fits the *execution-feedback* case (an actual failed-run error message), which is the defensible side of the dispute — but it should explicitly distinguish that from intrinsic self-correction, and should cite [16]/[17] to avoid overclaiming.

---

## 4. Prompting as conditioning / steering; theory/geometry of prompting

Supports "prompting repositions the start point." There is method-level theory (soft prompts as a learned conditioning vector) but **no widely-cited rigorous "geometry of the trajectory" theory**; the geometric/steering framing is largely the paper's own contribution / metaphor.

- **Prefix-Tuning** [18] (Li & Liang, 2021): prepend trainable continuous "prefix" activations at every layer; steers a frozen LM per task. Conditioning made an optimizable vector. **[VERIFIED-LISTING]**
- **The Power of Scale for Parameter-Efficient Prompt Tuning** [19] (Lester et al., EMNLP 2021): learns "soft prompts" via backprop on a frozen model; closes the gap with full finetuning at scale. Strongest evidence that a prompt is a *point in embedding space that conditions/locates a task*. **[VERIFIED-LISTING]**
- Latent-task location is also argued by the Bayesian ICL account [8] (see §2).

**Support verdict:** "Prompt repositions the start point / locates a latent task" is **supported as conditioning** ([8], [18], [19]). A formal *geometry of prompting* (manifolds, trajectory curvature) is **not established prior art** — flag as the paper's own framing/metaphor, not a cited result.

---

## Summary of support vs. metaphor

| Paper claim | Status |
|---|---|
| Thinking/CoT tokens widen/extend the search | **Formal support** as serial-depth / circuit-size gain [2][3][4][5]; "wider curves" is metaphor |
| Filler/pause tokens add power without meaningful content | **Formal + empirical support** [5][6][7] |
| Prompt repositions start / locates latent task | **Support** as conditioning [8][18][19]; geometry is metaphor |
| ICL = implicit Bayesian inference / gradient descent | **Support in restricted settings** [8][9][10][11]; contested as the full story |
| Error message nudges a near-miss toward correct | **Support iff external/execution feedback** [14][15][17]; **refuted for intrinsic** [16][17] |

---

## Sources

[1] J. Wei, X. Wang, D. Schuurmans, M. Bosma, B. Ichter, F. Xia, E. Chi, Q. Le, and D. Zhou, "Chain-of-Thought Prompting Elicits Reasoning in Large Language Models," in *Proc. NeurIPS*, 2022. arXiv:2201.11903. [Online]. Available: https://arxiv.org/abs/2201.11903

[2] Z. Li, H. Liu, D. Zhou, and T. Ma, "Chain of Thought Empowers Transformers to Solve Inherently Serial Problems," in *Proc. ICLR*, 2024. arXiv:2402.12875. [Online]. Available: https://arxiv.org/abs/2402.12875

[3] W. Merrill and A. Sabharwal, "The Expressive Power of Transformers with Chain of Thought," in *Proc. ICLR*, 2024. arXiv:2310.07923. [Online]. Available: https://arxiv.org/abs/2310.07923

[4] G. Feng, B. Zhang, Y. Gu, H. Ye, D. He, and L. Wang, "Towards Revealing the Mystery behind Chain of Thought: A Theoretical Perspective," in *Proc. NeurIPS*, 2023. arXiv:2305.15408. [Online]. Available: https://arxiv.org/abs/2305.15408

[5] C. London and V. Kanade, "Pause Tokens Strictly Increase the Expressivity of Constant-Depth Transformers," 2025. arXiv:2505.21024. [Online]. Available: https://arxiv.org/abs/2505.21024

[6] J. Pfau, W. Merrill, and S. R. Bowman, "Let's Think Dot by Dot: Hidden Computation in Transformer Language Models," in *Proc. Conference on Language Modeling (COLM)*, 2024. arXiv:2404.15758. [Online]. Available: https://arxiv.org/abs/2404.15758

[7] S. Goyal, Z. Ji, A. S. Rawat, A. K. Menon, S. Kumar, and V. Nagarajan, "Think before you speak: Training Language Models With Pause Tokens," in *Proc. ICLR*, 2024. arXiv:2310.02226. [Online]. Available: https://arxiv.org/abs/2310.02226

[8] S. M. Xie, A. Raghunathan, P. Liang, and T. Ma, "An Explanation of In-context Learning as Implicit Bayesian Inference," in *Proc. ICLR*, 2022. arXiv:2111.02080. [Online]. Available: https://arxiv.org/abs/2111.02080

[9] J. von Oswald, E. Niklasson, E. Randazzo, J. Sacramento, A. Mordvintsev, A. Zhmoginov, and M. Vladymyrov, "Transformers Learn In-Context by Gradient Descent," in *Proc. ICML*, 2023, pp. 35151–35174. arXiv:2212.07677. [Online]. Available: https://arxiv.org/abs/2212.07677

[10] E. Akyürek, D. Schuurmans, J. Andreas, T. Ma, and D. Zhou, "What Learning Algorithm Is In-Context Learning? Investigations with Linear Models," in *Proc. ICLR*, 2023. arXiv:2211.15661. [Online]. Available: https://arxiv.org/abs/2211.15661

[11] D. Dai, Y. Sun, L. Dong, Y. Hao, S. Ma, Z. Sui, and F. Wei, "Why Can GPT Learn In-Context? Language Models Implicitly Perform Gradient Descent as Meta-Optimizers," in *Findings of ACL*, 2023. arXiv:2212.10559. [Online]. Available: https://arxiv.org/abs/2212.10559

[12] A. Madaan, N. Tandon, P. Gupta, S. Hallinan, L. Gao, S. Wiegreffe, U. Alon, N. Dziri, S. Prabhumoye, Y. Yang, S. Gupta, B. P. Majumder, K. Hermann, S. Welleck, A. Yazdanbakhsh, and P. Clark, "Self-Refine: Iterative Refinement with Self-Feedback," in *Proc. NeurIPS*, 2023. arXiv:2303.17651. [Online]. Available: https://arxiv.org/abs/2303.17651

[13] N. Shinn, F. Cassano, E. Berman, A. Gopinath, K. Narasimhan, and S. Yao, "Reflexion: Language Agents with Verbal Reinforcement Learning," in *Proc. NeurIPS*, 2023. arXiv:2303.11366. [Online]. Available: https://arxiv.org/abs/2303.11366

[14] X. Chen, M. Lin, N. Schärli, and D. Zhou, "Teaching Large Language Models to Self-Debug," in *Proc. ICLR*, 2024. arXiv:2304.05128. [Online]. Available: https://arxiv.org/abs/2304.05128

[15] Z. Gou, Z. Shao, Y. Gong, Y. Shen, Y. Yang, N. Duan, and W. Chen, "CRITIC: Large Language Models Can Self-Correct with Tool-Interactive Critiquing," in *Proc. ICLR*, 2024. arXiv:2305.11738. [Online]. Available: https://arxiv.org/abs/2305.11738

[16] J. Huang, X. Chen, S. Mishra, H. S. Zheng, A. W. Yu, X. Song, and D. Zhou, "Large Language Models Cannot Self-Correct Reasoning Yet," in *Proc. ICLR*, 2024. arXiv:2310.01798. [Online]. Available: https://arxiv.org/abs/2310.01798

[17] R. Kamoi, Y. Zhang, N. Zhang, J. Han, and R. Zhang, "When Can LLMs Actually Correct Their Own Mistakes? A Critical Survey of Self-Correction of LLMs," *Trans. Assoc. Comput. Linguistics (TACL)*, 2024. arXiv:2406.01297. doi:10.1162/tacl_a_00713. [Online]. Available: https://arxiv.org/abs/2406.01297

[18] X. L. Li and P. Liang, "Prefix-Tuning: Optimizing Continuous Prompts for Generation," in *Proc. ACL-IJCNLP*, 2021. arXiv:2101.00190. [Online]. Available: https://arxiv.org/abs/2101.00190

[19] B. Lester, R. Al-Rfou, and N. Constant, "The Power of Scale for Parameter-Efficient Prompt Tuning," in *Proc. EMNLP*, 2021. arXiv:2104.08691. [Online]. Available: https://arxiv.org/abs/2104.08691
