---
title: LLMs as a Model of Syntactic Space
date: 2026-06-26
show: false
summary: Agentic LLM workflows can be understood as operators steering a document through syntactic space toward a target region of acceptable artifacts.
image: "/fuzzy_llm.png"
---

> **Draft.** This is the blog-tone response to the paper source in
> `posts/llm_manifold/sections/`.
> It is the successor to [Fuzzy Homomorphic Endofunctors](/fuzzy_homomorphic_endofunctor), the 2024 informal seed.
> The diagrams below are planned as snapshot stills from one larger animation.

Here is the whole idea:

> Agentic LLM workflows can be understood as operators steering a document through syntactic space toward a target region of acceptable artifacts.

That sentence is doing most of the work.
An LLM is not a database of answers.
It is a learned model over the shape of documents: English paragraphs, Rust programs, SQL queries, meeting summaries, JSON blobs, half-broken test files, finished patches.
Generation starts from the prompt and moves through that space one token at a time.
Agentic workflows are the machinery we put around that motion so it lands in the region we actually wanted.

## Documents As Regions

Imagine the set of all possible documents.
Most token sequences are garbage.
A tiny part looks like valid language.
Inside that are smaller regions: valid Python, valid Rust, polite emails, correct invoices, programs that compile, programs that implement `sort`, programs that implement `sort` but with an off-by-one bug.

[Diagram: a large document-space field with regions for natural language, code, Rust, compiling Rust, correct sort implementations, and near-miss buggy sort implementations.]

This is why a bug can be useful to think about spatially.
The buggy program is not nowhere.
It sits near the correct program, but in the wrong region: the region of documents that look plausible, and maybe even compile, while denoting the wrong function.
The LLM can reach that region easily because it is syntactically coherent.
Our job is to steer it from plausible to acceptable.

## The Target Region

The target is the region of artifacts that satisfy the task's referent.
For code, the referent might be a compiler, a test suite, a type checker, a benchmark, or a human review.
For a coding agent such as Codex, Cursor, Claude Code, or a similar tool, it might be the visible file, terminal, or application change that actually exists after a tool call.
For retrieval, it is the external document that really contains the answer.

[Diagram: two paths through document space. One reaches a fluent completion labeled "looks done." The other reaches a smaller region labeled "actually passes the referent check."]

This distinction matters because a model can move the document into the *language* of success without moving the referent at all.
It can write "I updated the file" while the file is unchanged.
It can say "the tests pass" before running them.
It can cite a document that was never retrieved.
The words reached the success region; the world did not.

## Operators

Every common agent pattern is a steering operator, and each operator has three parts: its impulse, its signal, and its referent validation.

Prompting fixes the start point and uses only its conditioning tokens.
Retrieval manufactures stand-ins, then searches around them.
HyDE invents a hypothetical answer; HyPE and Jeopardy-style expansion generate query-side stand-ins.
Compiler errors and tests return an outside verdict that can pull the next step back toward the actual target.
Thinking tokens spend extra sequential computation before committing, but they do not validate the result by themselves.
Subagents launch several trajectories and select among them.
Tree search keeps a frontier of partial trajectories and backtracks using a value estimate.

[Diagram: one initial prompt branching into operator-labeled paths: retrieval, tool feedback, thinking, subagents, tree search. Each path bends toward or away from the target region.]

The operators are not equivalent.
Some have no internal referent validation.
Some validate only implicitly, through nearby retrieved documents.
Some repeatedly recouple the text to a referent.
That difference determines where they fail.

## How Agents Fail

The most useful version of this model is not "agents steer documents."
It is "operators reverse under identifiable conditions."

Tool feedback helps when the tool reports the true state and the model reads it.
It fails silently when the observation channel is weak: the text says success, the repository or application did not change, and no error is raised.

Retrieval expansion helps when the corpus is dense near the answer.
It hurts when the neighborhood is empty and the hypothetical answer becomes a hallucination seed.

Thinking helps when the task is bottlenecked on serial computation.
It is mostly cost when the task needed a missing fact, a verifier, or broader search.

Subagents help when the branches really start in different places.
They collapse when every branch shares the same prompt, same context, and same blind spot.

Tree search helps when a cheap, trustworthy value signal can rank partial paths.
It becomes expensive theater when the value signal is a proxy for the real target.

[Diagram: a table-like animation still showing operator, signal, good regime, failure regime.]

That is the practical payoff.
When an agent workflow fails, ask which operator was supposed to steer the document, what impulse it applied, what signal it used, and whether its referent validation actually touched the thing being judged.

## What The Paper Proves Out

The paper does not claim that "LLMs are manifolds" is new.
That vocabulary already exists in the literature, including categorical and manifold-flavored accounts of text and language-model probability.

The paper's contribution is narrower: it treats agentic workflows as steering operators over documents, then asks what follows from each operator's impulse, signal, and validation path.
The strongest test is not whether the metaphor feels nice.
It is whether readers can apply it to a workflow the paper did not analyze and name a failure mode that "try a better prompt" would not have found.

If the operator lens helps you design, debug, or evaluate the next agent workflow more clearly, it earned its place.
If it cannot predict anything beyond ordinary prompt-engineering advice, throw it away.
