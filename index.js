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

        // 1. Direct InnerTube Player API Call (Bypasses IP Blocks)
        const playerResponse = await axios.post('https://www.youtube.com/youtubei/v1/player', {
            videoId: videoId,
            context: {
                client: {
                    clientName: 'WEB',
                    clientVersion: '2.20240301.00.00',
                    hl: 'en',
                    gl: 'US'
                }
            }
        }, {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
            }
        });

        const captions = playerResponse.data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

        if (!captions || captions.length === 0) {
            return res.status(404).json({ success: false, error: 'No captions found for this video.' });
        }

        // 2. Select English/Auto-Generated or First Track
        let track = captions.find(c => c.languageCode === 'en') || captions[0];
        let transcriptUrl = track.baseUrl;

        if (!transcriptUrl) {
            return res.status(404).json({ success: false, error: 'Transcript URL unavailable.' });
        }

        // 3. Fetch XML Subtitles Data
        const xmlResponse = await axios.get(transcriptUrl);
        const xmlData = xmlResponse.data;

        // 4. Parse XML Text
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
        console.error('API Error:', error.message);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch transcript.',
            details: error.message
        });
    }
});

app.get('/', (req, res) => res.send('YouTube InnerTube Transcript API active.'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
