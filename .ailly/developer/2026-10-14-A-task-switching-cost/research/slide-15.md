# Slide 15 (PDF page 20), verbatim pdftotext
```
                          Kernel Perspective



Why a Thread Switch Is Cheaper

Recall from the context-switch discussion: switching between processes
costs more than switching between threads.
Why:
 ▶ Thread switch (same address space):
      ▶ save registers, switch stack pointer;
      ▶ reload the TCB;
      ▶ (to be discussed later) no page-table switch, no TLB flush.
 ▶ Process switch (different address space):
      ▶ everything above, plus
      ▶ switch to a different page table;
      ▶ (to be discussed later) no TLB flush;
      ▶ (to be discussed later) no cache invalidation.

So: the user-visible benefit (“threads are cheaper”) comes from a
kernel-level fact (no address-space switch).

     H. Chen (CUNY)                    CISC 7310X          October 7, 2026   15 / 29

--- slide 16 (project) ---
                      Context Switch Cost Project



Measuring Context Switch Cost?

The claim: thread switches are cheaper than process switches.
The questions:
 ▶ How much cheaper?
 ▶ Does the difference hold when the working set is large?
 ▶ Can you measure the cost, or only its macroscopic effect?

What we might do:
 ▶ Implement a benchmark that forces N context switches between two
   processes, then between two threads.
 ▶ Vary the working set size (0 KB, 32 KB, 256 KB).
 ▶ Measure wall-clock time and compute per-switch cost.
 ▶ Plot cost vs. working set size for both cases.


     H. Chen (CUNY)                          CISC 7310X   October 7, 2026   16 / 29

--- slide 25 ---
                           Thread Model



Kernel and User Threads

Kernel threads.
 ▶ Managed by the kernel; the TCBs live in kernel space.
 ▶ The kernel schedules them independently on multiple cores.
 ▶ A blocking system call blocks only the calling thread.
 ▶ More expensive to create and switch.
User threads.
 ▶ Managed by a user-level library; TCBs in the process.
 ▶ Cheaper to create and switch.
 ▶ If the library is many-to-one, one blocking call blocks all threads in
    the process.
 ▶ On a multicore system, the kernel sees only one schedulable entity, so
    threads cannot run in parallel.
But how much more expensive are kernel threads? We can measure this.
     H. Chen (CUNY)                CISC 7310X          October 7, 2026   25 / 29

```
