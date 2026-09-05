const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

function extractVideoID(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

app.get('/api/transcript', async (req, res) => {
    try {
        const rawUrl = req.query.url;
        if (!rawUrl) {
            return res.status(400).json({ success: false, error: 'Missing URL parameter.' });
        }

        const videoId = extractVideoID(rawUrl);
        if (!videoId) {
            return res.status(400).json({ success: false, error: 'Invalid YouTube URL.' });
        }

        // Fetch YouTube Video Page HTML
        const videoPageResponse = await axios.get(`https://www.youtube.com/watch?v=${videoId}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });

        const html = videoPageResponse.data;

        // Extract Captions JSON Track Object
        const splitHtml = html.split('"captionTracks":');
        if (splitHtml.length < 2) {
            return res.status(404).json({ success: false, error: 'No captions or auto-generated tracks found for this video.' });
        }

        const captionTracksJson = JSON.parse(splitHtml[1].split('],"')[0] + ']');
        if (!captionTracksJson || captionTracksJson.length === 0) {
            return res.status(404).json({ success: false, error: 'Caption tracks array is empty.' });
        }

        // Select English/Default Track URL
        let track = captionTracksJson.find(t => t.languageCode === 'en') || captionTracksJson[0];
        let transcriptUrl = track.baseUrl;

        if (!transcriptUrl) {
            return res.status(404).json({ success: false, error: 'Timed text URL not found.' });
        }

        // Fetch XML Captions Data
        const transcriptXmlResponse = await axios.get(transcriptUrl);
        const xmlData = transcriptXmlResponse.data;

        // Parse XML Text
        const textMatches = [...xmlData.matchAll(/<text[^>]*>(.*?)<\/text>/g)];
        const parsedData = textMatches.map(m => {
            let cleanText = m[1]
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/&#10;/g, ' ')
                .replace(/\n/g, ' ');
            return { text: cleanText };
        });

        if (parsedData.length === 0) {
            return res.status(404).json({ success: false, error: 'Failed to parse text from transcript track.' });
        }

        return res.status(200).json({
            success: true,
            count: parsedData.length,
            data: parsedData
        });

    } catch (error) {
        console.error('Transcript Fetch Error:', error.message);
        return res.status(500).json({
            success: false,
            error: 'Failed to extract transcript track.',
            details: error.message
        });
    }
});

app.get('/', (req, res) => res.send('Direct YouTube Subtitle Extractor API is Live.'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server active on port ${PORT}`));
