import { describe, expect, it } from 'vitest';
import { matchProject, parseTaskInput, resolveDueToken } from './taskInput';

// Pin "now" to Thursday 2026-07-30 (IST 11:30) so relative dates are stable.
const NOW = new Date('2026-07-30T06:00:00Z');
const PROJECTS = ['Home', 'Work', 'sundar-os'];

describe('resolveDueToken', () => {
  it('resolves today / tomorrow aliases', () => {
    expect(resolveDueToken('today', NOW)).toBe('2026-07-30');
    expect(resolveDueToken('tod', NOW)).toBe('2026-07-30');
    expect(resolveDueToken('tomorrow', NOW)).toBe('2026-07-31');
    expect(resolveDueToken('tmr', NOW)).toBe('2026-07-31');
  });

  it('resolves N-day and N-week offsets', () => {
    expect(resolveDueToken('3d', NOW)).toBe('2026-08-02');
    expect(resolveDueToken('2w', NOW)).toBe('2026-08-13');
  });

  it('passes through ISO dates', () => {
    expect(resolveDueToken('2026-08-01', NOW)).toBe('2026-08-01');
  });

  it('resolves weekday names to the next strictly-future occurrence', () => {
    // NOW is Thursday.
    expect(resolveDueToken('fri', NOW)).toBe('2026-07-31');
    expect(resolveDueToken('mon', NOW)).toBe('2026-08-03');
    expect(resolveDueToken('thu', NOW)).toBe('2026-08-06'); // same weekday → +7
  });

  it('returns null for garbage', () => {
    expect(resolveDueToken('someday', NOW)).toBeNull();
    expect(resolveDueToken('5x', NOW)).toBeNull();
  });
});

describe('matchProject', () => {
  // The user's actual project set — the matcher has to disambiguate within it.
  const REAL = [
    'Acuity NeoRes',
    'Amrutha',
    'Amrutha - PhD',
    'Career',
    'Data Consultant',
    'Family',
    'Hobby Projects',
    'Home & Life',
    'Lotus Gate',
    'PhD - Amrutha',
    'Programming - APU - Amrutha',
    'Routines',
    'SA Management - APU - Amrutha',
    'Sundar OS',
    'Swiss Relocation 2026',
    'Uncategorized',
    'Wedding',
    'Work',
  ];

  it('prefers an exact name over any looser match', () => {
    expect(matchProject('amrutha', REAL)).toBe('Amrutha');
    expect(matchProject('work', REAL)).toBe('Work');
  });

  it('still prefix-matches, case-insensitively', () => {
    expect(matchProject('wed', REAL)).toBe('Wedding');
    expect(matchProject('SWISS', REAL)).toBe('Swiss Relocation 2026');
  });

  it('matches word initials', () => {
    expect(matchProject('hl', REAL)).toBe('Home & Life');
    expect(matchProject('sos', REAL)).toBe('Sundar OS'); // s-undar o-s → "sos"
    expect(matchProject('lg', REAL)).toBe('Lotus Gate');
    expect(matchProject('dc', REAL)).toBe('Data Consultant');
  });

  it('matches an interior substring', () => {
    expect(matchProject('gate', REAL)).toBe('Lotus Gate');
    expect(matchProject('consultant', REAL)).toBe('Data Consultant');
  });

  it('matches a loose subsequence with gaps', () => {
    expect(matchProject('sndr', REAL)).toBe('Sundar OS');
    expect(matchProject('rltn', REAL)).toBe('Swiss Relocation 2026');
  });

  it('breaks ties toward the shorter, more specific name', () => {
    // Both contain "amrutha"; the bare project should win over the compounds.
    expect(matchProject('amru', REAL)).toBe('Amrutha');
  });

  it('is independent of the order projects arrive in', () => {
    const shuffled = [...REAL].reverse();
    for (const q of ['hl', 'sos', 'amru', 'gate', 'wed']) {
      expect(matchProject(q, shuffled)).toBe(matchProject(q, REAL));
    }
  });

  it('returns null when nothing matches, so the token becomes a new project', () => {
    expect(matchProject('zzqx', REAL)).toBeNull();
    expect(matchProject('', REAL)).toBeNull();
    expect(matchProject('anything', [])).toBeNull();
  });
});

describe('parseTaskInput', () => {
  it('parses a bare title with no tokens', () => {
    const { params, errors } = parseTaskInput('Call the plumber', PROJECTS, NOW);
    expect(params.text).toBe('Call the plumber');
    expect(params.project).toBeUndefined();
    expect(params.due).toBeUndefined();
    expect(errors).toEqual([]);
  });

  it('extracts all tokens regardless of order and leaves clean title', () => {
    const { params, preview, errors } = parseTaskInput(
      'Buy milk @tomorrow #home ~30m',
      PROJECTS,
      NOW,
    );
    expect(params.text).toBe('Buy milk');
    expect(params.project).toBe('Home'); // prefix-matched, canonical casing
    expect(params.due).toBe('2026-07-31');
    expect(params.est).toBe('30m');
    expect(preview.dueLabel).toBe('Tomorrow');
    expect(errors).toEqual([]);
  });

  it('prefix-matches an existing project case-insensitively', () => {
    const { params } = parseTaskInput('Standup #wo', PROJECTS, NOW);
    expect(params.project).toBe('Work');
  });

  it('treats an unknown #project as a new project verbatim', () => {
    const { params } = parseTaskInput('Read book #reading', PROJECTS, NOW);
    expect(params.project).toBe('reading');
  });

  it('maps *repeat tokens to server recurrence strings', () => {
    expect(parseTaskInput('x *daily', PROJECTS, NOW).params.recur).toBe('every day');
    expect(parseTaskInput('x *weekly', PROJECTS, NOW).params.recur).toBe('every week');
    expect(parseTaskInput('x *fortnightly', PROJECTS, NOW).params.recur).toBe(
      'every 2 weeks',
    );
  });

  it('anchors *monthly to the due day when present', () => {
    const { params, preview } = parseTaskInput(
      'Pay rent @2026-08-01 *monthly',
      PROJECTS,
      NOW,
    );
    expect(params.due).toBe('2026-08-01');
    expect(params.recur).toBe('every month on the 1st');
    expect(preview.recurLabel).toBe('monthly (1st)');
  });

  it('records an error and keeps the token in the title on a bad date', () => {
    const { params, errors } = parseTaskInput('Ship it @whenever', PROJECTS, NOW);
    expect(params.due).toBeUndefined();
    expect(params.text).toBe('Ship it @whenever');
    expect(errors).toHaveLength(1);
  });

  it('does not treat a mid-word hash/at as a token', () => {
    const { params } = parseTaskInput('email a@b.com re: c#4', PROJECTS, NOW);
    expect(params.text).toBe('email a@b.com re: c#4');
    expect(params.project).toBeUndefined();
    expect(params.due).toBeUndefined();
  });
});
