/**
 * Profile photo/club badge storage helpers: upload to the private bucket and create signed URLs for display.
 */
import { supabase } from "@/integrations/supabase/client";

export const PROFILE_IMAGES_BUCKET = "profile-images";
export const MAX_PROFILE_IMAGE_BYTES = 8 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export type PlayerImageSlot = "avatar" | "cover";
export type ClubImageSlot = "badge" | "team" | "home-ground" | "training-pitch";
export type ProfileImageSlot = PlayerImageSlot | ClubImageSlot;

export function validateProfileImage(file: File) {
  if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
    throw new Error("Choose a JPG, PNG or WebP image.");
  }
  if (file.size > MAX_PROFILE_IMAGE_BYTES) {
    throw new Error("Choose an image smaller than 8 MB.");
  }
}

export async function resolveProfileImage(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const { data, error } = await supabase.storage
    .from(PROFILE_IMAGES_BUCKET)
    .createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data.signedUrl;
}

function extensionFor(file: File) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

async function replaceObject(userId: string, slot: ProfileImageSlot, file: File, oldPath: string | null) {
  validateProfileImage(file);
  const path = `${userId}/${slot}-${Date.now()}.${extensionFor(file)}`;
  const { error } = await supabase.storage.from(PROFILE_IMAGES_BUCKET).upload(path, file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;
  return { path, oldPath: oldPath && !/^https?:\/\//i.test(oldPath) ? oldPath : null };
}

async function removeObjects(paths: Array<string | null | undefined>) {
  const stored = paths.filter((path): path is string => Boolean(path && !/^https?:\/\//i.test(path)));
  if (!stored.length) return;
  await supabase.storage.from(PROFILE_IMAGES_BUCKET).remove(stored);
}

export async function updatePlayerImage(slot: PlayerImageSlot, file: File | null, oldPath: string | null) {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) throw new Error("You need to be signed in to change your images.");
  const uploaded = file ? await replaceObject(user.id, slot, file, oldPath) : null;
  const nextPath = uploaded?.path ?? null;
  const update = slot === "avatar" ? { avatar_path: nextPath } : { cover_path: nextPath };
  const { error } = await supabase.from("profiles").update(update).eq("id", user.id);
  if (error) {
    if (uploaded) await removeObjects([uploaded.path]);
    throw error;
  }
  await removeObjects([uploaded?.oldPath ?? oldPath]);
  return { path: nextPath, url: await resolveProfileImage(nextPath) };
}

export async function updateClubImage(slot: ClubImageSlot, file: File | null, oldPath: string | null) {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) throw new Error("You need to be signed in to change club images.");
  const uploaded = file ? await replaceObject(user.id, slot, file, oldPath) : null;
  const nextPath = uploaded?.path ?? null;
  const update = slot === "badge"
    ? { badge_path: nextPath }
    : slot === "team"
      ? { team_photo_path: nextPath }
      : slot === "home-ground"
        ? { home_ground_photo_path: nextPath }
        : { training_pitch_photo_path: nextPath };
  const { error } = await supabase.from("clubs").update(update).eq("id", user.id);
  if (error) {
    if (uploaded) await removeObjects([uploaded.path]);
    throw error;
  }
  await removeObjects([uploaded?.oldPath ?? oldPath]);
  return { path: nextPath, url: await resolveProfileImage(nextPath) };
}