/**
 * Builds the AI prompt for API documentation generation.
 * @param {object} req - Request context (method, url, headers, body, auth)
 * @param {object} res - Response context (status, body, time)
 * @returns {string} Prompt string
 */
export function buildDocPrompt(req, res) {
  const requestData = JSON.stringify(req, null, 2);
  const responseData = JSON.stringify(res, null, 2);

  return `Act as a Senior Technical Writer. Based on this API request and response, generate a structured Markdown document.

Include:
1. A clear endpoint description with method and URL
2. A table for query parameters and request body fields (name, type, required, description)
3. Authorization details
4. Response schema with field descriptions
5. Possible HTTP status codes (200, 400, 401, 404, 500, etc.) with meanings
6. A ready-to-use cURL example
7. A JavaScript fetch() example

Format the output as clean, well-structured Markdown with proper headings (##, ###), code blocks, and tables.

Request:
\`\`\`json
${requestData}
\`\`\`

Response:
\`\`\`json
${responseData}
\`\`\`

Generate the documentation now:`;
}
