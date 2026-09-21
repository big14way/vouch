# Calibration repeat runs, Sept 21

Question: is the gap between models on the release path stable, or noise? Each configuration was run three times on the nine job samples in `examples/calibration` (`pnpm --filter @vouch/web calibrate --model --only real`), same prompt and rules as the full run. "Released" counts the five acceptable deliveries that came back PASS at confidence ≥ 0.90, the payer's auto-release threshold in the harness.

| configuration | run | accuracy | released | wrong PASS | good deliveries held |
|---|---|---|---|---|---|
| Sonnet 4.6, temperature 0 | 1 | 8/9 | 4/5 | 0 | 02-landing-copy |
| Sonnet 4.6, temperature 0 | 2 | 8/9 | 4/5 | 0 | 02-landing-copy |
| Sonnet 4.6, temperature 0 | 3 | 8/9 | 4/5 | 0 | 02-landing-copy |
| Sonnet 5, thinking off | 1 | 6/9 | 2/5 | 0 | 02-landing-copy, 03-slugify-with-tests, 04-csv-cleanup |
| Sonnet 5, thinking off | 2 | 6/9 | 2/5 | 0 | 02-landing-copy, 03-slugify-with-tests, 04-csv-cleanup |
| Sonnet 5, thinking off | 3 | 7/9 | 3/5 | 0 | 02-landing-copy, 04-csv-cleanup |
| Sonnet 5, adaptive thinking, medium effort | 1 | 8/9 | 4/5 | 0 | 02-landing-copy |
| Sonnet 5, adaptive thinking, medium effort | 2 | 8/9 | 4/5 | 0 | 02-landing-copy |
| Sonnet 5, adaptive thinking, medium effort | 3 | 8/9 | 4/5 | 0 | 02-landing-copy |

Reading: Sonnet 4.6 and Sonnet 5 with adaptive thinking are identical on every run (8/9, four of five released, the landing copy held). Sonnet 5 with thinking off releases two or three of five, holding the CSV clean-up on a row count it gets wrong and, in two runs, the code sample as unverifiable. No configuration produced a wrong PASS in any run.

The landing copy is held by every configuration for the same reason: the scope sets word limits, and the models miscount or add a limit the scope does not state, which the rules then treat as unverifiable (confidence capped at 0.60). Scopes with tight word or character limits are where verification is least reliable; the failure is a hold for review, never a release.

Decision: production runs `claude-sonnet-5` with `VERIFIER_THINKING=adaptive` and `VERIFIER_EFFORT=medium`. Same release rate and safety as Sonnet 4.6 across three runs each, current generation, $2/$10 per million tokens against $3/$15, about 15 s per verification with thinking on.
