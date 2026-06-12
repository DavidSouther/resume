---
title: Ailly OODA
date: 2026-06-12
summary: Observe, Orient, Decide, Act is a durable framework to guide decision making in mission critical contexts. This framework has valuable guidance for creating collaborative coding agents that aim to work with the developer, rather than take on the role entirely. This post describes how Ailly implements these concepts, as well as serving as a general guide to using and thinking about coding with agents.
---

Ailly is available at [davidsouther/domain-driven-design](https://github.com/davidsouther/domain-driven-design).

#### OODA Agents

Observe, Orient, Decide, Act. OODA is doing all four, simultaneously. Observations happen both actively and passively. And there will still be missing, both known and unknown, data. Regardless, it's necessary to orient within the space to the best of the ability provided by those observation. Orientation feeds back into observation, changing the way observations are viewed and contextualized. Within some orientation, it is necessary to make a decision, which will have some effect on the world. A decision should have a hypothesis- how the world is expected to change after carrying out the decision. This also feeds back to observation, priming specific things to look out for. The action then attempts to change the world in a way to test the hypothesis. Refutation of the hypothesis may be just as valuable as, if not more valuable than, meeting the expected outcome.

For actors in a physical world, the OODA loop should be happening constantly, often subconsciously. Practicing each piece in isolation and together is possible, and proactively applying each portion over longer time horizons can bring strategic advantages to organizations. AI Agents aren't actors in a physical world, but are rather linear token sequence predictors.  When left to their own devices, minimally directed prompts allow the LLM token stream to wander through a syntactic landscape without necessarily anchoring on any semantic concepts.

While this next sequence prediction may gather formal semantics, the transformer attention mechanism is very different than animal attention mechanism and does not “interrupt” the LLM to shift its focus, and it is very unstable in that both durability and consistency. Conversation specific state and behavior are immediately lost when the session ends, and minor positional changes in prompts and conversations can have substantial, cascading impacts later in the session.

If LLMs aren't actors, and have these constraints on their “thinking”, they can't get into an OODA loop. But with careful skill selection and promoting, we can extract the central tenets of OODA, recontextualize them for AI Agents, and achieve drastically improved results with substantially less token spend than unguided, unconstrained prompting.

#### Obey the Testing Goat

Software engineering has independently developed a looped workflow to consistently deliver high quality software. Best described in Test Driven Development with Python (aka Obey the Testing Goat), development proceeds with an out loop of high-level feature tests that, when passing, validate a user journey from start to finish. Within this low cadence outer loop, implementation uses the Red/Green/Refactor loop from Test Driven Developmemt and Extreme Programming. One common frustration with practitioners of TDD is a desire to “jump ahead” and just write the code they know they'll want, and sometimes skip the testing even when they pinky promise they won't. Or, tests will be boring to write, so edge cases get missed. That dynamic thinking gets in the way of the otherwise linear progression of a TDD practice.

So humans are good at dynamic thought, and LLMs with proper guidance can follow linear tasks for some time…

#### Research, Design, Plan, Build

The goal of these skills is that users should continue to use short, vague, imprecise prompts to get started, but when the skill activates, it guides a multi-conversation session towards an effective response to the underlying intent. They aim to combine some of the best parts of human judgment with the tenacity of 1m token models.

An Ailly session starts with a prompt that activates Ailly, and Ailly chooses a slug for the conversation and prepares a folder in the project directory to hold the cross session artifacts. Research performs a combination of Observe and Orient- observations come from gathering canonical reference material from MCP tools, and orient is the (refined) research report built with the user’s feedback.

The next step is to apply Jeopardy search to expand the context window and ideally find an anchor to what the user was asking about. After performing Jeopardy! search for the positive statement, it then looks to refute the idea. As research completes, Ailly prepares a report and passes it through a round of review for clarity, consistency, and conciseness. Deep research may have several ancillary supporting docs as well. When finished with research, the user can review, revise, edit, or otherwise collaborate. An especially common collaboration is asking Ailly to perform additional research in an area that was missed, or to remove content that they don't find relevant or compelling. When the research is done, end the session.

When ready to move on, the next prompt is any variant of “Ailly, continue the <slug> task”. Ailly will see the research doc, and move to the design phase. The design phase is a combination of orient and decide- it focuses from the original prompt into a specific, verifiable feature description and a high (appropriate to the size of the feature) level overview of how to get their. The output is a design doc, including purpose, prior art, the user journey (and any guiding metrics), a specification, and alternatives considered, and a feature test that, while it fails at this point, when it passes will show that the feature is appropriately implemented. Ailly again reviews these documents for consistency, conciseness, etc, and then asks the user to collaborate either by providing feedback and asking for changes, or editing the document directly themselves. Throughout the design phase, Ailly is likely to ask clarifying questions around any ambiguities that arise & that it cannot answer confidently from the research.

Starting a fresh session and asking Ailly to continue, Ailly will build a detailed plan on how to specifically implement the feature. Ailly is instructed to always look for a step 0 that modifies the type definitions (Structs, function signatures, modules, etc) that will be necessary. This is called “Type-First Test Driven Development.” By fixing the types first, the implementations are constrained to a much narrower focus. In effect, the thinking tokens in later phases will have more bang for their buck, because they already have so much structure to work within. Additional steps in the plan fill these out, often with discrete chunks at each step. When working in a code base with source control (all of them?), Ailly will perform all of this work on a branch and each plan step will turn into a commit. As before, a final review of the plan before collaborating with the user to refine it to their expectations.

With a plan in place, “Ailly build <slug>” is usually pretty hand off. It just churns away in the background, writing tests, running them, writing code, running checks, until the plan is complete. Each step along the way gets a commit, for easy auditing after the fact. When it's done, depending on the project it can open a pull request or spend additional time waiting your local review. However that goes, the feature test is green and each individual step along the way adds to your codebase.

After the dogfight, OODA took the pilot to a win. She still has to fly home, land, and debrief. For Ailly, that's the cleanup command. The artifacts Ailly made are of questionable value outside the feature cycle. I find them fascinating for review and teaching, but they do fill up both the git repo as well as Ailly’s context window. Cleanup will remove these, ensure the branch is merged (ideally with a squash commit, either locally or via the pull request process), and leave the local directory ready for the next task.

#### FAQs

**Why is Ailly so insistent on using different LLM sessions (or subagents) for each step?** Using an LLM should be a collaboration. When I described an early version of Ailly to a friend, she observed that Ailly is a coding agent for programmers who like coding. The deep, frequent feedback is as much for the human to stay engaged with what the agent is doing as it is for the agent to be kept on task. These phases are a set that David has found that gives a good balance between letting the agent do a wider multitasking that a human can do on their own (especially during the research phase). Ailly asking for feedback is as much keeping the human in their loop as it is correcting its output.

**How can I work on several features at once?** So long as they don't have dependencies on one another, this is usually as easy as adding “in a worktree” to the initial Ailly research prompt. Or if you want to later move because you started working on a second feature that could conflict, just ask it. This actually isn't anything specific to Ailly, this works on pretty much any coding agent and model as of June 2026. But Ailly is (generally) clever enough to match “Ailly, continue on <slug>” to the correct work tree.

**My feature is very simple, do I really need to babysit it?** No, but if you're wrong your mileage may vary ;) At any point, you can say “Ailly, complete this using a quick loop” and it'll do its best to get it all done. If it's truly simple and has no ambiguity, you should be green. But it will hallucinate answers to thing it would otherwise ask you, so hopefully there's enough context to hallucinate the right answer.

**My feature is very complex, I don't want to babysit Ailly and I just want to vibe code the next million dollar idea!** Ok. You'll spend a lot of tokens! Pick an agent and model with Workflows. In your prompt, tell it your great idea, and tell it to write a workflow that drives Ailly to finishing it. Any questions Ailly would ask you, the managing workflow agent should answer instead. (But it should use Ailly to do secondary research for those…) Depending on the capabilities of your model (Hello, Fable), you might get away with telling it to run several Ailly sessions itself. Maybe tell the coordinator to run an Ailly workflow where each step of the plan is actually starting an agent to run another Ailly workflow!? Hello, Gas City!

**Ailly keeps running the wrong command to test my project. What should I do?** Ailly comes with a specialized “initialize” skill that specifically walks through deciding and verifying a project framework (currently optimized for Cargo Rust, Node TypeScript, and UV Python, but it should be straightforward to add more).

**Ailly has dozens of skills across half a dozen skill sets! Why so many!?** Yep. Skills work best when they're focused and targeted. “Ailly” described here is mainly the `developer` skills. There's also `general` which tries to give Ailly a more professional tone when asking questions and writing, `patterns` which documents a number of coding “best practices” that generally don’t get too much disagreement and anyway they make the code better in my opinion, and `domain` and `voices` which are somewhat more experimental and can be skipped.

#### Ailly Quickstart

| **Task** | **Prompt** |
| --- | --- |
| Install Ailly | https://github.com/davidsouther/domain-driven-design |
| Start on a task | Ailly, start work on (or research) \<describe the task or topic>. |
| Start on a task in isolation | Ailly, in a worktree start work on \<describe the task>. |
| Continue the next phase | Ailly, continue (or design or plan or build of implement or clean up) \<task slug>. |
| Finish a task without intervention | Ailly, finish \<task slug or description > with a quick loop. |
| Do work that requires a longer description | Write the task in a file `.ailly/prompts/[topic]`. Then in the Chat, “Run `.ailly/prompts/[topic]`.” |
| Learn more about what Ailly can do | Try it, and ask it. Prompts like "If I tell Ailly to use .agent instead of .ailly for its files, will it respect that?" The agent will often read the source of the Ailly skill and provide an appropriate answer. |
