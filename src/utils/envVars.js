/**
 * Multi-environment variable management — stored per project in localStorage.
 *
 * Storage layout:
 *   nexus_envs_{projectId}        = JSON: EnvironmentSet[]
 *   nexus_active_env_{projectId}  = string: active environment name
 *
 * EnvironmentSet: { id, name, vars: EnvVar[] }
 * EnvVar:         { key, value, type, enabled }
 * type:           'text' | 'secret' | 'baseUrl'
 */

const ENVS_PREFIX   = 'nexus_envs_';
const ACTIVE_PREFIX = 'nexus_active_env_';

// ── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_ENVS = () => [
  { id: 'development', name: 'Development', vars: [] },
  { id: 'production',  name: 'Production',  vars: [] },
];

// ── Load / Save environment sets ─────────────────────────────────────────────

export function loadEnvSets(projectId) {
  try {
    const raw = localStorage.getItem(ENVS_PREFIX + projectId);
    const sets = raw ? JSON.parse(raw) : DEFAULT_ENVS();
    // Backward-compat: migrate legacy single flat array
    if (Array.isArray(sets) && sets.length > 0 && 'key' in sets[0]) {
      const migrated = [{ id: 'default', name: 'Default', vars: sets }, ...DEFAULT_ENVS().slice(1)];
      saveEnvSets(projectId, migrated);
      return migrated;
    }
    return sets.length ? sets : DEFAULT_ENVS();
  } catch { return DEFAULT_ENVS(); }
}

export function saveEnvSets(projectId, sets) {
  localStorage.setItem(ENVS_PREFIX + projectId, JSON.stringify(sets));
}

// ── Active environment ────────────────────────────────────────────────────────

export function getActiveEnvId(projectId) {
  return localStorage.getItem(ACTIVE_PREFIX + projectId) || null;
}

export function setActiveEnvId(projectId, envId) {
  localStorage.setItem(ACTIVE_PREFIX + projectId, envId);
}

// ── Get active vars ───────────────────────────────────────────────────────────

export function getActiveEnvSet(projectId) {
  const sets   = loadEnvSets(projectId);
  const active = getActiveEnvId(projectId);
  return sets.find(s => s.id === active) || sets[0] || { id: '', name: '', vars: [] };
}

export function getActiveEnvMap(projectId) {
  const envSet = getActiveEnvSet(projectId);
  const map    = {};
  (envSet.vars || []).filter(v => v.enabled !== false && v.key).forEach(v => {
    map[v.key] = v.value;
  });
  return map;
}

export function getBaseUrl(projectId) {
  const envSet = getActiveEnvSet(projectId);
  const bu = (envSet.vars || []).find(v => v.type === 'baseUrl' && v.enabled !== false);
  return bu?.value || '';
}

// ── Backward-compat single-env API (used by RequestBuilder) ──────────────────
/** @deprecated Use getActiveEnvMap instead */
export function loadEnvVars(projectId) {
  return getActiveEnvSet(projectId).vars || [];
}
/** @deprecated Use saveEnvSets instead */
export function saveEnvVars(projectId, vars) {
  const sets = loadEnvSets(projectId);
  const active = getActiveEnvId(projectId) || sets[0]?.id;
  const updated = sets.map(s => s.id === active ? { ...s, vars } : s);
  saveEnvSets(projectId, updated);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function generateEnvId() {
  return 'env_' + Math.random().toString(36).slice(2, 9);
}

export function cloneEnvSet(envSet, newName) {
  return {
    id:   generateEnvId(),
    name: newName,
    vars: envSet.vars.map(v => ({ ...v })),
  };
}

/** Interpolate {{variable}} placeholders in a string using env map */
export function interpolateEnv(str, envMap) {
  if (!str) return str;
  return str.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
    return key.trim() in envMap ? envMap[key.trim()] : `{{${key}}}`;
  });
}
