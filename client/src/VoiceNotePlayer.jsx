import { useEffect, useRef, useState } from "react";
import { IconPause, IconPlay } from "./icons.jsx";

const formatTime = (totalSeconds) => {
  const safe = Number.isFinite(totalSeconds) ? totalSeconds : 0;
  const m = Math.floor(safe / 60);
  const s = Math.floor(safe % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
};

export default function VoiceNotePlayer({ src, duration = 0, activeAudioRef }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [knownDuration, setKnownDuration] = useState(duration);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => setCurrentTime(0);

    // Recorded blob audio can report duration as Infinity until played
    // through/seeked once — a well-known MediaRecorder + <audio> quirk.
    const onLoadedMetadata = () => {
      if (Number.isFinite(audio.duration)) {
        setKnownDuration(audio.duration);
        return;
      }
      const fixDuration = () => {
        if (Number.isFinite(audio.duration)) {
          setKnownDuration(audio.duration);
          audio.currentTime = 0;
          audio.removeEventListener("durationchange", fixDuration);
        }
      };
      audio.addEventListener("durationchange", fixDuration);
      audio.currentTime = Number.MAX_SAFE_INTEGER;
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      return;
    }
    if (activeAudioRef && activeAudioRef.current && activeAudioRef.current !== audio) {
      activeAudioRef.current.pause();
    }
    if (activeAudioRef) activeAudioRef.current = audio;
    audio.play().catch(() => {});
  };

  const handleSeek = (e) => {
    const t = Number(e.target.value);
    if (audioRef.current) audioRef.current.currentTime = t;
    setCurrentTime(t);
  };

  return (
    <div className="voice-note-player">
      <audio ref={audioRef} src={src} preload="metadata" />
      <button
        type="button"
        className="voice-note-play-btn"
        onClick={togglePlay}
        aria-label={playing ? "Pause voice note" : "Play voice note"}
      >
        {playing ? <IconPause /> : <IconPlay />}
      </button>
      <input
        type="range"
        className="voice-note-scrubber"
        min={0}
        max={knownDuration || 0}
        step={0.1}
        value={Math.min(currentTime, knownDuration || 0)}
        onChange={handleSeek}
        aria-label="Seek voice note"
      />
      <span className="voice-note-time">
        {formatTime(currentTime)} / {formatTime(knownDuration)}
      </span>
    </div>
  );
}
