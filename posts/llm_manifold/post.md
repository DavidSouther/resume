---
title: LLMs as a Model of Syntactic Space
date: 2026-06-26
show: false
summary: An LLM is a machine-learned model over the syntactic space of language. Generation starts at the prompt and wanders the manifold of valid documents; agentic workflows are all ways of steering that wander toward the region you want.
image: "/fuzzy_llm.png"
---

> **Draft.** This is the blog-tone companion to the paper in `llm_manifold/`. It is
> the successor to [Fuzzy Homomorphic Endofunctors](/fuzzy_homomorphic_endofunctor),
> the 2024 informal seed. Five diagrams are planned as snapshot stills from a larger
> animation (marked `[Diagram: …]` below).

I'm working on an explanation of LLMs as an ML model of the "syntactic space" of
language, and the numerous manifolds within that space. My first attempt was
[Fuzzy Homomorphic Endofunctors](/fuzzy_homomorphic_endofunctor); this is where the
idea has gone since.

## Functions

Imagine the set of all functions — `is_even(number)`, `sort(numbers)`,
`net_worth(person, date)`, `more_beautiful_than(thing_a, thing_b)`. Some are
computable. All are definable. And around each function is a region of similar but
slightly different functions — `is_odd`, `almost_net_worth()`,
`sort_but_sometimes_random()`. Whether these are different functions entirely, or
just the interesting function *with a bug*, turns out to matter.

[Diagram: a large oval for the set of all functions, with points for specific
functions; a fully contained smaller oval for the computable functions; and small
squiggly ovals around some computable points for "similar" functions.]

## Programs

Separately from functions, we have programs. The computable subset of functions
each have an infinite number of programs that correctly implement them — and an
infinite number that *incorrectly* implement them. (The incorrect implementations
are actually correct implementations of a *different* function: the one defined as
having the bug.)

[Diagram: a large oval, above the functions oval, for the set of all documents.
Two squiggly ovals inside with a little overlap, for "all Python programs" and "all
Rust programs." A small squiggly oval within the Rust region for "all Rust programs
that implement sort," surrounded by a slightly larger one for "Rust programs that
mostly implement sort, but with bugs." A dotted funnel from the Rust region to the
function region: infinitely many Rust programs implement the sort function, and
infinitely many implement each of the infinitely many almost-sorted functions.]

As programmers our goal is two-fold: first, find the correct function that models
some real-world process; second, find a program encoding that function that meets
some aesthetic definition of "good." Historically humans did this through intuition
and trial and error. LLMs do it by walking through document space.

## Document space, and the wander

[Diagram: to the right of the prior two spaces, a larger "blown up" syntax-space
diagram, about twice the area. Keep the Rust squiggle; drop the Python.]

This is where all possible documents live, and the magic of the LLM is that it has
been trained to generate text that stays on the manifold of *valid* documents. Take
tokens entirely at random and there's a vanishingly small chance of getting any
semblance of a reasonable sentence. The Transformer architecture made it possible to
constrain hundreds of thousands of tokens to the manifold of valid documents — valid
French, valid Rust, valid Chinese, valid Rust written with French variable names and
Chinese comments. Anything that comes out, a native speaker would agree is
reasonable. Compared to the stilted gibberish of 2022, this is astounding.

But the algorithm itself just starts somewhere on the manifold (the prompt) and
"wanders." We've succeeded when that wander happens to pass through the region that
holds the correct Rust implementation of the sort function. It might hit… or it might
miss.

[Diagram: a big point in the larger diagram, with one line wandering into the correct
region, another wandering off somewhere, and a third landing near the first but in
the "sorted but has a bug" region.]

## Nudges

For a programming task with a near miss, we can add the error message from the failed
run. That's a new prompt: it extends the path and points it toward the region we
want.

[Diagram: a point on the third line in the buggy area, then a shorter line to the
correct region.]

Or, if the model supports them, we can use "thinking" tokens.

[Diagram: a fourth line starting from the original prompt, following the first and
third lines, but with substantially "wider" curves.]

## Still unwritten

- Subagents; HyDE and HyPE / [Jeopardy search](/jeopardy_search).
- Topology of the space: the LLM "learns" the topology, and the tokens mostly follow
  the terrain.

---

The goal for this work is a paper explaining these ideas and their relevance to
agentic AI workflows. See `llm_manifold/paper.md` for the rigorous treatment and the
claim ledger.
