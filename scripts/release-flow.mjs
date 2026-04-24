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
  node scripts/release-flow.mjs --lane production --staging-env-file .env.staging.local

Options:
  --lane <staging|production>     Release lane to run.
  --env-file <path>               Build-time env file for staging deploys.
  --staging-env-file <path>       Build-time env file for the staging realignment pass after production.
  --help                          Show this message.
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
    stagingEnvFile: '.env.staging.local',
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

    if (arg === '--staging-env-file') {
      options.stagingEnvFile = argv[index + 1] ?? null;
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

function runLocalValidation() {
  printStep('Running local validation');
  run('npm', ['run', 'lint']);
  run('npm', ['run', 'typecheck']);
  run('npm', ['run', 'test']);
  run('npm', ['run', 'build']);
  run('npx', ['playwright', 'test']);
}

function envArgsFor(filePath) {
  return filePath ? ['--env-file', filePath] : [];
}

function runHostedLaneSmoke(projectName, baseUrl, envArgs = []) {
  printStep(`Running ${projectName} hosted shell smoke`);
  runPagesValidation([
    '--project',
    projectName,
    '--smoke',
    '--base-url',
    baseUrl,
    ...envArgs,
  ]);
}

function runHostedAuthSmoke(projectName, baseUrl, envArgs = []) {
  printStep(`Running ${projectName} hosted auth smoke`);
  runPagesValidation([
    '--project',
    projectName,
    '--auth-smoke',
    '--base-url',
    baseUrl,
    ...envArgs,
  ]);
}

function runHostedSyncSmoke(projectName, baseUrl, envArgs = []) {
  printStep(`Running ${projectName} hosted sync smoke`);
  runPagesValidation([
    '--project',
    projectName,
    '--sync-smoke',
    '--base-url',
    baseUrl,
    ...envArgs,
  ]);
}

function runStagingDeploy(envArgs = [], options = {}) {
  printStep('Deploying staging');
  runPagesValidation([
    '--project',
    STAGING_PROJECT,
    '--create',
    '--deploy',
    '--base-url',
    STAGING_BASE_URL,
    ...(options.skipBuild ? ['--skip-build'] : []),
    ...envArgs,
  ]);
}

function runStagingRelease(options) {
  printStep('Staging release candidate');
  printGitContext();
  runLocalValidation();

  const envArgs = envArgsFor(options.envFile);

  runStagingDeploy(envArgs);
  runHostedLaneSmoke(STAGING_PROJECT, STAGING_BASE_URL, envArgs);
  runHostedAuthSmoke(STAGING_PROJECT, STAGING_BASE_URL, envArgs);
  runHostedSyncSmoke(STAGING_PROJECT, STAGING_BASE_URL, envArgs);

  printStep('Staging release candidate passed');
  console.log('Promote intentionally with `npm run release:prod` after review.');
}

function runProductionRelease(options) {
  printStep('Production promotion');
  printGitContext();

  runLocalValidation();

  printStep('Deploying production');
  runPagesValidation([
    '--project',
    PRODUCTION_PROJECT,
    '--deploy',
    '--base-url',
    PRODUCTION_BASE_URL,
  ]);

  runHostedLaneSmoke(PRODUCTION_PROJECT, PRODUCTION_BASE_URL);
  runHostedAuthSmoke(PRODUCTION_PROJECT, PRODUCTION_BASE_URL);
  runHostedSyncSmoke(PRODUCTION_PROJECT, PRODUCTION_BASE_URL);

  const stagingEnvArgs = envArgsFor(options.stagingEnvFile);
  printStep('Realigning staging to the same fixed commit');
  runStagingDeploy(stagingEnvArgs);
  runHostedLaneSmoke(STAGING_PROJECT, STAGING_BASE_URL, stagingEnvArgs);
  runHostedAuthSmoke(STAGING_PROJECT, STAGING_BASE_URL, stagingEnvArgs);
  runHostedSyncSmoke(STAGING_PROJECT, STAGING_BASE_URL, stagingEnvArgs);
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

  runProductionRelease(options);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
