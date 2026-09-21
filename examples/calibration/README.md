# Calibration samples

Each `<n>-<slug>/` folder is one job: `scope.md` (what the payer asked), the delivered files, and `expected.json` with the human label (`{"expected":"PASS|NEEDS_REVIEW|FAIL","note":"…"}`). `pnpm --filter @vouch/web calibrate --model` runs the verifier over every folder plus the adversarial corpus and prints the confusion matrix that is copied into the root README.

Samples 01–09 are **synthetic**: written on Sept 21 by the Vouch team so the PASS row of the matrix is not empty (five acceptable deliveries across a brief, landing copy, code with tests, a CSV clean-up and a translation; three realistic near-misses; one non-delivery). Their `expected.json` says so in `origin`. They are not field data.

Field samples come from three places, and replace the synthetic ones as they arrive: jobs run on the live site (the payer's approve or dispute is the label, with both sides' permission to quote), the team's own past freelance work with the original brief, and beta testers' finished jobs. Target: 20 field samples.
