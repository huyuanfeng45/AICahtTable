export interface SyncPayload {
  settings: any;
  personas: any[];
  adminCredentials: any;
  timestamp: number;
}

const API_BASE = 'https://jsonblob.com/api/jsonBlob';

export const SyncService = {
  /**
   * Create a new sync storage and return the ID (Sync Code)
   */
  async create(data: SyncPayload): Promise<string> {
    try {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error(`Sync creation failed: ${response.statusText}`);
      }

      // The Location header contains the URL to the new blob
      const location = response.headers.get('Location');
      if (!location) throw new Error('No location header returned');

      // Extract ID from URL (last segment)
      const id = location.split('/').pop();
      if (!id) throw new Error('Could not parse Sync ID');

      return id;
    } catch (error) {
      console.error('Cloud Sync Create Error:', error);
      throw error;
    }
  },

  /**
   * Update existing sync storage
   */
  async update(id: string, data: SyncPayload): Promise<void> {
    try {
      const response = await fetch(`${API_BASE}/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        // If 404, it might mean the code expired or was deleted
        if (response.status === 404) {
           throw new Error('Sync Code not found or expired');
        }
        throw new Error(`Sync update failed: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Cloud Sync Update Error:', error);
      throw error;
    }
  },

  /**
   * Fetch data from sync storage
   */
  async get(id: string): Promise<SyncPayload> {
    try {
      const response = await fetch(`${API_BASE}/${id}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
           throw new Error('Sync Code not found');
        }
        throw new Error(`Sync fetch failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Cloud Sync Get Error:', error);
      throw error;
    }
  }
};