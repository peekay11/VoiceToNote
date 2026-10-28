
import React, { useState, useRef } from "react";
import { getUploadUrl, uploadAudioToS3 } from "../services/api.ts";
import { RiMicLine, RiStopCircleLine, RiUploadCloud2Line, RiCloseLine } from "react-icons/ri";
import "./VoiceRec.css";

interface VoiceRecProps {
  onUploadSuccess?: () => void;
}

const VoiceRec: React.FC<VoiceRecProps> = ({ onUploadSuccess }) => {
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);


  const startRecording = async () => {
    try {
      setStatusMessage("");

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      // onstop fires for both Save and Cancel — cancelled flag prevents upload
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop()); // release mic
        if (!cancelledRef.current) {
          const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          await uploadAudio(audioBlob);
        }
        cancelledRef.current = false;
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch (err) {
      setStatusMessage(
        err instanceof Error ? `Microphone error: ${err.message}` : "Failed to access microphone"
      );
    }
  };

  // Tracks whether the current stop was a cancel (discard) or a save (upload)
  const cancelledRef = useRef(false);

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      cancelledRef.current = false; // save mode
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && recording) {
      cancelledRef.current = true; // discard mode — onstop will skip upload
      mediaRecorderRef.current.stop();
      setRecording(false);
      setStatusMessage("");
    }
  };


  const uploadAudio = async (audioBlob: Blob) => {
    try {
      setUploading(true);
      setStatusMessage("Getting upload URL...");
      const { uploadUrl } = await getUploadUrl("webm");
      setStatusMessage("Uploading...");
      await uploadAudioToS3(uploadUrl, audioBlob);
      setStatusMessage("Processing in AWS...");
      onUploadSuccess?.();
    } catch (err) {
      setStatusMessage(
        err instanceof Error ? `Upload failed: ${err.message}` : "Failed to upload audio"
      );
    } finally {
      setUploading(false);
    }
  };


  return (
    <div className="voicerec">
      {/* Cancel button — only visible while recording */}
      {recording && (
        <button
          type="button"
          className="rec-cancel-btn"
          onClick={cancelRecording}
          title="Discard recording"
        >
          <RiCloseLine size={16} />
          <span>Cancel</span>
        </button>
      )}

      {/* Main circle button */}
      <button
        type="button"
        className={`rec-btn${recording ? " rec-btn--recording" : ""}${uploading ? " rec-btn--uploading" : ""}`}
        onClick={recording ? stopRecording : startRecording}
        disabled={uploading}
        title={recording ? "Stop and save" : "Start recording"}
      >
        {uploading ? (
          <RiUploadCloud2Line size={22} />
        ) : recording ? (
          <RiStopCircleLine size={22} />
        ) : (
          <RiMicLine size={22} />
        )}
        <span>{uploading ? "Saving" : recording ? "Stop" : "Rec"}</span>
      </button>

      {statusMessage && <span className="rec-status">{statusMessage}</span>}
    </div>
  );
};

export default VoiceRec;
