/**
 * OpenAPI/Swagger Import Module
 * Parses Swagger 2.0 and OpenAPI 3.x formats and converts to BrickAPI endpoint format
 */

/**
 * Parse OpenAPI/Swagger JSON and convert to BrickAPI format
 * @param {Object} spec - The OpenAPI/Swagger specification object
 * @returns {Object} - Converted endpoints in BrickAPI format
 */
function parseOpenAPISpec(spec) {
    const apiVersion = detectOpenAPIVersion(spec);
    
    if (apiVersion === '2.0') {
        return parseSwagger2(spec);
    } else if (apiVersion === '3.0' || apiVersion === '3.1') {
        return parseOpenAPI3(spec);
    } else {
        throw new Error('Unsupported OpenAPI/Swagger version');
    }
}

/**
 * Detect OpenAPI/Swagger version
 * @param {Object} spec - The specification object
 * @returns {string} - Version string ('2.0', '3.0', '3.1')
 */
function detectOpenAPIVersion(spec) {
    if (spec.swagger === '2.0') {
        return '2.0';
    } else if (spec.openapi) {
        const version = spec.openapi.split('.')[0] + '.' + spec.openapi.split('.')[1];
        return version;
    }
    return 'unknown';
}

/**
 * Parse Swagger 2.0 specification
 * @param {Object} spec - Swagger 2.0 spec
 * @returns {Array} - Array of endpoints in BrickAPI format
 */
function parseSwagger2(spec) {
    const endpoints = [];
    const basePath = spec.basePath || '';
    const host = spec.host || 'api.example.com';
    
    if (!spec.paths) return endpoints;
    
    Object.entries(spec.paths).forEach(([path, pathItem]) => {
        Object.entries(pathItem).forEach(([method, operation]) => {
            if (!['get', 'post', 'put', 'delete', 'patch', 'head', 'options'].includes(method)) {
                return; // Skip non-HTTP methods
            }
            
            const endpoint = {
                path: basePath + path,
                method: method.toUpperCase(),
                summary: operation.summary || '',
                description: operation.description || '',
                headers: extractHeaders(operation.parameters),
                requestBody: extractRequestBody(operation, spec),
                responseBody: extractResponseBody(operation, spec),
                tags: operation.tags || []
            };
            
            endpoints.push(endpoint);
        });
    });
    
    return endpoints;
}

/**
 * Parse OpenAPI 3.0/3.1 specification
 * @param {Object} spec - OpenAPI 3.x spec
 * @returns {Array} - Array of endpoints in BrickAPI format
 */
function parseOpenAPI3(spec) {
    const endpoints = [];
    const baseUrl = extractBaseUrl(spec.servers);
    
    if (!spec.paths) return endpoints;
    
    Object.entries(spec.paths).forEach(([path, pathItem]) => {
        Object.entries(pathItem).forEach(([method, operation]) => {
            if (!['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'trace'].includes(method)) {
                return; // Skip non-HTTP methods
            }
            
            const endpoint = {
                path: path,
                method: method.toUpperCase(),
                summary: operation.summary || '',
                description: operation.description || '',
                headers: extractHeadersOpenAPI3(operation.parameters),
                requestBody: extractRequestBodyOpenAPI3(operation, spec),
                responseBody: extractResponseBodyOpenAPI3(operation, spec),
                tags: operation.tags || []
            };
            
            endpoints.push(endpoint);
        });
    });
    
    return endpoints;
}

/**
 * Extract base URL from servers array (OpenAPI 3.x)
 * @param {Array} servers - Servers array
 * @returns {string} - Base URL
 */
function extractBaseUrl(servers) {
    if (!servers || servers.length === 0) {
        return 'https://api.example.com';
    }
    return servers[0].url || 'https://api.example.com';
}

/**
 * Extract headers from parameters (Swagger 2.0)
 * @param {Array} parameters - Parameters array
 * @returns {Object} - Headers as key-value object
 */
function extractHeaders(parameters) {
    if (!parameters) return {};
    
    const headers = {};
    parameters
        .filter(p => p.in === 'header')
        .forEach(p => {
            headers[p.name] = p.description || '';
        });
    
    return headers;
}

/**
 * Extract headers from parameters (OpenAPI 3.x)
 * @param {Array} parameters - Parameters array
 * @returns {Object} - Headers as key-value object
 */
function extractHeadersOpenAPI3(parameters) {
    if (!parameters) return {};
    
    const headers = {};
    parameters
        .filter(p => p.in === 'header')
        .forEach(p => {
            headers[p.name] = p.description || '';
        });
    
    return headers;
}

/**
 * Extract request body (Swagger 2.0)
 * @param {Object} operation - Operation object
 * @param {Object} spec - Complete spec for resolving references
 * @returns {string} - JSON string of request body
 */
function extractRequestBody(operation, spec) {
    if (!operation.parameters) return '{}';
    
    const bodyParam = operation.parameters.find(p => p.in === 'body');
    if (!bodyParam) return '{}';
    
    const schema = resolveRef(bodyParam.schema, spec);
    return JSON.stringify(schema, null, 2);
}

/**
 * Extract request body (OpenAPI 3.x)
 * @param {Object} operation - Operation object
 * @param {Object} spec - Complete spec for resolving references
 * @returns {string} - JSON string of request body
 */
function extractRequestBodyOpenAPI3(operation, spec) {
    if (!operation.requestBody) return '{}';
    
    const content = operation.requestBody.content || {};
    const jsonContent = content['application/json'] || content['*/*'] || Object.values(content)[0];
    
    if (!jsonContent || !jsonContent.schema) return '{}';
    
    const schema = resolveRef(jsonContent.schema, spec);
    return JSON.stringify(schema, null, 2);
}

/**
 * Extract response body (Swagger 2.0)
 * @param {Object} operation - Operation object
 * @param {Object} spec - Complete spec for resolving references
 * @returns {string} - JSON string of response body
 */
function extractResponseBody(operation, spec) {
    if (!operation.responses) return '{}';
    
    // Get the 200 response or the first successful response
    const successResponse = operation.responses['200'] || 
                           operation.responses['201'] || 
                           Object.values(operation.responses)[0];
    
    if (!successResponse || !successResponse.schema) return '{}';
    
    const schema = resolveRef(successResponse.schema, spec);
    return JSON.stringify(schema, null, 2);
}

/**
 * Extract response body (OpenAPI 3.x)
 * @param {Object} operation - Operation object
 * @param {Object} spec - Complete spec for resolving references
 * @returns {string} - JSON string of response body
 */
function extractResponseBodyOpenAPI3(operation, spec) {
    if (!operation.responses) return '{}';
    
    // Get the 200 response or the first successful response
    const successResponse = operation.responses['200'] || 
                           operation.responses['201'] || 
                           Object.values(operation.responses)[0];
    
    if (!successResponse || !successResponse.content) return '{}';
    
    const jsonContent = successResponse.content['application/json'] || 
                       successResponse.content['*/*'] || 
                       Object.values(successResponse.content)[0];
    
    if (!jsonContent || !jsonContent.schema) return '{}';
    
    const schema = resolveRef(jsonContent.schema, spec);
    return JSON.stringify(schema, null, 2);
}

/**
 * Resolve $ref references in the schema
 * @param {Object} schema - Schema object that may contain $ref
 * @param {Object} spec - Complete spec for resolving references
 * @param {number} depth - Recursion depth to prevent infinite loops
 * @returns {Object} - Resolved schema
 */
function resolveRef(schema, spec, depth = 0) {
    if (depth > 10) return {}; // Prevent infinite recursion
    
    if (!schema) return {};
    
    if (schema.$ref) {
        const refPath = schema.$ref.replace('#/', '').split('/');
        let resolved = spec;
        
        for (const part of refPath) {
            resolved = resolved[part];
            if (!resolved) return {};
        }
        
        return resolveRef(resolved, spec, depth + 1);
    }
    
    // Handle allOf, oneOf, anyOf
    if (schema.allOf && Array.isArray(schema.allOf)) {
        const merged = {};
        schema.allOf.forEach(s => {
            const resolved = resolveRef(s, spec, depth + 1);
            Object.assign(merged, resolved);
        });
        return merged;
    }
    
    return schema;
}

/**
 * Convert imported endpoints to BrickAPI storage format
 * @param {Array} endpoints - Imported endpoints
 * @param {string} projectName - Project/host name
 * @returns {Object} - Data ready for BrickAPI storage
 */
function convertToStorageFormat(endpoints, projectName) {
    const groupsData = { unassigned: [] };
    const endpointsMap = {};
    
    endpoints.forEach((endpoint, index) => {
        const fingerprint = `imported_${Date.now()}_${index}`;
        
        const metadata = {
            hostname: projectName,
            method: endpoint.method,
            path: endpoint.path,
            url: `${projectName}${endpoint.path}`,
            reqHeaders: endpoint.headers,
            reqBody: endpoint.requestBody,
            resBody: endpoint.responseBody,
            summary: endpoint.summary,
            description: endpoint.description,
            timestamp: Date.now()
        };
        
        endpointsMap[`meta_${fingerprint}`] = metadata;
        
        if (endpoint.tags && endpoint.tags.length > 0) {
            const tag = endpoint.tags[0];
            if (!groupsData[tag]) {
                groupsData[tag] = [];
            }
            groupsData[tag].push(fingerprint);
        } else {
            groupsData.unassigned.push(fingerprint);
        }
    });
    
    return { endpointsMap, groupsData };
}

/**
 * Validate OpenAPI spec
 * @param {Object} spec - The spec to validate
 * @returns {Object} - Validation result { valid: boolean, errors: string[] }
 */
function validateOpenAPISpec(spec) {
    const errors = [];
    
    if (!spec) {
        errors.push('Spec is empty');
        return { valid: false, errors };
    }
    
    const version = detectOpenAPIVersion(spec);
    if (version === 'unknown') {
        errors.push('Unable to detect OpenAPI/Swagger version. Must have "swagger" or "openapi" field.');
    }
    
    if (!spec.paths || Object.keys(spec.paths).length === 0) {
        errors.push('No paths found in specification');
    }
    
    return { 
        valid: errors.length === 0, 
        errors 
    };
}
