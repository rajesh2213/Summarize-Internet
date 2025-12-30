Summarize-Internet
System for extracting and summarizing content from the web. The main goal was to solve the "garbage in, garbage out" problem with LLMs by building a heavy-duty extraction and cleaning pipeline before any AI hits the text.

Core Logic
1. Hybrid Extraction & Fallbacks
Standard scrapers fail on React/Next.js sites. I implemented a fallback logic:

Static First: Tries to fetch via standard HTTP.

Shell Detection: Checks text-to-HTML density and searches for SPA indicators.

Playwright Fallback: Only spins up a headless browser if the static fetch fails or detects a shell. This saves significant CPU/RAM.

2. The Extraction Stack
runs multiple strategies in parallel to ensure it get the best possible version of the content:

Readability: Mozilla’s engine for standard articles.

JSON-LD: Pulling structured schema data.

Custom DOM Scorer: A recursive function that ranks nodes based on text length, punctuation density, and link-to-text ratios.

3. Scoring & Selection
Since I get multiple versions of the same page, using a weighted scorer to pick the winner:

Semantic Match: Uses local embeddings (Xenova/all-MiniLM) to see which candidate matches the page title best.

Centroid Alignment: Compares candidates against each other to find the most representative block.

Prototype Matching: Uses pgvector to check if the content looks like high-quality data I've processed before.

4. Noise Filtering
To save tokens and improve summary accuracy, I strip:

Navbars, footers, and sidebars via link-density thresholds.

"Junk" text like cookie notices and newsletter CTAs.

Repetitive fragments using sentence-level Set operations.

Architecture & Scaling
SSE Updates: The frontend uses Server-Sent Events to stream the internal state (Ingesting, Scoring, Summarizing) instead of constant polling.

Hierarchical Merge: For long transcripts (400k+ characters), the system chunks at ~90k tokens, summarizes the pieces, and then merges them back together in batches to preserve context.

Vector Dedupe: Before processing a URL, it checks pgvector for a 0.98 similarity match to avoid re-running expensive LLM calls for near-identical content.