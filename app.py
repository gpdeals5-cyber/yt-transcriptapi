from flask import Flask, request, jsonify
from flask_cors import CORS
from youtube_transcript_api import YouTubeTranscriptApi
import re

app = Flask(__name__)
CORS(app)

def extract_video_id(url):
    regex = r"(?:v=|\/)([0-9A-Za-z_-]{11})"
    match = re.search(regex, url)
    return match.group(1) if match else None

@app.route('/api/transcript', methods=['GET'])
def get_transcript():
    video_url = request.args.get('url')
    if not video_url:
        return jsonify({'success': False, 'error': 'Missing URL parameter'}), 400

    video_id = extract_video_id(video_url)
    if not video_id:
        return jsonify({'success': False, 'error': 'Invalid YouTube URL'}), 400

    try:
        # Step 1: Video ke saare transcript tracks list karein
        transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)

        # Step 2: Auto-generated ya manually created track fetch karein
        try:
            transcript = transcript_list.find_transcript(['en', 'en-US', 'auto'])
        except Exception:
            # Agar English nahi milti toh jo bhi pehla generated/manual track mile use utha lein
            transcript = transcript_list.find_generated_transcript(['en']) if transcript_list else None
            if not transcript:
                first_track = next(iter(transcript_list))
                transcript = first_track

        data = transcript.fetch()
        full_text = " ".join([item['text'] for item in data])
        clean_text = full_text.replace('\n', ' ')

        return jsonify({
            'success': True,
            'data': clean_text
        }), 200

    except Exception as e:
        return jsonify({'success': False, 'error': f"Captions unavailable for this video. Details: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
