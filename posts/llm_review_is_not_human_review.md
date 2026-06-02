---
title: LLM Review is not Human Review
date: 2026-06-01
summary: LLM review is a valuable tool for identifying areas of common patterns in your documents. Human review is a two-way street of communication, a meeting of the minds.
---

LLM Review is, simply, having an LLM review and critique a piece of written work. LLM Review is a critical and necessary phase of agentic workflows, but it is not a substitute for human review (in programming, code review), because these achieve different aims.

LLM Review against an LLM output helps refine that output towards a set of examples. Without providing examples, those will usually be some  net "average" of the type of thing it's reviewing. With examples, including examples from the current code base or similar documents from the organization, the review will move more towards that average. This is good in that it keeps bad things from getting worse, but left alone it blocks good things from getting better.

LLM Review applied to human written content is a bit different- while it has the same underlying effects, the benefit from LLM review suggestions is finding patterns a human may have missed. This "blind spot" search can be a welcome backstop, but must be considered in balance with an LLM's push towards the average.

Human review is entirely different. The purpose of human review is to build a shared understanding. Human to human review is always a two-way street, with the reviewer learning from the author's writing, and the author learning what is and is not convincing to the reviewer.

LLMs don't learn from conducting a review. They only "learn" (be it through training or RAG) after the work product has been accepted and committed in full. There's never a meeting of minds, or shared understanding, when an LLM is involved in creating a document.

LLM review is certainly a valuable, albeit at times sharp and harmful, tool in the modern digital world. It does not, cannot, and should not be used as a replacement for humans reviewing each other's work.

For more on effective LLM review techniques, see (I don't have great authoritative links for this; Googling gives a dozen results for every search variant). For more on code review, including techniques and reasoning, see [Software Engineering at Google](https://abseil.io/resources/swe-book/html/ch09.html). For more on general review and editing, see [What Is Editing?](https://shirleyrashediting.com/blog/intro-to-what-is-editing-series/)