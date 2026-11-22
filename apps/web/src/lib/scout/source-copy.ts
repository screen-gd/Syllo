/**
 * Wording for building a Scout pack from pasted YouTube links. The Scout form
 * reads the field text and the start endpoint and pipeline read the errors
 * and progress lines, so both sides stay in step.
 */
export const SOURCE_COPY = {
    label: "YouTube links (optional)",
    placeholder: "https://www.youtube.com/@channel",
    caption: "Paste one link per line. Channels, playlists, and videos work. Leave this empty to search the web.",
    invalidLink: (line: string) => `"${line}" is not a YouTube channel, playlist, or video link. Replace or remove that line.`,
    tooManyLinks: "Scout accepts up to 10 links. Remove the extra lines to continue.",
    noVideos: "Scout found no videos in those links. Check that they are public or try different links.",
    listing: "Finding videos in your links",
    found: (count: number) => `Reading ${count} ${count === 1 ? "video" : "videos"} from your links`,
    feedOnly: "Scout sees only the latest 15 channel videos. Add a YouTube key to unlock the full channel.",
    badYouTubeKey: "YouTube rejected the saved key because it is not a valid YouTube Data API key. A Gemini key does not work here. Replace YOUTUBE_API_KEY in apps/web/.env.local or remove it to use the latest 15 videos only.",
    listFailed: (detail: string) => `Scout could not read those links. Check them and try again. Reason: ${detail}`,
    noTranscriptHelper: "Scout could not find the Python transcript helper. Run python -m pip install youtube-transcript-api, then restart Syllo and try again.",
    noPython: "Scout could not find Python on this computer. Install Python, run python -m pip install youtube-transcript-api, then restart Syllo and try again.",
};
