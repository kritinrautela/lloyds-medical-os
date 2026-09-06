import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Check, Image as ImageIcon, RotateCcw, Upload, UserRound, X } from 'lucide-react';
import { api } from '../services/api';

/*
 * Patient photograph.
 *
 * In a district where many patients share a name and very few carry an identity
 * document, a photograph on the record is the most reliable way a clerk can
 * confirm that the person at the counter is the person the record belongs to.
 * It also stops one card being passed around a family to collect medicines
 * repeatedly under one name.
 *
 * Two ways in, because clinic laptops vary: the built-in camera, and a file
 * already on the machine. Both are downscaled and compressed in the browser
 * before they are sent, so an old laptop on clinic Wi-Fi is not pushing a
 * four-megapixel frame across the network for every registration.
 */

const TARGET_WIDTH = 480;
const JPEG_QUALITY = 0.72;

function drawToJpeg(source, width, height) {
  const scale = Math.min(1, TARGET_WIDTH / width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}

/** The stored photograph, or a neutral placeholder when there is none. */
export function PatientAvatar({ patient, size = 40, className = '' }) {
  const [failed, setFailed] = useState(false);
  const hasPhoto = !!patient?.photo_path && !failed;

  useEffect(() => { setFailed(false); }, [patient?.id, patient?.photo_taken_at]);

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-line bg-subtle ${className}`}
      style={{ width: size, height: size }}
    >
      {hasPhoto ? (
        <img
          src={api.getPatientPhotoUrl(patient.id, patient.photo_taken_at || '')}
          alt={`Photograph of ${patient.full_name}`}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <UserRound
          className="text-ink-3"
          style={{ width: size * 0.5, height: size * 0.5 }}
          aria-label="No photograph on this record"
        />
      )}
    </span>
  );
}

export default function PatientPhotoCapture({ patient, takenBy, onSaved }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileRef = useRef(null);

  const [cameraOn, setCameraOn] = useState(false);
  const [pending, setPending] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraOn(false);
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  const startCamera = async () => {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('This computer has no camera the browser can use. Choose a photograph from the machine instead.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 720 } },
        audio: false
      });
      streamRef.current = stream;
      setCameraOn(true);
      // The element only exists once cameraOn has rendered it.
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch (err) {
      setError(
        err && err.name === 'NotAllowedError'
          ? 'The browser blocked the camera. Allow camera access for this page, then try again.'
          : 'The camera could not be opened. Choose a photograph from the machine instead.'
      );
    }
  };

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    setPending(drawToJpeg(video, video.videoWidth, video.videoHeight));
    stopCamera();
  };

  const chooseFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    if (!file.type.startsWith('image/')) {
      setError('That file is not a picture.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => setPending(drawToJpeg(img, img.naturalWidth, img.naturalHeight));
      img.onerror = () => setError('That picture could not be read.');
      img.src = reader.result;
    };
    reader.onerror = () => setError('That file could not be read.');
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const save = async () => {
    if (!pending || !patient?.id) return;
    setSaving(true);
    setError('');
    try {
      const res = await api.savePatientPhoto(patient.id, pending, takenBy);
      setPending(null);
      onSaved?.(res.patient);
    } catch (err) {
      setError(err.message || 'The photograph could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2.5">
      <div className="relative overflow-hidden rounded-md border border-line bg-subtle">
        <div className="aspect-[4/3] w-full">
          {pending ? (
            <img src={pending} alt="Photograph waiting to be saved" className="h-full w-full object-cover" />
          ) : cameraOn ? (
            // Mirrored, because an unmirrored preview makes people move the
            // wrong way when they try to centre themselves.
            <video
              ref={videoRef}
              playsInline
              muted
              className="h-full w-full -scale-x-100 object-cover"
            />
          ) : patient?.photo_path ? (
            <img
              src={api.getPatientPhotoUrl(patient.id, patient.photo_taken_at || '')}
              alt={`Photograph of ${patient.full_name}`}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-ink-3">
              <ImageIcon className="h-7 w-7" aria-hidden="true" />
              <p className="text-xs">No photograph on this record</p>
            </div>
          )}
        </div>
      </div>

      {pending ? (
        <div className="flex gap-2">
          <button type="button" className="btn btn-sm btn-primary flex-1" onClick={save} disabled={saving}>
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            {saving ? 'Saving' : 'Use this photograph'}
          </button>
          <button type="button" className="btn btn-sm" onClick={() => { setPending(null); startCamera(); }}>
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Retake
          </button>
          <button type="button" className="btn btn-sm" onClick={() => setPending(null)} aria-label="Discard">
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      ) : cameraOn ? (
        <div className="flex gap-2">
          <button type="button" className="btn btn-sm btn-primary flex-1" onClick={capture}>
            <Camera className="h-3.5 w-3.5" aria-hidden="true" />
            Take the photograph
          </button>
          <button type="button" className="btn btn-sm" onClick={stopCamera}>Cancel</button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button type="button" className="btn btn-sm flex-1" onClick={startCamera}>
            <Camera className="h-3.5 w-3.5" aria-hidden="true" />
            {patient?.photo_path ? 'Retake with the camera' : 'Use the camera'}
          </button>
          <button type="button" className="btn btn-sm flex-1" onClick={() => fileRef.current?.click()}>
            <Upload className="h-3.5 w-3.5" aria-hidden="true" />
            From this computer
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={chooseFile}
          />
        </div>
      )}

      {error ? (
        <p className="rounded border border-warn-line bg-warn-wash px-2.5 py-1.5 text-xs text-warn">
          {error}
        </p>
      ) : null}

      {patient?.photo_taken_at ? (
        <p className="text-2xs text-ink-3">
          Taken {new Date(`${patient.photo_taken_at}Z`.replace(' ', 'T')).toLocaleString([], {
            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
          })}
          {patient.photo_taken_by ? ` by ${patient.photo_taken_by}` : ''}.
        </p>
      ) : null}
    </div>
  );
}
