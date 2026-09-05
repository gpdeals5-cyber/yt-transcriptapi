const express = require('express');
const cors = require('cors');
const { Innertube, UniversalCache } = require('youtubei.js');

const app = express();
app.use(cors());
app.use(express.json());

let youtubeClient = null;

// Initialize YouTube Client safely
async function getYouTubeClient() {
    if (!youtubeClient) {
        youtubeClient = await Innertube.create({
            cache: new UniversalCache(false),
            generate_session_locally: true
        });
    }
    return youtubeClient;
}

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

        const yt = await getYouTubeClient();
        const info = await yt.getInfo(videoId);
        const transcriptData = await info.getTranscript();

        if (!transcriptData || !transcriptData.transcript) {
            return res.status(404).json({ success: false, error: 'No transcript data available for this video.' });
        }

        // Handle different structural formats returned by Innertube
        const content = transcriptData.transcript.content;
        let segments = [];

        if (content && content.body && content.body.initial_segments) {
            segments = content.body.initial_segments;
        } else if (transcriptData.segments) {
            segments = transcriptData.segments;
        }

        if (!segments || segments.length === 0) {
            return res.status(404).json({ success: false, error: 'Transcript segments are empty.' });
        }

        const parsedData = segments.map(segment => {
            return {
                text: segment.snippet ? segment.snippet.text : (segment.text || ''),
                start: segment.start_ms || 0,
                duration: (segment.end_ms && segment.start_ms) ? (segment.end_ms - segment.start_ms) : 0
            };
        });

        return res.status(200).json({
            success: true,
            count: parsedData.length,
            data: parsedData
        });

    } catch (error) {
        console.error('[Transcript Error Details]:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch transcript using Innertube API.',
            details: error.message
        });
    }
});

app.get('/', (req, res) => res.send('Innertube Transcript API is Live.'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
