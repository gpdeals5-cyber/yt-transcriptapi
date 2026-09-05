const express = require('express');
const cors = require('cors');
const { YoutubeTranscript } = require('youtube-transcript');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/transcript', async (req, res) => {
    try {
        const videoUrl = req.query.url;

        if (!videoUrl) {
            return res.status(400).json({ 
                success: false,
                error: 'YouTube URL parameter missing.' 
            });
        }

        const transcript = await YoutubeTranscript.fetchTranscript(videoUrl);
        
        return res.status(200).json({ 
            success: true, 
            count: transcript.length,
            data: transcript 
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch transcript. Check if video has captions enabled.',
            details: error.message
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
