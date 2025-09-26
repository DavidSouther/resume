---
title: Whiteboarding Glossary
date: 2024-08-13
summary: This post is a glossary of common data structures, their properties, and the algorithms they use. It works best as a study guide - if you're comfortable with an item in the glossary, move on until you find one you're less familiar with. Then, spend time researching that!
---

### Data Structures & Algorithms Glossary

Part six of a series on [technical whiteboarding](https://davidsouther.com/blog/interview_01_whiteboard).

There are a lot of ways to do a successful whiteboard interview. To perform efficiently, it’s critical to recognize common DS\&A patterns and how to apply them to a problem at hand. In the forward/backward method, each line should correspond to one of these data structures, and each step from one line to the next should be applying one of its operations to get the second structure.

This glossary is best used as a study guide. For items that are familiar and comfortable, you’re good to go. For items that are unfamiliar, find practice questions on the internet to improve your understanding and increase your comfort with that item.

#### Concepts

While each data structure has its own specifics and details, they can all be generally understood by looking at these four details.

**Construction** How do you get an empty instance of the data structure? How do you get an instance initialized with known data?

**Modification** How do you add and remove items from the data structure? What are the algorithmic implications of modifying the instance?

**Access** How do you get one value out of the data structure? What is the algorithmic complexity of accessing one item?

**Traversal** How do you operate on all items of the data structure? How do you operate on all items to modify each one? How do you operate on all items to create a new data structure from some or all of those values?

#### Array

An array is a linear collection of items that can be accessed and modified in constant time, often all with the same type, but otherwise have no information about the relative position or details of the items. Changing the order of the items, or moving items around relative to one another, or growing the array to be able to handle more items, are all expensive operations. It is also expensive to find values inside the array, as each item must be examined individually.

**Indexing \[i\]**: Elements in an array are accessed by their index. Indices are between 0 and the length of the array minus one. Arrays are backed directly by contiguous computer memory. Accessing an array by a (valid) index returns a single value from the array in constant time.

**Length**: Arrays have a known maximum length. Arrays can only be accessed by index values less than the length. Some languages allow setting items beyond the length of the array, though this may have performance implications.

**Traversal**: Traversing an array looks at every item in the array a single time. All languages allow traversing the array by incrementing an index value from zero up to (but not including) the length of the array, with their for loop syntax. Some languages provide for each loops which allows accessing each item without needing to track the index. Unless the index is specifically necessary for the problem, prefer for each loops.

**Map**: The array map operation is a fundamental array operation that creates a new array by applying a function to every item in the source array, and using the return of that function in the new array.

**Filter**: The array filter operation is a fundamental array operation that creates a new array by applying a conditional function to every item in the source array, and only including those items for which the conditional function returns true.

**Reduce**: The array reduce operation is a fundamental array operation that creates a single value that combines every item in the source array. Reduce applies a function that takes a previous state and current value argument, and applies logic to return a new state that combines the previous state and current value.

**Sort**: The array sort operation takes a comparator function and results in an array with the items in sorted order. The comparator function takes two arguments, typically called self and other, and returns a number less than zero if self should be sorted earlier in the array than other, or returns a number greater than zero if self should appear later in the array than other. If it returns 0, the items are considered equal and their order is unchanged. Depending on the language, sort may change the original array, or it may leave the original array intact and return a new array.

#### Linked List

Linked Lists defines its items in terms of followers, or the next pointer. Adding items in the list immediately after a referenced item is inexpensive, which is desirable for situations where data is added and removed often. That makes linked lists especially useful for implementing Stacks and Queues.

**Nodes**: The links in a linked list are Node objects. A Node has a value, which contains the item itself, and a next property, which is either empty (meaning this is the end of the list) or another Node. While any Node can be considered a linked list in and of itself, a LinkedList class typically has a head property, which points to the first node of the list. It may also have a tail property, which points to the last node of the list.

**Insert (front)**: The insert operation on a LinkedList creates a new Node, with the current head as its next, and updates the head to point at the newly created Node.

**Insert (middle)**: The insert operation with a node of a LinkedList creates a new node from a current node. The new node’s next is the current node’s next, and the current node’s next is updated to be the new node.

**Append (end)**: The append operation on a LinkedList creates a new node at the end of the list. If there’s already a tail node, that node and tail will both point to the newly created node. If there were no nodes in the list, head and tail would both point to the newly created node.

**Remove**: Removing a node from a LinkedList requires pointing the prior node from the one to be deleted to the deleted nodes’ next. The prior node may be the Linked List’s head. The deleted node may be the end of the list.

**Traversal**: Traversing a linked list involves looking at all items in the list. Typically, traversing uses a while loop and a current node. The current variable starts at the head, advances by setting the variable to the next property, and continues until reaching the empty node past the end of the list.

#### Trees

**Root**: The root is the topmost node of a tree data structure. It is the starting point from which all other nodes in the tree are derived. The root node has no parent and serves as the unique entry point for accessing the tree.

**Children**: In a tree data structure, the children are the nodes directly connected to a parent node. Each node in the tree (except the root) has exactly one parent, and can have zero or more children. In a binary tree, each node can have at most two children, which are distinguished as left and right.

**Left**: The left child of a node in a binary tree is the node connected to the parent node’s left side. If a node does not have a left child, the left reference is considered empty or null.

**Right**: The right child of a node in a binary tree is the node connected to the parent node’s right side. If a node does not have a right child, the right reference is considered empty or null.

**Height**: The height of a tree is the length of the longest path from the root node to a leaf node. It is a measure of the tree’s depth. In an empty tree, the height is considered to be \-1, while a tree with only a root node has a height of 0\.

**Leaf nodes**: Leaf nodes, also known as terminal nodes or external nodes, are nodes in a tree data structure that do not have any children. These nodes represent the endpoints of the tree structure and have a height of 0\.

**Depth**: The depth of a tree is a measure of the maximum number of edges or levels in the longest path from the root node to a leaf node. In other words, it is the same as the tree’s height. The depth of an empty tree is considered to be \-1, while a tree with only a root node has a depth of 0\. The depth of the tree is often used to assess the complexity and performance of tree-based algorithms, as it can impact the time and space requirements for traversing and processing the tree.

#### Binary Tree

A binary tree is a tree data structure where each node has at most two children, which are distinguished as left and right. The binary tree is a simple and widely-used structure that can be utilized for various applications, such as searching, sorting, and implementing data storage.

**Creating nodes**: A node in a binary tree has three attributes: value, left, and right. The ‘value’ attribute stores the data associated with the node. The ‘left’ and ‘right’ attributes are references to the left and right children of the node, respectively. If a node does not have a left or right child, the respective reference is considered empty or null.

##### Traversals:

**Depth First Pre-order**: In a pre-order traversal, the nodes of a binary tree are visited in the following order: root, left subtree, and right subtree. This traversal is performed recursively, meaning that the entire left subtree is processed before moving on to the right subtree.

**Depth First Post-order**: In a post-order traversal, the nodes of a binary tree are visited in the following order: left subtree, right subtree, and root. This traversal is also performed recursively, visiting the left and right subtrees before processing the root node.

**Depth First In-order**: In an in-order traversal, the nodes of a binary tree are visited in the following order: left subtree, root, and right subtree. This traversal is performed recursively and, in the case of a binary search tree, results in the nodes being visited in a sorted order.

**Level order/Breadth-first**: In a level order or breadth-first traversal, the nodes of a binary tree are visited level by level, from left to right. This traversal is performed iteratively, typically using a queue data structure to maintain the order of nodes to be visited.

**Balanced binary tree**: A balanced binary tree is a binary tree in which the height of the left and right subtrees of every node differs by at most one. This property ensures that the tree remains approximately balanced, minimizing its height and optimizing its performance for operations like searching, insertion, and deletion.

* **Full binary tree**: A full binary tree is a binary tree in which every level, except possibly the last, is completely filled, and all nodes are as far left as possible. In other words, every node in a full binary tree has either zero or two children.

* **Perfect binary tree**: A perfect binary tree is a binary tree in which all interior nodes have exactly two children, and all leaf nodes are at the same depth or level. In a perfect binary tree, every level is completely filled.

**Binary Search Tree (BST)**: A binary search tree is a binary tree with the additional property that the value of each node is greater than or equal to the values of all nodes in its left subtree, and less than or equal to the values of all nodes in its right subtree. This property ensures that the tree is ordered, allowing for efficient search, insertion, and deletion operations.

**Balanced Binary Search Tree**: A balanced binary search tree is a binary search tree that is also a balanced binary tree. This means that the height difference between the left and right subtrees of every node is at most one. Balanced binary search trees provide optimal performance for search, insertion, and deletion operations, as their height is minimized, ensuring that these operations have a logarithmic time complexity. Examples of balanced binary search trees include AVL trees and Red-Black trees.

#### Other Trees

**N-ary Tree**: An N-ary tree is a tree data structure where each node can have an arbitrary number of children, organized in an ordered way. N-ary trees generalize the concept of binary trees and are used in various applications, such as representing hierarchical relationships or organizing data in a more flexible manner.

**K-ary Tree**: A K-ary tree is a tree data structure in which each node has a fixed number (K) of children. K-ary trees are a specific type of N-ary trees, with the number of children per node being constant throughout the tree. Examples of K-ary trees include binary trees (K=2) and ternary trees (K=3).

**Node**: A node in an N-ary or K-ary tree has two attributes: value and children. The ‘value’ attribute stores the data associated with the node. The ‘children’ attribute is a list, array, or other iterable container that holds references to the child nodes of the current node in an ordered manner. The length of the ‘children’ container determines the number of children a node has.

**Depth-first traversal**: Depth-first traversal in an N-ary or K-ary tree is a way of visiting nodes by exploring as deep as possible into a subtree before backtracking. Depth-first traversal can be further divided into pre-order, post-order, and other depth-first traversal schemes that specify the order in which the root and its children are visited. Depth-first traversal can be implemented recursively or with an explicit stack data structure.

* **Pre-order traversal**: In a pre-order traversal for an N-ary or K-ary tree, the nodes are visited in the following order: root, and then each of its children in order, recursively applying the pre-order traversal to each child’s subtree. This traversal is performed recursively, processing the root node before visiting its children.

* **Post-order traversal**: In a post-order traversal for an N-ary or K-ary tree, the nodes are visited in the following order: each child of the root node in order, recursively applying the post-order traversal to each child’s subtree, and finally the root itself. This traversal is performed recursively, visiting the children of a node before processing the node itself.

**Breadth-first traversal**: Breadth-first traversal in an N-ary or K-ary tree is a way of visiting nodes by exploring each level of the tree before moving on to the next level. This traversal visits nodes in a horizontal manner, starting from the root and moving left to right for each level. Breadth-first traversal is typically implemented using a queue data structure to maintain the order of nodes to be visited.

#### Map & Set

Map: A map, also known as a dictionary, associative array, or hash table, is a data structure that stores a collection of key-value pairs, where each key is associated with a single value. Maps allow for efficient retrieval, insertion, and deletion of values based on their corresponding keys, making them useful in various applications, such as caching, storing configuration settings, and implementing symbol tables in compilers. Do not confuse the Map data structure with the array map operation.

**Set**: A set is a data structure that represents a collection of distinct elements, without any specific order or duplicates. Sets are often used to store unique elements or to perform operations such as union, intersection, and difference on collections of items. Do not confuse the Set data structure with the Map’s set operation.

**Set/Put**: The set or put operation is used to add a new key-value pair to a map or insert a new element into a set. In a map, if the key already exists, the associated value is updated; otherwise, a new key-value pair is added. In a set, if the element already exists, it is not added again, ensuring that the set contains only unique elements. Set is typically used with maps, while put is with sets. They are sometimes called add or insert.

**Get**: The get operation is used to retrieve the value associated with a specific key in a map. If the key is not present in the map, the operation typically returns a default value or an indication that the key was not found. In the context of a set, the get operation is usually not applicable, as sets do not store key-value pairs.

**Has**: The has operation checks if a given key is present in a map or if an element is a member of a set. The operation returns a boolean value, indicating whether the key or element was found.

**Key-value pair:** A key-value pair is a combination of a unique key and its associated value. In a map, each entry consists of a key-value pair, with the key serving as an identifier for the corresponding value. The key is used to look up the value when needed, allowing for efficient retrieval of data.

**Hashing**: Hashing is a technique used to convert a given key or element into a fixed-size integer, which can then be used to determine the position of the key-value pair in a map or the element in a set. A good hash function distributes keys or elements uniformly across the underlying data structure, minimizing collisions and ensuring efficient performance for insertion, deletion, and retrieval operations.

**Big O implications**: Maps and sets are often used in situations where their O(1) average-case time complexity for insertion, deletion, and retrieval operations is desirable. This efficiency is particularly useful when working with large datasets or when frequent lookups and updates are required. By using maps and sets, the performance of algorithms can be significantly improved, as opposed to using data structures with higher time complexity, such as arrays or linked lists, which may require O(n) time for these operations.

#### Stacks & Queues

**Stack**: A stack is a linear data structure that follows the Last In, First Out (LIFO) principle, meaning that the last element added to the stack is the first one to be removed. It is commonly used in depth-first traversal algorithms and function call execution.

**LIFO**: LIFO stands for “Last In, First Out” and refers to the ordering principle used by stacks. In this ordering, the most recently added element is the first to be removed, while the least recently added element is the last to be removed. This principle enables depth-first traversal in algorithms and efficient handling of nested function calls in programming languages.

**Push**: The push operation is used to add an element to the top of the stack. When an element is pushed onto the stack, it becomes the new top element, and all other elements are pushed down by one position.

**Pop**: The pop operation is used to remove the top element from the stack. When an element is popped from the stack, it is removed from the top, and the element below it becomes the new top element. When implemented with a linked list, The time complexity of this operation is generally constant time, O(1).

**Queue**: A queue is a linear data structure that follows the First In, First Out (FIFO) principle, meaning that the first element added to the queue is the first one to be removed. It is commonly used in breadth-first traversal algorithms and managing processes in operating systems.

**FIFO**: FIFO stands for “First In, First Out” and refers to the ordering principle used by queues. In this ordering, the least recently added element is the first to be removed, while the most recently added element is the last to be removed. This principle enables breadth-first traversal in algorithms and fair scheduling of tasks in operating systems.

**Enqueue**: The enqueue operation is used to add an element to the end of the queue. When an element is enqueued, it becomes the new last element in the queue, and all other elements maintain their order. When implemented with a linked list, the time complexity of this operation is generally constant time, O(1).

**Dequeue**: The dequeue operation is used to remove the front element from the queue. When an element is dequeued, it is removed from the front of the queue, and the element immediately behind it becomes the new front element. When implemented with a linked list, time complexity of this operation is constant time, O(1).

**Linked Lists**: When implemented with a linked list, the time complexity of these operations are constant time, O(1).

#### Recursion

Recursion is a programming technique where a function calls itself in order to solve a problem by breaking it down into smaller instances of the same problem. Recursive solutions typically consist of a base case, one or more recursive cases, and function logic that guides the process.

**Base Case**: The base case is the simplest form of the problem that can be solved directly without any further recursion. It serves as the stopping condition for the recursive function. When the function encounters a base case, it returns a result immediately, without making any more recursive calls.

* for a *Linked List* the base case is typically encountered when the current node being processed is null or empty. This indicates that the end of the list has been reached, and no further recursive calls are needed.

* for a *Binary Tree* the base case is usually encountered when the current node being processed is null or empty. This indicates that the end of a branch has been reached, and no further recursive calls are necessary.

* for a *General Tree* the base case is typically encountered when the current node being processed is null, empty, or has no child nodes. This indicates that the end of a branch has been reached, and no further recursive calls are needed.

The base case for linked lists, binary trees, and general trees is essential for ensuring that the recursive function converges to a solution and preventing infinite loops, as it stops traversal beyond the leaves of the tree or the end of the list.

**Recursive Case**: The recursive case is the part of the function where the function calls itself with a modified input, usually a smaller or simpler version of the original problem. The recursive case is responsible for breaking down the problem into smaller instances, eventually reaching the base case.

**Function Logic**: Function logic refers to the algorithm or set of rules that the recursive function follows to combine the results from recursive calls, ultimately producing the final solution to the problem. This logic is crucial for ensuring that the recursion converges to a solution and does not result in an infinite loop.

**Tail Recursion**: Tail recursion is a special form of recursion where the recursive call is the last operation performed by the function, with no further computation or processing needed after the call returns. Tail recursion can be optimized by compilers or interpreters to reduce the amount of stack space used, effectively transforming the recursion into an iterative process, which can improve performance and prevent stack overflow errors.

**Recursive Helper Function**: A recursive helper function is an auxiliary function used to facilitate recursion, often by adding extra parameters or managing additional state that is required for the main recursive function. Helper functions can simplify the main function’s logic, manage specific edge cases, or encapsulate functionality that is specific to the recursive process.

`def max_depth(root):`  
    `return max_depth_helper(root, 0)`  
`def max_depth_helper(node, depth):`  
    `if node is None:`  
        `return depth`  
    `left_depth = max_depth_helper(node.left, depth + 1)`  
    `right_depth = max_depth_helper(node.right, depth + 1)`  
    `return max(left_depth, right_depth)`

In this example, the helper function is the recursive helper function that simplifies the main max\_depth function’s logic. The helper function takes two parameters: the current node being processed and the current depth of the tree. It then recursively computes the depth of the left and right subtrees and returns the maximum depth.

#### Graphs

A graph is a data structure that represents a collection of objects (nodes) and the relationships (edges) between them. Graphs can be used to model a wide variety of real-world scenarios and problems, such as social networks, transportation systems, or computer networks. Graphs can be directed (edges have a specific direction) or undirected (edges have no direction), and edges can be weighted (with associated values) or unweighted. Graph algorithms, such as Breadth First Search and Depth First Search, can be used to traverse, analyze, and solve problems on graphs.

**Nodes**: Nodes in a graph represent individual items, often with a unique identifier. These items are the primary components of a graph and are connected by edges.

**Edges {value, from, to}**: Edges in a graph are the connections between nodes. They can be directed or undirected, and may have a value associated with them, representing weights, distances, or other attributes. Each edge has a from node and a to node, defining the relationship between the connected nodes.

**Directed vs Undirected**: A directed graph (also called a “digraph”) is a graph where edges have a specific direction, connecting a from node to a to node. In contrast, an undirected graph has no direction associated with its edges, meaning that connections between nodes are bidirectional.

**Adjacent**: Nodes in a graph are considered adjacent if there is an edge directly connecting them. In a directed graph, adjacency is determined by the direction of the edge, while in an undirected graph, adjacency is determined by the mere presence of an edge between two nodes.

**Neighbors**: Neighbors are nodes in a graph that are directly connected to a given node by an edge. In a directed graph, neighbors may be outgoing (connected by an edge pointing away from the node) or incoming (connected by an edge pointing toward the node).

**Path**: A path in a graph is a list of nodes and edges that connects two nodes. The length of a path is typically calculated as the number of edges it traverses or, in a weighted graph, the sum of the weights of the traversed edges. A shortest path is a path with the minimum possible length between two nodes.

**Breadth First Traversal (BFT)**: is a traversal algorithm that explores all the neighbors of a visited node before moving on to “downstream” neighbors. BFS starts at a source node and visits all its neighbors before exploring the neighbors of those neighbors. BFT can be used to find the shortest path between two nodes in an unweighted graph. The nodes to visit in a BFT are tracked with a queue.

**Depth First Traversal (DFT)**: is a graph traversal algorithm that explores as far as possible along a branch before backtracking. Starting from a source node, DFT visits a node and then recursively visits its unvisited neighbors. DFS can be used to detect cycles, find connected components, or traverse the graph in a specific order. The nodes to visit in a DFT are tracked with a stack.

##### BFT & DFT Algorithm

    Create an empty queue Q (or stack S)
    Enqueue (or push) the source node to Q (or S).
    Create an empty set Visited and add the source node to Visited.
    While Q (or S) is not empty:
        Dequeue (or pop) a node N from Q (or S).
        Process or print the node N.
        For each neighbor M of node N:
            If M is not in Visited:`
                Add M to Visited.
                Enqueue (or push) M to the end of Q (or S).