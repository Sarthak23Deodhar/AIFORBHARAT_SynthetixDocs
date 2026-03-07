// mockData.js
// V4: Mock data completely removed per user request. 
// This now acts as a simple fetch wrapper that enforces live backend interaction 
// and throws actual network/500 errors to the UI.

export const fetchWithFallback = async (url, options = {}) => {
    const response = await fetch(url, options);

    if (!response.ok) {
        // If the backend returns a 500 (e.g., missing AWS credentials), 
        // we throw the error so the UI handles it as a real failure,
        // rather than masking it with mock data.
        throw new Error(`Live API Error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
};
