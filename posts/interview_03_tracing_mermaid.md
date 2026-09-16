---
title: Tracing Algorithms, Drawn From Text
date: 2026-09-15
# show: false
summary: The tracing notation from "Tracing Algorithms", redrawn. Every figure in that article was a photograph of ink on paper. Here each one is a `traceDiagram` block — a mermaid diagram type for memory traces — so a trace can be written, corrected, and extended as text instead of redrawn.
---

### Tracing Code, Drawn From Text

Part three of a series on [technical whiteboarding](/blog/interview_01_whiteboard).

This article carries the same lesson as [Tracing Algorithms](/blog/interview_03_tracing), with one change: every figure there was a photograph of ink on paper, and every figure here is text. Each diagram below is a `traceDiagram` block — a mermaid diagram type built for the memory-diagram notation Dragon and Dickson describe. A value that is wrong is corrected by editing a number, not by redrawing a page.

The notation is unchanged. Nothing here is a new mark; the syntax only names the marks the pen was already making.

#### Name/Value Table

Tracing starts with a print out of the code to work through. Without code, there's nothing to trace! With the code available, create a T table of names on the left and values on the right.

```python
def gcd(a, b):
  while a != b:
    if a > b:
      a = a - b
    else:
      b = b - a
  return a

gcd(1071, 462)
```

```mermaid
traceDiagram
  title Tracing the GCD function
  frame gcd
    a: 1071, 609, 147, 126, 105, 84, 63, 42, 21
    b: 462, 315, 168, 21
    ret 21
  end
```

This is a complete trace of calling a Greatest Common Divisor (GCD) function. The GCD function computes the largest integer that is itself a divisor of two other integers. This approach using repeated subtraction is known as "Euclid's Algorithm". It has two variables, `a` and `b`, which both have numeric values that change repeatedly over the course of executing the function. Each of those intermediate values is captured in the table, less as reference and more as a tool to keep attention and not lose a value.

In the syntax, an ordinary table entry is written directly as `name: values` inside its `frame` or `scope`; it needs no `row` keyword. The values are written in the order they were taken, and every value but the last is drawn struck through — the same cross-out the pen makes.

Read through the code, parsing each statement and expression.

##### 1. Check variable names in the table.

If the code has a variable name on the left hand side of an `=` assignment operator, check for the name in the table. If the line declares the variable and the name is in the table, that is an error.

Look for each variable in the right hand side of the `=`, or the condition of the control flow. If the name for the right hand side variables are not in the table, that is an error.

##### 2. Evaluate expressions.

Look up variable names in the table, and copy their values. For objects and arrays, follow `.` and `[]` for properties and indexes. Perform arithmetic, and apply functions to arguments.

##### 3. On lines that have an assignment operator `=`, update variables in the table.

Ensure the variable on the left of the `=` is already in the table. Evaluate the expression on the right of the `=`. Cross out the last value in the table. Write the new value from the evaluated expression. In the syntax, that is one more entry appended to the row.

```javascript
function gcdmod(a, b) {
  while (b != 0) {
    [a, b] = [b, a % b];
  }
  return a;
}

gcdmod(1071, 462);
```

```mermaid
traceDiagram
  title Tracing gcdmod
  frame gcdmod
    a: 1071, 462, 147, 21
    b: 462, 147, 21, 0
    ret 21
  end
```

This version of GCD uses the "Long Division" improvement to Euclid's algorithm, resulting in many fewer iterations. It also uses a JavaScript array destructuring assignment, avoiding an intermediate variable inside the while loop. Compare the two rows against the first trace: the same answer, four entries instead of nine.

##### 4. Follow control flow.

Function calls for code that has been written in this solution should be traced. See Function Calls, below.

If statements execute the body when the condition is true, or the else body if the condition is false and the else is present. While loops check the condition; if the condition is true, they execute the next line in the body, otherwise the next line after the end of the body. For loops generally work as a while loop with an additional assignment.

##### 5. Where there is no control flow, move to the next line and repeat until finished!

#### State

The core purpose of this tracing technique is to understand how program state changes over time. To make this readily apparent, this approach does not erase prior values. Instead, this approach crosses out those values, so that on review, it is apparent how they changed over the course of a program. It becomes immediately visually apparent to the reader (and more importantly, the tracer) which variables change, any patterns to their change, and any exceptions to the expected pattern.

Primitive values (booleans, numbers, short strings, and small arrays with three items or fewer) should be drawn directly in the value column. Complex values, primarily objects and large arrays of more than three items, should be drawn to the right of the name/value table with an arrow from the value pointing at the object. If a property or array entry itself has a complex value, draw another arrow. In the visual step through, arrows are literal pointer references.

```javascript
function hasCycle(listHead) {
  const visited = new Set();
  let current = listHead;
  while (current) {
    if (visited.has(current)) return true;
    visited.add(current);
    current = current.next;
  }
  return false;
}
```

```mermaid
traceDiagram
  title Tracing a circular linked list
  heap blue 0x10
    color: cornflowerblue
    next -> green
  end
  heap green 0x20
    color: mediumseagreen
    next -> gold
  end
  heap gold 0x30
    color: goldenrod
    next -> blue
  end
  frame hasCycle
    listHead: @blue
    visited: {}, {0x10}, {0x10 0x20}, {0x10 0x20 0x30}
    current: @blue, @green, @gold, @blue
    ret true
  end
```

This walk through of a circular linked list detection algorithm shows a number of arrows for objects. Each node carries its colour as its fill rather than spelling it out in a field, and has a `next` pointer. The `gold` node's `next` points back to `blue`, forming the circle. The `visited` set uses curly braces as shorthand for the references it contains; it stores references to the nodes, not copies of them. The `current` reference moved several times through the algorithm, so the renderer automatically crosses out its first three, superseded values and leaves the final reference to `0x10` live.

A `heap` block declares an object once. In the source, `@name` uses the heap object's internal connection ID. That name is only for connecting the diagram: the rendered table shows the object's address when it has one, or only an arrow when it does not.

#### Function Calls

Some function calls or method invocations do not need to be traced. Library methods that have a well known interface can be evaluated and their result used in an expression. However, functions and methods that are part of the solution being traced should be represented on the table of variables.

When tracing a function call, draw a horizontal line across the table. To the left of the name column, write the function's name. Add the argument variables, as normal, and continue tracing the function.

When returning from a function, add a final entry in the name column as `return` (or `ret`), with the return value in the value column. Draw an arrow along the left side of the stack back to the variable the return value is assigned to. Finally, cross out with a large X the completed function invocation.

```python
def gcdr(a, b):
  if b == 0:
    return a
  else:
    return gcdr(b, a % b)

gcdr(1071, 462)
```

```mermaid
traceDiagram
  title Tracing function calls in gcdr
  frame gcdr
    a: 1071
    b: 462
    ret 21
    frame gcdr
      a: 462
      b: 147
      ret 21 -> ret
      done
      frame gcdr
        a: 147
        b: 21
        ret 21 -> ret
        done
        frame gcdr
          a: 21
          b: 0
          ret 21 -> ret
          done
        end
      end
    end
  end
```

A recursive implementation of the GCD algorithm. Each recursive call received a new stack frame, with the two arguments. As the functions returned, the arrow filled in the return value for the prior invocation and the frame got crossed off as "complete".

Three statements carry that: a nested `frame` opens the new invocation, `ret 21 -> ret` draws the arrow back to the caller's return slot, and `done` crosses the completed frame out. A frame with no `done` is a frame still running — the outermost one here.

#### Extensions

##### Fewer Arrows with Heap Pointers

Instead of arrows to the heap, each heap object can have a "memory address" assigned. These should be chosen pseudo-randomly, and always written in hexadecimal. For the object in the heap, write its fake address to the top left of the visualization, and put the same number in the value column for the pointer variable. Arrows are optional — they will reinforce what the pointer values are, and they make it obvious to see when an object is no longer in use, but they may be over cluttering for some pointer-heavy programs.

A good rule of thumb for pointers is to start at `0x10`, incrementing the first hex digit by one for each new object, and incrementing the second digit by 1 for each field or item in the array. This does imply a limit of 16 items in an array, or 16 fields in a struct, and does imply word-aligned member access. In the syntax, the address is the optional second word of a `heap` statement; a `heap` with no address is drawn with arrows only.

##### Expression Evaluation as Variables

Programmers with complex expressions may want to track those computations during execution. Adding an expression to the T-table where the left column is the expression of interest, and the right column is its value, is a convenient way to track these pieces of information.

```javascript
function extractValue(arg) {
  return arg.list[2].value;
}
```

```mermaid
traceDiagram
  title Tracing intermediate expressions
  heap arg 0x10
    list -> items
  end
  heap items 0x20
    0: 0x30
    1: 0x40
    2: 0x50
  end
  heap third 0x50
    value: 42
  end
  frame extractValue
    arg: @arg
    watch arg.list[2]: @third
    ret 42
  end
```

The `extractValue` function looks at the value of the item at index 2 in the `list` property of `arg`. In the table, `arg.list[2]` is shown in the "name" column, and makes it clear which object is at index 2 in the array. The return entry can skip the process of going through the entire expression, and follow the arrow directly.

When using a debugger, this functionality is often available as a "watch" entry — which is why the syntax gives it an explicit `watch` marker while ordinary variable rows need no keyword. The only difference is that the name column holds an expression, and is drawn in italic.

##### Scope

Many languages have block scopes for variables. In Java, scopes are created at any pair of braces. JavaScript creates scopes at any pair of control flow braces (for `let` and `const` variables). In either case, variables defined within the scope are no longer valid after the scope.

When tracing a function that has a scope block, draw a dashed line instead of a solid line when starting the scope. Continue the trace as normal, using all values both in the function and the local scope. When the scope is complete, cross it off the same as exiting a function. Multiple scopes can be stacked, and read values higher up the stack.

```javascript
let total = 0;
let i = 0;
while (i < 3) {
  const t = i * 2;
  total = total + t;
  i = i + 1;
}
```

```mermaid
traceDiagram
  title Tracing scope
  frame main
    total: 0, 0, 2, 6
    i: 0, 1, 2, 3
    scope while
      t: 0
      done
    end
    scope while
      t: 2
      done
    end
    scope while
      t: 4
      done
    end
  end
```

In this JavaScript example, using `const` in a `while` loop creates a new `t` value on each iteration. The trace shows this with a dashed line — the same function, but an offset scope. Like returning from functions, the scope is crossed out when it exits, that is, when the `while` loop repeats at the top.

`scope` and `frame` are the same statement with one difference: a `scope` draws its opening rule dashed. That is the whole of the distinction on paper too.

#### On adding detail rather than changing it

Dickson and Dragon's rule for this notation is to vary the level of detail to match the concept being taught, and to **add detail rather than change earlier notation**. The syntax follows that rule by omission: a diagram that declares no `heap` draws no heap area, and a `heap` with no address is drawn with arrows instead of addresses. Choosing the detail level means writing less, not setting a mode.

That rule is also why this is worth having as text. A notation that only ever adds marks can grow — the next marks to add are Rust's ownership, borrow, and lifetime — and a syntax can grow with it in a way a folder of photographs cannot.

#### References

1. Matthew Hertz and Maria Jump. 2013. Trace-based teaching in early programming courses. In Proceedings of the 44th ACM technical symposium on Computer science education (SIGCSE '13). Association for Computing Machinery, New York, NY, USA, 561–566. [https://doi.org/10.1145/2445196.2445364](https://doi.org/10.1145/2445196.2445364)

2. Toby Dragon and Paul E. Dickson. 2016. Memory Diagrams: A Consistent Approach Across Concepts and Languages. In Proceedings of the 47th ACM Technical Symposium on Computing Science Education (SIGCSE '16). Association for Computing Machinery, New York, NY, USA, 546–551. [https://doi.org/10.1145/2839509.2844607](https://doi.org/10.1145/2839509.2844607)

3. Paul E. Dickson and Toby Dragon. 2021. A Memory Diagram for All Seasons. In Proceedings of the 26th ACM Conference on Innovation and Technology in Computer Science Education V. 1 (ITiCSE '21). Association for Computing Machinery, New York, NY, USA, 150–156. [https://doi.org/10.1145/3430665.3456317](https://doi.org/10.1145/3430665.3456317)
