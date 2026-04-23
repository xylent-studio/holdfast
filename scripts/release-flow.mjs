import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const STAGING_PROJECT = 'holdfast-staging';
const STAGING_BASE_URL = 'https://holdfast-staging.pages.dev';
const PRODUCTION_PROJECT = 'holdfast';
const PRODUCTION_BASE_URL = 'https://holdfast.xylent.studio';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pagesValidationScript = 'scripts/pages-validation.mjs';

function printUsage() {
  console.log(`Holdfast release flow helper

Usage:
  node scripts/release-flow.mjs --lane staging --env-file .env.staging.local
  node scripts/release-flow.mjs --lane production

Options:
  --lane <staging|production>  Release lane to run.
  --env-file <path>            Build-time env file for staging deploys.
  --help                       Show this message.
`);
}

function escapeForCmd(value) {
  if (/^[\w./:@=-]+$/u.test(value)) {
    return value;
  }

  return `"${value.replaceAll('"', '""')}"`;
}

function run(binary, args, options = {}) {
  const spawnOptions = {
    cwd: repoRoot,
    encoding: 'utf8',
    env: options.env ?? process.env,
    stdio: options.capture ? 'pipe' : 'inherit',
  };
  const result =
    process.platform === 'win32'
      ? spawnSync(
          process.env.ComSpec ?? 'cmd.exe',
          ['/d', '/s', '/c', [binary, ...args].map(escapeForCmd).join(' ')],
          spawnOptions,
        )
      : spawnSync(binary, args, spawnOptions);

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const detail =
      options.capture && (result.stderr || result.stdout)
        ? `\n${(result.stderr || result.stdout).trim()}`
        : '';
    throw new Error(
      `${binary} ${args.join(' ')} failed with exit code ${result.status}.${detail}`,
    );
  }

  return options.capture ? result.stdout.trim() : '';
}

function parseArgs(argv) {
  const options = {
    envFile: null,
    help: false,
    lane: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--lane') {
      options.lane = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (arg === '--env-file') {
      options.envFile = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function gitValue(args) {
  return run('git', args, { capture: true });
}

function printStep(message) {
  console.log('');
  console.log(message);
}

function printGitContext() {
  const branch = gitValue(['rev-parse', '--abbrev-ref', 'HEAD']);
  const commit = gitValue(['rev-parse', '--short', 'HEAD']);
  console.log(`Git branch: ${branch}`);
  console.log(`Git commit: ${commit}`);
}

function runPagesValidation(args) {
  run('node', [pagesValidationScript, ...args]);
}

function runStagingRelease(options) {
  printStep('Staging release candidate');
  printGitContext();

  printStep('Running local validation');
  run('npm', ['run', 'lint']);
  run('npm', ['run', 'typecheck']);
  run('npm', ['run', 'test']);
  run('npm', ['run', 'build']);
  run('npx', ['playwright', 'test']);

  const envArgs = options.envFile ? ['--env-file', options.envFile] : [];

  printStep('Deploying staging');
  runPagesValidation([
    '--project',
    STAGING_PROJECT,
    '--create',
    '--deploy',
    '--base-url',
    STAGING_BASE_URL,
    ...envArgs,
  ]);

  printStep('Running staging hosted auth smoke');
  runPagesValidation([
    '--project',
    STAGING_PROJECT,
    '--auth-smoke',
    '--base-url',
    STAGING_BASE_URL,
    ...envArgs,
  ]);

  printStep('Running staging hosted sync smoke');
  runPagesValidation([
    '--project',
    STAGING_PROJECT,
    '--sync-smoke',
    '--base-url',
    STAGING_BASE_URL,
    ...envArgs,
  ]);

  printStep('Staging release candidate passed');
  console.log('Promote intentionally with `npm run release:prod` after review.');
}

function runProductionRelease() {
  printStep('Production promotion');
  printGitContext();

  printStep('Building production artifact');
  run('npm', ['run', 'build']);

  printStep('Deploying production');
  runPagesValidation([
    '--project',
    PRODUCTION_PROJECT,
    '--create',
    '--deploy',
    '--base-url',
    PRODUCTION_BASE_URL,
    '--skip-build',
  ]);

  printStep('Running production hosted auth smoke');
  runPagesValidation([
    '--project',
    PRODUCTION_PROJECT,
    '--auth-smoke',
    '--base-url',
    PRODUCTION_BASE_URL,
  ]);

  printStep('Running production hosted sync smoke');
  runPagesValidation([
    '--project',
    PRODUCTION_PROJECT,
    '--sync-smoke',
    '--base-url',
    PRODUCTION_BASE_URL,
  ]);
}

function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printUsage();
    return;
  }

  if (options.lane !== 'staging' && options.lane !== 'production') {
    throw new Error('Pass --lane staging or --lane production.');
  }

  if (options.lane === 'staging') {
    runStagingRelease(options);
    return;
  }

  runProductionRelease();
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
