export const getProjectMissionsStorageKey = (orgId: string, projectId: string) => {
  return `${orgId}__${projectId}__missions`;
};

export const getProjectAnnotationsStorageKey = (orgId: string, projectId: string) => {
  return `${orgId}__${projectId}__annotations`;
};

export function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ] : [255, 0, 0]; // Defaults to red if parsing fails
}