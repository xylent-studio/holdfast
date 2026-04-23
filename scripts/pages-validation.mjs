import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const DEFAULT_PROJECT = 'holdfast-validation';
const DEFAULT_BRANCH = 'main';
const NON_BLOCKING_PRODUCTION_DIRTY_PATHS = new Set([
  'scripts/rehydrate-agent.ps1',
]);

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function printUsage() {
  console.log(`Holdfast Pages deployment helper

Usage:
  node scripts/pages-validation.mjs
  node scripts/pages-validation.mjs --project holdfast-validation --create --deploy
  node scripts/pages-validation.mjs --project holdfast-validation --create --deploy --smoke
  node scripts/pages-validation.mjs --project holdfast --create --deploy --base-url https://holdfast.xylent.studio
  node scripts/pages-validation.mjs --project holdfast-staging --create --deploy --base-url https://holdfast-staging.pages.dev --env-file .env.staging.local
  node scripts/pages-validation.mjs --auth-preflight --base-url https://holdfast-validation.pages.dev
  node scripts/pages-validation.mjs --auth-smoke --base-url https://holdfast-validation.pages.dev
  node scripts/pages-validation.mjs --sync-smoke --base-url https://holdfast.xylent.studio
  node scripts/pages-validation.mjs --smoke --base-url https://holdfast-validation.pages.dev

Options:
  --project <name>    Pages project name. Default: ${DEFAULT_PROJECT}
  --branch <name>     Pages branch to deploy. Default: ${DEFAULT_BRANCH}
  --base-url <url>    Hosted base URL for smoke tests.
  --env-file <path>   Additional env file to load before build/smoke checks.
  --allow-dirty       Allow production deploys with release-affecting dirty files.
  --auth-preflight    Verify Supabase-generated email links stay on the hosted origin.
  --auth-smoke        Run hosted auth smoke after preflight using server-side magic links.
  --sync-smoke        Run hosted same-account sync and attachment smoke after auth preflight.
  --create            Create the Pages project if it does not exist.
  --deploy            Build the app and deploy dist to the Pages project.
  --smoke             Run Playwright smoke tests against the hosted URL.
  --skip-build        Skip npm run build before deploy.
  --help              Show this message.
`);
}

function stripQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }

  const content = readFileSync(filePath, 'utf8');
  const values = {};

  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    values[key] = stripQuotes(value);
  }

  return values;
}

function applyLocalEnvFallbacks(envValues) {
  const merged = {
    ...loadEnvFile(path.join(repoRoot, '.env.local')),
    ...loadEnvFile(path.join(repoRoot, '.env.secrets.local')),
    ...envValues,
  };

  for (const [key, value] of Object.entries(merged)) {
    if (!process.env[key] && value) {
      process.env[key] = value;
    }
  }

  return merged;
}

function parseJsonc(filePath) {
  const content = readFileSync(filePath, 'utf8')
    .replace(/^\s*\/\/.*$/gmu, '')
    .trim();
  return JSON.parse(content);
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

function escapeForCmd(value) {
  if (/^[\w./:@=-]+$/u.test(value)) {
    return value;
  }

  return `"${value.replaceAll('"', '""')}"`;
}

function parseArgs(argv) {
  const options = {
    authSmoke: false,
    authPreflight: false,
    allowDirty: false,
    baseUrl: null,
    branch: DEFAULT_BRANCH,
    create: false,
    deploy: false,
    envFile: null,
    help: false,
    project: DEFAULT_PROJECT,
    skipBuild: false,
    smoke: false,
    syncSmoke: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--project') {
      options.project = argv[index + 1] ?? options.project;
      index += 1;
      continue;
    }

    if (arg === '--branch') {
      options.branch = argv[index + 1] ?? options.branch;
      index += 1;
      continue;
    }

    if (arg === '--base-url') {
      options.baseUrl = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (arg === '--env-file') {
      options.envFile = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (arg === '--auth-preflight') {
      options.authPreflight = true;
      continue;
    }

    if (arg === '--allow-dirty') {
      options.allowDirty = true;
      continue;
    }

    if (arg === '--auth-smoke') {
      options.authSmoke = true;
      continue;
    }

    if (arg === '--sync-smoke') {
      options.syncSmoke = true;
      continue;
    }

    if (arg === '--create') {
      options.create = true;
      continue;
    }

    if (arg === '--deploy') {
      options.deploy = true;
      continue;
    }

    if (arg === '--smoke') {
      options.smoke = true;
      continue;
    }

    if (arg === '--skip-build') {
      options.skipBuild = true;
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

function currentPagesOrigin(options) {
  return options.baseUrl ?? `https://${options.project}.pages.dev`;
}

function currentPagesCallback(options) {
  return `${currentPagesOrigin(options).replace(/\/$/u, '')}/auth/callback`;
}

function currentAuthProbeTarget(options) {
  return `${currentPagesCallback(options)}?next=/settings`;
}

function requireBuildEnv(envValues) {
  const missing = [];

  if (!envValues.VITE_SUPABASE_URL) {
    missing.push('VITE_SUPABASE_URL');
  }

  if (!envValues.VITE_SUPABASE_ANON_KEY) {
    missing.push('VITE_SUPABASE_ANON_KEY');
  }

  if (missing.length) {
    throw new Error(
      `Missing build-time auth env: ${missing.join(', ')}. Add them to .env or the shell before deploying hosted Pages.`,
    );
  }
}

function requireAuthProbeEnv(envValues) {
  const supabaseUrl = envValues.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY ?? null;
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN ?? null;

  if (!supabaseUrl || (!secretKey && !accessToken)) {
    throw new Error(
      'Hosted auth preflight needs VITE_SUPABASE_URL (or SUPABASE_URL) plus SUPABASE_SECRET_KEY or SUPABASE_ACCESS_TOKEN. Keep secrets out of tracked repo files.',
    );
  }

  return {
    accessToken,
    secretKey,
    supabaseUrl,
  };
}

function supabaseProjectRefFromUrl(supabaseUrl) {
  try {
    const hostname = new URL(supabaseUrl).hostname;
    const [projectRef] = hostname.split('.');
    return projectRef || null;
  } catch {
    return null;
  }
}

async function resolveSupabaseSecretKey(authEnv) {
  if (authEnv.secretKey) {
    return authEnv.secretKey;
  }

  const projectRef = supabaseProjectRefFromUrl(authEnv.supabaseUrl);
  if (!projectRef || !authEnv.accessToken) {
    throw new Error(
      'Hosted auth probe could not derive a service-role key because the Supabase project ref or access token is missing.',
    );
  }

  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/api-keys`,
    {
      headers: {
        Authorization: `Bearer ${authEnv.accessToken}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `Supabase Management API GET /projects/${projectRef}/api-keys failed with ${response.status}.`,
    );
  }

  const keys = await response.json();
  const key = keys.find((entry) => entry.id === 'service_role')?.api_key ?? null;

  if (!key) {
    throw new Error(
      `Supabase project ${projectRef} does not expose a service_role key through the management response.`,
    );
  }

  process.env.SUPABASE_SECRET_KEY = key;
  return key;
}

function loadBuildEnv(options) {
  const envPath = path.join(repoRoot, '.env');
  const extraEnvPath = options.envFile
    ? path.resolve(repoRoot, options.envFile)
    : null;
  return {
    ...loadEnvFile(envPath),
    ...(extraEnvPath ? loadEnvFile(extraEnvPath) : {}),
    ...process.env,
  };
}

function getPagesProjects() {
  const raw = run(
    'npx',
    ['wrangler', 'pages', 'project', 'list', '--json'],
    { capture: true },
  );

  return JSON.parse(raw || '[]');
}

function getProjectName(project) {
  return project.name ?? project['Project Name'] ?? null;
}

function getProjectDomain(project) {
  return project.domain ?? project['Project Domains'] ?? null;
}

function getProjectDomains(project) {
  const raw = getProjectDomain(project);
  if (!raw) {
    return [];
  }

  return String(raw)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function getLatestDeployment(projectName) {
  const raw = run(
    'npx',
    ['wrangler', 'pages', 'deployment', 'list', '--project-name', projectName, '--json'],
    { capture: true },
  );
  const deployments = JSON.parse(raw || '[]');
  return deployments[0] ?? null;
}

function projectRole(options) {
  return options.project === DEFAULT_PROJECT
    ? 'validation'
    : options.project === 'holdfast-staging'
      ? 'staging'
      : 'production';
}

function parseDirtyPath(line) {
  const match = line.match(/^[ MADRCU?!]{1,2}\s+(.*)$/u);
  const candidate = (match?.[1] ?? line).trim();
  const pathText = candidate.includes(' -> ')
    ? candidate.split(' -> ').at(-1) ?? candidate
    : candidate;
  return pathText.replaceAll('\\', '/');
}

function getBlockingDirtyPaths() {
  const raw = run(
    'git',
    ['status', '--porcelain=1', '--untracked-files=all'],
    { capture: true },
  );

  if (!raw) {
    return [];
  }

  return raw
    .split(/\r?\n/u)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map(parseDirtyPath)
    .filter((entry) => !NON_BLOCKING_PRODUCTION_DIRTY_PATHS.has(entry));
}

function ensureProductionDeployClean(options) {
  if (projectRole(options) !== 'production' || options.allowDirty) {
    return;
  }

  const blockingDirtyPaths = getBlockingDirtyPaths();
  if (!blockingDirtyPaths.length) {
    return;
  }

  const preview = blockingDirtyPaths
    .slice(0, 10)
    .map((entry) => `- ${entry}`)
    .join('\n');
  const more =
    blockingDirtyPaths.length > 10
      ? `\n- ...and ${blockingDirtyPaths.length - 10} more`
      : '';

  throw new Error(
    `Production deploy requires a clean release-affecting working tree.\nCommit or stash these paths before deploying:\n${preview}${more}\n\nIgnored non-release path: scripts/rehydrate-agent.ps1\nOverride only for emergencies with --allow-dirty.`,
  );
}

function getCompatibilityDate() {
  const wranglerConfig = parseJsonc(path.join(repoRoot, 'wrangler.jsonc'));
  return wranglerConfig.compatibility_date;
}

function printStatus(project, envValues, options) {
  const latestDeployment = project ? getLatestDeployment(options.project) : null;
  const role = projectRole(options);
  const projectDomains = project ? getProjectDomains(project) : [];

  console.log('Holdfast Pages status');
  console.log(`- Role: ${role}`);
  console.log(`- Pages project: ${options.project}`);
  console.log(`- Project exists: ${project ? 'yes' : 'no'}`);
  console.log(
    `- Build auth env ready: ${
      envValues.VITE_SUPABASE_URL && envValues.VITE_SUPABASE_ANON_KEY
        ? 'yes'
        : 'no'
    }`,
  );
  if (projectDomains.length) {
    console.log(
      `- Project domains: ${projectDomains.map((domain) => `https://${domain}`).join(', ')}`,
    );
  }
  console.log(`- Served base URL: ${currentPagesOrigin(options)}`);
  console.log(`- Hosted callback: ${currentPagesCallback(options)}`);
  if (latestDeployment?.Deployment) {
    console.log(`- Latest deployment: ${latestDeployment.Deployment}`);
  }
  if (role === 'validation') {
    console.log(
      '- Reminder: this is the disposable hosted smoke surface. Keep it separate from the production hostname.',
    );
  } else if (role === 'staging') {
    console.log(
      '- Reminder: staging should be the first provider-backed auth and sync lane for risky hosted validation before production.',
    );
  } else {
    console.log(
      '- Reminder: production is currently a direct-upload Pages project. Deploy from a clean release-affecting tree, and replace the project intentionally later if you need Git integration.',
    );
  }
}

function runPlaywrightSuite(suiteArgs, envValues, extraEnv = {}) {
  run('npx', ['playwright', 'test', ...suiteArgs], {
    env: {
      ...envValues,
      ...process.env,
      ...extraEnv,
    },
  });
}

async function runHostedAuthPreflight(envValues, options) {
  const authEnv = requireAuthProbeEnv(envValues);
  const secretKey = await resolveSupabaseSecretKey(authEnv);
  const { createClient } = await import('@supabase/supabase-js');
  const authProbeTarget = currentAuthProbeTarget(options);
  const email = `holdfast-auth-preflight-${Date.now()}@example.com`;
  const client = createClient(authEnv.supabaseUrl, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data, error } = await client.auth.admin.generateLink({
    type: 'magiclink',
    email,
    redirectTo: authProbeTarget,
  });

  if (error) {
    throw new Error(`Hosted auth preflight failed to generate a link: ${error.message}`);
  }

  const generatedRedirect = data?.properties?.redirect_to ?? null;

  console.log('Hosted auth redirect preflight');
  console.log(`- Probe email: ${email}`);
  console.log(`- Requested redirect: ${authProbeTarget}`);
  console.log(`- Generated redirect: ${generatedRedirect ?? 'none'}`);

  if (!generatedRedirect?.startsWith(currentPagesOrigin(options))) {
    throw new Error(
      `Supabase is still generating email-link redirects for ${generatedRedirect ?? 'an empty redirect'} instead of the hosted origin ${currentPagesOrigin(
        options,
      )}. Update Supabase Auth URL configuration before hosted auth smoke.`,
    );
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printUsage();
    return;
  }

  const envValues = loadBuildEnv(options);
  applyLocalEnvFallbacks(envValues);

  run('npx', ['wrangler', 'whoami']);

  const projects = getPagesProjects();
  let project =
    projects.find((candidate) => getProjectName(candidate) === options.project) ??
    null;
  let projectExists = Boolean(project);

  printStatus(project, envValues, options);

  if (options.create && !projectExists) {
    console.log(`Creating Pages project ${options.project}...`);
    run('npx', [
      'wrangler',
      'pages',
      'project',
      'create',
      options.project,
      '--production-branch',
      options.branch,
      '--compatibility-date',
      getCompatibilityDate(),
    ]);
    projectExists = true;
    project = {
      'Project Domains': `${options.project}.pages.dev`,
      'Project Name': options.project,
    };
  }

  if (options.deploy) {
    ensureProductionDeployClean(options);
    requireBuildEnv(envValues);

    if (!projectExists) {
      throw new Error(
        `Pages project ${options.project} does not exist. Re-run with --create or create it in Cloudflare first.`,
      );
    }

    if (!options.skipBuild) {
      run('npm', ['run', 'build'], { env: envValues });
    }

    console.log(`Deploying dist to ${options.project}...`);
    run('npx', [
      'wrangler',
      'pages',
      'deployment',
      'create',
      'dist',
      '--project-name',
      options.project,
      '--branch',
      options.branch,
      '--commit-dirty',
      '--upload-source-maps',
    ]);

    console.log(`Hosted URL: ${currentPagesOrigin(options)}`);
    console.log(
      'Add these before hosted sign-in smoke if you have not already:',
    );
    console.log(`- Supabase redirect allow-list: ${currentPagesCallback(options)}`);
    console.log(
      `- Google authorized JavaScript origin: ${currentPagesOrigin(options)}`,
    );
    console.log(
      '- Google authorized redirect URI: use the Supabase callback shown in the provider settings.',
    );
  }

  if (options.authPreflight) {
    await runHostedAuthPreflight(envValues, options);
  }

  if (options.authSmoke) {
    await runHostedAuthPreflight(envValues, options);
    console.log(`Running hosted auth smoke against ${currentPagesOrigin(options)}...`);
    runPlaywrightSuite(['tests/e2e/hosted-auth.spec.ts'], envValues, {
      PLAYWRIGHT_AUTH_SMOKE: '1',
      PLAYWRIGHT_BASE_URL: currentPagesOrigin(options),
    });
  }

  if (options.syncSmoke) {
    await runHostedAuthPreflight(envValues, options);
    console.log(`Running hosted sync smoke against ${currentPagesOrigin(options)}...`);
    runPlaywrightSuite(['tests/e2e/hosted-sync.spec.ts'], envValues, {
      PLAYWRIGHT_BASE_URL: currentPagesOrigin(options),
      PLAYWRIGHT_SYNC_SMOKE: '1',
    });
  }

  if (options.smoke) {
    if (!options.baseUrl && !projectExists && !options.deploy) {
      throw new Error(
        `Pages project ${options.project} does not exist. Pass --base-url or create and deploy the project first.`,
      );
    }

    const smokeUrl = currentPagesOrigin(options);
    console.log(`Running Playwright smoke against ${smokeUrl}...`);
    runPlaywrightSuite([], envValues, {
      PLAYWRIGHT_BASE_URL: smokeUrl,
    });
  }
}

await main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
