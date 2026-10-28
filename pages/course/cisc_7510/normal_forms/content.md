# Normal Forms, as Data

Many treatments of database normalization focus on the schema. But in isolation, it's hard to get a feel or intuition for how changing the schema affects the data, or what to look for in data to make you think to apply normalizations in the first place. Here, we're going to look at data 

 Here the schema is secondary: one sample table of staffing data is carried through each form, and you watch the values move. Scroll, use the buttons, or press the arrow keys. Based on [Introduction to Normalization](https://theparticle.com/cs/bc/dbsys/norm.pdf).

## {#raw:Unnormalized}

One table with everything: lists in cells, nulls, repeated facts. Lists share a cell, Eli has nulls, and each department is typed out again for every employee.

## {#1nf-violates:Toward 1NF}

Atomic fields: no complex columns. Marked columns break the rule: {{columns}}.

## {#1nf-settled:1NF}

Every cell holds one value. Lists become rows. Row counts: {{rows}}.

## {#2nf-violates:Toward 2NF}

No partial dependencies: no duplicate records. Marked columns break the rule: {{columns}}.

## {#2nf-settled:2NF}

No non-key column depends on only part of the key. Row counts: {{rows}}.

## {#3nf-violates:Toward 3NF}

Attributes are facts about the key: no overlapping tuples. Marked columns break the rule: {{columns}}.

## {#3nf-settled:3NF}

No non-key column depends on another non-key column. Row counts: {{rows}}.

## {#coda-violates:Toward BCNF / 4NF}

No derivative data. Marked columns are independent lists: every skill repeats with every language for the same employee (a *multivalued dependency*, which 4NF removes).

## {#coda-settled:BCNF / 4NF}

Every determinant is a key, and independent lists are stored apart. Row counts: {{rows}}. Under the dependencies in this data, every determinant in these tables is a superkey, so BCNF already holds; the visible change is 4NF.

## {#post-violates:Toward Post BCNF}

Fold the lists back into the employee as one document column. Marked columns are the separate skill and language tables, which rejoin the employee.

## {#post-settled:Post BCNF}

Skills and languages return to Employees as a JSON column, trading the 4NF split for one fewer join. Row counts: {{rows}}. The JSON column is not atomic, so this deliberately gives up 1NF for read speed. The database no longer enforces the shape of the lists.
