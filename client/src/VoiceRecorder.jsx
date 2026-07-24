import { useEffect, useRef, useState } from "react";
import { IconMic, IconSquare, IconX } from "./icons.jsx";

const MAX_SECONDS = 120;
const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"];

const formatTime = (totalSeconds) => {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
};

function pickMimeType() {
  if (typeof MediaRecorder === "undefined") return null;
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

export default function VoiceRecorder({ onRecorded, onError }) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const startTimeRef = useRef(0);
  const intervalRef = useRef(null);
  const discardRef = useRef(false);
  const finalDurationRef = useRef(0);

  useEffect(() => () => {
    clearInterval(intervalRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const stopTracking = () => {
    clearInterval(intervalRef.current);
    setRecording(false);
  };

  const finish = () => {
    finalDurationRef.current = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000));
    stopTracking();
    recorderRef.current?.stop();
  };

  const start = async () => {
    if (typeof navigator.mediaDevices?.getUserMedia !== "function" || typeof MediaRecorder === "undefined") {
      onError("Voice notes aren't supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      discardRef.current = false;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (discardRef.current) return;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        onRecorded({ blob, duration: finalDurationRef.current });
      };

      recorderRef.current = recorder;
      streamRef.current = stream;
      recorder.start();
      startTimeRef.current = Date.now();
      setElapsed(0);
      setRecording(true);

      intervalRef.current = setInterval(() => {
        const secs = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setElapsed(secs);
        if (secs >= MAX_SECONDS) finish();
      }, 250);
    } catch {
      onError("Microphone access was denied.");
    }
  };

  const cancel = () => {
    discardRef.current = true;
    stopTracking();
    recorderRef.current?.stop();
  };

  if (!recording) {
    return (
      <button
        type="button"
        className="comment-voice-record-btn"
        onClick={start}
        aria-label="Record a voice note"
        title="Record a voice note"
      >
        <IconMic />
      </button>
    );
  }

  return (
    <div className="comment-voice-recording">
      <span className="comment-voice-recording-dot" />
      <span className="comment-voice-recording-timer">{formatTime(elapsed)}</span>
      <button type="button" className="comment-voice-recording-cancel" onClick={cancel} aria-label="Cancel recording">
        <IconX />
      </button>
      <button type="button" className="comment-voice-recording-stop" onClick={finish} aria-label="Stop recording">
        <IconSquare />
      </button>
    </div>
  );
}
