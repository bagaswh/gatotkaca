export function isObject(val: any) {
  return typeof val === 'object' && !Array.isArray(val) && val !== null;
}
