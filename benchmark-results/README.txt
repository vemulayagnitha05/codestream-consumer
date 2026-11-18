Benchmark results for CodeStreamConsumer

These files contain measurements from the project's own experiments.

Observed tests:
- A.java and B.java with CHUNKSIZE 5.
- Brute-force A/B chunk comparison: 75 x 70 = 5250 possible comparisons.
- Hash-filtering run: 24 detailed chunk-match checks and 6 detected clones.
- Sequential timing run: A.java was processed first, then B.java.
- Dataset-size timing run: A1.java through A10.java were processed sequentially.
- Qualitas Corpus run reached 15,200 processed files before the consumer crashed. This was a pre-fix run, before the upload error-handling changes.
- No CHUNKSIZE 3 or CHUNKSIZE 10 results are included in this submission.
