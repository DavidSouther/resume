---
prompt: |
  <page name="llm">
  Introduction

  Large-language models (LLMs) have gained tons of popularity lately with the releases of ChatGPT, GPT-4, Bard, and more. All these LLMs are based on the transformer neural network architecture. The transformer architecture was first introduced in the paper "Attention is All You Need" by Google Brain in 2017. LLMs/GPT models use a variant of this architecture called de' decoder-only transformer'.

  The most popular variety of transformers are currently these GPT models. The only purpose of these models is to receive a prompt (an input) and predict the next token/word that comes after this input. Nothing more, nothing less.

  Note: Not all large-language models use a transformer architecture. However, models such as GPT-3, ChatGPT, GPT-4 & LaMDa use the (decoder-only) transformer architecture.

  Overview of the (decoder-only) Transformer model

  It is key first to understand the input and output of a transformer:

  The input is a prompt (often referred to as context) fed into the transformer as a whole. There is no recurrence.
  The output depends on the goal of the model. For GPT models, the output is a probability distribution of the next token/word that comes after the prompt. It outputs one prediction for the complete input.
  Next, it is essential to understand the key components that make up the decoder-only transformer architecture:

  The embedding: the input of the transformer model is a prompt. This prompt needs to be embedded into something that the model can use.
  The block(s): This is the main source of complexity. Each block contains a masked multi-head attention submodule, a feedforward network, and several layer normalization operations. Blocks are put in sequence to make the model deeper.
  The output: the output of the last block is fed through one more linear layer to obtain the final output of the model (a classification, a next word/token etc.)
  The following visualization gives an overview of the transformer architecture.

  Overview of transformer architecture

  Self-Attention Mechanism

  Self-attention makes the transformer powerful. The intuition of self-attention is that the mechanism allows the model to focus on (attend to) the most relevant parts of the input. A single self-attention mechanism is called a head.

  The head works as follows. First, the input is fed into three separate linear layers. Two of those (the queries Q and the keys K) are multiplied, scaled, and turned into a probability distribution using a softmax activation function. Think of this probability distribution as describing which indices matter most for the output (i.e. which words in the prompt matter for the next word to be predicted). Finally, the output is multiplied with values V. This thus gives V * the importance of each of the tokens in V. A key observation is that the learnable parameters in the head are the three linear layers.

  The following figure gives an overview of the operations done in a head and an overview of how multi-head attention works.

  Overview of attention mechanism

  Multi-Head Attention

  Multi-head attention is nothing more than several individual heads stacked on top of one another. The input to all heads is equivalent. However, each head has its own weights. After forwarding the input through all the heads, the output of the heads is concatenated and passed through a linear layer which brings the dimensionality back to the dimension of the initial input.

  Masked Self-Attention

  In the decoder-only transformer, masked self-attention is nothing more than sequence padding. The 'masking' term is a left-over of the original encoder-decoder transformer module in which the encoder could see the whole (original language) sentence, and the decoder could only see the first part of the sentence which was already translated. As such, they called it 'masking'.

  Block

  Each block contains a multi-head attention submodule, a feedforward network, 2 layer-normalization operations, and 2 skip connections.

  The feedforward network is simply a multi-layer perceptron. In the original paper, the proposed feedforward module consisted of (1) a fully connected layer; (2) a ReLU activation; (3) another fully connected layer; and (4) a dropout layer.

  The 'add & norm' blocks get the output from the multi-head attention/feedforward submodule and add it to the input into those modules. After that, a layer normalization operation is performed. Adding the input and output of a submodule together is known as a skip-connection. As blocks can be put in sequence, the skip connections help tremendously reduce the problem of vanishing or exploding gradients. In other words, skip connections are necessary to ensure proper backpropagation of the gradients.

  Positional Embedding

  Transformers take in a complete prompt at once (in contrast to RNNs) and embed this as one big Tensor. As such, transformers do not know which word is at what position in the sentence. This is problematic as the following two sentences mean entirely different things, only dependent on the order of the words:

  The boy chased the bird with a butterfly net.
  The bird chased the boy with a butterfly net.
  To that end, a positional embedding is added to allow the model to deduce which word is where. Positional embeddings can be learned using any embedding layer from your favourite AI library. However, the original authors proposed a much more complicated method, which does not require learning any parameters. Please find an elaborate explanation (not mine) on the original positional embedding here.

  Output

  After the prompt is forwarded through all the blocks sequentially, the output is forwarded through one final linear layer. This final linear layer maps the output of the model back to the size of the 'vocabulary'. I.e. if you want to predict the next letter in a message, it would map to 26 (letters) + additional stuff (such as .,-!? etc.).

  The output of the model is a probability distribution. For GPT models, the output is the probability of each token being the next token in the sequence.

  Training

  Basic training

  The basic training process consists of self-supervised learning. Simply put, you gather lots of text, strip the last word from that text, feed it as input into the transformer, check if the prediction matches the word you cut off and backpropagate the error.

  Every text/sentence/book/webpage can be separated into several samples.

  sample = [
      ["This"],
      ["This", "is"],
      ["This", "is", "a"]] # padding is added until the max-sequence length is reached.
  targets = ["is", "a", "sample"]
  Fine-tuning / transfer-learning

  After the first stage of training is completed, the model is now a large-language model. As in, it can predict the next word based on a context. However, through fine-tuning/transfer-learning the model can be adapted to better suit the needs of the final application.

  One of the key reasons why ChatGPT & GPT-4 seem so ridiculously impressive is because of this second stage of training. In this stage, the following process is executed many times:

  The model is given a prompt and generates different answers
  The different answers are ranked by a human from best to worst.
  The scores of the different answers are backpropagated.
  However, transformer models can also be used for different tasks than language generation. They can, for example, be used for sentiment analysis. After doing the basic training, a transformer can be fine-tuned for sentiment analysis by removing the outgoing linear layer and replacing it with a different layer suitable for the task to be executed. Consequently, it can be trained in a supervised fashion on a custom (sentiment analysis) dataset.

  Inference (answer generation)

  Doing inference with a transformer is just like training. You insert a prompt and out comes the next word/classification/other.

  For GPT models, this means that the prompt is extended one word at a time. You insert the prompt, and out comes the first word of the answer. The first word of the answer is now added to the prompt, creating a new, slightly different prompt. This prompt is again forwarded through the model, giving the prediction of a new word.

  As the output is the probability for each token to be the next one, you can do several things during inference. For one, you can sample from the probability distribution. This induces some randomness into the algorithm. You can also take the token that has the highest probability; then, the model becomes deterministic.

  How can a transformer do X?

  The transformer can do X because it has seen enough examples of similar sentences in its training to give a satisfactory output to your prompt. However, for the question 'Why can a transformer not do X?' the answers are vastly more diverse.
  </page>

  <page name="homomorphism">
  In algebra, a homomorphism is a structure-preserving map between two algebraic structures of the same type (such as two groups, two rings, or two vector spaces). The word homomorphism comes from the Ancient Greek language: ὁμός (homos) meaning "same" and μορφή (morphe) meaning "form" or "shape". However, the word was apparently introduced to mathematics due to a (mis)translation of German ähnlich meaning "similar" to ὁμός meaning "same".[1] The term "homomorphism" appeared as early as 1892, when it was attributed to the German mathematician Felix Klein (1849–1925).[2]
  Homomorphisms of vector spaces are also called linear maps, and their study is the subject of linear algebra.
  The concept of homomorphism has been generalized, under the name of morphism, to many other structures that either do not have an underlying set, or are not algebraic. This generalization is the starting point of category theory.
  A homomorphism may also be an isomorphism, an endomorphism, an automorphism, etc. (see below). Each of those can be defined in a way that may be generalized to any class of morphisms.
  Definition
  A homomorphism is a map between two algebraic structures of the same type (that is of the same name), that preserves the operations of the structures. This means a map 
  f : A → B {\displaystyle f:A\to B} between two sets A {\displaystyle A}, B {\displaystyle B} equipped with the same structure such that, if ⋅ {\displaystyle \cdot } is an operation of the structure (supposed here, for simplification, to be a binary operation), then f ( x ⋅ y) = f ( x) ⋅ f ( y) {\displaystyle f(x\cdot y)=f(x)\cdot f(y)} for every pair x {\displaystyle x}, y {\displaystyle y} of elements of A {\displaystyle A}.[note 1] One says often that f {\displaystyle f} preserves the operation or is compatible with the operation.
  Formally, a map f : A → B {\displaystyle f:A\to B} preserves an operation μ {\displaystyle \mu } of arity k {\displaystyle k}, defined on both A {\displaystyle A} and B {\displaystyle B} if f ( μ A ( a 1 , … , a k)) = μ B ( f ( a 1) , … , f ( a k)) , {\displaystyle f(\mu _{A}(a_{1},\ldots ,a_{k}))=\mu _{B}(f(a_{1}),\ldots ,f(a_{k})),} for all elements a 1 , .  .  .  , a k {\displaystyle a_{1},...,a_{k}} in A {\displaystyle A}.
  The operations that must be preserved by a homomorphism include 0-ary operations, that is the constants. In particular, when an identity element is required by the type of structure, the identity element of the first structure must be mapped to the corresponding identity element of the second structure.
  For example:
  A semigroup homomorphism is a map between semigroups that preserves the semigroup operation.
  A monoid homomorphism is a map between monoids that preserves the monoid operation and maps the identity element of the first monoid to that of the second monoid (the identity element is a 0-ary operation).
  A group homomorphism is a map between groups that preserves the group operation. This implies that the group homomorphism maps the identity element of the first group to the identity element of the second group, and maps the inverse of an element of the first group to the inverse of the image of this element. Thus a semigroup homomorphism between groups is necessarily a group homomorphism.
  A ring homomorphism is a map between rings that preserves the ring addition, the ring multiplication, and the multiplicative identity. Whether the multiplicative identity is to be preserved depends upon the definition of ring in use. If the multiplicative identity is not preserved, one has a rng homomorphism.
  A linear map is a homomorphism of vector spaces; that is, a group homomorphism between vector spaces that preserves the abelian group structure and scalar multiplication.
  A module homomorphism, also called a linear map between modules, is defined similarly.
  An algebra homomorphism is a map that preserves the algebra operations.
  An algebraic structure may have more than one operation, and a homomorphism is required to preserve each operation. Thus a map that preserves only some of the operations is not a homomorphism of the structure, but only a homomorphism of the substructure obtained by considering only the preserved operations. For example, a map between monoids that preserves the monoid operation and not the identity element, is not a monoid homomorphism, but only a semigroup homomorphism.
  The notation for the operations does not need to be the same in the source and the target of a homomorphism. For example, the real numbers form a group for addition, and the positive real numbers form a group for multiplication. The exponential function x ↦ e x {\displaystyle x\mapsto e^{x}} satisfies e x + y = e x e y , {\displaystyle e^{x+y}=e^{x}e^{y},}
  and is thus a homomorphism between these two groups. It is even an isomorphism (see below), as its inverse function, the natural logarithm, satisfies ln ⁡ ( x y) = ln ⁡ ( x) + ln ⁡ ( y) , {\displaystyle \ln(xy)=\ln(x)+\ln(y),} and is also a group homomorphism.
  Examples

  Monoid homomorphism 
  f {\displaystyle f} from the monoid (N, +, 0) to the monoid (N, ×, 1), defined by f ( x) = 2 x
  {\displaystyle f(x)=2^{x}}. It is injective, but not surjective.
  The real numbers are a ring, having both addition and multiplication. The set of all 2×2 matrices is also a ring, under matrix addition and matrix multiplication. If we define a function between these rings as follows:
  f ( r) = ( r	0	0	r )
  {\displaystyle f(r)={\begin{pmatrix}r&0\\0&r\end{pmatrix}}}
  where r is a real number, then f is a homomorphism of rings, since f preserves both addition:
  f ( r + s) = ( r+s	0	0	r+s 
  )
  =
  (
  r	0	0	r 
  )
  +
  (
  s	0	0	s 
  )
  =
  f
  (
  r
  )
  +
  f
  (
  s
  )
  {\displaystyle f(r+s)={\begin{pmatrix}r+s&0\\0&r+s\end{pmatrix}}={\begin{pmatrix}r&0\\0&r\end{pmatrix}}+{\begin{pmatrix}s&0\\0&s\end{pmatrix}}=f(r)+f(s)}
  and multiplication:
  f
  (
  r
  s
  )
  =
  (
  rs	0	0	rs 
  )
  =
  (
  r	0	0	r 
  )
  (
  s	0	0	s 
  )
  =
  f
  (
  r
  )
  f
  (
  s
  )
  .
  {\displaystyle f(rs)={\begin{pmatrix}rs&0\\0&rs\end{pmatrix}}={\begin{pmatrix}r&0\\0&r\end{pmatrix}}{\begin{pmatrix}s&0\\0&s\end{pmatrix}}=f(r)\,f(s).}
  For another example, the nonzero complex numbers form a group under the operation of multiplication, as do the nonzero real numbers. (Zero must be excluded from both groups since it does not have a multiplicative inverse, which is required for elements of a group.) Define a function 
  f
  {\displaystyle f} from the nonzero complex numbers to the nonzero real numbers by
  f
  (
  z
  )
  =
  |
  z
  |
  .
  {\displaystyle f(z)=|z|.}
  That is, 
  f
  {\displaystyle f} is the absolute value (or modulus) of the complex number 
  z
  {\displaystyle z}. Then 
  f
  {\displaystyle f} is a homomorphism of groups, since it preserves multiplication:
  f
  (
  z
  1
  z
  2
  )
  =
  |
  z
  1
  z
  2
  |
  =
  |
  z
  1
  |
  |
  z
  2
  |
  =
  f
  (
  z
  1
  )
  f
  (
  z
  2
  )
  .
  {\displaystyle f(z_{1}z_{2})=|z_{1}z_{2}|=|z_{1}||z_{2}|=f(z_{1})f(z_{2}).}
  Note that f cannot be extended to a homomorphism of rings (from the complex numbers to the real numbers), since it does not preserve addition:
  |
  z
  1
  +
  z
  2
  |
  ≠
  |
  z
  1
  |
  +
  |
  z
  2
  |
  .
  {\displaystyle |z_{1}+z_{2}|\neq |z_{1}|+|z_{2}|.}
  As another example, the diagram shows a monoid homomorphism 
  f
  {\displaystyle f} from the monoid 
  (
  N
  ,
  +
  ,
  0
  )
  {\displaystyle (\mathbb {N} ,+,0)} to the monoid 
  (
  N
  ,
  ×
  ,
  1
  )
  {\displaystyle (\mathbb {N} ,\times ,1)}. Due to the different names of corresponding operations, the structure preservation properties satisfied by 
  f
  {\displaystyle f} amount to 
  f
  (
  x
  +
  y
  )
  =
  f
  (
  x
  )
  ×
  f
  (
  y
  )
  {\displaystyle f(x+y)=f(x)\times f(y)} and 
  f
  (
  0
  )
  =
  1
  {\displaystyle f(0)=1}.
  A composition algebra 
  A
  {\displaystyle A} over a field 
  F
  {\displaystyle F} has a quadratic form, called a norm, 
  N
  :
  A
  →
  F
  {\displaystyle N:A\to F}, which is a group homomorphism from the multiplicative group of 
  A
  {\displaystyle A} to the multiplicative group of 
  F
  {\displaystyle F}.
  Special homomorphisms
  Several kinds of homomorphisms have a specific name, which is also defined for general morphisms.
  Isomorphism
  An isomorphism between algebraic structures of the same type is commonly defined as a bijective homomorphism.[3]: 134  [4]: 28 
  In the more general context of category theory, an isomorphism is defined as a morphism that has an inverse that is also a morphism. In the specific case of algebraic structures, the two definitions are equivalent, although they may differ for non-algebraic structures, which have an underlying set.
  More precisely, if
  f
  :
  A
  →
  B
  {\displaystyle f:A\to B}
  is a (homo)morphism, it has an inverse if there exists a homomorphism
  g
  :
  B
  →
  A
  {\displaystyle g:B\to A}
  such that
  f
  ∘
  g
  =
  Id
  B
  and
  g
  ∘
  f
  =
  Id
  A
  .
  {\displaystyle f\circ g=\operatorname {Id} _{B}\qquad {\text{and}}\qquad g\circ f=\operatorname {Id} _{A}.}
  If 
  A
  {\displaystyle A} and 
  B
  {\displaystyle B} have underlying sets, and 
  f
  :
  A
  →
  B
  {\displaystyle f:A\to B} has an inverse 
  g
  {\displaystyle g}, then 
  f
  {\displaystyle f} is bijective. In fact, 
  f
  {\displaystyle f} is injective, as 
  f
  (
  x
  )
  =
  f
  (
  y
  )
  {\displaystyle f(x)=f(y)} implies
  x
  =
  g
  (
  f
  (
  x
  )
  )
  =
  g
  (
  f
  (
  y
  )
  )
  =
  y
  {\displaystyle x=g(f(x))=g(f(y))=y}, and 
  f
  {\displaystyle f} is surjective, as, for any 
  x
  {\displaystyle x} in 
  B
  {\displaystyle B}, one has 
  x
  =
  f
  (
  g
  (
  x
  )
  )
  {\displaystyle x=f(g(x))}, and 
  x
  {\displaystyle x} is the image of an element of 
  A
  {\displaystyle A}.
  Conversely, if 
  f
  :
  A
  →
  B
  {\displaystyle f:A\to B} is a bijective homomorphism between algebraic structures, let 
  g
  :
  B
  →
  A
  {\displaystyle g:B\to A} be the map such that 
  g
  (
  y
  )
  {\displaystyle g(y)} is the unique element 
  x
  {\displaystyle x} of 
  A
  {\displaystyle A} such that 
  f
  (
  x
  )
  =
  y
  {\displaystyle f(x)=y}. One has 
  f
  ∘
  g
  =
  Id
  B
  ⁡
  and 
  g
  ∘
  f
  =
  Id
  A
  ,
  {\displaystyle f\circ g=\operatorname {Id} _{B}{\text{ and }}g\circ f=\operatorname {Id} _{A},} and it remains only to show that g is a homomorphism. If 
  ∗
  {\displaystyle *} is a binary operation of the structure, for every pair 
  x
  {\displaystyle x}, 
  y
  {\displaystyle y} of elements of 
  B
  {\displaystyle B}, one has
  g
  (
  x
  ∗
  B
  y
  )
  =
  g
  (
  f
  (
  g
  (
  x
  )
  )
  ∗
  B
  f
  (
  g
  (
  y
  )
  )
  )
  =
  g
  (
  f
  (
  g
  (
  x
  )
  ∗
  A
  g
  (
  y
  )
  )
  )
  =
  g
  (
  x
  )
  ∗
  A
  g
  (
  y
  )
  ,
  {\displaystyle g(x*_{B}y)=g(f(g(x))*_{B}f(g(y)))=g(f(g(x)*_{A}g(y)))=g(x)*_{A}g(y),}
  and 
  g
  {\displaystyle g} is thus compatible with 
  ∗
  .
  {\displaystyle *.} As the proof is similar for any arity, this shows that 
  g
  {\displaystyle g} is a homomorphism.
  This proof does not work for non-algebraic structures. For example, for topological spaces, a morphism is a continuous map, and the inverse of a bijective continuous map is not necessarily continuous. An isomorphism of topological spaces, called homeomorphism or bicontinuous map, is thus a bijective continuous map, whose inverse is also continuous.
  Endomorphism
  An endomorphism is a homomorphism whose domain equals the codomain, or, more generally, a morphism whose source is equal to its target.[3]: 135 
  The endomorphisms of an algebraic structure, or of an object of a category form a monoid under composition.
  The endomorphisms of a vector space or of a module form a ring. In the case of a vector space or a free module of finite dimension, the choice of a basis induces a ring isomorphism between the ring of endomorphisms and the ring of square matrices of the same dimension.
  Automorphism
  An automorphism is an endomorphism that is also an isomorphism.[3]: 135 
  The automorphisms of an algebraic structure or of an object of a category form a group under composition, which is called the automorphism group of the structure.
  Many groups that have received a name are automorphism groups of some algebraic structure. For example, the general linear group 
  GL
  n
  ⁡
  (
  k
  )
  {\displaystyle \operatorname {GL} _{n}(k)} is the automorphism group of a vector space of dimension 
  n
  {\displaystyle n} over a field 
  k
  {\displaystyle k}.
  The automorphism groups of fields were introduced by Évariste Galois for studying the roots of polynomials, and are the basis of Galois theory.
  Monomorphism
  For algebraic structures, monomorphisms are commonly defined as injective homomorphisms.[3]: 134  [4]: 29 
  In the more general context of category theory, a monomorphism is defined as a morphism that is left cancelable.[5] This means that a (homo)morphism
  f
  :
  A
  →
  B
  {\displaystyle f:A\to B} is a monomorphism if, for any pair 
  g
  {\displaystyle g}, 
  h
  {\displaystyle h} of morphisms from any other object 
  C
  {\displaystyle C} to 
  A
  {\displaystyle A}, then 
  f
  ∘
  g
  =
  f
  ∘
  h
  {\displaystyle f\circ g=f\circ h} implies 
  g
  =
  h
  {\displaystyle g=h}.
  These two definitions of monomorphism are equivalent for all common algebraic structures. More precisely, they are equivalent for fields, for which every homomorphism is a monomorphism, and for varieties of universal algebra, that is algebraic structures for which operations and axioms (identities) are defined without any restriction (the fields do not form a variety, as the multiplicative inverse is defined either as a unary operation or as a property of the multiplication, which are, in both cases, defined only for nonzero elements).
  In particular, the two definitions of a monomorphism are equivalent for sets, magmas, semigroups, monoids, groups, rings, fields, vector spaces and modules.
  A split monomorphism is a homomorphism that has a left inverse and thus it is itself a right inverse of that other homomorphism. That is, a homomorphism 
  f
  :
  A
  →
  B
  {\displaystyle f\colon A\to B} is a split monomorphism if there exists a homomorphism 
  g
  :
  B
  →
  A
  {\displaystyle g\colon B\to A} such that 
  g
  ∘
  f
  =
  Id
  A
  .
  {\displaystyle g\circ f=\operatorname {Id} _{A}.} A split monomorphism is always a monomorphism, for both meanings of monomorphism. For sets and vector spaces, every monomorphism is a split monomorphism, but this property does not hold for most common algebraic structures.
  Proof of the equivalence of the two definitions of monomorphisms
  Epimorphism
  In algebra, epimorphisms are often defined as surjective homomorphisms.[3]: 134 [4]: 43  On the other hand, in category theory, epimorphisms are defined as right cancelable morphisms.[5] This means that a (homo)morphism 
  f
  :
  A
  →
  B
  {\displaystyle f:A\to B} is an epimorphism if, for any pair 
  g
  {\displaystyle g}, 
  h
  {\displaystyle h} of morphisms from 
  B
  {\displaystyle B} to any other object 
  C
  {\displaystyle C}, the equality 
  g
  ∘
  f
  =
  h
  ∘
  f
  {\displaystyle g\circ f=h\circ f} implies 
  g
  =
  h
  {\displaystyle g=h}.
  A surjective homomorphism is always right cancelable, but the converse is not always true for algebraic structures. However, the two definitions of epimorphism are equivalent for sets, vector spaces, abelian groups, modules (see below for a proof), and groups.[6] The importance of these structures in all mathematics, especially in linear algebra and homological algebra, may explain the coexistence of two non-equivalent definitions.
  Algebraic structures for which there exist non-surjective epimorphisms include semigroups and rings. The most basic example is the inclusion of integers into rational numbers, which is a homomorphism of rings and of multiplicative semigroups. For both structures it is a monomorphism and a non-surjective epimorphism, but not an isomorphism.[5][7]
  A wide generalization of this example is the localization of a ring by a multiplicative set. Every localization is a ring epimorphism, which is not, in general, surjective. As localizations are fundamental in commutative algebra and algebraic geometry, this may explain why in these areas, the definition of epimorphisms as right cancelable homomorphisms is generally preferred.
  A split epimorphism is a homomorphism that has a right inverse and thus it is itself a left inverse of that other homomorphism. That is, a homomorphism
  f
  :
  A
  →
  B
  {\displaystyle f\colon A\to B} is a split epimorphism if there exists a homomorphism 
  g
  :
  B
  →
  A
  {\displaystyle g\colon B\to A} such that 
  f
  ∘
  g
  =
  Id
  B
  .
  {\displaystyle f\circ g=\operatorname {Id} _{B}.} A split epimorphism is always an epimorphism, for both meanings of epimorphism. For sets and vector spaces, every epimorphism is a split epimorphism, but this property does not hold for most common algebraic structures.
  In summary, one has
  split epimorphism
  ⟹
  epimorphism (surjective)
  ⟹
  epimorphism (right cancelable)
  ;
  {\displaystyle {\text{split epimorphism}}\implies {\text{epimorphism (surjective)}}\implies {\text{epimorphism (right cancelable)}};}
  the last implication is an equivalence for sets, vector spaces, modules, abelian groups, and groups; the first implication is an equivalence for sets and vector spaces.
  Equivalence of the two definitions of epimorphism
  Kernel
  Main article: Kernel (algebra)
  Any homomorphism 
  f
  :
  X
  →
  Y
  {\displaystyle f:X\to Y} defines an equivalence relation 
  ∼
  {\displaystyle \sim } on 
  X
  {\displaystyle X} by 
  a
  ∼
  b
  {\displaystyle a\sim b} if and only if 
  f
  (
  a
  )
  =
  f
  (
  b
  )
  {\displaystyle f(a)=f(b)}. The relation 
  ∼
  {\displaystyle \sim } is called the kernel of 
  f
  {\displaystyle f}. It is a congruence relation on 
  X
  {\displaystyle X}. The quotient set 
  X
  /
  ∼
  {\displaystyle X/{\sim }} can then be given a structure of the same type as 
  X
  {\displaystyle X}, in a natural way, by defining the operations of the quotient set by 
  [
  x
  ]
  ∗
  [
  y
  ]
  =
  [
  x
  ∗
  y
  ]
  {\displaystyle [x]\ast [y]=[x\ast y]}, for each operation 
  ∗
  {\displaystyle \ast } of 
  X
  {\displaystyle X}. In that case the image of 
  X
  {\displaystyle X} in 
  Y
  {\displaystyle Y} under the homomorphism 
  f
  {\displaystyle f} is necessarily isomorphic to 
  X
  /
  ∼
  {\displaystyle X/\!\sim }; this fact is one of the isomorphism theorems.
  When the algebraic structure is a group for some operation, the equivalence class 
  K
  {\displaystyle K} of the identity element of this operation suffices to characterize the equivalence relation. In this case, the quotient by the equivalence relation is denoted by 
  X
  /
  K
  {\displaystyle X/K} (usually read as "
  X
  {\displaystyle X} mod 
  K
  {\displaystyle K}"). Also in this case, it is 
  K
  {\displaystyle K}, rather than 
  ∼
  {\displaystyle \sim }, that is called the kernel of 
  f
  {\displaystyle f}. The kernels of homomorphisms of a given type of algebraic structure are naturally equipped with some structure. This structure type of the kernels is the same as the considered structure, in the case of abelian groups, vector spaces and modules, but is different and has received a specific name in other cases, such as normal subgroup for kernels of group homomorphisms and ideals for kernels of ring homomorphisms (in the case of non-commutative rings, the kernels are the two-sided ideals).
  Relational structures
  In model theory, the notion of an algebraic structure is generalized to structures involving both operations and relations. Let L be a signature consisting of function and relation symbols, and A, B be two L-structures. Then a homomorphism from A to B is a mapping h from the domain of A to the domain of B such that
  h(FA(a1,…,an)) = FB(h(a1),…,h(an)) for each n-ary function symbol F in L,
  RA(a1,…,an) implies RB(h(a1),…,h(an)) for each n-ary relation symbol R in L.
  In the special case with just one binary relation, we obtain the notion of a graph homomorphism.[8]
  Formal language theory
  Homomorphisms are also used in the study of formal languages[9] and are often briefly referred to as morphisms.[10] Given alphabets 
  Σ
  1
  {\displaystyle \Sigma _{1}} and 
  Σ
  2
  {\displaystyle \Sigma _{2}}, a function 
  h
  :
  Σ
  1
  ∗
  →
  Σ
  2
  ∗
  {\displaystyle h\colon \Sigma _{1}^{*}\to \Sigma _{2}^{*}} such that 
  h
  (
  u
  v
  )
  =
  h
  (
  u
  )
  h
  (
  v
  )
  {\displaystyle h(uv)=h(u)h(v)} for all 
  u
  ,
  v
  ∈
  Σ
  1
  {\displaystyle u,v\in \Sigma _{1}} is called a homomorphism on 
  Σ
  1
  ∗
  {\displaystyle \Sigma _{1}^{*}}.[note 2] If 
  h
  {\displaystyle h} is a homomorphism on 
  Σ
  1
  ∗
  {\displaystyle \Sigma _{1}^{*}} and 
  ε
  {\displaystyle \varepsilon } denotes the empty string, then 
  h
  {\displaystyle h} is called an 
  ε
  {\displaystyle \varepsilon }-free homomorphism when 
  h
  (
  x
  )
  ≠
  ε
  {\displaystyle h(x)\neq \varepsilon } for all 
  x
  ≠
  ε
  {\displaystyle x\neq \varepsilon } in 
  Σ
  1
  ∗
  {\displaystyle \Sigma _{1}^{*}}.
  A homomorphism 
  h
  :
  Σ
  1
  ∗
  →
  Σ
  2
  ∗
  {\displaystyle h\colon \Sigma _{1}^{*}\to \Sigma _{2}^{*}} on 
  Σ
  1
  ∗
  {\displaystyle \Sigma _{1}^{*}} that satisfies 
  |
  h
  (
  a
  )
  |
  =
  k
  {\displaystyle |h(a)|=k} for all 
  a
  ∈
  Σ
  1
  {\displaystyle a\in \Sigma _{1}} is called a 
  k
  {\displaystyle k}-uniform homomorphism.[11] If 
  |
  h
  (
  a
  )
  |
  =
  1
  {\displaystyle |h(a)|=1} for all 
  a
  ∈
  Σ
  1
  {\displaystyle a\in \Sigma _{1}} (that is, 
  h
  {\displaystyle h} is 1-uniform), then 
  h
  {\displaystyle h} is also called a coding or a projection.[citation needed]
  The set 
  Σ
  ∗
  {\displaystyle \Sigma ^{*}} of words formed from the alphabet 
  Σ
  {\displaystyle \Sigma } may be thought of as the free monoid generated by 
  Σ
  {\displaystyle \Sigma }. Here the monoid operation is concatenation and the identity element is the empty word. From this perspective, a language homomorphism is precisely a monoid homomorphism.[note 3]
  </page>

  <page name="endofunctor">
  In category theory, a branch of mathematics, a monad (also triple, triad, standard construction and fundamental construction)[1] is a monoid in the category of endofunctors of some fixed category. An endofunctor is a functor mapping a category to itself, and a monad is an endofunctor together with two natural transformations required to fulfill certain coherence conditions. Monads are used in the theory of pairs of adjoint functors, and they generalize closure operators on partially ordered sets to arbitrary categories. Monads are also useful in the theory of datatypes, the denotational semantics of imperative programming languages, and in functional programming languages, allowing languages without mutable state to do things such as simulate for-loops; see Monad (functional programming).
  Introduction and definition
  A monad is a certain type of endofunctor. For example, if 
  F
  {\displaystyle F} and 
  G
  {\displaystyle G} are a pair of adjoint functors, with 
  F
  {\displaystyle F} left adjoint to 
  G
  {\displaystyle G}, then the composition 
  G
  ∘
  F
  {\displaystyle G\circ F} is a monad. If 
  F
  {\displaystyle F} and 
  G
  {\displaystyle G} are inverse functors, the corresponding monad is the identity functor. In general, adjunctions are not equivalences—they relate categories of different natures. The monad theory matters as part of the effort to capture what it is that adjunctions 'preserve'. The other half of the theory, of what can be learned likewise from consideration of 
  F
  ∘
  G
  {\displaystyle F\circ G}, is discussed under the dual theory of comonads.
  Formal definition
  Throughout this article 
  C
  {\displaystyle C} denotes a category. A monad on 
  C
  {\displaystyle C} consists of an endofunctor 
  T
  :
  C
  →
  C
  {\displaystyle T\colon C\to C} together with two natural transformations:
  η
  :
  1
  C
  →
  T
  {\displaystyle \eta \colon 1_{C}\to T} (where 
  1
  C
  {\displaystyle 1_{C}} denotes the identity functor on 
  C
  {\displaystyle C}) and 
  μ
  :
  T
  2
  →
  T
  {\displaystyle \mu \colon T^{2}\to T} (where 
  T
  2
  {\displaystyle T^{2}} is the functor 
  T
  ∘
  T
  {\displaystyle T\circ T} from 
  C
  {\displaystyle C} to 
  C
  {\displaystyle C}). These are required to fulfill the following conditions (sometimes called coherence conditions):
  μ
  ∘
  T
  μ
  =
  μ
  ∘
  μ
  T
  {\displaystyle \mu \circ T\mu =\mu \circ \mu T} (as natural transformations 
  T
  3
  →
  T
  {\displaystyle T^{3}\to T}); here 
  T
  μ
  {\displaystyle T\mu } and 
  μ
  T
  {\displaystyle \mu T} are formed by "horizontal composition."
  μ
  ∘
  T
  η
  =
  μ
  ∘
  η
  T
  =
  1
  T
  {\displaystyle \mu \circ T\eta =\mu \circ \eta T=1_{T}} (as natural transformations 
  T
  →
  T
  {\displaystyle T\to T}; here 
  1
  T
  {\displaystyle 1_{T}} denotes the identity transformation from 
  T
  {\displaystyle T} to 
  T
  {\displaystyle T}).
  We can rewrite these conditions using the following commutative diagrams:

                

  See the article on natural transformations for the explanation of the notations 
  T
  μ
  {\displaystyle T\mu } and 
  μ
  T
  {\displaystyle \mu T}, or see below the commutative diagrams not using these notions:
                  
  The first axiom is akin to the associativity in monoids if we think of 
  μ
  {\displaystyle \mu } as the monoid's binary operation, and the second axiom is akin to the existence of an identity element (which we think of as given by 
  η
  {\displaystyle \eta }). Indeed, a monad on 
  C
  {\displaystyle C} can alternatively be defined as a monoid in the category 
  E
  n
  d
  C
  {\displaystyle \mathbf {End} _{C}} whose objects are the endofunctors of 
  C
  {\displaystyle C} and whose morphisms are the natural transformations between them, with the monoidal structure induced by the composition of endofunctors.
  The power set monad
  The power set monad is a monad 
  P
  {\displaystyle {\mathcal {P}}} on the category 
  S
  e
  t
  {\displaystyle \mathbf {Set} }: For a set 
  A
  {\displaystyle A} let 
  T
  (
  A
  )
  {\displaystyle T(A)} be the power set of 
  A
  {\displaystyle A} and for a function 
  f
  :
  A
  →
  B
  {\displaystyle f\colon A\to B} let 
  T
  (
  f
  )
  {\displaystyle T(f)} be the function between the power sets induced by taking direct images under 
  f
  {\displaystyle f}. For every set 
  A
  {\displaystyle A}, we have a map 
  η
  A
  :
  A
  →
  T
  (
  A
  )
  {\displaystyle \eta _{A}\colon A\to T(A)}, which assigns to every
  a
  ∈
  A
  {\displaystyle a\in A} the singleton 
  {
  a
  }
  {\displaystyle \{a\}}. The function
  μ
  A
  :
  T
  (
  T
  (
  A
  )
  )
  →
  T
  (
  A
  )
  {\displaystyle \mu _{A}\colon T(T(A))\to T(A)}
  takes a set of sets to its union. These data describe a monad.
  Remarks
  The axioms of a monad are formally similar to the monoid axioms. In fact, monads are special cases of monoids, namely they are precisely the monoids among endofunctors 
  End
  ⁡
  (
  C
  )
  {\displaystyle \operatorname {End} (C)}, which is equipped with the multiplication given by composition of endofunctors.
  Composition of monads is not, in general, a monad. For example, the double power set functor 
  P
  ∘
  P
  {\displaystyle {\mathcal {P}}\circ {\mathcal {P}}} does not admit any monad structure.[2]
  Comonads
  The categorical dual definition is a formal definition of a comonad (or cotriple); this can be said quickly in the terms that a comonad for a category 
  C
  {\displaystyle C} is a monad for the opposite category 
  C
  o
  p
  {\displaystyle C^{\mathrm {op} }}. It is therefore a functor 
  U
  {\displaystyle U} from 
  C
  {\displaystyle C} to itself, with a set of axioms for counit and comultiplication that come from reversing the arrows everywhere in the definition just given.
  Monads are to monoids as comonads are to comonoids. Every set is a comonoid in a unique way, so comonoids are less familiar in abstract algebra than monoids; however, comonoids in the category of vector spaces with its usual tensor product are important and widely studied under the name of coalgebras.
  Terminological history
  The notion of monad was invented by Roger Godement in 1958 under the name "standard construction". Monad has been called "dual standard construction", "triple", "monoid" and "triad".[3] The term "monad" is used at latest 1967, by Jean Bénabou.[4][5]
  Examples
  Identity
  The identity functor on a category 
  C
  {\displaystyle C} is a monad. Its multiplication and unit are the identity function on the objects of 
  C
  {\displaystyle C}.
  Monads arising from adjunctions
  Any adjunction
  F
  :
  C
  ⇄
  D
  :
  G
  {\displaystyle F:C\rightleftarrows D:G}
  gives rise to a monad on C. This very widespread construction works as follows: the endofunctor is the composite
  T
  =
  G
  ∘
  F
  .
  {\displaystyle T=G\circ F.}
  This endofunctor is quickly seen to be a monad, where the unit map stems from the unit map 
  id
  C
  →
  G
  ∘
  F
  {\displaystyle \operatorname {id} _{C}\to G\circ F} of the adjunction, and the multiplication map is constructed using the counit map of the adjunction:
  T
  2
  =
  G
  ∘
  F
  ∘
  G
  ∘
  F
  →
  G
  ∘
  counit
  ∘
  F
  G
  ∘
  F
  =
  T
  .
  {\displaystyle T^{2}=G\circ F\circ G\circ F\xrightarrow {G\circ {\text{counit}}\circ F} G\circ F=T.}
  In fact, any monad can be found as an explicit adjunction of functors using the Eilenberg–Moore category 
  C
  T
  {\displaystyle C^{T}} (the category of 
  T
  {\displaystyle T}-algebras).[6]
  Double dualization
  The double dualization monad, for a fixed field k arises from the adjunction
  (
  −
  )
  ∗
  :
  V
  e
  c
  t
  k
  ⇄
  V
  e
  c
  t
  k
  o
  p
  :
  (
  −
  )
  ∗
  {\displaystyle (-)^{*}:\mathbf {Vect} _{k}\rightleftarrows \mathbf {Vect} _{k}^{op}:(-)^{*}}
  where both functors are given by sending a vector space V to its dual vector space 
  V
  ∗
  :=
  Hom
  ⁡
  (
  V
  ,
  k
  )
  {\displaystyle V^{*}:=\operatorname {Hom} (V,k)}. The associated monad sends a vector space V to its double dual 
  V
  ∗
  ∗
  {\displaystyle V^{**}}. This monad is discussed, in much greater generality, by Kock (1970).
  Closure operators on partially ordered sets
  For categories arising from partially ordered sets 
  (
  P
  ,
  ≤
  )
  {\displaystyle (P,\leq )} (with a single morphism from 
  x
  {\displaystyle x} to 
  y
  {\displaystyle y} if and only if 
  x
  ≤
  y
  {\displaystyle x\leq y}), then the formalism becomes much simpler: adjoint pairs are Galois connections and monads are closure operators.
  Free-forgetful adjunctions
  For example, let 
  G
  {\displaystyle G} be the forgetful functor from the category Grp of groups to the category Set of sets, and let 
  F
  {\displaystyle F} be the free group functor from the category of sets to the category of groups. Then 
  F
  {\displaystyle F} is left adjoint of 
  G
  {\displaystyle G}. In this case, the associated monad 
  T
  =
  G
  ∘
  F
  {\displaystyle T=G\circ F} takes a set 
  X
  {\displaystyle X} and returns the underlying set of the free group 
  F
  r
  e
  e
  (
  X
  )
  {\displaystyle \mathrm {Free} (X)}. The unit map of this monad is given by the maps
  X
  →
  T
  (
  X
  )
  {\displaystyle X\to T(X)}
  including any set 
  X
  {\displaystyle X} into the set 
  F
  r
  e
  e
  (
  X
  )
  {\displaystyle \mathrm {Free} (X)} in the natural way, as strings of length 1. Further, the multiplication of this monad is the map
  T
  (
  T
  (
  X
  )
  )
  →
  T
  (
  X
  )
  {\displaystyle T(T(X))\to T(X)}
  made out of a natural concatenation or 'flattening' of 'strings of strings'. This amounts to two natural transformations. The preceding example about free groups can be generalized to any type of algebra in the sense of a variety of algebras in universal algebra. Thus, every such type of algebra gives rise to a monad on the category of sets. Importantly, the algebra type can be recovered from the monad (as the category of Eilenberg–Moore algebras), so monads can also be seen as generalizing varieties of universal algebras.
  Another monad arising from an adjunction is when 
  T
  {\displaystyle T} is the endofunctor on the category of vector spaces which maps a vector space 
  V
  {\displaystyle V} to its tensor algebra 
  T
  (
  V
  )
  {\displaystyle T(V)}, and which maps linear maps to their tensor product. We then have a natural transformation corresponding to the embedding of 
  V
  {\displaystyle V} into its tensor algebra, and a natural transformation corresponding to the map from 
  T
  (
  T
  (
  V
  )
  )
  {\displaystyle T(T(V))} to 
  T
  (
  V
  )
  {\displaystyle T(V)} obtained by simply expanding all tensor products.
  Codensity monads
  Under mild conditions, functors not admitting a left adjoint also give rise to a monad, the so-called codensity monad. For example, the inclusion
  F
  i
  n
  S
  e
  t
  ⊂
  S
  e
  t
  {\displaystyle \mathbf {FinSet} \subset \mathbf {Set} }
  does not admit a left adjoint. Its codensity monad is the monad on sets sending any set X to the set of ultrafilters on X. This and similar examples are discussed in Leinster (2013).
  Monads used in denotational semantics
  See also: Monad (functional programming)
  The following monads over the category of sets are used in denotational semantics of imperative programming languages, and analogous constructions are used in functional programming.
  The maybe monad
  The endofunctor of the maybe or partiality monad adds a disjoint point:[7]
  (
  −
  )
  ∗
  :
  S
  e
  t
  →
  S
  e
  t
  {\displaystyle (-)_{*}:\mathbf {Set} \to \mathbf {Set} }
  X
  ↦
  X
  ∪
  {
  ∗
  }
  {\displaystyle X\mapsto X\cup \{*\}}
  The unit is given by the inclusion of a set 
  X
  {\displaystyle X} into 
  X
  ∗
  {\displaystyle X_{*}}:
  η
  X
  :
  X
  →
  X
  ∗
  {\displaystyle \eta _{X}:X\to X_{*}}
  x
  ↦
  x
  {\displaystyle x\mapsto x}
  The multiplication maps elements of 
  X
  {\displaystyle X} to themselves, and the two disjoint points in 
  (
  X
  ∗
  )
  ∗
  {\displaystyle (X_{*})_{*}} to the one in 
  X
  ∗
  {\displaystyle X_{*}}.
  In both functional programming and denotational semantics, the maybe monad models partial computations, that is, computations that may fail.
  The state monad
  [icon]	
  This section needs expansion with: describe multiplication. You can help by adding to it. (February 2023)
  Given a set 
  S
  {\displaystyle S}, the endofunctor of the state monad maps each set 
  X
  {\displaystyle X} to the set of functions 
  S
  →
  S
  ×
  X
  {\displaystyle S\to S\times X}. The component of the unit at 
  X
  {\displaystyle X} maps each element 
  x
  ∈
  X
  {\displaystyle x\in X} to the function
  η
  X
  (
  x
  )
  :
  S
  →
  S
  ×
  X
  {\displaystyle \eta _{X}(x):S\to S\times X}
  s
  ↦
  (
  s
  ,
  x
  )
  {\displaystyle s\mapsto (s,x)}
  The multiplication maps the function 
  f
  :
  S
  →
  S
  ×
  (
  S
  →
  S
  ×
  X
  )
  ,
  s
  ↦
  (
  s
  ′
  ,
  f
  ′
  )
  {\displaystyle f:S\to S\times (S\to S\times X),s\mapsto (s',f')} to the function
  μ
  X
  (
  f
  )
  :
  S
  →
  S
  ×
  X
  {\displaystyle \mu _{X}(f):S\to S\times X}
  s
  ↦
  f
  ′
  (
  s
  ′
  )
  {\displaystyle s\mapsto f'(s')}
  In functional programming and denotational semantics, the state monad models stateful computations.
  The environment monad
  [icon]	
  This section needs expansion with: describe multiplication. You can help by adding to it. (February 2023)
  Given a set 
  E
  {\displaystyle E}, the endofunctor of the reader or environment monad maps each set 
  X
  {\displaystyle X} to the set of functions 
  E
  →
  X
  {\displaystyle E\to X}. Thus, the endofunctor of this monad is exactly the hom functor 
  H
  o
  m
  (
  E
  ,
  −
  )
  {\displaystyle \mathrm {Hom} (E,-)}. The component of the unit at 
  X
  {\displaystyle X} maps each element 
  x
  ∈
  X
  {\displaystyle x\in X} to the constant function 
  e
  ↦
  x
  {\displaystyle e\mapsto x}.
  In functional programming and denotational semantics, the environment monad models computations with access to some read-only data.
  The list and set monads
  [icon]	
  This section needs expansion with: describe multiplication. You can help by adding to it. (February 2023)
  The list or nondeterminism monad maps a set X to the set of finite sequences (i.e., lists) with elements from X. The unit maps an element x in X to the singleton list [x]. The multiplication concatenates a list of lists into a single list.
  In functional programming, the list monad is used to model nondeterministic computations. The covariant powerset monad is also known as the set monad, and is also used to model nondeterministic computation.
  Algebras for a monad
  See also: F-algebra and pseudoalgebra
  Given a monad 
  (
  T
  ,
  η
  ,
  μ
  )
  {\displaystyle (T,\eta ,\mu )} on a category 
  C
  {\displaystyle C}, it is natural to consider 
  T
  {\displaystyle T}-algebras, i.e., objects of 
  C
  {\displaystyle C} acted upon by 
  T
  {\displaystyle T} in a way which is compatible with the unit and multiplication of the monad. More formally, a 
  T
  {\displaystyle T}-algebra 
  (
  x
  ,
  h
  )
  {\displaystyle (x,h)} is an object 
  x
  {\displaystyle x} of 
  C
  {\displaystyle C} together with an arrow 
  h
  :
  T
  x
  →
  x
  {\displaystyle h\colon Tx\to x} of 
  C
  {\displaystyle C} called the structure map of the algebra such that the diagrams
      and		
  commute.
  A morphism 
  f
  :
  (
  x
  ,
  h
  )
  →
  (
  x
  ′
  ,
  h
  ′
  )
  {\displaystyle f\colon (x,h)\to (x',h')} of 
  T
  {\displaystyle T}-algebras is an arrow 
  f
  :
  x
  →
  x
  ′
  {\displaystyle f\colon x\to x'} of 
  C
  {\displaystyle C} such that the diagram

  commutes. 
  T
  {\displaystyle T}-algebras form a category called the Eilenberg–Moore category and denoted by 
  C
  T
  {\displaystyle C^{T}}.
  Examples
  Algebras over the free group monad
  For example, for the free group monad discussed above, a 
  T
  {\displaystyle T}-algebra is a set 
  X
  {\displaystyle X} together with a map from the free group generated by 
  X
  {\displaystyle X} towards 
  X
  {\displaystyle X} subject to associativity and unitality conditions. Such a structure is equivalent to saying that 
  X
  {\displaystyle X} is a group itself.
  Algebras over the distribution monad
  Another example is the distribution monad 
  D
  {\displaystyle {\mathcal {D}}} on the category of sets. It is defined by sending a set 
  X
  {\displaystyle X} to the set of functions 
  f
  :
  X
  →
  [
  0
  ,
  1
  ]
  {\displaystyle f:X\to [0,1]} with finite support and such that their sum is equal to 
  1
  {\displaystyle 1}. In set-builder notation, this is the set
  D
  (
  X
  )
  =
  {
  f
  :
  X
  →
  [
  0
  ,
  1
  ]
  :
  #
  supp
  (f)<+∞	
  ∑
  x
  ∈
  X
  f(x)=1 
  }
  {\displaystyle {\mathcal {D}}(X)=\left\{f:X\to [0,1]:{\begin{matrix}\#{\text{supp}}(f)<+\infty \\\sum _{x\in X}f(x)=1\end{matrix}}\right\}}
  By inspection of the definitions, it can be shown that algebras over the distribution monad are equivalent to convex sets, i.e., sets equipped with operations 
  x
  +
  r
  y
  {\displaystyle x+_{r}y} for 
  r
  ∈
  [
  0
  ,
  1
  ]
  {\displaystyle r\in [0,1]} subject to axioms resembling the behavior of convex linear combinations 
  r
  x
  +
  (
  1
  −
  r
  )
  y
  {\displaystyle rx+(1-r)y} in Euclidean space.[8]
  Algebras over the symmetric monad
  Another useful example of a monad is the symmetric algebra functor on the category of 
  R
  {\displaystyle R}-modules for a commutative ring 
  R
  {\displaystyle R}.
  Sym
  ∙
  (
  −
  )
  :
  Mod
  (
  R
  )
  →
  Mod
  (
  R
  )
  {\displaystyle {\text{Sym}}^{\bullet }(-):{\text{Mod}}(R)\to {\text{Mod}}(R)}
  sending an 
  R
  {\displaystyle R}-module 
  M
  {\displaystyle M} to the direct sum of symmetric tensor powers
  Sym
  ∙
  (
  M
  )
  =
  ⨁
  k
  =
  0
  ∞
  Sym
  k
  (
  M
  )
  {\displaystyle {\text{Sym}}^{\bullet }(M)=\bigoplus _{k=0}^{\infty }{\text{Sym}}^{k}(M)}
  where 
  Sym
  0
  (
  M
  )
  =
  R
  {\displaystyle {\text{Sym}}^{0}(M)=R}. For example, 
  Sym
  ∙
  (
  R
  ⊕
  n
  )
  ≅
  R
  [
  x
  1
  ,
  …
  ,
  x
  n
  ]
  {\displaystyle {\text{Sym}}^{\bullet }(R^{\oplus n})\cong R[x_{1},\ldots ,x_{n}]} where the 
  R
  {\displaystyle R}-algebra on the right is considered as a module. Then, an algebra over this monad are commutative 
  R
  {\displaystyle R}-algebras. There are also algebras over the monads for the alternating tensors 
  Alt
  ∙
  (
  −
  )
  {\displaystyle {\text{Alt}}^{\bullet }(-)} and total tensor functors
  T
  ∙
  (
  −
  )
  {\displaystyle T^{\bullet }(-)} giving anti-symmetric 
  R
  {\displaystyle R}-algebras, and free 
  R
  {\displaystyle R}-algebras, so
  Alt
  ∙
  (
  R
  ⊕
  n
  )	=R(
  x
  1
  ,…,
  x
  n
  )	
  T
  ∙
  (
  R
  ⊕
  n
  )	=R⟨
  x
  1
  ,…,
  x
  n
  ⟩ 
  {\displaystyle {\begin{aligned}{\text{Alt}}^{\bullet }(R^{\oplus n})&=R(x_{1},\ldots ,x_{n})\\{\text{T}}^{\bullet }(R^{\oplus n})&=R\langle x_{1},\ldots ,x_{n}\rangle \end{aligned}}}
  where the first ring is the free anti-symmetric algebra over 
  R
  {\displaystyle R} in 
  n
  {\displaystyle n}-generators and the second ring is the free algebra over 
  R
  {\displaystyle R} in 
  n
  {\displaystyle n}-generators.
  Commutative algebras in E-infinity ring spectra
  There is an analogous construction for commutative 
  S
  {\displaystyle \mathbb {S} }-algebras[9]pg 113 which gives commutative 
  A
  {\displaystyle A}-algebras for a commutative 
  S
  {\displaystyle \mathbb {S} }-algebra 
  A
  {\displaystyle A}. If 
  M
  A
  {\displaystyle {\mathcal {M}}_{A}} is the category of 
  A
  {\displaystyle A}-modules, then the functor 
  P
  :
  M
  A
  →
  M
  A
  {\displaystyle \mathbb {P} :{\mathcal {M}}_{A}\to {\mathcal {M}}_{A}} is the monad given by
  P
  (
  M
  )
  =
  ⋁
  j
  ≥
  0
  M
  j
  /
  Σ
  j
  {\displaystyle \mathbb {P} (M)=\bigvee _{j\geq 0}M^{j}/\Sigma _{j}}
  where
  M
  j
  =
  M
  ∧
  A
  ⋯
  ∧
  A
  M
  {\displaystyle M^{j}=M\wedge _{A}\cdots \wedge _{A}M}
  j
  {\displaystyle j}-times. Then there is an associated category 
  C
  A
  {\displaystyle {\mathcal {C}}_{A}} of commutative 
  A
  {\displaystyle A}-algebras from the category of algebras over this monad.
  Monads and adjunctions
  As was mentioned above, any adjunction gives rise to a monad. Conversely, every monad arises from some adjunction, namely the free–forgetful adjunction
  T
  (
  −
  )
  :
  C
  ⇄
  C
  T
  :
  forget
  {\displaystyle T(-):C\rightleftarrows C^{T}:{\text{forget}}}
  whose left adjoint sends an object X to the free T-algebra T(X). However, there are usually several distinct adjunctions giving rise to a monad: let
  A
  d
  j
  (
  C
  ,
  T
  )
  {\displaystyle \mathbf {Adj} (C,T)} be the category whose objects are the adjunctions 
  (
  F
  ,
  G
  ,
  e
  ,
  ε
  )
  {\displaystyle (F,G,e,\varepsilon )} such that 
  (
  G
  F
  ,
  e
  ,
  G
  ε
  F
  )
  =
  (
  T
  ,
  η
  ,
  μ
  )
  {\displaystyle (GF,e,G\varepsilon F)=(T,\eta ,\mu )} and whose arrows are the morphisms of adjunctions that are the identity on 
  C
  {\displaystyle C}. Then the above free–forgetful adjunction involving the Eilenberg–Moore category 
  C
  T
  {\displaystyle C^{T}} is a terminal object in 
  A
  d
  j
  (
  C
  ,
  T
  )
  {\displaystyle \mathbf {Adj} (C,T)}. An initial object is the Kleisli category, which is by definition the full subcategory of 
  C
  T
  {\displaystyle C^{T}} consisting only of free T-algebras, i.e., T-algebras of the form 
  T
  (
  x
  )
  {\displaystyle T(x)} for some object x of C.
  Monadic adjunctions
  Given any adjunction 
  (
  F
  :
  C
  →
  D
  ,
  G
  :
  D
  →
  C
  ,
  η
  ,
  ε
  )
  {\displaystyle (F:C\to D,G:D\to C,\eta ,\varepsilon )} with associated monad T, the functor G can be factored as
  D
  →
  G
  ~
  C
  T
  →
  forget
  C
  ,
  {\displaystyle D{\stackrel {\tilde {G}}{\to }}C^{T}{\stackrel {\text{forget}}{\to }}C,}
  i.e., G(Y) can be naturally endowed with a T-algebra structure for any Y in D. The adjunction is called a monadic adjunction if the first functor 
  G
  ~
  {\displaystyle {\tilde {G}}} yields an equivalence of categories between D and the Eilenberg–Moore category 
  C
  T
  {\displaystyle C^{T}}.[10] By extension, a functor 
  G
  :
  D
  →
  C
  {\displaystyle G\colon D\to C} is said to be monadic if it has a left adjoint 
  F
  {\displaystyle F} forming a monadic adjunction. For example, the free–forgetful adjunction between groups and sets is monadic, since algebras over the associated monad are groups, as was mentioned above. In general, knowing that an adjunction is monadic allows one to reconstruct objects in D out of objects in C and the T-action.
  Beck's monadicity theorem
  Beck's monadicity theorem gives a necessary and sufficient condition for an adjunction to be monadic. A simplified version of this theorem states that G is monadic if it is conservative (or G reflects isomorphisms, i.e., a morphism in D is an isomorphism if and only if its image under G is an isomorphism in C) and C has and G preserves coequalizers.
  For example, the forgetful functor from the category of compact Hausdorff spaces to sets is monadic. However the forgetful functor from all topological spaces to sets is not conservative since there are continuous bijective maps (between non-compact or non-Hausdorff spaces) that fail to be homeomorphisms. Thus, this forgetful functor is not monadic.[11] The dual version of Beck's theorem, characterizing comonadic adjunctions, is relevant in different fields such as topos theory and topics in algebraic geometry related to descent. A first example of a comonadic adjunction is the adjunction
  −
  ⊗
  A
  B
  :
  M
  o
  d
  A
  ⇄
  M
  o
  d
  B
  :
  forget
  {\displaystyle -\otimes _{A}B:\mathbf {Mod} _{A}\rightleftarrows \mathbf {Mod} _{B}:\operatorname {forget} }
  for a ring homomorphism 
  A
  →
  B
  {\displaystyle A\to B} between commutative rings. This adjunction is comonadic, by Beck's theorem, if and only if B is faithfully flat as an A-module. It thus allows to descend B-modules, equipped with a descent datum (i.e., an action of the comonad given by the adjunction) to A-modules. The resulting theory of faithfully flat descent is widely applied in algebraic geometry.
  Uses
  Monads are used in functional programming to express types of sequential computation (sometimes with side-effects). See monads in functional programming, and the more mathematically oriented Wikibook module b:Haskell/Category theory.
  Monads are used in the denotational semantics of impure functional and imperative programming languages.[12][13]
  In categorical logic, an analogy has been drawn between the monad-comonad theory, and modal logic via closure operators, interior algebras, and their relation to models of S4 and intuitionistic logics.
  </page>

  <page>
  As we all know:

  Git gets easier once you understand branches are homeomorphic endofunctors mapping submanifolds of a Hilbert space
  Which seems like jargon, but on the other hand,

  All told, a monad in X is just a monoid in the category of endofunctors of X, with product × replaced by composition of endofunctors and unit set by the identity endofunctor.
  is funny because it is true.



  It's a joke, that is based on the monad joke, but without actually getting the monad joke.

  The monad joke is funny on three levels:

  it tries to explain abstract mathematical jargon with even more mathematical jargon, which is even more abstract
  however, the explanation is actually correct
  and once you dive deeper into category theory, you will actually start to see monads as "just a monoid in the category of endofunctors"
  The Git thing, however, is just random gibberish. It is meant to resemble the monad joke, and might also be a jab at the darcs patch theory, but fundamentally, the person making the joke didn't understand the monad joke.

  Sources:

  This is the original tweet containing the quote:

  Wil Shipley (‏@wilshipley): Sweet god I hate git.

  Isaac Wolkerstorfer (‏@agnoster): @wilshipley git gets easier once you get the basic idea that branches are homeomorphic endofunctors mapping submanifolds of a Hilbert space.
  And this is a comment on Quora by the original author of the tweet:

  To confirm what Leo said, it was intended as a joke. […]

  It was intended as firmly tongue-in-cheek. I actually love git, and I think its complexity is greatly overblown. At the same time, I'm sympathetic to the fact that advice from git gurus to novices can end up sounding like inscrutable gibberish.

  It's not intended to have any deeper meaning. […]
  The Leo he is referring to is another answerer in the same thread, a mathematician, who basically explains why that is nonsense. (Hilbert spaces are continuous, patches and branches are discrete.)

  He also explains that he was inspired by this blog post (A Guide to GIT using spatial analogies), which actually does make sense.
  </page>

  <page>
  A Guide to GIT using spatial analogies
  Some developers find Git takes a little getting used to, claiming that it is conceptually convoluted compared to other distributed version control systems. I used to number myself amongst them.

  Happily, I’ve found that a couple of simple spatial analogies have made me proficient and fluent in using Git’s command-line interface.

  One of the things that tripped me up as a novice user was the way Git handles branches. Unlike more primitive version control systems, git repositories are not linear, they already support branching, and are thus best visualised as trees in their own right.  Branches thus become trees of trees. To visualise this, it’s simplest to think of the state of your repository as a point in a high-dimensional ‘code-space’,  in which branches are represented as n-dimensional membranes, mapping the spatial loci of successive commits onto the projected manifold of each cloned repository.

  Branches as n-branes

  The authors of the git manuals clearly had this in mind.  Taken directly from the git manual:

  In simplified form, git object storage is “just” a DAG of objects, with a handful of different types of entries from <commit> to the index, optionally modifying index and working tree to match. The <commit> defaults to HEAD in all forms.

  If <branch> is specified, git rebase will perform an automatic git checkout <branch> before doing anything else. Otherwise it remains on the current branch. All changes made by commits in the current branch but that are not in <upstream> are saved to a temporary area. This is the same set of commits that would be shown by git log <upstream>..HEAD (or git log HEAD, if –root is specified). The current branch is reset to <upstream>, or <newbase> if the –onto option was supplied. This has the exact same effect as git reset --hard <upstream> (or <newbase>). ORIG_HEAD is set to point at the tip of the commits that were previously saved into the temporary area, then reapplied to the current branch, one by one, in order. Note that any commits in HEAD which introduce the same textual changes as a commit in HEAD..<upstream> are omitted (i.e., a patch already accepted upstream with a different commit message or timestamp will be skipped).
  </page>

  Large Language models are Fuzzy Homomorphic Endofunctors on the manifold of syntactically correct documents in the  space of natural language documents. Conceptually, this can be thought of as moving along the surface, represented using a Gordian knot. The knot should be present in the scene, with the LLM moving from one document on the surface to the next. The surface is a manifold projection that represents syntactically valid documents, in the larger space of all possible unicode documents.

  Write a medium length tongue in cheack but informative blog post explaining how LLMs use statistics of language to find novel documents in a region of possible valid documents, and how changing the prompt context influences which document(s) the LLM will find.

  <post>
  Title: Fuzzy Homomorphic Endofunctors

  At first glance, large language models (LLMs) appear to be conjuring prose out of thin air. But look closer, and you'll see they are actually fuzzy homomorphic endofunctors navigating the manifold of syntactically valid documents within the vast topological space of all possible text sequences.

  Visualize, if you will, a Gordian knot. This tangled form represents the manifold of grammatically and semantically coherent documents. While knotted and twisted, it retains the continuous surface properties that define a manifold embedded in the higher-dimensional space of all Unicode strings.

  An LLM begins at one point on this language manifold corresponding to its initial prompt or context. From there, it crawls along the manifold's surface by modeling the statistical properties and patterns of natural language. With each forward pass, it transitions to nearby points, generating novel text that retains syntactic and semantic validity.

  But the LLM is no mere inchworm restricted to a single path. Its path is fuzzy and covered in a fine nap - for any given point, the model can bifurcate toward related but distinct documents within some radius defined by its inherent uncertainty. Change the initial prompt, and you shift the LLM's starting point, pushing it onto a different tendril of the manifold to reach new textual destinations.

  This fuzziness is key to the LLM's apparent creativity and generalization ability. It doesn't simply regurgitate verbatim text from its training set. Instead, it finds novel "paths" guided by the statistical trends and coherence of natural language itself. The manifold's tangled geometry encodes all sensical communication, and the LLM goes along for the ride, navigating between prompts while diffusing erratically yet staying true to the manifold's contours.

  Of course, this geometric intuition is just an abstract metaphor to shed light on the LLM's inner mechanics. Under the hood, these models are really just extremely high-capacity functions approximated by huge neural networks. But by conceptualizing them as manifold mappers, we can develop a richer understanding of their behavior, strengths, and failure modes as we continue unraveling their mysteries.
  </post>

  Rewrite the post in way suitable for a high school student who has taken calculus.
  <post>
  Title: Language Models Exploring the Landscape of Meaningful Text

  Language models like GPT appear to pull sensible writing out of thin air, but there's actually a deeper mechanism at play. To understand it, we can imagine a tangled 3D surface that represents all the grammatically correct and meaningful documents in the English language. This knotted surface is like a landscape of valid communication.

  When you give GPT a starting prompt, that's like dropping it onto one point of this tangled landscape. From there, GPT can crawl outward by analyzing the statistical patterns and rules that define coherent language. With each word it generates, it steps to a new nearby point on the landscape while still sticking to the twisted surface.

  But GPT doesn't just follow one rigid path across this landscape. There's some fuzziness in where it can go next from any given point. Based on the context so far, it has options to veer onto slightly different trails across the terrain. Change the initial prompt, and you move GPT to a totally different starting location on the language landscape, yielding new directions for it to traverse.

  This fuzzy flexibility to explore multiple meaningful paths from any point is key to GPT's creativity. It's not just reciting memorized texts, but finding novel routes guided by the geometry of language itself - the ebbs, flows and branchings of this vast communication terrain. As GPT travels unpredictably yet staying true to the landscape contours, it generates fresh, coherent writing that somehow feels insightful and relevant.

  Of course, under the hood GPT is really just a hyper-complicated math function encoded by a gigantic neural network. But thinking of it as a landscape explorer can shed light on how it stays on-track while allowing for open-ended navigation across the boundless frontiers of human language.
  </post>

  Combine the concepts in these posts explaining LLMs as searching for documents in the topological space of English language writing, similar to the git branches along a surface analogy.

  <post>
  Title: Language Models as Multidimensional Git Branchers

  Just as Git allows developers to branch and merge codebases across the manifold of all possible software projects, large language models (LLMs) can be viewed as intelligent agents branching and navigating across the vast high-dimensional manifold that encompasses all syntactically and semantically valid documents in a given natural language.

  Imagine this manifold as a tangled, knotted, continuous surface embedded in the higher-dimensional space of all possible text sequences. While contorted into complex folds and crevices, this "language landscape" has the defining properties of a manifold - every point on its Surface corresponds to a logically coherent document flow.

  When an LLM like GPT is prompted with some initial text, it is akin to being dropped onto a specific point on this language manifold. Its task is then to intelligently navigate, or "branch", along the manifold's surface by generating context-relevant text that continues along a coherent communicative trajectory.

  However, just like Git branches aren't a single rigid path, an LLM's generative process allows for some diffusion and fuzziness in its routes. From any given point, it can bifurcate into related but distinctly different textual passages that stay true to the constraints defined by the language manifold geometry.

  So in a sense, an LLM is like an intelligent Git that can fluidly branch across the high-dimensional language hypersurface by modeling the statistical patterns and rules that define meaningful communication flows. Change the initial prompt, and you transplant the LLM to a completely different region of the manifold to start branching anew along alternative coherent trajectories.

  This navigational geometric view explains how LLMs can somehow stay syntactically and semantically coherent while exhibiting properties of generalization, creativity, and multi-directional branching that allows them to fluidly explore the full scope of a natural language's expressive capacity. They are constrained yet open-ended multidimensional Git-like systems for exploring the language universe.
  </post>

  Reformulate this post without referencing git. Only discuss LLMs and topological spaces.

  <post>
  Title: Large Language Models as Multidimensional Explorers of the Natural Language Manifold

  Imagine a tangled, knotted, yet continuous surface existing in a vast higher-dimensional space. This twisting, folding surface represents the manifold of all syntactically valid documents that can be expressed in a given natural language. While contorted into intricate folds and crevices, every point on this "language landscape" corresponds to a coherent, meaningful flow of communication - not just a sequence of Unicode characters, but a sequence that a reader of the language would understand.

  Large language models (LLMs) like GPT can be viewed as explorers navigating this manifold. When prompted with an initial piece of text, an LLM is essentially dropped onto a specific location on the language manifold's surface. Its task is then to traverse this landscape, generating contextually relevant text that continues along locally coherent communicative trajectories while adhering to the constraints defined by the manifold's geometry. This starting point is the initial prompt used when invoking the model.

  However, the paths an LLM can take are not rigidly predetermined. From any given point, there exists a fuzzy radius within which the model can bifurcate onto distinctly different but equally valid textual passages. By modeling the statistical patterns and rules that shape natural language, LLMs can fluidly branch across this high-dimensional hypersurface, exploring a multitude of expressive trajectories that remain true to the manifold's contours. This ability comes from the weights of its neural network and transformer architecture.

  Changing the initial prompt is akin to teleporting the LLM to an entirely new region of the manifold to begin its exploratory branching anew along alternative coherent paths through the language landscape's folds and crevices. This free yet constrained navigational ability allows LLMs to stay syntactically and semantically coherent while exhibiting powerful properties of generalization, creativity, and open-ended multidirectional exploration across the full expressive capacity of a natural language.

  In essence, LLMs are semi-intelligent, fuzzy, multidimensional explorers fleetingly mapping out the tangled manifold that encompasses the universe of meaningful textual communication within a language. They are constrained sabreviouranchers, feeling their way through the contours of coherent language understanding in a continuous high-dimensional space.
  </post>

  This sounds like a Deepak Chopra generator, but it's on the right track. Simplify the language in the post to be appropriate for a professional information technology audience.

  <post>
  Title: Fuzzy Homomorphic Endofunctors

  Consider all the possible sequences of characters that make up syntactically valid text in a given natural language. This set forms a high-dimensional space. However, not all points in this vast space correspond to coherent, meaningful content a reader would understand. The set of all well-formed documents defines a complex, convoluted manifold - a lower-dimensional continuous surface embedded within that higher space.

  Large language models (LLMs) like GPT can be viewed as intelligent agents that explore and navigate this natural language manifold. When given an initial prompt, an LLM is effectively placed at a specific point on this manifold's surface corresponding to coherent text so far. Its neural architecture allows it to model local statistical patterns and transition to nearby points, generating contextually relevant text while remaining on the manifold - adhering to syntactic and semantic constraints.

  However, from any given point, the LLM is not locked into a single predetermined path. There exists a fuzzy radius within which it can branch off onto distinctly different but equally valid trajectories over the manifold's surface. By leveraging vast neural weights trained on immense language data, LLMs gain the ability to fluidly navigate and explore multiple plausible communicative paths through the high-dimensional language surface.

  Altering the initial prompt is akin to repositioning the LLM on another part of the manifold to reset its constrained exploration. This flexibility to search out diverse meaningful continuations from any context, while respecting linguistic constraints, underlies the generalization and open-ended creative expression abilities of large language models.

  In essence, LLMs are semi-intelligent multidimensional explorers intelligently mapping out the convoluted hypersurface representing a natural language's full scope of meaningful communication within a vast formal space of possible texts. Their generative behavior stems from learned high-dimensional geometry inextricably tied to human language itself.
  </post>

  Create a several different tweet-length summaries of this post, suitable for social media.
---

1. Large language models navigate the tangled manifold of meaningful text, generating coherent continuations from any prompt while creatively branching across the high-dimensional language hypersurface.

2. LLMs are exploratory fuzzy homomorphic endofunctors mapping between points on the manifold of syntactically valid documents, traversing diverse paths of meaning.

3. Trapped on the twisted manifold of natural language, large AI models navigate from prompt to prompt, branching creatively yet adhering to the geometry of human communication.

4. By modeling statistical patterns, LLMs traverse the convoluted hypersurface representing the scope of a language, generating novel meaningful text from any context.

5. Large AI models explore the geometry of human communication itself - intelligently mapping out the complex manifold defining all coherent documents in a natural language.

6. Give an LLM a prompt, and it branches onto the manifold of valid language at that point, creatively extending along statistically-modeled trajectories of meaning.
