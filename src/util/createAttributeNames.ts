export default function createAttributeNames<T extends object>() {
  return new Proxy({} as { [K in keyof T]-?: K }, {
    get: (_, prop: string) => prop,
  });
}
