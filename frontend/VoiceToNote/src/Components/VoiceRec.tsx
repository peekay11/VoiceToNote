import React, { useState, useRef } from "react";
import "./VoiceRec.css";
import { getUploadUrl, uploadAudioToS3 } from "../services/api.ts";
import { RiMicLine, RiStopCircleLine, RiUploadCloud2Line } from "react-icons/ri";

interface VoiceRecProps {
  onUploadSuccess?: () => void;
}

const VoiceRec: React.FC<VoiceRecProps> = ({ onUploadSuccess }) => {
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const startRecording = async () => {
    try {
      setStatusMessage("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });

      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        await handleAudioUpload(audioBlob);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setRecording(true);
    } catch (err: unknown) {
      setStatusMessage(
        err instanceof Error ? `Microphone error: ${err.message}` : "Failed to access microphone"
      );
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const handleAudioUpload = async (audioBlob: Blob) => {
    try {
      setUploading(true);
      setStatusMessage("Getting upload URL...");
      const { uploadUrl } = await getUploadUrl("webm");
      setStatusMessage("Uploading...");
      await uploadAudioToS3(uploadUrl, audioBlob);
      setStatusMessage("Processing in AWS...");
      if (onUploadSuccess) onUploadSuccess();
    } catch (err: unknown) {
      setStatusMessage(
        err instanceof Error ? `Upload failed: ${err.message}` : "Failed to upload audio"
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="voicerec">
      <button
        type="button"
        className={`rec-btn${recording ? " rec-btn--recording" : ""}${uploading ? " rec-btn--uploading" : ""}`}
        onClick={recording ? stopRecording : startRecording}
        disabled={uploading}
        title={recording ? "Stop recording" : "Start recording"}
      >
        {uploading ? (
          <RiUploadCloud2Line size={18} />
        ) : recording ? (
          <RiStopCircleLine size={18} />
        ) : (
          <RiMicLine size={18} />
        )}
        <span>{uploading ? "Saving..." : recording ? "Stop" : "Rec"}</span>
      </button>
      {statusMessage && <span className="rec-status">{statusMessage}</span>}
    </div>
  );
};

export default VoiceRec;
