---
title: "-ilities: Functional & Non-Functional Requirements"
date: 2023-08-18
summary: As software projects grow beyond a single user, understanding functional and non-functional requirements helps teams manage complexity in their system. While functional requirements are visible to users and stakeholders, formalized non-functional requirements ensure the system can grow sustainably over its entire product lifecycle.
---

_This is a transcript of a talk given to a Code Fellows 401 JavaScript course._

### Introduction: Distinguishing Between Functional and Non-Functional Requirements

Good afternoon, aspiring developers\!

First, I'd like to express my gratitude for having me here today. Transitioning careers is no small feat, and diving into full-stack React JavaScript development requires both passion and perseverance. I applaud your efforts and commitment.

Today, we'll be delving into an essential yet often overlooked aspect of software development: the distinction between functional and non-functional requirements. Now, I understand that in the throes of coding, when you're wrestling with state management in React or figuring out the intricacies of a new API, these terminologies might seem a bit abstract. But trust me, they underpin the foundation of every software product out there.

Imagine you're constructing a building. The functional requirements might be the number of rooms, the layout, or the placement of windows and doors. The non-functional requirements, on the other hand, could be likened to the quality of materials, the insulation, or how earthquake-resistant the building is. Both are vital, but they serve different purposes.

By the end of this lecture, I hope to equip you with a clearer understanding of these two categories, ensuring that the software you build not only works but works well for your users. Let's begin our journey into the backbone of software requirements\!

### Transitioning to the '-ilities': Measuring Non-Functional Requirements

Having laid the groundwork with the distinction between functional and non-functional requirements, let's now delve deeper into the heart of non-functional requirements. You might have heard the term '-ilities' thrown around in software development discussions. No, it's not some secret developer code language, but it's a foundational concept that gives structure and specificity to non-functional requirements.

The '-ilities' refer to characteristics of the system that don't directly define its behavior but rather describe its quality, performance, and user experience. Think of them as the standards that determine how well your software performs its functional tasks.

The first \-ility is “Quality” \- do we as a team care that the program works? That it we do our best? This isn’t a trait shared by all teams, or all members of a team. Actively choosing quality is the first and necessary step in achieving other \-ilities.

| &nbsp; | &nbsp; | &nbsp; |
| ---- | ---- | ---- |
| **Quality** Ownership Communication Cleanliness Testing | **Usability** Interaction Latency Effectiveness Efficiency in action Engagement | **Accessibility** Perceivable Operable Understandable Robus |
|  | **Maintainability** Contract (Hyrum’s Law) Documented Modular | **Extensibility** Modifiable SOLID Graceful |
|  | **Availability** Meets business goals Error Budget Fault Tolerant Consistency | **Scalability** Load Shock Efficiency in resources Loose coupling Throughput |
|  | **Security** Private Data Protection (Encryption) Authentication Access Control | **Auditability** Zero Trust Access Rights Management Access Logging Verification |

Let’s embark on this exploration of the '-ilities', shedding light on how we measure and ensure that our software isn’t just operational, but exceptional.

#### Usability & Accessibility

##### 1\. Usability

Definition: Does the software work for the people it was designed for?

Usability focuses on the ease with which your target users can understand, learn, and use the software. A system could have all the required features, but if users struggle to navigate it or find it unintuitive, then its usability is compromised.

###### Ways to Verify Usability

* **User Testing:** Gather a group of your target users and observe them using your software. Take notes on areas where they get stuck or express confusion.  
* **Feedback Surveys:** After users have interacted with your software, provide them with a short survey asking about their experience.  
* **Heuristic Evaluations:** Apply usability principles, often called heuristics, to evaluate potential usability issues. This can be done even before user testing.

##### 2\. Accessibility

Definition: Does the software work for people it wasn’t designed for? (Implies usability)

Accessibility goes a step further than usability. It ensures that your software is usable not just for its target audience but also for people with disabilities. This could include individuals with visual, auditory, cognitive, or motor impairments.

###### Ways to Verify Accessibility

* **Automated Accessibility Testing Tools:** Tools like Axe or Wave can scan your website and provide feedback on accessibility issues.  
* **Manual Testing with Screen Readers:** Test your software with screen readers like JAWS or NVDA to ensure it's navigable and understandable for visually impaired users.  
* **Keyboard-only Navigation:** Ensure that your software can be fully navigated using only the keyboard, a crucial aspect of accessibility.

It's worth noting that while usability often considers the majority or the 'average' user, accessibility ensures no one is left behind. *Inclusivity is a hallmark of excellent software.* In the context of our React applications, libraries like [react-a11y](https://github.com/reactjs/react-a11y) can be instrumental in highlighting accessibility issues during development.

Remember, by ensuring both usability and accessibility, we're not just ticking off boxes; *we're creating software that serves and respects all users*. Next, we'll delve into how some of our advanced '-ilities' build on these foundational concepts.

#### Maintainability & Extensibility

Now that we've delved into the user-centric foundations of Usability and Accessibility, let's pivot our attention towards the developer-centric foundations: Maintainability and Extensibility.

##### 3\. Maintainability

Definition: Are team members able to add features and remediate issues over time?

Maintainability is about ensuring that, as your software grows and evolves, it doesn't become a tangled mess that's impossible to manage. Software that's easy to maintain can adapt to changing requirements without inordinate effort, time, or cost.

###### Ways to Verify Maintainability

* **Code Reviews:** Regularly reviewing code among team members can identify potential maintenance issues and promote best practices.  
* **Technical Debt Tracking:** Track and manage "quick fixes" or "temporary solutions" as they can pile up and become maintainability nightmares.  
* **Automated Testing:** Implement unit, integration, and end-to-end tests. A well-tested application can prevent regressions, ensuring new changes don't break existing functionality.

##### 4\. Extensibility

Definition: Are non-team members able to adapt the software to novel situations? (Implies maintainability)

Extensibility is the ability of your software to be expanded with new capabilities without major changes to the existing system. Think of it as preparing your software for the unknown—situations you didn't anticipate but others might find use for.

###### Ways to Verify Extensibility

* **Plugin Architecture:** Design your software to allow for plugins or extensions, letting other developers build on top of your core functionality.  
* **Clear Documentation:** By providing comprehensive documentation for APIs, modules, and functionalities, you empower other developers to leverage and extend your software.  
* **Decoupling:** Ensure components of your software are modular and loosely coupled. This means changes or additions to one component don't create a cascade of changes in others.

In the realm of React, the concept of componentization promotes both maintainability and extensibility. When components are reusable and modular, they can be maintained more easily and extended for varied use-cases.

As we dive deeper into the '-ilities', it's fascinating to see how they interconnect. Just as extensibility implies maintainability, our upcoming '-ilities' will further build upon these core foundations. Let's continue our journey.

#### Availability & Scalability

Having explored user-focused and development-centric '-ilities', we now transition to a realm which both developers and users equally care about: the performance and reliability of a system. Enter: Availability and Scalability.

##### 5\. Availability:

Definition: Does the system respond successfully with appropriate latency under typical load conditions?

Availability speaks to the uptime of your system and its reliability. An available system ensures that users can access it when they need to without encountering unexpected downtimes or slow responses.

###### Ways to Verify Availability

* **Monitoring Tools:** Employ tools like Nagios, Prometheus, or Datadog to constantly monitor system health and performance.  
* **Regular Health Checks:** Implement periodic health checks on your servers and databases to identify potential availability issues.  
* **Distributed Systems:** By distributing your application across multiple servers or even geographical locations, you can ensure higher availability. If one server fails, others can pick up the slack.

##### 6\. Scalability:

Definition: Does the software continue operation without catastrophic loss of data when experiencing spikes in load? (Implies availability)

Scalability addresses how your system performs under increased load, whether that's more users, more data, or increased concurrent requests. A scalable system can handle growth seamlessly.

###### Ways to Verify Scalability

* **Load Testing:** Use tools like JMeter or LoadRunner to simulate spikes in traffic and see how your system responds.  
* **Horizontal Scaling:** Add more machines to your system or scale out, so as the load increases, you can easily distribute it across multiple servers.  
* **Optimized Databases:** Ensure that your databases are optimized for the expected load and can be scaled up or out as necessary.

In the context of JavaScript and React, consider the back-end environment where your application resides. If you're using Node.js, for instance, utilizing clusters can help improve scalability. For front-end applications, ensuring efficient data-fetching strategies and optimal rendering can aid in managing increased user loads.

Both availability and scalability ensure that as your software garners more users and faces unforeseen circumstances, it remains robust and reliable. As we further explore our '-ilities', we'll see how these foundational concepts play a role in shaping the overall quality of any software system.

#### Security & Auditability

Our exploration of '-ilities' now brings us to a domain that's of paramount importance in today's digital age: the realm of Security and Auditability. With data breaches becoming increasingly common and the value of data soaring, ensuring the security and traceability of our software systems is crucial.

##### 7\. Security

Definition: Is data appropriately stored, and visible only to authorized users?

Security ensures that unauthorized access is denied to sensitive data, services, or resources. It also encompasses the confidentiality, integrity, and availability of data.

###### Ways to Verify Security

* **Penetration Testing:** Engage security experts to simulate cyber attacks on your system to identify vulnerabilities.  
* **Data Encryption:** Ensure data at rest and in transit is encrypted. For web apps, HTTPS should be a standard, and databases should encrypt sensitive data.  
* **Authentication and Authorization:** Implement strong authentication mechanisms, like two-factor authentication, and ensure that authorization mechanisms are in place so that users can only access what they are allowed to.

##### 8\. Auditability

Definition: Is it possible to audit data modification and access over defined periods of time, e.g., the last 30 days? (Implies security)

Auditability ensures that all transactions and modifications within a system are traceable. This is crucial for understanding system activity, investigating incidents, and ensuring compliance with regulations.

###### Ways to Verify Auditability

* **Logging Mechanisms:** Implement comprehensive logging that captures all system and user activities. Tools like ELK Stack (Elasticsearch, Logstash, Kibana) can be used to analyze logs.  
* **Immutable Logs:** Ensure logs are immutable and cannot be tampered with once written. This might mean storing them in a write-once, read-many storage system.  
* **Timestamps:** Include timestamps and user identifiers in logs to trace back actions to a specific time and user.

For developers working with React and JavaScript, leveraging secure coding practices is crucial. Be wary of potential XSS (Cross-Site Scripting) attacks, ensure your APIs are secure, and always validate and sanitize user inputs.

Security and auditability are not just technical requirements but are often mandated by laws and regulations, especially in industries like finance, healthcare, and e-commerce. With these '-ilities' in your arsenal, you're not just building software that works, but software that is trusted and transparent.

As we conclude our exploration of the '-ilities', remember that these are not isolated concepts but interwoven facets of a holistic software development approach.

### The '-ilities': A Journey, Not a Destination

As we wrap up our deep dive into the '-ilities', I want to leave you with a crucial perspective: mastering the '-ilities' is a journey, not a one-time destination. For those just embarking on their software development careers, it's easy to feel overwhelmed by the sheer depth and breadth of these concepts. And that's okay\!

Here's what I'd like you to remember:

* **Aspirational Nature:** The '-ilities' are aspirational. They represent an ideal state of software development, where we continuously strive to improve our products and services.  
* **Foundation First:** The foundational '-ilities' we've discussed \- Usability, Accessibility, Maintainability, and Security \- are immediate areas you can begin focusing on. These form the bedrock of good software, and as you become more adept at them, you'll naturally start exploring the advanced topics.  
* **Continuous Learning:** The software landscape is ever-evolving, and so is the context of these '-ilities'. As you gain more experience, you'll revisit and refine your understanding, applying them in ways you hadn't considered before.  
* **Exposure over Mastery:** At this stage, exposure to these concepts is more crucial than mastery. Being aware of them allows you to know what's out there and where to turn when faced with specific challenges.  
* **Collaborative Growth:** Remember, software development is a team sport. As you collaborate with peers, mentors, and teams, you'll discover that some have strengths in areas you're looking to grow in. Don't hesitate to learn from them and share your strengths in return.

To sum up, embark on your coding journey with a curious mind and an open heart. Celebrate the milestones you achieve, be patient with the challenges, and remember that every '-ility' you encounter is a stepping stone to becoming not just a developer, but a craftsman of technology. Embrace the journey, and you'll find that growth, both professional and personal, awaits at every turn.

### Building Robust Software Homes

As we've journeyed through the intricate landscape of software development today, we've explored the delicate balance between Functional and Non-functional Requirements.

Just as in constructing a home, while functional requirements dictate the rooms and spaces we have, the non-functional requirements act as the specifications for the materials, insulation, and foundational elements that ensure the home stands the test of time. The rooms serve our immediate needs, but it's the quality of materials and construction that ensure safety, comfort, and longevity.

Through our '-ilities', we delved into:

Usability and Accessibility, ensuring our digital spaces are welcoming and inclusive for everyone.

Maintainability and Extensibility, allowing for our software to grow, evolve, and adapt.

Availability and Scalability, ensuring our software homes are reliable and can accommodate all their inhabitants.

Security and Auditability, acting as the fortified walls and security systems that keep threats at bay and trace every entry and exit.

As aspiring developers, it's essential to recognize that building software isn't just about coding functionalities. It's about crafting experiences, safeguarding data, and ensuring that as the digital world evolves, our creations remain relevant, resilient, and reliable.

Always remember, the journey of building robust software homes is iterative and collaborative. Start with a strong foundation, prioritize the foundational '-ilities', and as you grow in your career, layer on the advanced elements. In this way, you won't just construct software; you'll craft digital sanctuaries that stand tall in the vast landscape of technology.

Thank you for embarking on this journey with me today, and here's to building many more enduring digital homes together\!
