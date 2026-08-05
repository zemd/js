export const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} must be set`);
  }
  return value;
};

export const optionalEnv = (name: string, fallback: string): string => {
  const value = process.env[name];
  return value ? value : fallback;
};
