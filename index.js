const express = require('express');
const cors = require('cors');
const { YoutubeTranscript } = require('youtube-transcript');

const app = express();
app.use(cors());
app.use(express.json());

// Helper: Extract Video ID from any YouTube URL format
function extractVideoID(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

app.get('/api/transcript', async (req, res) => {
    try {
        const rawUrl = req.query.url;

        if (!rawUrl) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing URL parameter.' 
            });
        }

        const videoId = extractVideoID(rawUrl);
        if (!videoId) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid YouTube URL or Video ID.' 
            });
        }

        let transcript = null;

        // Multi-Language & Auto-Caption Fallback Array
        // Primary attempt: Default track (whatever language video has)
        try {
            transcript = await YoutubeTranscript.fetchTranscript(videoId);
        } catch (e1) {
            // Secondary attempts for common languages & auto-generated tracks
            const languages = ['en', 'ur', 'hi', 'es', 'fr', 'de', 'ar', 'pt', 'id'];
            
            for (const lang of languages) {
                try {
                    transcript = await YoutubeTranscript.fetchTranscript(videoId, { lang });
                    if (transcript && transcript.length > 0) break;
                } catch (e) {
                    continue;
                }
            }
        }

        if (!transcript || transcript.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'No captions found or YouTube blocked server access for this auto-generated track.'
            });
        }

        return res.status(200).json({ 
            success: true, 
            count: transcript.length,
            data: transcript 
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch transcript from YouTube.',
            details: error.message
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Universal Multi-Language Transcript API running on port ${PORT}`);
});
