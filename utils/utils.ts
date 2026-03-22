export const getProjectTopologiesStorageKey = (orgId: string, projectId: string) => {
  return `${orgId}__${projectId}__topologies`;
};

export const getProjectMissionsStorageKey = (orgId: string, projectId: string) => {
  return `${orgId}__${projectId}__missions`;
};

export const getProjectAnnotationsStorageKey = (orgId: string, projectId: string) => {
  return `${orgId}__${projectId}__annotations`;
};

export const extractNumber = (input: string): number => {
  const match = input.match(/#(\d+)\s/);

  if (match && match[1]) {
    const parsed = parseInt(match[1], 10);
    return isNaN(parsed) ? 999 : parsed;
  }

  return 999;
};

export function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ] : [255, 0, 0]; // Defaults to red if parsing fails
}