# Normal Forms, as Data

Many treatments of database normalization focus on the schema. But, it's hard to get a feel or intuition for how changing the schema affects the data, or even what to look for in data to make you think to apply normalizations in the first place. Here, we're going to look at a small representative dataset. This is typical of what a non-IT or programmer might prepare, which programmers then need to build out into a full data model.

Scroll down to see how the data changes across several normalization steps. Scroll, use the buttons, or press the arrow keys. Based on [Introduction to Normalization](https://theparticle.com/cs/bc/dbsys/norm.pdf).

## {#raw:Unnormalized}

This first table looks pretty straightforward. It's concise, but would be difficult to update any row safely. How many hours did people work on the Zephyr project? What if Operations moves to Staten Island? Who can we add to a JavaScript project?

## {#1nf-violates:Toward 1NF}

The rule for First Normal Form is "No Complex Columns". We're going to find each column that has complex values. `skills` and `languages` both have complex columns, because they have mulitple values of the same type. `projects` also has multiple entries, but also each entry inside the column has multiple parts - the project ID, the project codename, and the amount of time spent on the project!

To get to 1NF, we want Atomic fields, so each cell has one and only one value. We get to 1NF by adding _columns_ to the table.

## {#1nf-settled:1NF}

Every cell holds one value. Lists become rows. Row counts: {{rows}}. But to get here, we did have to duplicate quite a few values...

## {#2nf-violates:Toward 2NF}

Second normal form means no duplicate records for the same primary key. After going from 1NF to 2NF, we duplicated quite a lot of data! Ana went from one row to eight! (Three records had two values each, so we added one row for each entry of that three way cross product!)

To get to 2NF, we want to replace any duplicated data with new tables, extracting those columns to undo the duplication introduced leaving 1NF.

## {#2nf-settled:2NF}

Now, the duplication in Ana's record got undone and spread into new tables. The employees table is back to five rows (the five employees); the projets are pulled into their own table using their ID as the primary key; and a join table "Assignments" now has a complex key (employee and project ids), along with an attribute column for the hours per project. (EmployeeSkillLanguage is still a bit ugly, because there's no primary key for this concept. Stay tuned.)

## {#3nf-violates:Toward 3NF}

From 1nf to 2nf, we removed duplication within a primary key. To get from 2nf to 3nf, we're going to remove duplication _across_ primary keys. Formally, the principle is that attributes are facts about the key. In practice, this means in data there's no overlapping tuples.

In our data, EmployeeDetails `dept_name` and `office` columns have this duplication. EmployeeSkillLanguage _looks_ like it has this duplication, but that column doesn't have a key, so the attributes can't be facts about "a key". (Stay tuned.) For now, we're going to again add a new table to handle this duplication.

## {#3nf-settled:3NF}

Here we've extracted the departments out, and now (except for EmployeeSkillLanguage), the data is nice and clean and every piece of data has a single logical and actual point of ownership.

## {#coda-violates:Toward BCNF / 4NF}

Marked columns are independent lists: every skill repeats with every language for the same employee is a *multivalued dependency*, which 4NF removes by adding yet more tables.

## {#coda-settled:BCNF / 4NF}

Every determinant is a key, and independent lists are stored apart. Row counts: {{rows}}. Under the dependencies in this data, every determinant in these tables is a superkey, so BCNF already holds; the visible change is 4NF.

## {#post-violates:Toward Post BCNF}

But now, we're back to a 3NF violation, since the data is duplicated across assignments... do we need a Skill table and a Language table and a SkillAssignment table and a LanguageAssignment table!?

Until the mid 2010s, the answer was "yep." However, our application isn't about tracking skills, our application is for tracking projects! This is just interesting additional data, but it's not critical to our program. It would be nice if we had an easier way to handle this...

## {#post-settled:Post BCNF}

Fold the lists back into the employee as one document column! Marked columns are the separate skill and language tables, which rejoin the employee.

Skills and languages return to Employees as a JSON column, trading the 4NF split for one fewer join. Row counts: {{rows}}. The JSON column is not atomic, so this deliberately gives up 1NF for read speed. Certain databases can enforce the schema on write, and most databases can index into JSON so we can still have fast answers for "which employee knows Excel and speaks Hindi?"
