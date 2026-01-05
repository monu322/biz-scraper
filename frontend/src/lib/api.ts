// API Configuration for deployment
// Uses environment variable in production, localhost in development

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Helper function to build API URLs
export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

// Helper for fetch requests with common options
export async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  return fetch(apiUrl(path), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
}

// Helper for SSE connections
export function apiEventSource(path: string): EventSource {
  return new EventSource(apiUrl(path));
}
