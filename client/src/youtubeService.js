import axios from 'axios';

const API_KEY = 'AIzaSyDmSTYdSkweyXhppZvjOYhhTVolubrR39Y'; // Unga API Key-ah inga paste pannunga

export const searchYouTubeMusic = async (query) => {
  try {
    console.log(`[YouTubeAPI] Fetching results for: "${query}"`);
    const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        part: 'snippet',
        maxResults: 20,
        q: `${query} official audio song`,
        type: 'video',
        videoCategoryId: '10', // Music category
        relevanceLanguage: 'en',
        key: API_KEY
      }
    });
    
    if (response.data && response.data.items) {
      console.log(`[YouTubeAPI] Success: ${response.data.items.length} items found`);
      return response.data.items;
    }
    
    console.warn("[YouTubeAPI] No items found in response", response.data);
    return [];
  } catch (error) {
    console.error("[YouTubeAPI] Error fetching data:", error.response?.data || error.message);
    return [];
  }
};