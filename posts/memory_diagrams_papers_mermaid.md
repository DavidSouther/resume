---
title: Fifteen Memory Diagrams, Rebuilt from Two Papers
date: 2026-09-16
show: false
summary: The complete diagram sets from Dickson and Dragon's 2016 and 2021 memory-diagram papers, reconstructed as editable traceDiagram source.
---

# Fifteen Memory Diagrams, Rebuilt from Two Papers

This hidden gallery is a working test bed for `traceDiagram`. It reconstructs
the diagram in every numbered figure from two papers by Toby Dragon and Paul E.
Dickson. The captions below identify what each reconstruction exercises; they
do not reproduce the papers' prose.

## 2016 paper: Memory Diagrams: A Consistant Approach Across Concepts and Languages

Source: Toby Dragon and Paul E. Dickson, 2016,
[doi:10.1145/2839509.2844607](https://doi.org/10.1145/2839509.2844607).

### Figure 1: Primitive assignments in Python

The first reconstruction keeps the overwritten value of `x` visible and ends
with the printed result.

```python
s = "hello"
x = 4
y = 6
x = 8
total = x + y + x
print(total)
```

```mermaid
traceDiagram
  title 2016 Figure 1 — primitive values
  frame main
    s: "hello"
    x: 4, 8
    y: 6
    total: 22
    output: 22
  end
```

### Figure 2: Function calls and returned values

Two completed calls to `here` update the same variable in the calling frame.

```python
def here(valHere):
  valHere = valHere + 1
  return valHere

output=3
output=here(output)
output=here(output)
```

```mermaid
traceDiagram
  title 2016 Figure 2 — calls and returns
  frame main
    output: 3, 4, 5
    frame here
      valHere: 3, 4
      ret 4 -> output
      done
    end
    frame here
      valHere: 4, 5
      ret 5 -> output
      done
    end
  end
```

### Figure 3: Lists and dictionaries on the heap

`numList` and `numList2` share one list after mutation, while `dict` points to
a separate mapping.

```python
def change(listIn):
  listIn[0]=0
  return listIn

numList=[5,7,17,24]
numList2=change(numList2)
dict = {'Name': 'Seth', 'Age': 2};
```

```mermaid
traceDiagram
  title 2016 Figure 3 — mutable collections
  heap numbers
    0: 5, 0
    1: 7
    2: 17
    3: 24
  end
  heap person
    Name: Seth
    Age: 2
  end
  frame main
    numList: @numbers
    numList2: @numbers
    dict: @person
    frame change
      listIn: @numbers
      ret @numbers -> numList2
      done
    end
  end
```

### Figure 4: Python objects and method scope

Two variables point to two `Person` instances; the completed method call uses
`self` to reach the first object.

```python
class Person:
  def __init__(self, name, age):
    self.name = name
    self.age = age

  def getAge(self):
    return self.age

p1=Person("Seth",2)
p2=Person("Elyse",3)
ageOut=p1.getAge()
```

```mermaid
traceDiagram
  title 2016 Figure 4 — Python objects
  heap seth
    type: Person
    name: Seth
    age: 2
  end
  heap elyse
    type: Person
    name: Elyse
    age: 3
  end
  frame main
    p1: @seth
    p2: @elyse
    ageOut: 2
    frame __init__
      self: @seth
      name: Seth
      age: 2
      done
    end
    frame __init__
      self: @elyse
      name: Elyse
      age: 3
      done
    end
    frame getAge
      self: @seth
      ret 2 -> ageOut
      done
    end
  end
```

### Figure 5: Java inheritance and polymorphism

The stack uses the declared `Account` reference while the heap object retains
the additional state of `SavingsAccount`.

```java
public class Account {
  private String id;
  private double balance;

  public Account(String id, double deposit){
    this.id = id;
    this.balance = deposit;
  }

  public String getInfo(){
    return "ID: " + this.id + "\tBalance:" +
      this.balance;
  }

  public static void main(String[] args) {
    Account test = new SavingsAccount("Jane Doe",
      100, 0.0025);
    String acctInfo = test.getInfo());
  }
}

class SavingsAccount extends Account {
  private double apr;

  public SavingsAccount (String id,
      double deposit, double apr){
    super(id, deposit);
    this.apr = apr;
  }

  public String getInfo(){
    String acctInfo = super.getInfo();
    return acctInfo + "\tAPR: " + apr;
  }
}
```

```mermaid
traceDiagram
  title 2016 Figure 5 — Java objects
  heap savings
    type: SavingsAccount extends Account
    id: Jane Doe
    balance: 100.0
    apr: 0.0025
  end
  frame main
    test: @savings
    acctInfo: ID Jane Doe | Balance 100.0 | APR 0.0025
    frame SavingsAccount.getInfo
      this: @savings
      baseInfo: ID Jane Doe | Balance 100.0
      frame Account.getInfo
        this: @savings
        ret ID Jane Doe | Balance 100.0 -> baseInfo
        done
      end
      ret ID Jane Doe | Balance 100.0 | APR 0.0025 -> acctInfo
      done
    end
  end
```

### Figure 6: C++ stack and heap pointers

One pointer aliases a stack value; another reaches an explicitly allocated heap
cell before being cleared.

```cpp
#include <iostream>
using namespace std;

int main () {
  int stackX = 5;
  int* stackPtr = &stackX;
  int* heapPtr = new int;
  *stackPtr = 10;
  *heapPtr = 20;
  cout << "\n on stack:" << stackX;
  cout << "\n on heap:" << *heapPtr;
  delete heapPtr;
  heapPtr = nullptr;
  return 0;
}
```

```mermaid
traceDiagram
  title 2016 Figure 6 — C++ pointers
  heap allocated
    value: ~20~
  end
  frame main
    stackX: 5, 10
    stackPtr: &stackX
    heapPtr: @allocated, nullptr
    output stack: 10
    output heap: 20
  end
```

## 2021 paper: A Memory Diagram for All Seasons

Source: Paul E. Dickson and Toby Dragon, 2021,
[doi:10.1145/3430665.3456317](https://doi.org/10.1145/3430665.3456317).

### Figure 1: Primitive value history

The later specification preserves the same compact name/value trace for a
reassigned primitive.

```python
ageYears = 10
ageDays = ageYears * 365
ageYears = 12
```

```mermaid
traceDiagram
  title 2021 Figure 1 — primitive history
  frame main
    ageYears: 10, 12
    ageDays: 3650
  end
```

### Figure 2: A simple function frame

The callee's result returns to `ageInDays` in the caller.

```python
def calcDays(yearsIn):
  numDays = yearsIn * 365
  return numDays

def main():
  ageInYears = 10
  ageInDays = calcDays(ageInYears)

main()
```

```mermaid
traceDiagram
  title 2021 Figure 2 — a function frame
  frame main
    ageInYears: 10
    ageInDays: 3650
    frame calcDays
      yearsIn: 10
      numDays: 3650
      ret 3650 -> ageInDays
      done
    end
  end
```

### Figure 3: A list passed by reference

The caller and callee share address `0x240`, so the heap list records the three
incremented values.

```python
def inc_all(numList):
  for i in range(len(numList)):
    numList[i] += 1

def main():
  all_ages = [19, 17, 21]
  inc_all(numList)

main()
```

```mermaid
traceDiagram
  title 2021 Figure 3 — list side effects
  heap ages 0x240
    0: 19, 20
    1: 17, 18
    2: 21, 22
  end
  frame main
    all_ages: @ages
    frame inc_all
      numList: @ages
      i: 0, 1, 2
      done
    end
  end
```

### Figure 4: Objects at hexadecimal locations

Two stack references point at independent `Person` objects on the heap.

Unlike the other numbered figures, the paper prints no code listing here. These
are the two construction statements recoverable from the object names, values,
and addresses in the diagram.

```python
p1 = Person("Seth", 7)
p2 = Person("Elyse", 8)
```

```mermaid
traceDiagram
  title 2021 Figure 4 — addressed objects
  heap seth 0x120
    type: Person
    Name: Seth
    Age: 7
  end
  heap elyse 0x130
    type: Person
    Name: Elyse
    Age: 8
  end
  frame main
    p1: @seth
    p2: @elyse
  end
```

### Figure 5: Ordinary and tail recursion

The left stack retains pending additions; the right stack carries the running
pair through tail calls.

```python
def fib_tail_R(num1, num2, count):
  if count == 0:
    return num2
  else:
    temp = num1 + num2
    return fib_tail_R(num2, temp, count - 1)

def fib_tail(num):
  return fib_tail_R(0, 1, num - 1)

def fib(num):
  if num == 0:
    return 0
  elif num == 1:
    return 1
  else:
    ans1 = fib(num - 1)
    ans2 = fib(num - 2)
    return ans1 + ans2

def main():
  ans=fib(3)
  ans=fib_tail(3)

main()
```

```mermaid
traceDiagram
  title 2021 Figure 5 — two recursive stacks
  frame fib main
    ans: 2
    frame fib(3)
      num: 3
      ans1: 1
      ans2: 1
      ret 2 -> ans
      done
      frame fib(2)
        num: 2
        ans1: 1
        ans2: 0
        ret 1 -> ans1
        done
        frame fib(1)
          num: 1
          ret 1 -> ans1
          done
        end
        frame fib(0)
          num: 0
          ret 0 -> ans2
          done
        end
      end
      frame fib(1)
        num: 1
        ret 1 -> ans2
        done
      end
    end
  end
  frame fib_tail main
    ans: 2
    frame fib_tail(3)
      num: 3
      ret 2 -> ans
      done
      frame fib_tail_R
        num1: 0
        num2: 1
        count: 2
        temp: 1
        done
        frame fib_tail_R
          num1: 1
          num2: 1
          count: 1
          temp: 2
          done
          frame fib_tail_R
            num1: 1
            num2: 2
            count: 0
            ret 2 -> ans
            done
          end
        end
      end
    end
  end
```

### Figure 6: Block scope inside a function

The loop index lives in a nested scope while `total` and the list reference
remain in the function frame.

```java
public static int calcTot(List<int> numList) {
  int total=0;
  for (int i = 0; i <numList.size(); i++) {
    total += numList.get(i);
  }
  return total;
}

public static void main(String[] args) {
  List<int> nums = Arrays.asList(1, 2, 3));
  int sum= calcTot(nums);
}
```

```mermaid
traceDiagram
  title 2021 Figure 6 — block scope
  heap nums 0x182
    0: 1
    1: 2
    2: 3
  end
  frame main
    nums: @nums
    sum: 6
    frame calcTot
      numList: @nums
      total: 0, 1, 3, 6
      scope for
        i: 0, 1, 2, 3
        done
      end
      ret 6 -> sum
      done
    end
  end
```

### Figure 7: A linked list assembled on the heap

The final chain is `42 → 5 → 10 → 9`; `curr` records its walk to the end.

```cpp
LinkedList* myList = new LinkedList(5);
myList->setNext(new LinkedList(10));
LinkedList* another = new LinkedList(42);
another->setNext(myList);
myList->getNext()->setNext(new LinkedList(9));
LinkedList* curr = another;
while (curr != nullptr) {
  curr = curr->getNext();
}
```

```mermaid
traceDiagram
  title 2021 Figure 7 — linked nodes
  heap node42
    value: 42
    next -> node5
  end
  heap node5
    value: 5
    next -> node10
  end
  heap node10
    value: 10
    next -> node9
  end
  heap node9
    value: 9
    next: nullptr
  end
  frame main
    myList: @node5
    another: @node42
    curr: @node42, @node5, @node10, @node9, nullptr
  end
```

### Figure 8: Stack addresses beside heap addresses

Stack variable names include their sequential addresses; both heap pointers
refer to the separately addressed allocation. The source draws `stackPtr`
pointing to the stack cell at `0x20`; current `traceDiagram` syntax records that
relation as the text `&0x20` rather than drawing an arrow.

```cpp
int stackInt = 20;
int* stackPtr = &stackInt;
(*stackPtr)++;
int* heapInt = new int(30);
int* heapPtr = heapInt;
*heapPtr = (*heapPtr) + 10;
```

```mermaid
traceDiagram
  title 2021 Figure 8 — static and dynamic addresses
  heap dynamic-int 0x114
    value: 30, 40
  end
  frame main
    stackInt [0x20]: 20, 21
    stackPtr [0x24]: &0x20
    heapInt [0x28]: @dynamic-int
    heapPtr [0x32]: @dynamic-int
  end
```

### Figure 9: Pointer arithmetic and invalid locations

The pointer advances through an allocation, reaches the invalid address just
beyond it, and is finally cleared; the abandoned allocation remains visible as
a leak.

```cpp
int* heapArrayPtr = new int[2];
*heapArrayPtr = 1;
heapArrayPtr++;
*heapArrayPtr = 2;
heapArrayPtr++;
*heapArrayPtr = 12;
heapArrayPtr = nullptr;
```

```mermaid
traceDiagram
  title 2021 Figure 9 — pointer arithmetic
  heap allocation 0x216
    0x216: 1
    0x220: 2
  end
  frame main
    heapArrayPtr: 0x216, 0x220, 0x224, nullptr
    watch lost allocation: 0x216
    watch invalid write beyond allocation: 0x224 ← 12
  end
```

These reconstructions deliberately use only the current `traceDiagram`
vocabulary. Differences from the source drawings therefore expose useful next
extensions—most notably separate address/value columns and annotations—without
turning this gallery into a second syntax.
