# Weekly Employee Scheduler

Two implementations of a weekly employee shift scheduler, in Python and JavaScript. Both accept the same JSON input schema and enforce the required coverage and weekly limits.

## Run

```sh
python scheduler.py sample.json --seed 7
node scheduler.js sample.json --seed 7
```

`--seed` makes the random coverage choices repeatable within each implementation. The languages use different pseudorandom generators, so a seed does not imply byte-for-byte identical schedules across languages.

## Input

`sample.json` contains ten sample employees. Each employee has seven preference lists in Monday-to-Sunday order. List preferences from highest to lowest priority, for example ` ["morning", "evening"] `. The optional `shift_capacity` defaults to 4 and must be at least 2.

## Scheduling rules

1. The scheduler requires at least nine employees: it needs 42 distinct employee-days per week, and each employee can work at most five days.
2. It assigns minimum coverage first: two distinct employees to each of the three shifts, every day. It balances assignments toward employees with fewer workdays, randomizes ties, and favors people who requested that shift.
3. It then tries to place each remaining daily preference in priority order. If that shift is full, it tries the employee's other ranked shifts that day. If no shift has room, it tries the next day.
4. Each employee works at most one shift per day and at most five days in the week. Shift capacity can be raised in the JSON input.

If the requested minimum coverage cannot be met, the program reports an input error instead of silently emitting an invalid schedule. Employees not assigned after minimum coverage may have fewer than five workdays if shift capacity or available demand prevents additional assignments.
