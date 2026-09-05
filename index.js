const express = require('express');
const cors = require('cors');
const { Innertube, UniversalCache } = require('youtubei.js');

const app = express();
app.use(cors());
app.use(express.json());

let youtube;

// Initialize Innertube Client
(async () => {
    youtube = await Innertube.create({
        cache: new UniversalCache(false),
        generate_session_locally: true
    });
    console.log('[Innertube] Client initialized successfully.');
})();

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
            return res.status(400).json({ success: false, error: 'Invalid YouTube URL or Video ID.' });
        }

        if (!youtube) {
            return res.status(503).json({ success: false, error: 'YouTube client is initializing, try again in a few seconds.' });
        }

        // Get Video Info via Innertube
        const info = await youtube.getInfo(videoId);
        const transcriptData = await info.getTranscript();

        if (!transcriptData || !transcriptData.transcript || !transcriptData.transcript.content) {
            return res.status(404).json({ success: false, error: 'No transcript found for this video.' });
        }

        // Parse lines into simple array
        const body = transcriptData.transcript.content.body;
        const initialSegments = body.initial_segments || [];
        
        const parsedData = initialSegments.map(segment => {
            return {
                text: segment.snippet.text,
                start: segment.start_ms,
                duration: segment.end_ms - segment.start_ms
            };
        });

        return res.status(200).json({
            success: true,
            count: parsedData.length,
            data: parsedData
        });

    } catch (error) {
        console.error('[Transcript Error]', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch transcript using Innertube API.',
            details: error.message
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Innertube Transcript API running on port ${PORT}`));
