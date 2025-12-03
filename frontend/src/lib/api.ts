import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for adding auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for handling errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  register: (data: any) => api.post('/auth/register', data),
  getCurrentUser: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
};

// Users API
export const usersAPI = {
  getAll: () => api.get('/users'),
  getById: (id: string) => api.get(`/users/${id}`),
  create: (data: any) => api.post('/users', data),
  update: (id: string, data: any) => api.put(`/users/${id}`, data),
  deactivate: (id: string) => api.delete(`/users/${id}`),
  resetPassword: (id: string, data: any) => api.post(`/users/${id}/reset-password`, data),
  getIdentities: (id: string) => api.get(`/users/${id}/identities`),
  linkIdentity: (id: string, data: any) => api.post(`/users/${id}/identities`, data),
};

// Identity Providers API
export const identityProvidersAPI = {
  getAll: () => api.get('/identity-providers'),
  create: (data: any) => api.post('/identity-providers', data),
  update: (id: string, data: any) => api.put(`/identity-providers/${id}`, data),
  delete: (id: string) => api.delete(`/identity-providers/${id}`),
};

// Groups API
export const groupsAPI = {
  getAll: () => api.get('/groups'),
  getById: (id: string) => api.get(`/groups/${id}`),
  create: (data: any) => api.post('/groups', data),
  update: (id: string, data: any) => api.put(`/groups/${id}`, data),
  delete: (id: string) => api.delete(`/groups/${id}`),
  addMember: (groupId: string, data: any) => api.post(`/groups/${groupId}/members`, data),
  removeMember: (groupId: string, userId: string) => api.delete(`/groups/${groupId}/members/${userId}`),
};

// Environments API
export const environmentsAPI = {
  getAll: () => api.get('/environments'),
  getById: (id: string) => api.get(`/environments/${id}`),
  create: (data: any) => api.post('/environments', data),
  update: (id: string, data: any) => api.put(`/environments/${id}`, data),
  delete: (id: string) => api.delete(`/environments/${id}`),
  getStatistics: () => api.get('/environments/statistics'),
  // Related entities
  getRelatedConfigs: (id: string) => api.get(`/environments/${id}/related-configs`),
  getRelatedInterfaces: (id: string) => api.get(`/environments/${id}/related-interfaces`),
  // Instances
  getAllInstances: () => api.get('/instances'), // Get all instances across environments
  getInstances: (envId: string) => api.get(`/environments/${envId}/instances`),
  createInstance: (envId: string, data: any) => api.post(`/environments/${envId}/instances`, data),
  updateInstance: (envId: string, instanceId: string, data: any) => api.put(`/environments/${envId}/instances/${instanceId}`, data),
  deleteInstance: (envId: string, instanceId: string) => api.delete(`/environments/${envId}/instances/${instanceId}`),
  updateInstanceStatus: (envId: string, instanceId: string, data: any) => api.put(`/environments/${envId}/instances/${instanceId}/status`, data),
  // Infra components
  getInfraComponents: (envId: string, instanceId: string) => api.get(`/environments/${envId}/instances/${instanceId}/infra`),
  createInfraComponent: (envId: string, instanceId: string, data: any) => api.post(`/environments/${envId}/instances/${instanceId}/infra`, data),
  // Application environment instances
  getAppEnvInstances: (envId: string) => api.get(`/environments/${envId}/applications`),
  linkApplicationToInstance: (instanceId: string, data: any) => api.post(`/instances/${instanceId}/applications`, data),
  updateAppEnvInstance: (appEnvInstanceId: string, data: any) => api.put(`/app-env-instances/${appEnvInstanceId}`, data),
  deleteAppEnvInstance: (appEnvInstanceId: string) => api.delete(`/app-env-instances/${appEnvInstanceId}`),
};

// Applications API
export const applicationsAPI = {
  getAll: () => api.get('/applications'),
  getById: (id: string) => api.get(`/applications/${id}`),
  create: (data: any) => api.post('/applications', data),
  update: (id: string, data: any) => api.put(`/applications/${id}`, data),
  delete: (id: string) => api.delete(`/applications/${id}`),
  // Related entities
  getRelatedConfigs: (id: string) => api.get(`/applications/${id}/related-configs`),
  getRelatedInterfaces: (id: string) => api.get(`/applications/${id}/related-interfaces`),
  getRelatedTestData: (id: string) => api.get(`/applications/${id}/related-testdata`),
  // Components
  getComponents: (appId: string) => api.get(`/applications/${appId}/components`),
  createComponent: (appId: string, data: any) => api.post(`/applications/${appId}/components`, data),
  updateComponent: (appId: string, componentId: string, data: any) => api.put(`/applications/${appId}/components/${componentId}`, data),
  deleteComponent: (appId: string, componentId: string) => api.delete(`/applications/${appId}/components/${componentId}`),
};

// Bookings API
export const bookingsAPI = {
  getAll: (params?: any) => api.get('/bookings', { params }),
  getById: (id: string) => api.get(`/bookings/${id}`),
  create: (data: any) => api.post('/bookings', data),
  update: (id: string, data: any) => api.put(`/bookings/${id}`, data),
  delete: (id: string) => api.delete(`/bookings/${id}`),
  updateStatus: (id: string, data: any) => api.put(`/bookings/${id}/status`, data),
  addResource: (id: string, data: any) => api.post(`/bookings/${id}/resources`, data),
  removeResource: (id: string, resourceId: string) => api.delete(`/bookings/${id}/resources/${resourceId}`),
  getCalendar: (params: any) => api.get('/bookings/calendar', { params }),
  getMyBookings: () => api.get('/bookings/my'),
  getConflicts: (params: any) => api.get('/bookings/conflicts', { params }),
  getStatistics: () => api.get('/bookings/statistics'),
  // Related entities
  getRelatedApplications: (id: string) => api.get(`/bookings/${id}/applications`),
  addApplication: (id: string, data: any) => api.post(`/bookings/${id}/applications`, data),
  removeApplication: (id: string, applicationId: string) => api.delete(`/bookings/${id}/applications/${applicationId}`),
  getRelatedInterfaces: (id: string) => api.get(`/bookings/${id}/interfaces`),
  getRelatedInstances: (id: string) => api.get(`/bookings/${id}/instances`),
  // Conflict management
  getBookingConflicts: (id: string) => api.get(`/bookings/${id}/conflicts`),
  resolveConflict: (id: string, data: any) => api.post(`/bookings/${id}/conflicts/resolve`, data),
  getAllConflictingBookings: () => api.get('/bookings/all-conflicts'),
};

// Releases API
export const releasesAPI = {
  getAll: (params?: any) => api.get('/releases', { params }),
  getById: (id: string) => api.get(`/releases/${id}`),
  create: (data: any) => api.post('/releases', data),
  update: (id: string, data: any) => api.put(`/releases/${id}`, data),
  delete: (id: string) => api.delete(`/releases/${id}`),
  updateStatus: (id: string, data: any) => api.put(`/releases/${id}/status`, data),
  addApplication: (id: string, data: any) => api.post(`/releases/${id}/applications`, data),
  addEnvironment: (id: string, data: any) => api.post(`/releases/${id}/environments`, data),
  getStatistics: () => api.get('/releases/statistics'),
};

// Integrations API
export const integrationsAPI = {
  getAll: () => api.get('/integrations'),
  getById: (id: string) => api.get(`/integrations/${id}`),
  create: (data: any) => api.post('/integrations', data),
  update: (id: string, data: any) => api.put(`/integrations/${id}`, data),
  delete: (id: string) => api.delete(`/integrations/${id}`),
  testConnection: (id: string) => api.post(`/integrations/${id}/test`),
  sync: (id: string) => api.post(`/integrations/${id}/sync`),
  createLink: (data: any) => api.post('/integrations/links', data),
  deleteLink: (linkId: string) => api.delete(`/integrations/links/${linkId}`),
  getLinksForEntity: (entityType: string, entityId: string) => api.get(`/integrations/links/${entityType}/${entityId}`),
};

// Changes API
export const changesAPI = {
  getAll: (params?: any) => api.get('/changes', { params }),
  getById: (id: string) => api.get(`/changes/${id}`),
  create: (data: any) => api.post('/changes', data),
  update: (id: string, data: any) => api.put(`/changes/${id}`, data),
  delete: (id: string) => api.delete(`/changes/${id}`),
  updateStatus: (id: string, data: any) => api.put(`/changes/${id}/status`, data),
  requestApproval: (id: string, data: any) => api.post(`/changes/${id}/approval`, data),
  processApproval: (id: string, approvalId: string, data: any) => api.put(`/changes/${id}/approval/${approvalId}`, data),
  getStatistics: () => api.get('/changes/statistics'),
};

// Dashboard API
export const dashboardAPI = {
  getStats: () => api.get('/dashboard/stats'),
  getActivities: (params?: any) => api.get('/activities', { params }),
};

// Interfaces API
export const interfacesAPI = {
  getAll: (params?: any) => api.get('/interfaces', { params }),
  getById: (id: string) => api.get(`/interfaces/${id}`),
  create: (data: any) => api.post('/interfaces', data),
  update: (id: string, data: any) => api.put(`/interfaces/${id}`, data),
  delete: (id: string) => api.delete(`/interfaces/${id}`),
  // Endpoints
  getEndpoints: (interfaceId: string) => api.get(`/interfaces/${interfaceId}/endpoints`),
  createEndpoint: (interfaceId: string, data: any) => api.post(`/interfaces/${interfaceId}/endpoints`, data),
  updateEndpoint: (interfaceId: string, endpointId: string, data: any) => api.put(`/interfaces/${interfaceId}/endpoints/${endpointId}`, data),
  deleteEndpoint: (interfaceId: string, endpointId: string) => api.delete(`/interfaces/${interfaceId}/endpoints/${endpointId}`),
};

// Component Instances API (for linking)
export const componentInstancesAPI = {
  getAll: (params?: any) => api.get('/component-instances', { params }),
};

// Config API
export const configsAPI = {
  getAll: (params?: any) => api.get('/configs', { params }),
  getById: (id: string) => api.get(`/configs/${id}`),
  create: (data: any) => api.post('/configs', data),
  update: (id: string, data: any) => api.put(`/configs/${id}`, data),
  delete: (id: string) => api.delete(`/configs/${id}`),
  // Items
  getItems: (configId: string) => api.get(`/configs/${configId}/items`),
  createItem: (configId: string, data: any) => api.post(`/configs/${configId}/items`, data),
  updateItem: (configId: string, itemId: string, data: any) => api.put(`/configs/${configId}/items/${itemId}`, data),
  deleteItem: (configId: string, itemId: string) => api.delete(`/configs/${configId}/items/${itemId}`),
};

// Test Data API
export const testDataAPI = {
  getAll: (params?: any) => api.get('/test-data', { params }),
  getById: (id: string) => api.get(`/test-data/${id}`),
  create: (data: any) => api.post('/test-data', data),
  update: (id: string, data: any) => api.put(`/test-data/${id}`, data),
  delete: (id: string) => api.delete(`/test-data/${id}`),
  markRefreshed: (id: string) => api.post(`/test-data/${id}/refresh`),
};

// Infra Components API (additional for direct access)
export const infraAPI = {
  getByInstance: (envId: string, instanceId: string) => api.get(`/environments/${envId}/instances/${instanceId}/infra`),
  create: (envId: string, instanceId: string, data: any) => api.post(`/environments/${envId}/instances/${instanceId}/infra`, data),
  update: (envId: string, instanceId: string, infraId: string, data: any) => api.put(`/environments/${envId}/instances/${instanceId}/infra/${infraId}`, data),
  delete: (envId: string, instanceId: string, infraId: string) => api.delete(`/environments/${envId}/instances/${instanceId}/infra/${infraId}`),
};

// Topology API
export const topologyAPI = {
  getAll: () => api.get('/topology'),
  getEnvironmentTopology: (envId: string) => api.get(`/topology/environments/${envId}`),
  getApplicationTopology: (appId: string) => api.get(`/topology/applications/${appId}`),
};

// Bulk Upload API
export const bulkUploadAPI = {
  getTemplate: (type: string) => api.get(`/bulk-upload/template/${type}`, { responseType: 'blob' }),
  uploadEnvironments: (csvContent: string) => api.post('/bulk-upload/environments', { csvContent }),
  uploadInstances: (csvContent: string) => api.post('/bulk-upload/instances', { csvContent }),
  uploadApplications: (csvContent: string) => api.post('/bulk-upload/applications', { csvContent }),
  uploadInterfaces: (csvContent: string) => api.post('/bulk-upload/interfaces', { csvContent }),
  uploadComponents: (csvContent: string) => api.post('/bulk-upload/components', { csvContent }),
  uploadAppInstances: (csvContent: string) => api.post('/bulk-upload/app-instances', { csvContent }),
  uploadInfraComponents: (csvContent: string) => api.post('/bulk-upload/infra-components', { csvContent }),
};

export default api;
