
// Defining valid HTTP methods
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

/**
 * Base request handler to centralize headers and error handling
 */
async function request<T>(endpoint: string, method: HttpMethod = 'GET', body?: any): Promise<T> {
    const zoneId = localStorage.getItem("uranus:zone_id");
    const beConfigRaw = localStorage.getItem("uranus:be-config");

    // 1. Parse the string into an object
    const beConfig = beConfigRaw ? JSON.parse(beConfigRaw) : { list: [] };

    // 2. Find the matching zone
    const zone = beConfig.list.find((item: any) => item.zone_id === zoneId);

    // 3. Use a fallback or throw error if not found
    const serverUrl = zone?.server_url;

    if (!serverUrl) {
        throw new Error(`Server URL not found for zone: ${zoneId}`);
    }

    const token = localStorage.getItem("x-auth-token");
    if (!token) throw new Error("No DJI Auth Token found");

    const url = `${serverUrl}${endpoint}`;

    const options: RequestInit = {
        method,
        headers: {
            "Content-Type": "application/json",
            "x-auth-token": token,
        },
    };

    if (body) options.body = JSON.stringify(body);

    const response = await fetch(url, options);

    // 1. Parse the JSON body FIRST
    const data = await response.json().catch(() => ({}));

    // 2. Now check if the response was successful
    if (!response.ok) {
        // If there's a specific message from DJI, use it; otherwise, fallback to status
        throw new Error(data.message || `DJI API Error: ${response.status}`);
    }

    // 3. Return the parsed data (cast to T for TypeScript)
    return data as T;
}

/**
 * The API Wrapper
 */
export const fhApi = {
    // 1. Add <T> here so the caller can define the expected shape
    async call<T>(method: HttpMethod, endpoint: string, data?: any): Promise<T> {
        switch (method) {
            case 'GET':
                // 2. Pass <T> into the request function
                return request<T>(endpoint, 'GET');
            case 'POST':
                return request<T>(endpoint, 'POST', data);
            case 'PUT':
                return request<T>(endpoint, 'PUT', data);
            case 'DELETE':
                return request<T>(endpoint, 'DELETE');
            default: {
                const _exhaustiveCheck: never = method;
                throw new Error(`Unsupported method: ${_exhaustiveCheck}`);
            }
        }
    },

    async getTopologies(projectUUID: string): Promise<any> {
        const endpoint = `/manage/api/v1/projects/${projectUUID}/topologies`;
        return this.call('GET', endpoint);
    },

    async getCurrentUser(organizationId: string): Promise<any> {
        const endpoint = `/manage/api/v1/organizations/${organizationId}/users/current`;
        return this.call('GET', endpoint);
    },

    async getAnnotations(projectUUID: string): Promise<any> {
        const endpoint = `/map/api/v1/workspaces/${projectUUID}/element-groups?proj_uuid=${projectUUID}`;
        return this.call('GET', endpoint);
    },




};