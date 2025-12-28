module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert
    'type-enum': [
      2,
      'always',
      [
        'feat',     // New feature
        'fix',      // Bug fix
        'docs',     // Documentation
        'style',    // Formatting (no code change)
        'refactor', // Code change (no new feature, no bug fix)
        'perf',     // Performance improvement
        'test',     // Adding tests
        'build',    // Build system changes
        'ci',       // CI configuration
        'chore',    // Maintenance
        'revert',   // Revert previous commit
      ],
    ],
    'type-case': [2, 'always', 'lower-case'],
    'subject-case': [0], // Allow any case in subject
    'subject-max-length': [2, 'always', 72],
    'body-max-line-length': [0], // No limit on body lines
  },
};
