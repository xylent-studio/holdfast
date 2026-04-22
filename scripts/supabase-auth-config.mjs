import process from 'node:process';

const MANAGEMENT_API_BASE = 'https://api.supabase.com/v1';

function printUsage() {
  console.log(`Holdfast Supabase auth config helper

Usage:
  npm run supabase:auth -- --project-ref <ref> --show
  npm run supabase:auth -- --project-ref <ref> --site-url <url> --redirect-url <url>
  npm run supabase:auth -- --project-ref <ref> --site-url <url> --redirect-url <url> --redirect-url <url> --enable-google --google-client-id <id> --google-client-secret <secret>

Options:
  --project-ref <ref>          Supabase project ref.
  --show                       Print current auth config without mutating it.
  --site-url <url>             Set the default auth Site URL.
  --redirect-url <url>         Add a redirect URL. Repeat as needed.
  --replace-redirects          Replace redirect URLs instead of merging with existing values.
  --enable-google             Enable Google auth when patching config.
  --disable-google            Disable Google auth when patching config.
  --google-client-id <id>     Set the Google OAuth client ID.
  --google-client-secret <s>  Set the Google OAuth client secret.
  --help                      Show this message.

Environment:
  SUPABASE_ACCESS_TOKEN       Required for show or patch operations.

Notes:
  - This script uses the Supabase Management API and does not write secrets to repo files.
  - The Google provider callback for a project is always:
      https://<project-ref>.supabase.co/auth/v1/callback
`);
}

function parseArgs(argv) {
  const options = {
    disableGoogle: false,
    enableGoogle: false,
    googleClientId: null,
    googleClientSecret: null,
    help: false,
    projectRef: null,
    redirectUrls: [],
    replaceRedirects: false,
    show: false,
    siteUrl: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }

    if (arg === '--project-ref') {
      options.projectRef = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (arg === '--show') {
      options.show = true;
      continue;
    }

    if (arg === '--site-url') {
      options.siteUrl = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (arg === '--redirect-url') {
      const value = argv[index + 1] ?? null;
      if (value) {
        options.redirectUrls.push(value);
      }
      index += 1;
      continue;
    }

    if (arg === '--replace-redirects') {
      options.replaceRedirects = true;
      continue;
    }

    if (arg === '--enable-google') {
      options.enableGoogle = true;
      continue;
    }

    if (arg === '--disable-google') {
      options.disableGoogle = true;
      continue;
    }

    if (arg === '--google-client-id') {
      options.googleClientId = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (arg === '--google-client-secret') {
      options.googleClientSecret = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function requireAccessToken() {
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN ?? null;

  if (!accessToken) {
    throw new Error(
      'SUPABASE_ACCESS_TOKEN is required. Generate one at https://supabase.com/dashboard/account/tokens or run `npx supabase login` first.',
    );
  }

  return accessToken;
}

function requireProjectRef(projectRef) {
  if (!projectRef) {
    throw new Error('--project-ref is required.');
  }

  return projectRef;
}

async function managementApi(path, init = {}) {
  const accessToken = requireAccessToken();
  const response = await fetch(`${MANAGEMENT_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Supabase Management API ${init.method ?? 'GET'} ${path} failed with ${response.status}: ${detail}`,
    );
  }

  return response.json();
}

function projectCallbackUrl(projectRef) {
  return `https://${projectRef}.supabase.co/auth/v1/callback`;
}

function dedupe(values) {
  return [...new Set(values.filter(Boolean))];
}

function mutatingFlagsPresent(options) {
  return Boolean(
    options.siteUrl ||
      options.redirectUrls.length ||
      options.enableGoogle ||
      options.disableGoogle ||
      options.googleClientId ||
      options.googleClientSecret ||
      options.replaceRedirects,
  );
}

function buildPatch(currentConfig, options) {
  const patch = {};

  if (options.siteUrl) {
    patch.site_url = options.siteUrl;
  }

  if (options.redirectUrls.length || options.replaceRedirects) {
    const baseRedirects = options.replaceRedirects
      ? []
      : String(currentConfig.uri_allow_list ?? '')
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean);
    patch.uri_allow_list = dedupe([...baseRedirects, ...options.redirectUrls]).join(
      ',',
    );
  }

  if (options.enableGoogle) {
    patch.external_google_enabled = true;
  }

  if (options.disableGoogle) {
    patch.external_google_enabled = false;
  }

  if (options.googleClientId) {
    patch.external_google_client_id = options.googleClientId;
    patch.external_google_enabled = true;
  }

  if (options.googleClientSecret) {
    patch.external_google_secret = options.googleClientSecret;
    patch.external_google_enabled = true;
  }

  return patch;
}

function printConfig(projectRef, config) {
  const redirectUrls = String(config.uri_allow_list ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  console.log(`Supabase auth config for ${projectRef}`);
  console.log(`- Site URL: ${config.site_url ?? '(unset)'}`);
  console.log(
    `- Redirect URLs: ${redirectUrls.length ? redirectUrls.join(', ') : '(none)'}`,
  );
  console.log(
    `- Google enabled: ${config.external_google_enabled ? 'yes' : 'no'}`,
  );
  console.log(`- Google callback: ${projectCallbackUrl(projectRef)}`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printUsage();
    return;
  }

  const projectRef = requireProjectRef(options.projectRef);
  const currentConfig = await managementApi(`/projects/${projectRef}/config/auth`);

  if (options.show || !mutatingFlagsPresent(options)) {
    printConfig(projectRef, currentConfig);
    return;
  }

  const patch = buildPatch(currentConfig, options);
  if (!Object.keys(patch).length) {
    printConfig(projectRef, currentConfig);
    return;
  }

  await managementApi(`/projects/${projectRef}/config/auth`, {
    body: JSON.stringify(patch),
    method: 'PATCH',
  });

  const nextConfig = await managementApi(`/projects/${projectRef}/config/auth`);
  console.log('Updated auth config.');
  printConfig(projectRef, nextConfig);
}

await main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
