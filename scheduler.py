"""Employee weekly scheduler. Run: python scheduler.py sample.json --seed 7"""
import argparse, json, random
from pathlib import Path

DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
SHIFTS = ["morning", "afternoon", "evening"]
MIN_PER_SHIFT = 2
DEFAULT_CAPACITY = 4


def build_schedule(data, seed=7):
    employees = data["employees"]
    capacity = int(data.get("shift_capacity", DEFAULT_CAPACITY))
    if capacity < MIN_PER_SHIFT:
        raise ValueError("shift_capacity must be at least 2")
    if len({e["name"] for e in employees}) != len(employees):
        raise ValueError("Employee names must be unique")
    for e in employees:
        if len(e.get("preferences", [])) != 7:
            raise ValueError(f"{e['name']} must provide 7 daily preferences")
        for prefs in e["preferences"]:
            if not isinstance(prefs, list) or not prefs or any(p not in SHIFTS for p in prefs):
                raise ValueError(f"Each preference must be a nonempty list of {SHIFTS}")
    # Six distinct employees are needed each day, thus at least ceil(42/5)=9 overall.
    if len(employees) < 9:
        raise ValueError("At least 9 employees are required to staff 3 shifts x 2 people for 7 days with a 5-day weekly limit")

    rng = random.Random(seed)
    days = [{s: [] for s in SHIFTS} for _ in DAYS]
    worked = {e["name"]: set() for e in employees}
    by_name = {e["name"]: e for e in employees}

    def assign(name, day, shift):
        if day in worked[name] or len(worked[name]) >= 5 or len(days[day][shift]) >= capacity:
            return False
        days[day][shift].append(name)
        worked[name].add(day)
        return True

    # Reserve minimum staffing first, randomly choosing eligible employees per shift.
    for d in range(7):
        for s in SHIFTS:
            while len(days[d][s]) < MIN_PER_SHIFT:
                eligible = [e["name"] for e in employees
                            if d not in worked[e["name"]] and len(worked[e["name"]]) < 5]
                if not eligible:
                    raise ValueError(f"Cannot meet minimum staffing on {DAYS[d]} {s}; add employees")
                # Balance weekly load to preserve workers for later days; randomize ties.
                least_worked = min(len(worked[n]) for n in eligible)
                eligible = [n for n in eligible if len(worked[n]) == least_worked]
                rng.shuffle(eligible)
                # Among equally available workers, favor those who requested this shift.
                preferred = [n for n in eligible if s in by_name[n]["preferences"][d]]
                name = (preferred or eligible)[0]
                assign(name, d, s)

    # Place remaining requested work by preference rank. When a preferred shift is full,
    # try the employee's other ranked shifts on that day, then try the following day.
    for d in range(7):
        order = list(employees)
        rng.shuffle(order)
        for e in order:
            name = e["name"]
            if d in worked[name] or len(worked[name]) >= 5:
                continue
            prefs = e["preferences"][d]
            choices = prefs + [s for s in SHIFTS if s not in prefs]
            placed = False
            for shift in choices:
                if assign(name, d, shift):
                    placed = True
                    break
            if not placed and d < 6 and len(worked[name]) < 5:
                next_prefs = e["preferences"][d + 1]
                next_choices = next_prefs + [s for s in SHIFTS if s not in next_prefs]
                for shift in next_choices:
                    if assign(name, d + 1, shift):
                        break

    return {"days": days, "worked": worked, "capacity": capacity}


def format_schedule(result):
    lines = ["WEEKLY EMPLOYEE SCHEDULE", "=" * 78]
    for i, day in enumerate(DAYS):
        lines.append(f"\n{day}")
        for shift in SHIFTS:
            names = ", ".join(result["days"][i][shift])
            lines.append(f"  {shift.capitalize():10} {names}")
    lines += ["\nDays worked:"]
    for name, days in sorted(result["worked"].items()):
        lines.append(f"  {name:16} {len(days)}")
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", nargs="?", default="sample.json")
    parser.add_argument("--seed", type=int, default=7, help="random seed for repeatable coverage assignments")
    args = parser.parse_args()
    data = json.loads(Path(args.input).read_text(encoding="utf-8"))
    print(format_schedule(build_schedule(data, args.seed)))

if __name__ == "__main__":
    main()

