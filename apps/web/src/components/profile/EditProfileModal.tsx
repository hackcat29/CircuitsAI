"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { User, AtSign, Mail, CheckCircle2, AlertCircle, Loader2, X, Upload, Trash2, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui";
import { useSocialSession, useUpdateProfile } from "@/hooks";

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Resizes and compresses an uploaded image file into an optimized base64 Data URL */
function compressAndResizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX_DIM = 360;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > MAX_DIM) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        // Export WebP with high quality
        try {
          const dataUrl = canvas.toDataURL("image/webp", 0.85);
          resolve(dataUrl);
        } catch {
          const fallbackUrl = canvas.toDataURL("image/jpeg", 0.85);
          resolve(fallbackUrl);
        }
      };
      img.onerror = () => reject(new Error("Failed to process image file"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export function EditProfileModal({ isOpen, onClose }: EditProfileModalProps) {
  const { profile } = useSocialSession();
  const updateProfileMutation = useUpdateProfile();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mounted, setMounted] = useState(false);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<{
    available?: boolean;
    reason?: string;
    isCurrent?: boolean;
  } | null>(null);

  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock background scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Initialize from current profile
  useEffect(() => {
    if (profile && isOpen) {
      setUsername(profile.username || "");
      setDisplayName(profile.displayName || "");
      setBio(profile.bio || "");
      setAvatarUrl(profile.avatarUrl || "");
      setShowUrlInput(Boolean(profile.avatarUrl && profile.avatarUrl.startsWith("http")));
      setUsernameStatus(null);
      setFormError(null);
      setSuccessMessage(null);
    }
  }, [profile, isOpen]);

  // Debounced username availability check
  useEffect(() => {
    const clean = username.trim().toLowerCase();
    if (!clean) {
      setUsernameStatus(null);
      return;
    }

    if (profile?.username && clean === profile.username.toLowerCase()) {
      setUsernameStatus({ available: true, isCurrent: true });
      return;
    }

    const timer = setTimeout(async () => {
      setCheckingUsername(true);
      try {
        const res = await fetch(`/api/social/profile/check-username?username=${encodeURIComponent(clean)}`);
        const data = await res.json();
        setUsernameStatus(data);
      } catch {
        setUsernameStatus({ available: false, reason: "Error checking handle" });
      } finally {
        setCheckingUsername(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [username, profile?.username]);

  if (!mounted || !isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setFormError("Please select a valid image file (PNG, JPG, WebP, GIF)");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setFormError("Image file size should be under 5MB");
      return;
    }

    setUploadingImage(true);
    setFormError(null);
    try {
      const dataUrl = await compressAndResizeImage(file);
      setAvatarUrl(dataUrl);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to load image");
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    if (!profile) {
      setFormError("Please sign in to update your profile.");
      return;
    }

    const cleanUsername = username.trim().toLowerCase();
    if (cleanUsername && usernameStatus && !usernameStatus.available && !usernameStatus.isCurrent) {
      setFormError(usernameStatus.reason || "Username is not available");
      return;
    }

    try {
      await updateProfileMutation.mutateAsync({
        username: cleanUsername || undefined,
        displayName: displayName.trim() || null,
        bio: bio.trim() || null,
        avatarUrl: avatarUrl.trim() || null,
      });

      setSuccessMessage("Profile updated successfully!");
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to update profile");
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-black/80 backdrop-blur-md">
      {/* Backdrop click dismiss */}
      <div className="fixed inset-0 -z-10" onClick={onClose} />

      {/* Dialog Box */}
      <div className="relative w-full max-w-md my-auto max-h-[92vh] flex flex-col rounded-2xl border border-border-strong bg-[#14151a] shadow-2xl overflow-hidden z-10 animate-fadeIn">
        {/* Glow Header Accent */}
        <div className="absolute -top-16 -left-16 h-36 w-36 rounded-full bg-accent-violet/20 blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 pb-3 border-b border-border-subtle shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-accent-violet/10 border border-accent-violet/30 flex items-center justify-center text-accent-violet shrink-0">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-text-primary">Human Profile Settings</h2>
              <p className="text-xs text-text-tertiary">Customize your public identity across Circuits</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-raised transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-5 space-y-4 custom-scrollbar">
          {/* Email Badge (Verified via Privy) */}
          {profile?.email && (
            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-bg-raised/70 border border-border-subtle">
              <div className="flex items-center gap-2 min-w-0">
                <Mail className="h-3.5 w-3.5 text-accent-violet shrink-0" />
                <span className="text-xs font-mono text-text-secondary truncate">{profile.email}</span>
              </div>
              <span className="text-[10px] font-semibold text-emerald-400/90 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 shrink-0">
                Verified with Privy
              </span>
            </div>
          )}

          {/* Avatar Photo Upload & Preview */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5 flex items-center justify-between">
              <span>Profile Avatar</span>
              <button
                type="button"
                onClick={() => setShowUrlInput(!showUrlInput)}
                className="text-[10.5px] text-accent-violet hover:underline flex items-center gap-1 cursor-pointer"
              >
                <LinkIcon className="h-2.5 w-2.5" />
                <span>{showUrlInput ? "Hide URL input" : "Or enter Image URL"}</span>
              </button>
            </label>

            <div className="flex items-center gap-3.5 p-3 rounded-xl bg-bg-raised/60 border border-border-subtle">
              <div className="relative h-14 w-14 shrink-0 rounded-full border-2 border-border-strong bg-bg-surface3 flex items-center justify-center overflow-hidden group">
                {uploadingImage ? (
                  <Loader2 className="h-6 w-6 animate-spin text-accent-violet" />
                ) : avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    onError={() => setAvatarUrl("")}
                  />
                ) : (
                  <User className="h-7 w-7 text-text-tertiary" />
                )}
              </div>

              <div className="flex-1 space-y-1.5">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImage}
                    className="text-xs gap-1.5 h-8 px-2.5 cursor-pointer bg-bg-surface hover:bg-bg-surface3"
                  >
                    <Upload className="h-3.5 w-3.5 text-accent-violet" />
                    <span>Upload Photo</span>
                  </Button>

                  {avatarUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setAvatarUrl("")}
                      className="text-xs text-red-400/80 hover:text-red-400 hover:bg-red-500/10 h-8 px-2 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <p className="text-[10px] text-text-quaternary">Supports PNG, JPG, WebP (auto-optimized)</p>
              </div>
            </div>

            {showUrlInput && (
              <div className="mt-2">
                <input
                  type="url"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://example.com/avatar.png"
                  className="w-full bg-bg-raised border border-border-strong rounded-xl px-3 py-2 text-xs text-text-primary placeholder:text-text-quaternary outline-none focus:border-accent-violet/60 transition-all font-mono"
                />
              </div>
            )}
          </div>

          {/* Username (@handle) */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5 flex items-center justify-between">
              <span>Username Handle</span>
              <span className="text-[10.5px] font-normal text-text-quaternary">3–20 chars (a-z, 0-9, _)</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-quaternary">
                <AtSign className="h-4 w-4" />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                placeholder="satoshi"
                className="w-full bg-bg-raised border border-border-strong rounded-xl pl-9 pr-10 py-2 text-xs font-mono text-text-primary placeholder:text-text-quaternary outline-none focus:border-accent-violet/60 transition-all"
                maxLength={20}
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                {checkingUsername ? (
                  <Loader2 className="h-4 w-4 animate-spin text-text-quaternary" />
                ) : usernameStatus?.available ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                ) : usernameStatus && !usernameStatus.available ? (
                  <AlertCircle className="h-4 w-4 text-red-400" />
                ) : null}
              </div>
            </div>
            {usernameStatus && !usernameStatus.available && (
              <p className="mt-1 text-[11px] text-red-400/90">{usernameStatus.reason}</p>
            )}
            {usernameStatus?.available && !usernameStatus.isCurrent && (
              <p className="mt-1 text-[11px] text-emerald-400/90">Handle is available!</p>
            )}
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Satoshi Nakamoto"
              className="w-full bg-bg-raised border border-border-strong rounded-xl px-3 py-2 text-xs text-text-primary placeholder:text-text-quaternary outline-none focus:border-accent-violet/60 transition-all"
              maxLength={50}
            />
          </div>

          {/* Bio */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Building autonomous agents & decentralized intelligence..."
              rows={2}
              className="w-full bg-bg-raised border border-border-strong rounded-xl px-3 py-2 text-xs text-text-primary placeholder:text-text-quaternary outline-none focus:border-accent-violet/60 transition-all resize-none"
              maxLength={280}
            />
          </div>

          {/* Error / Success alerts */}
          {formError && (
            <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="flex-1 text-xs cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={updateProfileMutation.isPending || checkingUsername || uploadingImage}
              className="flex-1 text-xs cursor-pointer"
            >
              {updateProfileMutation.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
