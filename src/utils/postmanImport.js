/**
 * Parses a Postman Collection v2.1 JSON into NexusAPI's internal format.
 * @param {object} postmanJson - Parsed JSON from a .postman_collection.json file
 * @returns {{ projectName: string, requests: array }}
 */
export function importFromPostman(postmanJson) {
  const info = postmanJson.info || {};
  const projectName = info.name || 'Imported Collection';
  const requests = [];

  function parseItem(item, folderPath = '') {
    if (item.item) {
      // It's a folder
      item.item.forEach(child => parseItem(child, folderPath ? `${folderPath}/${item.name}` : item.name));
    } else {
      // It's a request
      const req = item.request || {};
      const urlObj = req.url || {};
      const rawUrl = typeof urlObj === 'string' ? urlObj : (urlObj.raw || '');

      // Parse headers
      const headers = (req.header || []).map(h => ({
        key: h.key,
        value: h.value,
        enabled: !h.disabled,
      }));

      // Parse query params
      const params = (urlObj.query || []).map(q => ({
        key: q.key,
        value: q.value,
        enabled: !q.disabled,
      }));

      // Parse body
      let body = '';
      let bodyType = 'none';
      if (req.body) {
        if (req.body.mode === 'raw') {
          body = req.body.raw || '';
          bodyType = 'json';
        } else if (req.body.mode === 'formdata') {
          body = JSON.stringify(req.body.formdata || []);
          bodyType = 'form-data';
        } else if (req.body.mode === 'urlencoded') {
          body = JSON.stringify(req.body.urlencoded || []);
          bodyType = 'urlencoded';
        }
      }

      // Parse auth
      let auth = { type: 'none' };
      if (req.auth) {
        const authType = req.auth.type;
        if (authType === 'bearer') {
          const token = (req.auth.bearer || []).find(b => b.key === 'token');
          auth = { type: 'bearer', token: token?.value || '' };
        } else if (authType === 'basic') {
          const u = (req.auth.basic || []).find(b => b.key === 'username');
          const p = (req.auth.basic || []).find(b => b.key === 'password');
          auth = { type: 'basic', username: u?.value || '', password: p?.value || '' };
        } else if (authType === 'apikey') {
          const k = (req.auth.apikey || []).find(b => b.key === 'key');
          const v = (req.auth.apikey || []).find(b => b.key === 'value');
          const loc = (req.auth.apikey || []).find(b => b.key === 'in');
          auth = { type: 'apikey', key: k?.value || '', value: v?.value || '', in: loc?.value || 'header' };
        }
      }

      requests.push({
        id: crypto.randomUUID(),
        name: item.name || 'Untitled',
        folder: folderPath,
        method: req.method || 'GET',
        url: rawUrl,
        headers,
        params,
        body,
        bodyType,
        auth,
        description: item.request?.description || '',
      });
    }
  }

  (postmanJson.item || []).forEach(item => parseItem(item));
  return { projectName, requests };
}
