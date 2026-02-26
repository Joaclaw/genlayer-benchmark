export function parseGenLayerResult(payload: any): any {
  if (!payload) return null;
  
  // Handle readable wrapper
  if (payload.readable) payload = payload.readable;
  
  // If already an object, return it
  if (typeof payload !== 'string') {
    return payload;
  }
  
  // Try normal JSON parse first
  try {
    let parsed = JSON.parse(payload);
    // Handle double-encoded JSON
    if (typeof parsed === 'string') {
      parsed = JSON.parse(parsed);
    }
    return parsed;
  } catch (e) {
    // JSON is malformed - try to fix it
  }
  
  // GenLayer sometimes returns JSON without commas between fields
  // Example: {"a":1"b":2} instead of {"a":1,"b":2}
  
  let fixed = payload;
  
  // Add commas after string values before next key
  fixed = fixed.replace(/""([a-z_])/g, '","$1');
  
  // Add commas after boolean/number values before next key  
  fixed = fixed.replace(/(true|false|[0-9]+)"([a-z_])/g, '$1,"$2');
  
  // Add commas after empty strings before next key
  fixed = fixed.replace(/:"""/g, ':"","');
  
  // Remove trailing commas before closing braces
  fixed = fixed.replace(/,}/g, '}');
  fixed = fixed.replace(/,]/g, ']');
  
  try {
    let parsed = JSON.parse(fixed);
    if (typeof parsed === 'string') {
      parsed = JSON.parse(parsed);
    }
    return parsed;
  } catch (e2) {
    console.error('Failed to parse even after fix attempts');
    console.error('Original:', payload);
    console.error('Fixed attempt:', fixed);
    throw e2;
  }
}
