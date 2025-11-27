export const getClientId = (): string => {
    const STORAGE_KEY = 'video_editor_client_id';

    // Check if ID exists in localStorage
    const existingId = localStorage.getItem(STORAGE_KEY);

    if (existingId) {
        return existingId;
    }

    // Generate a new unique integer ID within PostgreSQL integer range (0 to 2147483647)
    const newId = Math.floor(Math.random() * 2147483647).toString();

    // Save to localStorage
    localStorage.setItem(STORAGE_KEY, newId);

    return newId;
};
