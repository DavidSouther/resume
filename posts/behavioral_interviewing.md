---
title: Behavioral Interviewing
date: 2023-08-17
summary: Learn how to tell your story in the STAR narrative format. Interviewers want to hire candidates who have demonstrated success in their past performance. During a behavioral interview, you can help your interviewer understand your successes by applying STAR to your past roles.
---

When an organization is looking to hire, they want to find a candidate who will bring value to their team in as little time as possible. The best way to know if a person will bring value to a team is to work with them for a period of time, and then evaluate if it’s a good fit. Internships are a great strategy for this kind of hiring, but for professionals who have started their career, this time commitment is unrealistic. Instead, companies rely on the assertion that _future behavior is best indicated by past performance_.

The interview process is looking for a candidate who will work well on the team. For companies that have an established, data driven hiring process, this means looking for two things: 1) The candidate must bring a specific skill set that fills an expected role, and 2) the candidate must share the organization’s values. For programming jobs, the technical interview is used to evaluate a candidate's skill set and the behavioral interview is used to evaluate whether the candidate shares those values.

In this article, we'll look at two roles from a candidate and how they engage with the behavioral interview. We've started with a bit of background about why companies use behavioral interviews. We next look at the two stories, and use them to explore the STAR narrative format. With these specific examples, we will talk about how to tailor those stories for specific companies and interviews. That's the bulk of a single behavioral interview, but we’ll take time in this article to cover two more topics- what questions should you ask during the behavioral interview (or any interview), and how we can use our prepared STAR interviews to take our resumes to the next level.

### STAR: A Narrative Structure to Demonstrate Past Performance

In a behavioral interview, the interviewer will ask two or three questions related to past situations that candidates have likely been in. These questions are open ended, such as “tell me about a time when you worked with a difficult customer.” In this example, the ”customer” could be a student in a tutoring session, a patron at a movie theater, or a stakeholder with business requirements. The interviewer then probes the candidate’s story, reflecting on how their handling of the situation would align with the team’s and organization’s values. The most successful way to answer a behavioral interview question is to describe a narrative using the STAR format.

Let’s explore the STAR format using two examples. One role this engineer had was as an individual contributor, responsible for designing and implementing technical solutions at an internet service provider. The other role was a manager at a global cloud provider. Each column tells a STAR narrative for their respective performances. (The candidate has 15 years of experience on their resume. Some product names have been changed and appear in quotes.)

| _Individual Contributor_                    | _Tech Lead / Manager_                                                            |
| ------------------------------------------- | -------------------------------------------------------------------------------- |
| Responsible for a legacy production system. | Overseeing the migration of an application from one technology stack to another. |

#### Situation

The background context for the story. What organization was this at? What market are they in? Who was on the team? (But only those teammates who will be necessary to tell the story.) Set the scene! Except, leave out one person - the hero, you.

| _Individual Contributor_ | _Tech Lead / Manager_ |
| ------------------------ | --------------------- |
| &{#situation_ic};        | &{#situation_tl};     |

> {section #situation_ic}

“SSS” is a small (~1m customer) global (>20 country) Internet Service Provider. “SSS” maintains a number of networking sites globally. These include satellite ground stations, ISP Points of Presences (POPs), and other network devices. It has a central office, as well as a small travel team responsible for setup and installation of those facilities. “SSS” has a shelf-hosted internal system that manages the source of truth for these details.

> {section #situation_tl}

“VM Service (VMS)” underlies xx% of “Cloud Provider”’s revenue. The website control panel remains a primary entry point to managing “VMS” workloads, in addition to command line and API access. PTeam, the team managing the website control panel infrastructure, mandated a migration from AngularJS to Angular + Typescript.

#### Task

Every good story needs conflict. What needed to be done to advance the team’s mission? With the scene set, what was the dilemma? What was the missing piece holding the organization back? What needed to be changed, fixed or solved in order to make progress and move forward?

| _Individual Contributor_ | _Tech Lead / Manager_ |
| ------------------------ | --------------------- |
| &{#task_ic};             | &{task_tl};           |

> {section #task_ic}

The source of truth service ran as a single point of failure monolithic application on a single cloud VM instance. It was running out of date software and had a fragile update process. The business needed the system to be more robust, more secure, and more resilient. It was also necessary to remain in place for both human and automated users during upgrade and migration.

> {section #task_tl}

I was manager for four local front end developers, and Tech Lead for ten total distributed FE devs. This team was responsible for migrating “Groups”, about one quarter of the affected “VMS” functionality. These engineers were distributed between central Europe and the US west coast.

#### Action

The thing that you personally did when presented with that task. Anyone could pick up the task. Enter the hero - you! Why did you pick up this task? How did you decide on this task vs any other task? What steps did you take to achieve the task? This is the bulk of the story, and can be a bit longer. You’ll be going through two or three of these stories for each interview, so if you’re rehearsing these stories, you can take up to five minutes of prepared time to leave time for questions & nerves.

| _Individual Contributor_ | _Tech Lead / Manager_ |
| ------------------------ | --------------------- |
| &{#action_ic};           | &{#action_tl};        |

> {section #action_ic}

I developed the necessary scripts and migrations to handle safely moving to the then-current version of the software. These scripts additionally allow continued future upgrades as software updates are made available. <br /><br />I coordinated with internal IT and security teams to configure and enable corporate single sign on to the system.<br /><br />I coordinated modernizing a half-dozen custom-made plugins (rewriting two myself, documenting the process and guiding the original authors for the others) through the upgrade process. I added logging and metrics for API calls, allowing SLO monitoring & outage detection.

> {section #action_tl}

I coordinated AngularJS feature work with Angular migration work, collaborating with PM and UX stakeholders on direction & priority. I mentored several junior and noogler engineers in the org on how to work in the org, use Angular, program Typescript, and general career development.<br /><br />I engaged with the wider PTeam ecosystem on a variety of developer experience initiatives. This included TypeScript language readability guidance, GraphQL utilities & API feedback, and promulgating NgRX best practices. The NgRX best practices doc was written by one of my direct reports, whom I championed and guided through the wider cross-org process.

#### Results

The specific (preferably measurable) outcomes that only happened because you succeeded (or failed) in that task. The task is done, the project finished, our hero’s journey comes to an end and normalcy returns to the land. What happened? What changed? Use numbers as much as possible. (You can anonymize the specific number to the order of magnitude to protect confidentiality, but the number should be available to those with permission to access it.) Nearly every organization claims to be data driven - give them the data to realize that!

| _Individual Contributor_ | _Tech Lead / Manager_ |
| ------------------------ | --------------------- |
| &{#results_ic};          | &{#results_tl};       |

By telling a narrative, both the candidate and interviewer have a specific frame of reference to draw from. A narrative with characters, and a beginning, middle, and end of the story, fits human thought in natural ways. And these are your stories, where you are the hero. The question is not how great your team was, it was what you personally did that moved the project to its results. Other people were certainly critical to other parts, but this interview is about _you_.

> {section #results_ic}

System updates are now a 10 minute blue/green rollout, with manual rollback and automated monitoring for critical API endpoints.

SSO Integration allows audited access, and reduces operator burden of needing multiple passwords.

The upgraded version includes a GraphQL API, which allows analysts to greatly improve their tooling. This brings a commensurate improvement to their customer support abilities.

> {section #results_tl}

The extended team migrated the bulk of our pages in six months (from a three quarter estimate), while developing new features in tandem, including the Groups Policy Selection, and the Groups CRON scheduler widget. The Policy Selection was especially streamlined by the improved GraphQL utilities, and the CRON widget drove much of our understanding that went into the NgRX best practices document.

I had a clean handoff of Groups ownership from the US to Europe at the end of tenure, allowing the Europe team to complete the migration on schedule.

#### Probing & Challenging

It’s impossible to cover every possible aspect of the story in one telling. And even if it were, each interviewer is going to be interested in a different part. Expect probing questions so that the interviewer can be sure they have all the details. Be ready to give precise answers, fleshing out the parts of the narrative they are interested in.

Then, expect challenging questions to understand how your answer fits their organization’s culture and values. Again, the organization has that culture and those values already in place. The narrative lets you tell how you’ve performed in the past - but the organization wants to know if that’s how they want you to perform in the future. Your stories didn’t happen in an organization with the same values, so you and the interviewer need to work together to show how it would work with theirs.

| _Individual Contributor_ | _Tech Lead / Manager_    |
| ------------------------ | ------------------------ |
| &{#probing_ic_question}; | &{#probing_tl_question}; |
| &{#probing_ic_answer};   | &{#probing_tl_answer};   |

> {section #probing_ic_question}

Question: You said there was a fragile update process, but also that it hadn’t been updated in a year. What’s the difference there?

> {section #probing_ic_answer}

When I took over as RE, I was told that the prior RE had tried to update a couple times, but had been overwhelmed by the custom plugins, and how the updates had changed the plugin architecture. The prior RE was a network engineer- very talented, but minimal programming experience. So as I understood it, they had deployed maybe 18 months before I took over; they had done one or two point version updates but had lost data at least once, and then gave up because it was working and the blast radius in terms of downstream teams had grown.

> {section #probing_tl_question}

Question: You said you had a “clean handoff”, what does that mean in this context?

> {section #probing_tl_answer}

When we handed off the project, we agreed to one month of work hours on-call for any questions that might arise. We expected to need an hour or two of questions a week, but at the end of the month the Europe team hadn’t sent any questions or issues to the on-call. We had a final retrospective, and they confirmed they hadn’t needed to send any questions - the code, documentation, and training had all been sufficient for them to unblock before they needed to ask.

### Interview Prep

With this in mind, how do you prepare for a behavioral interview?

Know your stories. Prepare a handful to a dozen stories about projects you have been involved in. Write each out as a STAR narrative, focusing on your individual contributions and include measurable results. You don’t need to have them memorized, but they should be written out at least once and easily accessible while you’re job hunting and interviewing.

Research the organization. Focus on their values and principles. Most companies have an about page that describes their history, their vision, and their values. Amazon calls them Leadership Principles (LPs, verbalized “ell peas”). Google shortens the entire thing to “Googliness and Leadership.” Code Fellows has “What We Believe In.” However it’s phrased, the organization has likely thought about them and posted them publicly. At least, you can ask the recruiter (or recruiter coordinator) to pass them along. Read these values, and reflect on what you know about the organization and how they outwardly reflect them.

Finally, connect each STAR narrative of yours with two or three organization values. Make a copy of your stories and annotate it with the values and their meanings. Are there any words or phrases that overlap? Do any values stand out to you personally? Explain how the story demonstrates your embodiment of that value.

If the candidates we've been following applied to a role at Amazon, here's how they could connect these stories to Amazon’s leadership principles.

| _Individual Contributor_ | _Tech Lead / Manager_ |
| ------------------------ | --------------------- |
| &{#prep_ic};             | &{#prep_tl};          |

**Warning:** What if none of the organization’s values align with your own? Maybe take that as a sign to skip that interview…

> {section #prep_ic}

**Amazon Leadership Principles:**

_Bias for Action_ The outdated system had been in production for over a year with no updates. There was ask for budget to redevelop the system to internal tools. Instead, I did a practice migration to demonstrate it could be done; research to show it had the necessary features with an upgrade; and then performed the remaining work.

_Customer Obsession_ While the specific customers were internal facilities engineers and support analysts, their ability to improve their workflows made installs faster and reduced support resolution times.

> {section #prep_tl}

**Amazon Leadership Principles:**

_Ownership_ “Stop the world” migrations, with no feature work, can kill a project or business. Competitors will not stop, and neither could we. By working with the PM org, we were able to find two specific high value features, and implement them in a way that worked in the existing pages but did not add significant time to the migration.

_Deliver Results_ On time, on budget, with a successful handoff.

### “What questions do you have?”

This might be the most dreaded part of any interview. After all that time talking about yourself, you probably just want the job - how can you be interviewing them!? While most companies and interviewers don’t treat this portion as part of their review, you can still come prepared with questions to learn more about the organization, the division, and the team. Remember - they might be paying you dollars, but you are giving your only hours of your day to them. If it is risky for an organization to hire the right people, it is risky for your career growth by going to a harmful or toxic team!

|What makes someone successful on this team? |What has caused people to fail on this team? |
|What do you like most about this organization? |What are you working to change or improve in this organization? |
|What would you expect a new hire in this role to achieve in 6 months? 12 months? |What are your personal goals for the next 6 months? 12 months? |
| |How do you grow \[team-specific\] skill sets for this team? |

You’re looking for specific, clear answers to these questions. In fact, you could even evaluate them using the STAR rubric yourself! The questions on the right are “harder” than the questions on the left. Successful teams will have examples of each of these, and how they fit in with the organization culture. Do their answers align with the organization’s mission, vision, and values? Do their answers align with your values?

### STAR to XYZ(W)

That’s a lot of work to prepare for an interview! Or is it? Preparing your stories is part of prepping for any interview. You might even tell these stories already to your friends, family, and colleagues - especially if they are something you’re very proud of! But there is a next step you can take between writing your narratives and telling them in an interview - summarize them on your resume.

While automated systems screen resumes for keywords, a human reviewing the resume wants to see a narrative just as much as the behavioral interviewer. Because there’s less space in a resume, though, we’re going to cut the narrative down and tell it backwards. This is called the XYZ strategy.

“Accomplished X as measured by Y doing Z (using W).” This is the result of your STAR narrative, distilling the key numbers, and a brief summary of the action you took to do it. While there’s not enough room in a resume line for the Situation and the Task, a good XYZ line can spark specific interest from an interviewer and jump start the conversation. It is an unfortunate reality of automated systems that an additional “using W” line is necessary to list the technologies that were part of the project.

Here's the line on each of their resumes.

| _Individual Contributor_ | _Tech Lead / Manager_ |
| ------------------------ | --------------------- |
| &{#resume_ic_1};         | &{#resume_tl_1};      |
| &{#resume_ic_2};         | &{#resume_tl_2};      |

> {section#resume_ic_1}
> Created automated deployment for mission critical network infrastructure source of truth. Migrated from >1 yr out of date version to current version. Added two missing business critical features.

> {section#resume_ic_2}
> “Applications”, Python, Django, AWS, EC2, Kubernetes, Prometheus, Grafana

> {section#resume_tl_1}
> Lead team of 10 (4 direct) migrating cloud management tools from AngularJS to Angular. Organized additional feature work to maintain market parity and leadership during the migration.

> {section#resume_tl_2}
> AngularJS, Angular, TypeScript, NgRX, “Cloud Platform”, “VMS”, “VMS Groups”

### What have we covered?

Organizations want to hire candidates who will bring value to their teams. A robust hiring process allows organizations to use data to ensure they’re meeting that goal. An industry standard piece of that hiring process is the behavioral interview. This interview explores a candidate’s past performance, so that the organization can infer their future behavior. Candidates should use the STAR method to prepare their personal stories to make it easy for their interviewers to make that decision.

In this article, we followed the STAR-format narratives through two example stories. We saw how a hiring manager or interviewer might follow up on specific points of the stories, and how the candidate may answer those questions. We learned how to research prospective companies to tailor the stories to their values specifically. And for the last mile, we took two quick side trips to think about what questions we might ask our interviewers, and how to turn the STAR stories into XYZ resume bullet points on our resumes.
