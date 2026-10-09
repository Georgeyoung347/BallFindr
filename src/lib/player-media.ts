/**
 * Player media (photos + short video clips) backed by the `media` table and
 * the private `player-media` storage bucket.
 *
 * Ownership is enforced by RLS and the enforce_media_write trigger; signed-in
 * users receive short-lived signed URLs, never raw storage paths for display.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { compressVideo } from "@/lib/video-compression";

export const PLAYER_MEDIA_BUCKET = "player-media";
export const MAX_MEDIA_PHOTO_BYTES = 8 * 1024 * 1024;
/** Hard limit for the file that actually reaches Storage. */
export const MAX_UPLOAD_VIDEO_BYTES = 50 * 1024 * 1024;
/** Largest source clip we accept; anything above 50 MB is compressed first. */
export const MAX_MEDIA_VIDEO_BYTES = 500 * 1024 * 1024;
export const MAX_MEDIA_VIDEO_MB = 500;
export const MAX_VIDEO_SECONDS = 20;
export const MAX_MEDIA_TITLE = 80;
export const MAX_MEDIA_CAPTION = 300;

const PHOTO_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const VIDEO_TYPES: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

export const PHOTO_ACCEPT = Object.keys(PHOTO_TYPES).join(",");
export const VIDEO_ACCEPT = Object.keys(VIDEO_TYPES).join(",");

export type PlayerMediaKind = "photo" | "video";

export interface PlayerMediaItem {
  id: string;
  ownerId: string;
  kind: PlayerMediaKind;
  title: string | null;
  caption: string | null;
  url: string;
  sortOrder: number;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  createdAt: string;
}

interface Probe {
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
}

function probeImage(file: File): Promise<Probe> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ durationSeconds: null, width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file doesn't look like a valid image."));
    };
    img.src = url;
  });
}

function probeVideo(file: File): Promise<Probe> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    const done = () => {
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      video.load();
    };
    video.onloadedmetadata = () => {
      const duration = video.duration;
      const width = video.videoWidth || null;
      const height = video.videoHeight || null;
      done();
      if (!Number.isFinite(duration) || duration <= 0) {
        reject(new Error("We couldn't read this video's length. Try exporting it as an MP4."));
        return;
      }
      resolve({ durationSeconds: Math.round(duration * 100) / 100, width, height });
    };
    video.onerror = () => {
      done();
      reject(new Error("This video can't be played in the browser. Try an MP4 (H.264) clip."));
    };
    video.src = url;
  });
}

/** Client-side validation. The database trigger repeats these checks. */
export async function validatePlayerMedia(kind: PlayerMediaKind, file: File): Promise<Probe> {
  if (kind === "photo") {
    if (!PHOTO_TYPES[file.type]) throw new Error("Choose a JPG, PNG or WebP photo.");
    if (file.size > MAX_MEDIA_PHOTO_BYTES) throw new Error("Photos must be 8 MB or smaller.");
    return probeImage(file);
  }
  if (!VIDEO_TYPES[file.type]) throw new Error("Choose an MP4, MOV or WebM video clip.");
  if (file.size > MAX_MEDIA_VIDEO_BYTES)
    throw new Error(`Video clips must be ${MAX_MEDIA_VIDEO_MB} MB or smaller.`);
  const probe = await probeVideo(file);
  if ((probe.durationSeconds ?? 0) > MAX_VIDEO_SECONDS + 0.05) {
    throw new Error(
      `That clip is ${Math.round(probe.durationSeconds ?? 0)} seconds long. Clips must be ${MAX_VIDEO_SECONDS} seconds or shorter — trim it and try again.`,
    );
  }
  return probe;
}

function extensionFor(kind: PlayerMediaKind, file: File) {
  return (kind === "photo" ? PHOTO_TYPES[file.type] : VIDEO_TYPES[file.type]) ?? "bin";
}

/** Uploads with progress via XHR against the Storage REST endpoint. */
function uploadWithProgress(
  path: string,
  file: File,
  token: string,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const base = import.meta.env["VITE_SUPABASE_URL"] as string;
    const apikey = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string;
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${base}/storage/v1/object/${PLAYER_MEDIA_BUCKET}/${path}`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", apikey);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("cache-control", "3600");
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(1);
        resolve();
        return;
      }
      let message = "Upload failed. Please try again.";
      try {
        const body = JSON.parse(xhr.responseText) as { message?: string; error?: string };
        if (xhr.status === 413) message = "That file is too large for upload.";
        else if (body.message) message = body.message;
      } catch {
        /* keep default */
      }
      reject(new Error(message));
    };
    xhr.onerror = () => reject(new Error("Upload failed — check your connection and try again."));
    xhr.onabort = () => reject(new Error("Upload cancelled."));
    if (signal) {
      signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }
    xhr.send(file);
  });
}

async function removeObjects(paths: string[]) {
  if (!paths.length) return;
  await supabase.storage.from(PLAYER_MEDIA_BUCKET).remove(paths);
}

const mediaSelect =
  "id, owner_profile_id, kind, storage_path, title, caption, sort_order, duration_seconds, width, height, created_at";

export async function fetchPlayerMedia(playerId: string): Promise<PlayerMediaItem[]> {
  const { data, error } = await supabase
    .from("media")
    .select(mediaSelect)
    .eq("owner_profile_id", playerId)
    .eq("bucket", PLAYER_MEDIA_BUCKET)
    .in("kind", ["photo", "video"])
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  const rows = data ?? [];
  if (!rows.length) return [];

  const { data: signed, error: signError } = await supabase.storage
    .from(PLAYER_MEDIA_BUCKET)
    .createSignedUrls(
      rows.map((r) => r.storage_path),
      60 * 60,
    );
  if (signError) throw signError;
  const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));

  return rows.flatMap((r) => {
    const url = urlByPath.get(r.storage_path);
    if (!url) return [];
    return [
      {
        id: r.id,
        ownerId: r.owner_profile_id,
        kind: r.kind as PlayerMediaKind,
        title: r.title,
        caption: r.caption,
        url,
        sortOrder: r.sort_order,
        durationSeconds: r.duration_seconds === null ? null : Number(r.duration_seconds),
        width: r.width,
        height: r.height,
        createdAt: r.created_at,
      },
    ];
  });
}

export const playerMediaKey = (playerId: string) => ["player-media", playerId] as const;

export function usePlayerMedia(playerId: string | null | undefined) {
  return useQuery({
    queryKey: playerMediaKey(playerId ?? ""),
    queryFn: () => fetchPlayerMedia(playerId as string),
    enabled: Boolean(playerId),
    staleTime: 30_000,
  });
}

export type UploadStage = "compressing" | "uploading";

export interface UploadPlayerMediaInput {
  kind: PlayerMediaKind;
  file: File;
  title: string;
  caption: string;
  onProgress?: (fraction: number) => void;
  onStage?: (stage: UploadStage) => void;
  signal?: AbortSignal;
}

export async function uploadPlayerMedia(input: UploadPlayerMediaInput): Promise<string> {
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session) throw new Error("You need to be signed in to add media.");
  const userId = session.user.id;

  const probe = await validatePlayerMedia(input.kind, input.file);

  // Oversized but otherwise valid clips are re-encoded in the browser so the
  // file that reaches Storage always fits under the 50 MB limit.
  let file = input.file;
  if (input.kind === "video" && file.size > MAX_UPLOAD_VIDEO_BYTES) {
    input.onStage?.("compressing");
    input.onProgress?.(0);
    file = await compressVideo(file, probe.durationSeconds ?? 0, input.onProgress, input.signal);
    if (file.size > MAX_UPLOAD_VIDEO_BYTES) {
      throw new Error("We couldn't get this clip under 50 MB. Please trim it and try again.");
    }
  }
  input.onStage?.("uploading");
  input.onProgress?.(0);

  const title = input.title.trim();
  const caption = input.caption.trim();
  if (title.length > MAX_MEDIA_TITLE) throw new Error(`Title must be ${MAX_MEDIA_TITLE} characters or fewer.`);
  if (caption.length > MAX_MEDIA_CAPTION) throw new Error(`Caption must be ${MAX_MEDIA_CAPTION} characters or fewer.`);

  const { count } = await supabase
    .from("media")
    .select("id", { count: "exact", head: true })
    .eq("owner_profile_id", userId)
    .eq("bucket", PLAYER_MEDIA_BUCKET);
  const nextOrder = count ?? 0;

  const path = `${userId}/${input.kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extensionFor(input.kind, file)}`;
  await uploadWithProgress(path, file, session.access_token, input.onProgress ?? (() => {}), input.signal);

  const { data, error } = await supabase
    .from("media")
    .insert({
      owner_profile_id: userId,
      kind: input.kind,
      bucket: PLAYER_MEDIA_BUCKET,
      storage_path: path,
      title: title || null,
      caption: caption || null,
      sort_order: nextOrder,
      duration_seconds: probe.durationSeconds,
      content_type: file.type,
      size_bytes: file.size,
      width: probe.width,
      height: probe.height,
    })
    .select("id")
    .single();
  if (error) {
    await removeObjects([path]);
    throw new Error(error.message || "Could not save this media item.");
  }
  return data.id;
}

export async function updatePlayerMediaDetails(id: string, title: string, caption: string) {
  const t = title.trim();
  const c = caption.trim();
  if (t.length > MAX_MEDIA_TITLE) throw new Error(`Title must be ${MAX_MEDIA_TITLE} characters or fewer.`);
  if (c.length > MAX_MEDIA_CAPTION) throw new Error(`Caption must be ${MAX_MEDIA_CAPTION} characters or fewer.`);
  const { error } = await supabase
    .from("media")
    .update({ title: t || null, caption: c || null })
    .eq("id", id);
  if (error) throw error;
}

export async function deletePlayerMedia(id: string) {
  const { data, error } = await supabase
    .from("media")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return;
  const { error: delError } = await supabase.from("media").delete().eq("id", id);
  if (delError) throw delError;
  await removeObjects([data.storage_path]);
}

/** Persists a full ordering: index in `orderedIds` becomes sort_order. */
export async function reorderPlayerMedia(orderedIds: string[]) {
  const results = await Promise.all(
    orderedIds.map((id, index) => supabase.from("media").update({ sort_order: index }).eq("id", id)),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
}

function useInvalidateMyMedia() {
  const queryClient = useQueryClient();
  return async () => {
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
    if (userId) await queryClient.invalidateQueries({ queryKey: playerMediaKey(userId) });
    await queryClient.invalidateQueries({ queryKey: ["signed-in-player-extras"] });
  };
}

export function useUploadPlayerMedia() {
  const invalidate = useInvalidateMyMedia();
  return useMutation({ mutationFn: uploadPlayerMedia, onSuccess: () => void invalidate() });
}

export function useUpdatePlayerMediaDetails() {
  const invalidate = useInvalidateMyMedia();
  return useMutation({
    mutationFn: ({ id, title, caption }: { id: string; title: string; caption: string }) =>
      updatePlayerMediaDetails(id, title, caption),
    onSuccess: () => void invalidate(),
  });
}

export function useDeletePlayerMedia() {
  const invalidate = useInvalidateMyMedia();
  return useMutation({ mutationFn: deletePlayerMedia, onSuccess: () => void invalidate() });
}

export function useReorderPlayerMedia(playerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: reorderPlayerMedia,
    onMutate: async (orderedIds) => {
      await queryClient.cancelQueries({ queryKey: playerMediaKey(playerId) });
      const previous = queryClient.getQueryData<PlayerMediaItem[]>(playerMediaKey(playerId));
      if (previous) {
        const byId = new Map(previous.map((m) => [m.id, m]));
        queryClient.setQueryData<PlayerMediaItem[]>(
          playerMediaKey(playerId),
          orderedIds.flatMap((id, i) => {
            const m = byId.get(id);
            return m ? [{ ...m, sortOrder: i }] : [];
          }),
        );
      }
      return { previous };
    },
    onError: (_e, _ids, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(playerMediaKey(playerId), ctx.previous);
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: playerMediaKey(playerId) }),
  });
}

export function formatClipLength(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds)) return null;
  return `${Math.max(1, Math.round(seconds))}s`;
}
