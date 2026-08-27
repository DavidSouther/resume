## Introduction & Prior Art

In the field of document search, ranked retrieval is assigning an to order
documents by their relevancy to a user's query. A variety of ranking
operations have been developed and deployed, each having varying controls
to tune and document types they best support. These include simple token
matching, BM25 normalized token matching, or various vector embedding models
using cosine similarity or distance. Many corpi have documents that are
amenable to retrieval using sevearl, but not necessarily all, of these
techniques. This leads to the ranked fusion family of algorithms, which
aim to combine multiple disparate retrievers into a single rank.

The ranking operation begins with one heterogeneous document collection and a user's query.
Distinct retrievers rank eligible documents based on their deifnition of relevancy to the users query.
Ranked fusion consumes the resulting intermediate rankings.
Ranked fusion methods differ not only in how quickly rank
contributions decay, but also in what they do when the same document appears in
several such rankings. A method can change the influence of a
retriever, reward agreement across rankings, or normalize a document's
accumulated score. These operations are not interchangeable. We therefore
separate the rank kernel from the treatment of coverage: $R_d$ is the set of
retrieval rankings in which document $d$ appears, and $n(d)=|R_d|$ is its
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

Reciprocal Rank Fusion (RRF) assigns a document the sum of reciprocal-rank
contributions $S_{\mathrm{RRF}}(d)=\sum_{i\in R_d}\frac{1}{k+r_i(d)}$
[@cormack2009]. It requires no calibration between retrievers' score scales:
after each retriever has produced an intermediate ranking, only rank positions
enter the fusion rule. At the same time, every additional retrieval ranking in
which $d$ appears contributes another positive term. The score therefore
combines two signals: how highly the document ranks and its ranking coverage.

Dividing the accumulated score by $n(d)$ separates those signals in the
simplest possible way. The resulting quantity is the mean reciprocal-rank
contribution among retrieval rankings in which the document appears. We use
this *coverage division* as a comparator, not as a canonical variant of RRF,
and do not claim that the literature presents it as one.

Fixed per-retriever weights address a different problem. Weighted RRF replaces
each contribution with $w_i/(k+r_i(d))$; for example, Azure AI Search exposes a
query-time weight for individual vector queries [@azureVectorWeighting]. The
weight expresses the prior influence of retriever $i$. It remains fixed across
documents and is independent of the realized coverage $n(d)$, so weighting a
trusted retriever does not by itself normalize unequal document support.

### Rank-Biased Centroid

Rank-Biased Centroid (RBC) changes the rank kernel rather than adding a
coverage transformation. Bailey et al. describe RBC as using "a geometrically
decaying weight function" with depth distribution
$(1-p)p^{x-1}$ [@bailey2017]. With persistence parameter $\phi$, the
contribution at rank $r$ is $(1-\phi)\phi^{r-1}$, and the fused score sums that
contribution over the retrieval rankings in which the document appears.
$\phi$ controls rank persistence; it is not the document coverage count
$n(d)$. RBC can consequently accumulate support across several retrieval
rankings, but its geometric decay is neither a logarithm of coverage nor a
normalization by coverage.

### ISR, logISR, and logN ISR

Mourao et al.'s Inverse Square Rank (ISR) family combines ranking coverage
with a steeper rank-decay kernel [@mourao2014]. Its fusion rule is
$S_{\mathrm{ISR}}(d)=n(d)\sum_{i\in R_d}\frac{1}{r_i(d)^2}$.

Each contributing rank decays by its inverse square, and the resulting sum is
multiplied by the number of retrieval rankings containing the document. The
logISR variant replaces that linear frequency factor with
$S_{\mathrm{logISR}}(d)=\ln(n(d))\sum_{i\in R_d}\frac{1}{r_i(d)^2}$.

That logarithm creates a sharp boundary at one ranking. Because $\ln(1)=0$,
logISR assigns zero to every document that appears in only one retrieval
ranking, regardless of its rank. Such documents therefore require a secondary
tie-breaking rule; Mourao et al. used a deterministic shuffle. Their logN ISR
variant instead uses
$S_{\mathrm{logNISR}}(d;\sigma)=\ln(n(d)+\sigma)\sum_{i\in R_d}\frac{1}{r_i(d)^2}$.

It preserves a positive score for a document seen in only one ranking whenever
$\sigma>0$. The authors tested $\sigma$ over $[0,1]$ and used $\sigma=0.01$ in
their experiments. They report that $\sigma=1$ compresses the distinction
between low and high ranking coverage, whereas $\sigma=0.01$ gives
single-ranking documents a small nonzero weight [@mourao2014].

These empirical observations are specific to Mourao et al.'s experiments,
which used two modality-specific rankings per multimodal query: one image-search
rank and one text-search rank. logISR performed poorly in those tasks; the
authors attributed this result to the method being unstable with few rankings
and collapsing all $n(d)=1$ scores to zero. logN ISR was more balanced: it
marginally improved upon RRF for case retrieval, while RRF slightly led image
retrieval and logN ISR placed second [@mourao2014].

The closest formula-level precedent is logN ISR because it applies shifted
logarithmic coverage to an inverse-square rank kernel. The logarithmic RRF
family instead applies that coverage factor to the standard RRF kernel as
$S_{\mathrm{log}}(d;b,B)=B S_{\mathrm{RRF}}(d)\ln(n(d)+b)$.

Here $b$ controls the coverage shape, while the common positive factor $B$
sets the score scale. The singleton-normalized default $b=1$ is
$S_1(d)=S_{\mathrm{RRF}}(d)\frac{\ln(n(d)+1)}{\ln 2}$.

This specialization preserves the ordinary RRF score at $n(d)=1$ while
retaining a concave coverage reward. Mathematical Formulation develops the
parameters and boundary behavior; the relevant provenance here is the
combination of RRF's rank kernel [@cormack2009] with logN ISR's shifted
logarithmic coverage factor [@mourao2014].

Two older methods further clarify the comparison boundary. BM25's logarithm is
an inverse-document-frequency term defined over terms and a corpus, not over
retrievers that returned a document [@robertson2009]. CombMNZ rewards agreement
by multiplying a sum of individual similarity scores by the number of nonzero
scores [@fox1994]. It supplies a count-based consensus reward, but it is neither
reciprocal-rank fusion nor a logarithmic transformation of ranking coverage.

<!--
### Within-paper commentary: closest analogues and search boundary

The closest formula-level precedent found is logN ISR because it uses a shifted
logarithmic coverage factor with an inverse-square rank kernel. The logarithmic RRF family
uses the standard RRF rank kernel instead as
$S_{\mathrm{log}}(d;b,B)=B S_{\mathrm{RRF}}(d)\ln(n(d)+b)$.

The singleton-normalized default at $b=1$ is
$S_1(d)=S_{\mathrm{RRF}}(d)\frac{\ln(n(d)+1)}{\ln 2}$.

BM25 remains adjacent only by analogy because its logarithm is an
inverse-document-frequency term [@robertson2009]. CombMNZ supplies a
count-based consensus reward, but is neither reciprocal-rank fusion nor a
logarithmic transformation of coverage [@fox1994]. No novelty claim follows
from this comparison.
-->
