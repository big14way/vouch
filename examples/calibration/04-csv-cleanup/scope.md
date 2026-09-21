# Scope: clean a contacts export

The raw export is attached as `contacts_raw.csv` (columns `name,email,signup_date`, dates as DD/MM/YYYY). Deliver:

1. `contacts_clean.csv` with the same three columns where:
   - names and emails are trimmed of surrounding whitespace and emails are lowercased;
   - rows whose email is not a valid address (one `@`, a domain with a dot) are dropped;
   - duplicate emails are removed, keeping the first occurrence in file order;
   - `signup_date` is rewritten as ISO `YYYY-MM-DD`.
2. `changelog.md` stating: rows in, rows dropped for invalid email, duplicates removed, rows out. The four numbers must add up.

Return the raw file unchanged alongside the cleaned one.
