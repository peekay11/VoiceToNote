import React, { useState, useRef } from "react";
import "./VoiceRec.css";
import { getUploadUrl, uploadAudioToS3 } from "../services/api.ts";

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
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
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
      if (err instanceof Error) {
        setStatusMessage(`Microphone error: ${err.message}`);
      } else {
        setStatusMessage("Failed to access microphone");
      }
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

      setStatusMessage("Uploading audio to cloud...");
      await uploadAudioToS3(uploadUrl, audioBlob);

      setStatusMessage("Recording uploaded! Processing note in AWS...");
      if (onUploadSuccess) {
        onUploadSuccess();
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setStatusMessage(`Upload failed: ${err.message}`);
      } else {
        setStatusMessage("Failed to upload audio");
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rec-button">
      <button
        type="button"
        onClick={recording ? stopRecording : startRecording}
        disabled={uploading}
        style={{
          backgroundColor: recording ? "#ef4444" : "#2563eb",
          color: "white",
          cursor: uploading ? "not-allowed" : "pointer",
        }}
      >
        {uploading ? "Saving..." : recording ? "Stop" : "Rec"}
      </button>
      {statusMessage && (
        <span style={{ fontSize: "12px", color: "#64748b", marginLeft: "10px" }}>
          {statusMessage}
        </span>
      )}
    </div>
  );
};

export default VoiceRec;
