## Prior Art

The ranking operation begins with one heterogeneous input document collection.
Distinct retrievers rank the documents eligible for them according to the
representations each document provides, and RRF consumes the resulting
intermediate rankings. Rank-fusion methods differ not only in how quickly rank
contributions decay, but also in what they do when the same document appears in
several but not all such rankings. A method can change the influence of a
retriever, reward agreement across rankings, or normalize a document's
accumulated score. These operations are not interchangeable. We therefore
separate the rank kernel from the treatment of coverage: `R_d` is the set of
retrieval rankings in which document `d` appears, and `n(d) = |R_d|` is its
ranking coverage.

For example, consider one input collection containing text and image
documents. Within this collection, a particular text document has lexical
tokens and a text embedding. One image document has lexical tokens derived from
descriptive tags as well as a multimodal embedding, while another image
document has only a multimodal embedding. BM25 ranks the token-bearing input
documents. A cosine-similarity retriever ranks the text-embedding-bearing
documents within the text-embedding space, and a separate cosine-similarity
retriever ranks the multimodal-embedding-bearing documents within the
multimodal-embedding space. Neither cosine retriever compares embeddings across
those spaces. The fusion step therefore receives three intermediate retrieval
rankings even though the entire operation began with one input document
collection. In the common case, a single collection yields overlapping,
representation-dependent rankings that contain different subsets of its
documents.

### Reciprocal-rank fusion and fixed weights

Reciprocal Rank Fusion (RRF) assigns a document the sum of reciprocal rank
contributions `sum_{i in R_d} 1/(k+r_i(d))` [@cormack2009]. It requires no
calibration between retrievers' score scales: after each retriever has produced
an intermediate ranking, only rank positions enter the fusion rule. At the same
time, every additional retrieval ranking in which `d` appears contributes
another positive term. The score therefore combines two signals: how highly
the document ranks and its ranking coverage.

Dividing the accumulated score by `n(d)` separates those signals in the
simplest possible way. The resulting quantity is the mean reciprocal-rank
contribution among retrieval rankings in which the document appears. We use
this *coverage division* as a paper-defined comparator, not as a canonical
variant of RRF, and we do not claim that the literature presents it as one.

Fixed per-retriever weights address a different problem. Weighted RRF replaces
each contribution with `w_i/(k+r_i(d))`; for example, Azure AI Search exposes a
query-time weight for individual vector queries [@azureVectorWeighting]. The
weight expresses the prior influence of retriever `i`. It remains fixed across
documents and is independent of the realized coverage `n(d)`, so weighting a
trusted retriever does not by itself normalize unequal document support.

### Rank-Biased Centroid

Rank-Biased Centroid (RBC) changes the rank kernel rather than adding a
coverage transformation. Bailey et al. describe RBC as using “a geometrically decaying weight function”
with depth distribution `(1-p) p^(x-1)` [@bailey2017]. In the notation of this
paper, the contribution at rank `r` is `(1-phi) phi^(r-1)`, and the fused score
sums that contribution over the retrieval rankings in which the document
appears.
`phi` controls rank persistence; it is not the document coverage count `n(d)`.
RBC can consequently accumulate support across several retrieval rankings, but
its geometric decay is neither a logarithm of coverage nor a normalization by
coverage.

### ISR, logISR, and logN ISR

Mourao et al.'s Inverse Square Rank (ISR) family combines ranking coverage
with a steeper rank-decay kernel [@mourao2014]. The fusion rule is
`ISR(d) = n(d) sum_{i in R_d} 1/r_i(d)^2`: each contributing rank
decays by its inverse square, and the resulting sum is multiplied by the
number of retrieval rankings containing the document. The logISR variant
replaces that linear frequency factor with
`logISR(d) = log(n(d)) sum_{i in R_d} 1/r_i(d)^2`.

That logarithm creates a sharp boundary at one ranking. Because `log(1)=0`, logISR assigns zero to every document that appears in only one retrieval
ranking, regardless of its rank. Such documents therefore require a secondary
tie-breaking rule; Mourao et al. used a deterministic shuffle. Their logN ISR
variant instead uses
`logN ISR(d) = log(n(d)+sigma) sum_{i in R_d} 1/r_i(d)^2`. It preserves a
positive score for a document seen in only one ranking whenever `sigma>0`.
The authors tested `sigma` over `[0,1]` and used `sigma=0.01` in their
experiments. They report that `sigma=1` compresses the distinction between low
and high ranking coverage, whereas `sigma=0.01` gives single-ranking documents
a small nonzero weight [@mourao2014].

These empirical observations are specific to Mourao et al.'s experiments,
which used two modality-specific rankings per multimodal query: one image-search
rank and one text-search rank. logISR performed poorly in those tasks; the
authors attributed this result to the method being unstable with few rankings
and collapsing all `n(d)=1` scores to zero. logN ISR was more balanced: it
marginally improved upon RRF for case retrieval, while RRF slightly led image
retrieval and logN ISR placed second [@mourao2014].

<!--
### Within-paper commentary: closest analogues and search boundary

The comparisons in this subsection are this paper's synthesis of the cited
methods, not names or claims introduced by those prior works.

The closest formula-level precedent found is logN ISR because it uses a shifted
logarithmic coverage factor. It nevertheless retains an inverse-square rank
kernel rather than standard RRF's `1/(k+r)` kernel, making it an analogue rather
than an instance of the proposed RRF transformation.

Two older methods clarify the boundary further. BM25 is adjacent only by analogy:
its logarithm is an inverse-document-frequency term defined over terms and a
corpus, not over retrievers that returned a candidate
[@robertson2009]. CombMNZ rewards agreement by multiplying a sum of individual
similarity scores by the number of nonzero scores [@fox1994]. It supplies a
count-based consensus reward, but it is neither reciprocal-rank fusion nor a
logarithmic transformation of coverage.

No confirmed prior publication using the standard-RRF kernel multiplied by a shifted logarithmic coverage factor was found in this targeted search.
This statement reports the outcome of the search; it does not establish that
no such publication exists or claim novelty by absence. The candidate
`RRF(d) log(n(d)+b)` is therefore presented as this paper's proposal, with
logN ISR and CombMNZ retained as relevant formula-level and conceptual
precedents. The choice of `b` is also not settled by prior art. At `n=1`,
`log(1+b)>0` for every `b>0`. At `n=0`, `log(b)` is negative for `0<b<1`, zero
for `b=1`, and positive for `b>1`. Any normative constraint on `b` is deferred
to the mathematical formulation.
-->