/**
 * Exports a NexusAPI project to Postman Collection v2.1 JSON format.
 * @param {string} projectName
 * @param {array} requests - NexusAPI request objects
 * @returns {string} JSON string ready to save as .postman_collection.json
 */
export function exportToPostman(projectName, requests) {
  const items = requests.map(req => {
    // Build URL object
    const urlParts = req.url ? req.url.split('?') : [''];
    const urlObj = {
      raw: req.url || '',
      host: [req.url ? req.url.replace(/https?:\/\//, '').split('/')[0] : ''],
      path: req.url ? req.url.replace(/https?:\/\/[^/]+/, '').split('/').filter(Boolean) : [],
      query: (req.params || [])
        .filter(p => p.key)
        .map(p => ({ key: p.key, value: p.value, disabled: !p.enabled })),
    };

    // Build headers
    const headers = (req.headers || [])
      .filter(h => h.key)
      .map(h => ({ key: h.key, value: h.value, type: 'text', disabled: !h.enabled }));

    // Build body
    let body = undefined;
    if (req.bodyType === 'json' && req.body) {
      body = { mode: 'raw', raw: req.body, options: { raw: { language: 'json' } } };
    } else if (req.bodyType === 'form-data' && req.body) {
      body = { mode: 'formdata', formdata: safeParseJSON(req.body, []) };
    } else if (req.bodyType === 'urlencoded' && req.body) {
      body = { mode: 'urlencoded', urlencoded: safeParseJSON(req.body, []) };
    }

    // Build auth
    let auth = undefined;
    if (req.auth?.type === 'bearer') {
      auth = { type: 'bearer', bearer: [{ key: 'token', value: req.auth.token || '', type: 'string' }] };
    } else if (req.auth?.type === 'basic') {
      auth = {
        type: 'basic',
        basic: [
          { key: 'username', value: req.auth.username || '', type: 'string' },
          { key: 'password', value: req.auth.password || '', type: 'string' },
        ],
      };
    } else if (req.auth?.type === 'apikey') {
      auth = {
        type: 'apikey',
        apikey: [
          { key: 'key', value: req.auth.key || '', type: 'string' },
          { key: 'value', value: req.auth.value || '', type: 'string' },
          { key: 'in', value: req.auth.in || 'header', type: 'string' },
        ],
      };
    }

    return {
      name: req.name || 'Untitled',
      request: {
        method: req.method || 'GET',
        header: headers,
        url: urlObj,
        ...(body ? { body } : {}),
        ...(auth ? { auth } : {}),
        description: req.description || '',
      },
      response: [],
    };
  });

  const collection = {
    info: {
      name: projectName,
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      _postman_id: crypto.randomUUID(),
    },
    item: items,
  };

  return JSON.stringify(collection, null, 2);
}

export function downloadPostmanExport(projectName, requests) {
  const json = exportToPostman(projectName, requests);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${projectName.replace(/\s+/g, '_')}.postman_collection.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function safeParseJSON(str, fallback) {
  try { return JSON.parse(str); } catch { return fallback; }
}
