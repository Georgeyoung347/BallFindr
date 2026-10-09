/**
 * Client-side video compression for Player Media.
 *
 * Oversized-but-valid clips (<= MAX_VIDEO_SECONDS) are re-encoded in the
 * browser with MediaRecorder before they ever reach Supabase Storage, so the
 * uploaded file always fits inside the 50 MB storage limit. No server, no
 * extra dependency, no second media system.
 *
 * Audio: the source <video> starts muted, so the clip never plays aloud and
 * muted playback is allowed without a fresh tap (iOS rejects unmuted play()
 * after an await). The soundtrack is recorded from
 *  - video.captureStream() where it exists (Chromium incl. the Android app);
 *    captured tracks ignore the element's mute, per the capture spec, or
 *  - Web Audio (createMediaElementSource -> MediaStreamDestination) where it
 *    doesn't (WebKit: Safari and the iOS app). Once the element is routed into
 *    the graph, which is never connected to the speakers, it is unmuted so real
 *    samples flow; if unmuted play() is refused it falls back to muted. If no
 *    running AudioContext can be had, the clip is compressed without sound
 *    rather than failing.
 */

/** Target output size, kept below the 50 MB storage limit as a safety margin. */
export const COMPRESSION_TARGET_BYTES = 47 * 1024 * 1024;
/** Longest edge of the re-encoded video; anything larger is scaled down. */
const MAX_OUTPUT_WIDTH = 1280;
const MAX_OUTPUT_HEIGHT = 720;
const AUDIO_BITS_PER_SECOND = 96_000;
const MAX_VIDEO_BITS_PER_SECOND = 12_000_000;
const MIN_VIDEO_BITS_PER_SECOND = 800_000;

function pickMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = [
    "video/mp4;codecs=avc1.4d002a,mp4a.40.2",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
}

function containerFor(mimeType: string) {
  return mimeType.startsWith("video/mp4")
    ? { type: "video/mp4", extension: "mp4" }
    : { type: "video/webm", extension: "webm" };
}

export function canCompressVideo() {
  return pickMimeType() !== null && typeof HTMLCanvasElement.prototype.captureStream === "function";
}

function fitWithin(width: number, height: number) {
  const scale = Math.min(1, MAX_OUTPUT_WIDTH / width, MAX_OUTPUT_HEIGHT / height);
  // Even dimensions keep H.264/VP9 encoders happy.
  const w = Math.max(2, Math.round((width * scale) / 2) * 2);
  const h = Math.max(2, Math.round((height * scale) / 2) * 2);
  return { width: w, height: h };
}

function loadVideo(file: File): Promise<{ video: HTMLVideoElement; revoke: () => void }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "auto";
    // muted (property + attribute) keeps playback silent and lets iOS play it
    // without a user gesture; playsinline stops iPhone going fullscreen.
    video.muted = true;
    video.defaultMuted = true;
    video.setAttribute("muted", "");
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.onloadeddata = () => resolve({ video, revoke: () => URL.revokeObjectURL(url) });
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("This video can't be played in the browser, so it can't be compressed."));
    };
    video.src = url;
  });
}

interface EncodeOptions {
  file: File;
  durationSeconds: number;
  videoBitsPerSecond: number;
  onProgress?: ((fraction: number) => void) | undefined;
  signal?: AbortSignal | undefined;
  /** Web Audio context for browsers without HTMLMediaElement.captureStream (WebKit). */
  audioContext?: AudioContext | null | undefined;
}

type CapturableVideo = HTMLVideoElement & { captureStream?: () => MediaStream };

/** Chromium/Android expose element capture; WebKit (Safari, iOS app) doesn't. */
function hasElementCapture(): boolean {
  return (
    typeof HTMLMediaElement !== "undefined" &&
    typeof (HTMLMediaElement.prototype as Partial<CapturableVideo>).captureStream === "function"
  );
}

/**
 * Creates the AudioContext used to record the soundtrack on WebKit, or null
 * (no Web Audio, creation refused, ...), in which case the output is video-only.
 */
function createAudioContext(): AudioContext | null {
  try {
    if (typeof window === "undefined") return null;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    const ctx = new Ctor();
    if (typeof ctx.createMediaStreamDestination !== "function") {
      void ctx.close().catch(() => undefined);
      return null;
    }
    return ctx;
  } catch {
    return null;
  }
}

/** Tries to get the context running; resolves false if it stays suspended (no user gesture). */
async function ensureRunning(ctx: AudioContext): Promise<boolean> {
  if (ctx.state === "running") return true;
  try {
    await Promise.race([ctx.resume(), new Promise((resolve) => setTimeout(resolve, 500))]);
  } catch {
    /* treated as not running */
  }
  return (ctx.state as string) === "running";
}

async function encodeOnce({
  file,
  durationSeconds,
  videoBitsPerSecond,
  onProgress,
  signal,
  audioContext,
}: EncodeOptions): Promise<Blob> {
  const mimeType = pickMimeType();
  if (!mimeType) throw new Error("This browser can't compress video. Try Chrome, Edge or Safari.");

  const { video, revoke } = await loadVideo(file);
  const size = fitWithin(video.videoWidth || MAX_OUTPUT_WIDTH, video.videoHeight || MAX_OUTPUT_HEIGHT);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    revoke();
    throw new Error("This browser can't compress video right now.");
  }

  const stream = canvas.captureStream(30);
  // Keep the original soundtrack (see the header comment for which path runs where).
  let source: MediaStream | undefined;
  let audioNode: MediaElementAudioSourceNode | undefined;
  const capture = (video as CapturableVideo).captureStream;
  if (typeof capture === "function") {
    try {
      source = capture.call(video);
      source.getAudioTracks().forEach((track) => stream.addTrack(track));
    } catch {
      /* video-only */
    }
  } else if (audioContext && (await ensureRunning(audioContext))) {
    try {
      audioNode = audioContext.createMediaElementSource(video);
      const destination = audioContext.createMediaStreamDestination();
      // Deliberately not connected to audioContext.destination: recorded, never heard.
      audioNode.connect(destination);
      destination.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
      // Now that the element's sound only goes into the graph (inaudible), unmute
      // it: a muted element can feed silence into Web Audio. If unmuted play() is
      // refused (Safari without a fresh tap), playback below retries muted.
      video.muted = false;
    } catch {
      /* video-only */
    }
  }

  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond,
    audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
  });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size) chunks.push(event.data);
  };

  return new Promise<Blob>((resolve, reject) => {
    let raf = 0;
    const cleanup = () => {
      cancelAnimationFrame(raf);
      stream.getTracks().forEach((t) => t.stop());
      source?.getTracks().forEach((t) => t.stop());
      try {
        audioNode?.disconnect();
      } catch {
        /* already disconnected */
      }
      video.pause();
      video.removeAttribute("src");
      video.load();
      revoke();
    };

    const abort = () => {
      try {
        recorder.stop();
      } catch {
        /* already stopped */
      }
      cleanup();
      reject(new Error("Upload cancelled."));
    };
    signal?.addEventListener("abort", abort, { once: true });

    recorder.onerror = () => {
      cleanup();
      reject(new Error("Compressing this video failed. Try a shorter or smaller clip."));
    };
    recorder.onstop = () => {
      cleanup();
      resolve(new Blob(chunks, { type: containerFor(mimeType).type }));
    };

    const draw = () => {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      if (durationSeconds > 0) {
        onProgress?.(Math.min(0.99, video.currentTime / durationSeconds));
      }
      raf = requestAnimationFrame(draw);
    };

    video.onended = () => {
      if (recorder.state !== "inactive") recorder.stop();
    };

    const start = () => {
      recorder.start(1000);
      draw();
    };
    const fail = () => {
      cleanup();
      reject(new Error("Compressing this video failed. Try a shorter or smaller clip."));
    };

    video.currentTime = 0;
    video
      .play()
      .then(start)
      .catch(() => {
        if (video.muted) return fail();
        // Unmuted playback refused: muted playback is always allowed (the
        // soundtrack may then be silent, but the clip still compresses).
        video.muted = true;
        video.play().then(start).catch(fail);
      });
  });
}

/**
 * Re-encodes `file` so the result fits under COMPRESSION_TARGET_BYTES.
 * Bitrate is derived from the clip length, with one lower-bitrate retry.
 */
export async function compressVideo(
  file: File,
  durationSeconds: number,
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<File> {
  if (!canCompressVideo()) {
    throw new Error("This browser can't compress video. Please upload a clip of 50 MB or less.");
  }
  const seconds = Math.max(1, durationSeconds || 1);
  const budgetBits = COMPRESSION_TARGET_BYTES * 8;
  let videoBitrate = Math.round(budgetBits / seconds) - AUDIO_BITS_PER_SECOND;
  videoBitrate = Math.min(MAX_VIDEO_BITS_PER_SECOND, Math.max(MIN_VIDEO_BITS_PER_SECOND, videoBitrate));

  // Created before the first await so a caller still inside a tap unlocks it
  // on Safari; the iOS app allows Web Audio without a gesture anyway.
  const audioContext = hasElementCapture() ? null : createAudioContext();
  let blob: Blob;
  try {
    if (audioContext) void audioContext.resume().catch(() => undefined);
    blob = await encodeOnce({
      file,
      durationSeconds: seconds,
      videoBitsPerSecond: videoBitrate,
      onProgress,
      signal,
      audioContext,
    });

    if (blob.size > COMPRESSION_TARGET_BYTES) {
      const ratio = COMPRESSION_TARGET_BYTES / blob.size;
      const retryBitrate = Math.max(
        MIN_VIDEO_BITS_PER_SECOND,
        Math.round(videoBitrate * ratio * 0.9),
      );
      blob = await encodeOnce({
        file,
        durationSeconds: seconds,
        videoBitsPerSecond: retryBitrate,
        onProgress,
        signal,
        audioContext,
      });
    }
  } finally {
    if (audioContext) void audioContext.close().catch(() => undefined);
  }

  if (blob.size > COMPRESSION_TARGET_BYTES) {
    throw new Error(
      "We couldn't get this clip under 50 MB. Please trim it or export it at a lower quality and try again.",
    );
  }

  const mimeType = pickMimeType() as string;
  const { type, extension } = containerFor(mimeType);
  const base = file.name.replace(/\.[^.]+$/, "") || "clip";
  onProgress?.(1);
  return new File([blob], `${base}.${extension}`, { type, lastModified: Date.now() });
}
