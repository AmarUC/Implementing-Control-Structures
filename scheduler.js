// Employee weekly scheduler. Run: node scheduler.js sample.json --seed 7
const fs = require('fs');
const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const SHIFTS = ['morning','afternoon','evening'];
const MIN_PER_SHIFT = 2;
const DEFAULT_CAPACITY = 4;

// Small seeded PRNG keeps sample schedules reproducible in both runtimes.
function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(items, random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function buildSchedule(data, seed = 7) {
  const employees = data.employees;
  const capacity = Number(data.shift_capacity ?? DEFAULT_CAPACITY);
  if (!Number.isInteger(capacity) || capacity < MIN_PER_SHIFT) throw Error('shift_capacity must be an integer of at least 2');
  if (new Set(employees.map(e => e.name)).size !== employees.length) throw Error('Employee names must be unique');
  for (const e of employees) {
    if (!Array.isArray(e.preferences) || e.preferences.length !== 7) throw Error(`${e.name} must provide 7 daily preferences`);
    for (const prefs of e.preferences) {
      if (!Array.isArray(prefs) || !prefs.length || prefs.some(p => !SHIFTS.includes(p))) throw Error(`Each preference must be a nonempty list of ${SHIFTS.join(', ')}`);
    }
  }
  // Six distinct employees are needed each day, so 42 weekly slots / 5 = 9 employees minimum.
  if (employees.length < 9) throw Error('At least 9 employees are required to meet daily coverage and the 5-day weekly limit');
  const random = seededRandom(seed);
  const days = DAYS.map(() => Object.fromEntries(SHIFTS.map(s => [s, []])));
  const worked = Object.fromEntries(employees.map(e => [e.name, new Set()]));
  const byName = Object.fromEntries(employees.map(e => [e.name, e]));
  function assign(name, day, shift) {
    if (worked[name].has(day) || worked[name].size >= 5 || days[day][shift].length >= capacity) return false;
    days[day][shift].push(name);
    worked[name].add(day);
    return true;
  }
  for (let d = 0; d < 7; d++) {
    for (const shift of SHIFTS) {
      while (days[d][shift].length < MIN_PER_SHIFT) {
        const eligible = employees.map(e => e.name).filter(n => !worked[n].has(d) && worked[n].size < 5);
        if (!eligible.length) throw Error(`Cannot meet minimum staffing on ${DAYS[d]} ${shift}; add employees`);
        // Balance weekly load to preserve workers for later days; randomize ties.
        const leastWorked = Math.min(...eligible.map(n => worked[n].size));
        const randomized = shuffle(eligible.filter(n => worked[n].size === leastWorked), random);
        // Among equally available workers, favor those who requested this shift.
        const preferred = randomized.filter(n => byName[n].preferences[d].includes(shift));
        assign((preferred.length ? preferred : randomized)[0], d, shift);
      }
    }
  }
  for (let d = 0; d < 7; d++) {
    for (const e of shuffle(employees, random)) {
      const name = e.name;
      if (worked[name].has(d) || worked[name].size >= 5) continue;
      const prefs = e.preferences[d];
      const choices = [...prefs, ...SHIFTS.filter(s => !prefs.includes(s))];
      let placed = false;
      for (const shift of choices) if (assign(name, d, shift)) { placed = true; break; }
      if (!placed && d < 6 && worked[name].size < 5) {
        const nextPrefs = e.preferences[d + 1];
        const nextChoices = [...nextPrefs, ...SHIFTS.filter(s => !nextPrefs.includes(s))];
        for (const shift of nextChoices) if (assign(name, d + 1, shift)) break;
      }
    }
  }
  return { days, worked, capacity };
}
function formatSchedule(result) {
  const lines = ['WEEKLY EMPLOYEE SCHEDULE', '='.repeat(78)];
  DAYS.forEach((day, i) => {
    lines.push(`\n${day}`);
    for (const shift of SHIFTS) lines.push(`  ${shift[0].toUpperCase()+shift.slice(1).padEnd(9)} ${result.days[i][shift].join(', ')}`);
  });
  lines.push('\nDays worked:');
  for (const name of Object.keys(result.worked).sort()) lines.push(`  ${name.padEnd(16)} ${result.worked[name].size}`);
  return lines.join('\n');
}
if (require.main === module) {
  const file = process.argv[2] || 'sample.json';
  const seedArg = process.argv.indexOf('--seed');
  const seed = seedArg >= 0 ? Number(process.argv[seedArg + 1]) : 7;
  console.log(formatSchedule(buildSchedule(JSON.parse(fs.readFileSync(file, 'utf8')), seed)));
}
module.exports = { buildSchedule, formatSchedule };

