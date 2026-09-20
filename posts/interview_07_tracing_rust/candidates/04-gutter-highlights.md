# Candidate D: Left-gutter highlighter bands

Candidate D removes Candidate C's symbol alphabet. Print the source, label one
narrow lane per binding or borrow in the **left-hand gutter**, and draw a
literal highlighter band from the line that introduces it through the final
in-scope source line before the closing brace. The source stays readable; extent and overlap live
beside it.

This is deliberately a **conservative lexical subset** of Rust, not a picture
of the compiler's exact non-lexical lifetimes (NLL). A **lexical binding scope**
runs from a `let` to its block's closing brace. A real **active loan** can end at
its reference's last relevant use, earlier than that brace. Candidate D ignores
that shortening: every borrow band reaches the final in-scope line before the closing brace, so it overstates
the real active loan and can report a conflict for a program that Rust accepts.
That simplification is the teaching experiment, not an implementation claim.

Give each variable a **different highlighter color** from a small accessible
palette. Its lane heading still names the binding, and the source at a band's
origin still contains `&` or `&mut`, so color reinforces identity but never
carries meaning alone. Geometry carries extent and overlap while the source
carries shared versus exclusive access. **Overlap alone is not an error:** shared loans may overlap. An
operation is rejected only when its source line crosses a band granting
**incompatible access**—for example, a move or owner write while any loan is
present, or a second mutable borrow while another lexical loan is present. A
rejected operation does not execute, so it starts no value, loan, or callee.

The HTML below is a browser facsimile of paper highlighting. Each
`lifetime-band` span renders as a translucent stroke, not as a glyph.

## Worked examples

### listing 2.2 — a plain lifetime

<div class="lifetime-gutter" style="--lanes: 1" role="group" aria-label="The art binding band runs from its let statement through the final source line before the closing brace.">
<div class="lifetime-labels"><span>art</span><span>source</span></div>
<pre><span class="lifetime-line"><span aria-hidden="true"></span><code>fn main() {</code></span>
<span class="lifetime-line"><span class="lifetime-band lifetime-start" aria-hidden="true"></span><code>    let art = artwork("Owain");</code></span>
<span class="lifetime-line"><span class="lifetime-band lifetime-end" aria-hidden="true"></span><code>    println!("{}", art.name);</code></span>
<span class="lifetime-line"><span aria-hidden="true"></span><code>}</code></span></pre>
</div>

### Copy example — two overlapping bindings

This is the added Copy listing. Both binding bands reach the final source line before the brace. Their
overlap is harmless because the source's plain `let b = a` copies an `i32` and
creates two independent values.

```rust
fn main() {
    let a: i32 = 7;
    let b = a;
    println!("{a} {b}");
}
```

<div class="lifetime-gutter" style="--lanes: 2" role="group" aria-label="The a and b binding bands overlap legally after the copy.">
<div class="lifetime-labels"><span>a</span><span>b</span><span>source</span></div>
<pre><span class="lifetime-line"><span aria-hidden="true"></span><span aria-hidden="true"></span><code>fn main() {</code></span>
<span class="lifetime-line"><span class="lifetime-band lifetime-start" aria-hidden="true"></span><span aria-hidden="true"></span><code>    let a: i32 = 7;</code></span>
<span class="lifetime-line"><span class="lifetime-band" aria-hidden="true"></span><span class="lifetime-band lifetime-start" aria-hidden="true"></span><code>    let b = a;</code></span>
<span class="lifetime-line"><span class="lifetime-band lifetime-end" aria-hidden="true"></span><span class="lifetime-band lifetime-end" aria-hidden="true"></span><code>    println!("{a} {b}");</code></span>
<span class="lifetime-line"><span aria-hidden="true"></span><span aria-hidden="true"></span><code>}</code></span></pre>
</div>

### listing 2.5 — move and use after move

The lexical `art1` band continues after the successful move because the name
remains in scope. Candidate D therefore does **not** diagnose use after move by
geometry alone; the source's move must still be tracked. This is an honest
failure of a scope-only notation, not a second transfer at runtime.

<div class="lifetime-gutter" style="--lanes: 1" role="group" aria-label="The art1 binding remains lexically in scope after its value moves, demonstrating that scope highlighting alone cannot diagnose use after move.">
<div class="lifetime-labels"><span>art1</span><span>source</span></div>
<pre><span class="lifetime-line"><span aria-hidden="true"></span><code>fn main() {</code></span>
<span class="lifetime-line"><span class="lifetime-band lifetime-start" aria-hidden="true"></span><code>    let art1 = artwork("Owain");</code></span>
<span class="lifetime-line"><span class="lifetime-band" aria-hidden="true"></span><code>    admire_owned(art1);</code></span>
<span class="lifetime-line lifetime-rejected"><span class="lifetime-band lifetime-end" aria-hidden="true"></span><code>    admire_owned(art1); // rejected: value already moved</code></span>
<span class="lifetime-line"><span aria-hidden="true"></span><code>}</code></span></pre>
</div>

### listing 2.9 — overlapping shared borrows

Both `&` origins are visible in the source. Their bands overlap through the
final source line before the closing brace, which is legal because shared loans may overlap.

<div class="lifetime-gutter" style="--lanes: 2" role="group" aria-label="Two shared borrow bands start at ampersand borrow expressions and overlap legally through the closing brace.">
<div class="lifetime-labels"><span>ref1</span><span>ref2</span><span>source</span></div>
<pre><span class="lifetime-line"><span aria-hidden="true"></span><span aria-hidden="true"></span><code>fn main() {</code></span>
<span class="lifetime-line"><span aria-hidden="true"></span><span aria-hidden="true"></span><code>    let art1 = artwork("Owain");</code></span>
<span class="lifetime-line"><span class="lifetime-band lifetime-start" aria-hidden="true"></span><span aria-hidden="true"></span><code>    let ref1 = &amp;art1;</code></span>
<span class="lifetime-line"><span class="lifetime-band" aria-hidden="true"></span><span class="lifetime-band lifetime-start" aria-hidden="true"></span><code>    let ref2 = &amp;art1;</code></span>
<span class="lifetime-line"><span class="lifetime-band" aria-hidden="true"></span><span class="lifetime-band" aria-hidden="true"></span><code>    admire_shared(ref1);</code></span>
<span class="lifetime-line"><span class="lifetime-band lifetime-end" aria-hidden="true"></span><span class="lifetime-band lifetime-end" aria-hidden="true"></span><code>    admire_shared(ref2);</code></span>
<span class="lifetime-line"><span aria-hidden="true"></span><span aria-hidden="true"></span><code>}</code></span></pre>
</div>

### listing 2.11 — non-overlapping mutable borrows

Candidate D uses explicit **inner blocks** around sequential mutable borrows.
Each `&mut` band reaches its own block's final source line before the closing brace, so the mutable borrow
bands do not overlap and both the lexical teaching rule and actual Rust agree.

<div class="lifetime-gutter" style="--lanes: 2" role="group" aria-label="Two mutable borrow bands occupy separate inner blocks and therefore do not overlap.">
<div class="lifetime-labels"><span>mref1</span><span>mref2</span><span>source</span></div>
<pre><span class="lifetime-line"><span aria-hidden="true"></span><span aria-hidden="true"></span><code>fn main() {</code></span>
<span class="lifetime-line"><span aria-hidden="true"></span><span aria-hidden="true"></span><code>    let mut art1 = artwork("Owain");</code></span>
<span class="lifetime-line"><span aria-hidden="true"></span><span aria-hidden="true"></span><code>    {</code></span>
<span class="lifetime-line"><span class="lifetime-band lifetime-start" aria-hidden="true"></span><span aria-hidden="true"></span><code>        let mref1 = &amp;mut art1;</code></span>
<span class="lifetime-line"><span class="lifetime-band lifetime-end" aria-hidden="true"></span><span aria-hidden="true"></span><code>        record_view(&amp;mut *mref1);</code></span>
<span class="lifetime-line"><span aria-hidden="true"></span><span aria-hidden="true"></span><code>    }</code></span>
<span class="lifetime-line"><span aria-hidden="true"></span><span aria-hidden="true"></span><code>    {</code></span>
<span class="lifetime-line"><span aria-hidden="true"></span><span class="lifetime-band lifetime-start" aria-hidden="true"></span><code>        let mref2 = &amp;mut art1;</code></span>
<span class="lifetime-line"><span aria-hidden="true"></span><span class="lifetime-band lifetime-end" aria-hidden="true"></span><code>        record_view(&amp;mut *mref2);</code></span>
<span class="lifetime-line"><span aria-hidden="true"></span><span aria-hidden="true"></span><code>    }</code></span>
<span class="lifetime-line"><span aria-hidden="true"></span><span aria-hidden="true"></span><code>}</code></span></pre>
</div>

The illegal contrast keeps a shared reference for a later use, then requests a
mutable borrow before that use. Actual Rust rejects the `requested_mut` line.
The second band is labelled **requested `&mut`** and is a **proof obligation**,
not an executed loan: it shows the extent the requested access would need if
accepted. It uses a different palette color from the shared band, while its
lane label and `&mut` source remain the meaning. Its overlap
with the shared band makes the conflict visible.

<div class="lifetime-gutter" style="--lanes: 2" role="group" aria-label="The shared borrow band overlaps a requested mutable-borrow proof-obligation band, so Rust rejects the requested mutable borrow; no second loan executes.">
<div class="lifetime-labels"><span>shared &amp;</span><span>requested &amp;mut</span><span>source</span></div>
<pre><span class="lifetime-line"><span aria-hidden="true"></span><span aria-hidden="true"></span><code>fn main() {</code></span>
<span class="lifetime-line"><span aria-hidden="true"></span><span aria-hidden="true"></span><code>    let mut art1 = artwork("Owain");</code></span>
<span class="lifetime-line"><span class="lifetime-band lifetime-start" aria-hidden="true"></span><span aria-hidden="true"></span><code>    let shared = &amp;art1;</code></span>
<span class="lifetime-line lifetime-rejected"><span class="lifetime-band" aria-hidden="true"></span><span class="lifetime-band lifetime-start" aria-hidden="true"></span><code>    let requested_mut = &amp;mut art1; // rejected: shared is still borrowed</code></span>
<span class="lifetime-line"><span class="lifetime-band lifetime-end" aria-hidden="true"></span><span class="lifetime-band lifetime-end" aria-hidden="true"></span><code>    println!("{}", shared.name);</code></span>
<span class="lifetime-line"><span aria-hidden="true"></span><span aria-hidden="true"></span><code>}</code></span></pre>
</div>

### listing 2.12 — a move rejected while borrowed

The attempted move row crosses the `borrowed` band. Its origin is `&art1`, so
the requested move is incompatible with that shared loan. The rejected
operation does not execute; ownership remains with `art1`.

<div class="lifetime-gutter" style="--lanes: 1" role="group" aria-label="A shared borrow band crosses the attempted move row, so the move is rejected.">
<div class="lifetime-labels"><span>borrowed</span><span>source</span></div>
<pre><span class="lifetime-line"><span aria-hidden="true"></span><code>fn main() {</code></span>
<span class="lifetime-line"><span aria-hidden="true"></span><code>    let art1 = artwork("Fire");</code></span>
<span class="lifetime-line"><span class="lifetime-band lifetime-start" aria-hidden="true"></span><code>    let borrowed = &amp;art1;</code></span>
<span class="lifetime-line lifetime-rejected"><span class="lifetime-band" aria-hidden="true"></span><code>    admire_owned(art1); // rejected: art1 is borrowed</code></span>
<span class="lifetime-line"><span class="lifetime-band lifetime-end" aria-hidden="true"></span><code>    println!("{}", borrowed.name);</code></span>
<span class="lifetime-line"><span aria-hidden="true"></span><code>}</code></span></pre>
</div>

### listing 2.13 — returning a reference to a local

The local `art` band ends on the return expression before the function's closing brace. A caller-selected
`'a` would require a reference band beyond that brace. The required region is
not contained within the referent's scope, so returning a reference is
rejected; the obligation band below is explanatory, not a runtime reference.

<div class="lifetime-gutter" style="--lanes: 2" role="group" aria-label="The caller-required reference would continue beyond the local art scope, so the return is rejected.">
<div class="lifetime-labels"><span>art</span><span>required 'a</span><span>source</span></div>
<pre><span class="lifetime-line"><span aria-hidden="true"></span><span aria-hidden="true"></span><code>fn build_art&lt;'a&gt;() -&gt; &amp;'a Artwork {</code></span>
<span class="lifetime-line"><span class="lifetime-band lifetime-start" aria-hidden="true"></span><span aria-hidden="true"></span><code>    let art = artwork("Liberty");</code></span>
<span class="lifetime-line lifetime-rejected"><span class="lifetime-band lifetime-end" aria-hidden="true"></span><span class="lifetime-band lifetime-start" aria-hidden="true"></span><code>    &amp;art // rejected return</code></span>
<span class="lifetime-line"><span aria-hidden="true"></span><span class="lifetime-band" aria-hidden="true"></span><code>}</code></span>
<span class="lifetime-line"><span aria-hidden="true"></span><span class="lifetime-band lifetime-end" aria-hidden="true"></span><code>caller would still require the reference here</code></span></pre>
</div>

## Draw order

Reserve a narrow lane, write the binding's name above it, place the highlighter
at its `let` or borrow, and pull straight down through the final source line
before that block's closing brace.
There is no lookahead for last use and no later annotation. Read `&` versus
`&mut` at the source line where the band begins, then compare the vertical
bands at any later move, read, write, or borrow.

This simplicity is exactly the trade: the drawing is mechanical, but the
borrow region is longer than Rust's precise NLL region. Code that needs an
early non-lexical loan end lies outside Candidate D's conservative lexical
subset. Adding an inner scope can make the intended non-overlap explicit.

## What this candidate tests

Candidate D asks whether learners can reason from spatial overlap without
memorizing lifetime symbols. They should be able to point to a row and say
“these `&` bands overlap legally,” “these `&mut` bands do not overlap,” or
“this operation crosses an incompatible borrow band.” The notation has not
been tested with learners.
