# Changelog: contacts export clean-up

- Rows in: 12
- Dropped for invalid email: 2 (`linus@kernel` has no dot in the domain; `ken@@bell-labs.com` has two `@`)
- Duplicates removed: 2 (the second `ada@example.com`, data row 4 = file line 5; the second `dmr@bell-labs.com`, data row 10 = file line 11; first occurrences kept). Data rows are counted from 1 below the header.
- Rows out: 8

12 - 2 - 2 = 8. All emails lowercased and trimmed, names trimmed, dates parsed as DD/MM/YYYY (the raw export's format, so `03/01/2024` is 3 January) and rewritten as YYYY-MM-DD.
