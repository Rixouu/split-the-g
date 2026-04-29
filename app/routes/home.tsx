import { useCallback, useEffect, useRef, useState } from "react";
import {
  useSubmit,
  useFetcher,
  useActionData,
  useSearchParams,
} from "react-router";
import { Zap, ZapOff } from "lucide-react";
import { AppDocumentLink } from "~/i18n/app-link";
import { PintGlassOverlay } from "~/components/PintGlassOverlay";
import { SplitTheGLogo } from "~/components/SplitTheGLogo";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useI18n } from "~/i18n/context";
import { langFromParams } from "~/i18n/lang-param";
import type {
  InferenceEngine as RoboflowInferenceEngine,
  InferencePrediction,
} from "inferencejs";
import { BuyCreatorABeer } from "~/components/BuyCreatorABeer";
import { PwaInstallBanner } from "~/components/pwa-install-banner";
import type { BrandedNoticeVariant } from "~/components/branded/BrandedNotice";
import { BrandedToast } from "~/components/branded/BrandedToast";
import { toastAutoCloseForVariant } from "~/components/branded/feedback-variant";
import { seoMetaForRoute } from "~/i18n/seo-meta";
import { getSupabaseBrowserClient } from "~/utils/supabase-browser";
import {
  enqueueOfflinePour,
  flushOfflinePourQueue,
} from "~/utils/offline-pour-queue";
import { analyticsEventNames } from "~/utils/analytics/events";
import { trackEvent } from "~/utils/analytics/client";
import { handleHomePourAction } from "./home-pour.server";

const isClient = typeof window !== "undefined";

/** Compact mobile browse links — avoids full-width gold blocks on small screens. */
const homeMobileBrowseLinkClass =
  "inline-flex min-h-9 w-full items-center justify-center rounded-md border border-guinness-gold/30 bg-guinness-black/40 px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-guinness-gold transition-colors hover:border-guinness-gold/50 hover:bg-guinness-gold/10 active:bg-guinness-gold/15";

const MAX_POUR_IMAGE_BYTES = 18 * 1024 * 1024;

/** inferencejs (browser) — Roboflow Publishable key (`rf_...`); optional override, else falls back to VITE_ROBOFLOW_API_KEY. */
const ROBOFLOW_PUBLISHABLE_KEY =
  import.meta.env.VITE_ROBOFLOW_PUBLISHABLE_KEY ??
  import.meta.env.VITE_ROBOFLOW_API_KEY ??
  "";

/** inferencejs (browser) — project slug + version from your model’s Deploy page (not the workflow id). */
const ROBOFLOW_INFERENCE_MODEL =
  import.meta.env.VITE_ROBOFLOW_INFERENCE_MODEL ?? "split-g-label-experiment";
const ROBOFLOW_INFERENCE_VERSION =
  import.meta.env.VITE_ROBOFLOW_INFERENCE_VERSION ?? "8";
const INFERENCEJS_CDN_URL =
  "https://esm.sh/inferencejs@1.2.3?target=es2022";

/** Second argument to `InferenceEngine.infer` (CDN build matches npm typings). */
type InferenceImageInput = Parameters<RoboflowInferenceEngine["infer"]>[1];

type InferenceJsModule = {
  InferenceEngine: new () => RoboflowInferenceEngine;
  CVImage: new (source: HTMLVideoElement) => InferenceImageInput;
};

type TorchTrackCapabilities = MediaTrackCapabilities & {
  torch?: boolean;
  fillLightMode?: string[];
};

let inferenceModulePromise: Promise<InferenceJsModule> | null = null;

async function loadInferenceJsModule(): Promise<InferenceJsModule> {
  if (!inferenceModulePromise) {
    inferenceModulePromise = import(
      /* @vite-ignore */ INFERENCEJS_CDN_URL
    ) as Promise<InferenceJsModule>;
  }
  return inferenceModulePromise;
}

export async function loader(_args: LoaderFunctionArgs) {
  return {};
}

export function meta({ params }: { params: { lang?: string } }) {
  return seoMetaForRoute(params, "/", "home");
}

/** Vercel: long-running pour action (Roboflow + uploads + DB). */
export const config = {
  maxDuration: 60,
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function action({ request, params }: ActionFunctionArgs) {
  return handleHomePourAction({
    request,
    lang: langFromParams(params),
  });
}

export default function Home() {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const competitionIdParam = searchParams.get("competition")?.trim() ?? "";
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [actorMeta, setActorMeta] = useState<{ userId: string; actorName: string }>({
    userId: "",
    actorName: "",
  });
  const [isFlashSupported, setIsFlashSupported] = useState(false);
  const [isFlashEnabled, setIsFlashEnabled] = useState(false);
  const [isFlashUpdating, setIsFlashUpdating] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  /** Holds the active stream so we can stop tracks on unmount / tab hide even if the video node is gone. */
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const stopCameraTracks = useCallback(() => {
    const stream = mediaStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    const vid = videoRef.current;
    if (vid) {
      vid.srcObject = null;
    }
    setIsVideoReady(false);
    setIsFlashSupported(false);
    setIsFlashEnabled(false);
    setIsFlashUpdating(false);
  }, []);
  const submit = useSubmit();
  const queueFetcher = useFetcher<typeof action>();
  const actionData = useActionData<typeof action>();
  const offlineFlushPendingRef = useRef<{
    resolve: () => void;
    reject: (e: Error) => void;
  } | null>(null);
  const lastSubmitSourceRef = useRef<"camera" | "upload">("camera");

  const submitQueuedPourItem = useCallback(
    (item: {
      imageBase64: string;
      competitionId: string;
      actorUserId: string;
      actorName: string;
    }) => {
      return new Promise<void>((resolve, reject) => {
        offlineFlushPendingRef.current = {
          resolve,
          reject,
        };
        const fd = new FormData();
        fd.append("image", item.imageBase64);
        if (item.competitionId && UUID_RE.test(item.competitionId)) {
          fd.append("competition", item.competitionId);
        }
        if (item.actorName) fd.append("actorName", item.actorName);
        void getSupabaseBrowserClient()
          .then(async (sb) => {
            const { data: sessionData } = await sb.auth.getSession();
            const at = sessionData.session?.access_token;
            if (at) fd.append("accessToken", at);
          })
          .catch(() => null)
          .finally(() => {
            queueFetcher.submit(fd, {
              method: "post",
              encType: "multipart/form-data",
              action: ".",
            });
          });
      });
    },
    [queueFetcher],
  );

  useEffect(() => {
    if (queueFetcher.state !== "idle") return;
    const pending = offlineFlushPendingRef.current;
    if (!pending) return;
    offlineFlushPendingRef.current = null;
    const d = queueFetcher.data;
    if (
      d &&
      typeof d === "object" &&
      "success" in d &&
      (d as { success: boolean }).success === false
    ) {
      const code = (d as { error?: string }).error ?? "PROCESS_FAILED";
      pending.reject(new Error(code));
      return;
    }
    pending.resolve();
  }, [queueFetcher.state, queueFetcher.data]);

  const tryFlushOfflineQueue = useCallback(() => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    void flushOfflinePourQueue({
      submitPour: submitQueuedPourItem,
      onBatchSynced: () => {
        trackEvent(analyticsEventNames.offlinePourSynced, {});
        setHomeToast({
          message: t("pages.home.pourSyncedFromQueue"),
          variant: "success",
        });
      },
      onItemFailed: (_item, err) => {
        const code = err instanceof Error ? err.message : "";
        if (code === "RATE_LIMITED") {
          setHomeToast({ message: t("errors.pourRateLimited"), variant: "danger" });
        } else if (code === "DUPLICATE_IMAGE") {
          setHomeToast({ message: t("errors.duplicatePourImage"), variant: "danger" });
        } else if (code === "STALE_IMAGE_EXIF") {
          setHomeToast({ message: t("errors.imageTimestampStale"), variant: "danger" });
        } else {
          setHomeToast({
            message: t("pages.home.pourQueueSyncFailed"),
            variant: "danger",
          });
        }
      },
    });
  }, [submitQueuedPourItem, t]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onOnline = () => {
      tryFlushOfflineQueue();
    };
    const onVis = () => {
      if (document.visibilityState === "visible") tryFlushOfflineQueue();
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVis);
    void tryFlushOfflineQueue();
    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [tryFlushOfflineQueue]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.serviceWorker) return;
    function onSwMessage(e: MessageEvent) {
      if (e.data?.type === "FLUSH_POUR_QUEUE") {
        tryFlushOfflineQueue();
      }
    }
    navigator.serviceWorker.addEventListener("message", onSwMessage);
    return () =>
      navigator.serviceWorker.removeEventListener("message", onSwMessage);
  }, [tryFlushOfflineQueue]);

  const sendPourImageBase64 = useCallback(
    (
      base64Image: string,
      opts?: {
        onQueuedOffline?: () => void;
        source?: "camera" | "upload";
      },
    ) => {
      void (async () => {
        const source = opts?.source ?? "camera";
        lastSubmitSourceRef.current = source;
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          try {
            await enqueueOfflinePour({
              id: crypto.randomUUID(),
              imageBase64: base64Image,
              competitionId:
                competitionIdParam && UUID_RE.test(competitionIdParam)
                  ? competitionIdParam
                  : "",
              actorUserId: actorMeta.userId,
              actorName: actorMeta.actorName,
              queuedAt: Date.now(),
            });
            opts?.onQueuedOffline?.();
            trackEvent(analyticsEventNames.offlinePourQueued, {
              hasCompetition: Boolean(
                competitionIdParam && UUID_RE.test(competitionIdParam),
              ),
            });
            setHomeToast({
              message: t("pages.home.pourQueuedOffline"),
              variant: "info",
            });
          } catch {
            opts?.onQueuedOffline?.();
            setHomeToast({
              message: t("pages.home.pourQueueSaveFailed"),
              variant: "danger",
            });
          }
          return;
        }
        const formData = new FormData();
        formData.append("image", base64Image);
        if (competitionIdParam && UUID_RE.test(competitionIdParam)) {
          formData.append("competition", competitionIdParam);
        }
        if (actorMeta.actorName) formData.append("actorName", actorMeta.actorName);
        try {
          const sb = await getSupabaseBrowserClient();
          const { data: sessionData } = await sb.auth.getSession();
          const at = sessionData.session?.access_token;
          if (at) formData.append("accessToken", at);
        } catch {
          // anonymous pour still works
        }
        submit(formData, {
          method: "post",
          action: ".",
          encType: "multipart/form-data",
        });
        trackEvent(analyticsEventNames.pourSubmitted, {
          source,
          hasCompetition: Boolean(
            competitionIdParam && UUID_RE.test(competitionIdParam),
          ),
        });
      })();
    },
    [
      actorMeta.actorName,
      actorMeta.userId,
      competitionIdParam,
      submit,
      t,
    ],
  );

  // Load inferencejs only when the user turns the camera on — keeps first paint / upload-only path light.
  const [inferEngine, setInferEngine] =
    useState<RoboflowInferenceEngine | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !isCameraActive) return;
    if (inferEngine) return;

    let cancelled = false;
    void loadInferenceJsModule()
      .then(({ InferenceEngine }) => {
        if (cancelled) return;
        setInferEngine(new InferenceEngine());
      })
      .catch((err) => {
        console.error("Could not load inference module:", err);
        if (cancelled) return;
        setHomeToast({
          message: t("pages.home.inferenceUnavailable"),
          variant: "warning",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [isCameraActive, inferEngine, t]);

  const [modelWorkerId, setModelWorkerId] = useState<string | null>(null);
  const [modelLoading, setModelLoading] = useState(false);

  // Initialize model when inference engine is ready
  useEffect(() => {
    if (!inferEngine || modelLoading) return;

    setModelLoading(true);
    inferEngine
      .startWorker(
        ROBOFLOW_INFERENCE_MODEL,
        ROBOFLOW_INFERENCE_VERSION,
        ROBOFLOW_PUBLISHABLE_KEY
      )
      .then((id: string) => setModelWorkerId(id))
      .catch((error) => {
        console.error("Could not start inference worker:", error);
        setModelWorkerId(null);
        setHomeToast({
          message: t("pages.home.inferenceUnavailable"),
          variant: "warning",
        });
      })
      .finally(() => {
        setModelLoading(false);
      });
  }, [inferEngine, modelLoading, t]);

  const [isVideoReady, setIsVideoReady] = useState(false);
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const [homeToast, setHomeToast] = useState<{
    message: string;
    variant: BrandedNoticeVariant;
  } | null>(null);

  const toggleFlash = useCallback(async () => {
    const stream = mediaStreamRef.current;
    const track = stream?.getVideoTracks()[0];
    if (!track || !isFlashSupported || isFlashUpdating) return;

    const next = !isFlashEnabled;
    setIsFlashUpdating(true);
    try {
      await track.applyConstraints({
        advanced: [{ torch: next } as MediaTrackConstraintSet],
      });
      setIsFlashEnabled(next);
    } catch (error) {
      console.error("Flash toggle failed:", error);
      setHomeToast({
        message: t("pages.home.flashUnavailable"),
        variant: "warning",
      });
    } finally {
      setIsFlashUpdating(false);
    }
  }, [isFlashEnabled, isFlashSupported, isFlashUpdating, t]);

  // Camera: start when active; always stop tracks on deactivate, unmount, or aborted getUserMedia.
  useEffect(() => {
    if (!isCameraActive) return;

    if (!videoRef.current) return;

    const constraints = {
      video: {
        facingMode: { ideal: "environment" },
        width: 720,
        height: 960,
      },
    };

    let cancelled = false;

    navigator.mediaDevices
      .getUserMedia(constraints)
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        mediaStreamRef.current = stream;
        const track = stream.getVideoTracks()[0];
        const capabilities = track?.getCapabilities?.() as TorchTrackCapabilities;
        const supportsTorch =
          Boolean(capabilities?.torch) ||
          Boolean(capabilities?.fillLightMode?.includes("flash")) ||
          Boolean(capabilities?.fillLightMode?.includes("torch"));
        setIsFlashSupported(supportsTorch);
        setIsFlashEnabled(false);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      })
      .catch((err) => {
        console.error("Camera error:", err);
        mediaStreamRef.current = null;
        setIsCameraActive(false);
        setHomeToast({
          message: t("pages.home.cameraDenied"),
          variant: "warning",
        });
      });

    return () => {
      cancelled = true;
      const active = mediaStreamRef.current;
      if (active) {
        active.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setIsVideoReady(false);
    };
  }, [isCameraActive, t]);

  // Release camera when the user leaves the tab (indicator otherwise stays on in many browsers).
  useEffect(() => {
    if (!isCameraActive || typeof document === "undefined") return;

    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        stopCameraTracks();
        setIsCameraActive(false);
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [isCameraActive, stopCameraTracks]);

  // Add new state for tracking detections
  const [, setConsecutiveDetections] = useState(0);
  const [feedbackMessage, setFeedbackMessage] = useState(() =>
    t("pages.home.feedbackShowGlass"),
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadProcessing, setIsUploadProcessing] = useState(false);
  const [showNoGModal, setShowNoGModal] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getSupabaseBrowserClient()
      .then(async (supabaseClient) => {
        const { data } = await supabaseClient.auth.getUser();
        if (cancelled) return;
        const user = data.user;
        const actor =
          (user?.user_metadata?.full_name as string | undefined)?.trim() ||
          (user?.user_metadata?.name as string | undefined)?.trim() ||
          "";
        setActorMeta({ userId: user?.id ?? "", actorName: actor });
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, []);

  // Detection loop: import inferencejs once per interval (not every 500ms tick).
  useEffect(() => {
    if (
      !isClient ||
      !inferEngine ||
      !modelWorkerId ||
      !isCameraActive ||
      !isVideoReady
    )
      return;

    let intervalId: ReturnType<typeof setInterval> | undefined;
    let cancelled = false;

    void loadInferenceJsModule()
      .then(({ CVImage }) => {
        if (cancelled) return;

        const detectFrame = async () => {
          if (!modelWorkerId || !videoRef.current) return;

          try {
            const img = new CVImage(videoRef.current);
            const predictions: InferencePrediction[] = await inferEngine.infer(
              modelWorkerId,
              img,
            );

            const hasGlass = predictions.some(
              (pred: InferencePrediction) => pred.class === "glass",
            );
            const hasG = predictions.some(
              (pred: InferencePrediction) => pred.class === "G",
            );

            if (hasGlass && hasG) {
              setConsecutiveDetections((prev) => {
                if (prev >= 4) return prev;
                const next = prev + 1;
                if (next === 4) {
                  setFeedbackMessage(t("pages.home.feedbackPerfect"));
                  setIsProcessing(true);
                  setIsSubmitting(true);

                  const vid = videoRef.current;
                  const canvas = canvasRef.current;
                  if (vid && canvas) {
                    const context = canvas.getContext("2d");
                    canvas.width = vid.videoWidth;
                    canvas.height = vid.videoHeight;
                    context?.drawImage(vid, 0, 0, canvas.width, canvas.height);

                    const imageData = canvas.toDataURL("image/jpeg");
                    const base64Image = imageData.replace(
                      /^data:image\/\w+;base64,/,
                      "",
                    );

                    stopCameraTracks();
                    setIsCameraActive(false);

                    sendPourImageBase64(base64Image, {
                      onQueuedOffline: () => {
                        setIsProcessing(false);
                        setIsSubmitting(false);
                      },
                      source: "camera",
                    });
                  }
                } else if (next >= 2) {
                  setFeedbackMessage(t("pages.home.feedbackHoldStill"));
                } else {
                  setFeedbackMessage(t("pages.home.feedbackCentered"));
                }
                return next;
              });
            } else {
              setConsecutiveDetections(0);
              if (!hasGlass) {
                setFeedbackMessage(t("pages.home.feedbackShowGlass"));
              } else if (!hasG) {
                setFeedbackMessage(t("pages.home.feedbackGVisible"));
              }
            }
          } catch (error) {
            console.error("Detection error:", error);
          }
        };

        intervalId = setInterval(detectFrame, 500);
      })
      .catch((err) => {
        console.error("Could not load inference module:", err);
      });

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [
    modelWorkerId,
    isCameraActive,
    inferEngine,
    isVideoReady,
    sendPourImageBase64,
    stopCameraTracks,
    competitionIdParam,
    t,
  ]);

  // Update the effect that handles action response
  useEffect(() => {
    if (!actionData) return;
    setIsUploadProcessing(false);
    setIsSubmitting(false);
    setIsProcessing(false);

    if (
      "success" in actionData &&
      actionData.success === true &&
      "redirectTo" in actionData &&
      typeof actionData.redirectTo === "string"
    ) {
      const redirectTo = actionData.redirectTo;
      const scoreId =
        "scoreId" in actionData && typeof actionData.scoreId === "string"
          ? actionData.scoreId
          : "";
      void (async () => {
        try {
          const comp =
            competitionIdParam && UUID_RE.test(competitionIdParam)
              ? competitionIdParam
              : "";
          if (comp && scoreId) {
            const sb = await getSupabaseBrowserClient();
            const { data: u } = await sb.auth.getUser();
            if (u.user) {
              await sb.from("competition_scores").insert({
                competition_id: comp,
                score_id: scoreId,
                user_id: u.user.id,
              });
            }
          }
        } catch {
          // best-effort; pour is already saved
        }
        window.location.assign(redirectTo);
      })();
      trackEvent(analyticsEventNames.pourSaved, {
        hasCompetition: Boolean(competitionIdParam && UUID_RE.test(competitionIdParam)),
        scoreId: scoreId || undefined,
      });
      return;
    }

    if (actionData.error === "NO_G") {
      setShowNoGModal(true);
      return;
    }

    if ("success" in actionData && actionData.success === false) {
      const err = actionData.error;
      trackEvent(analyticsEventNames.pourProcessingFailed, {
        code: err,
        source: lastSubmitSourceRef.current,
      });
      let msg: string;
      if (err === "PROCESS_FAILED") {
        msg = t("errors.failedProcessImage");
      } else if (err === "ANALYSIS_TIMEOUT") {
        msg = t("errors.pourAnalysisTimedOut");
      } else if (err === "ROBOFLOW_FAILED") {
        msg = t("errors.pourScoringServiceUnavailable");
      } else if (err === "RATE_LIMITED") {
        msg = t("errors.pourRateLimited");
      } else if (err === "DUPLICATE_IMAGE") {
        msg = t("errors.duplicatePourImage");
      } else if (err === "STALE_IMAGE_EXIF") {
        msg = t("errors.imageTimestampStale");
      } else if (err === "INVALID_IMAGE") {
        msg = t("errors.readImageFailedShort");
      } else if (typeof (actionData as { detail?: string }).detail === "string") {
        msg = (actionData as { detail: string }).detail;
      } else {
        msg = t("errors.genericPourError");
      }
      setHomeToast({
        message: msg,
        variant: "danger",
      });
    }
  }, [actionData, competitionIdParam, t]);

  // Update the handleFileChange function
  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const input = event.target;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setHomeToast({
        message: t("errors.invalidImageType"),
        variant: "warning",
      });
      return;
    }
    if (file.size > MAX_POUR_IMAGE_BYTES) {
      setHomeToast({
        message: t("errors.imageTooLarge", {
          maxMb: Math.round(MAX_POUR_IMAGE_BYTES / (1024 * 1024)),
        }),
        variant: "warning",
      });
      return;
    }

    setIsUploadProcessing(true);
    const reader = new FileReader();

    reader.onerror = () => {
      setIsUploadProcessing(false);
      setHomeToast({
        message: t("errors.readImageFailed"),
        variant: "danger",
      });
    };

    reader.onloadend = () => {
      const base64Image = reader.result
        ?.toString()
        .replace(/^data:image\/\w+;base64,/, "");
      if (!base64Image) {
        setIsUploadProcessing(false);
        setHomeToast({
          message: t("errors.readImageFailedShort"),
          variant: "danger",
        });
        return;
      }
      sendPourImageBase64(base64Image, {
        onQueuedOffline: () => setIsUploadProcessing(false),
        source: "upload",
      });
    };
    reader.readAsDataURL(file);
  };

  const handleUploadInstead = useCallback(() => {
    if (isCameraActive) {
      stopCameraTracks();
      setIsCameraActive(false);
    }
    document.getElementById("file-upload")?.click();
  }, [actorMeta.actorName, actorMeta.userId, isCameraActive, stopCameraTracks]);

  return (
    <main className="flex min-h-dvh w-full flex-col items-center justify-start overflow-x-hidden bg-guinness-black text-guinness-cream max-lg:overflow-y-auto lg:max-h-dvh lg:min-h-0 lg:overflow-y-auto">
      <PwaInstallBanner />
      {isUploadProcessing && (
        <div className="fixed inset-0 bg-guinness-black/95 flex flex-col items-center justify-center gap-6 z-50">
          <div className="w-24 h-24 border-4 border-guinness-gold/20 border-t-guinness-gold rounded-full animate-spin"></div>
          <p className="type-section text-xl">
            {t("pages.home.processingImage")}
          </p>
          <p className="type-meta">
            {t("pages.home.moment")}
          </p>
        </div>
      )}

      {showNoGModal && (
        <div className="fixed inset-0 bg-guinness-black/95 flex flex-col items-center justify-center gap-6 z-50">
          <div className="bg-guinness-black/90 backdrop-blur-sm border border-guinness-gold/20 rounded-lg p-8 max-w-md mx-4 text-center">
            <p className="type-section mb-4">
              {t("errors.noGDetected")}
            </p>
            <p className="type-meta mb-6">
              {t("pages.home.noGModalBody")}
            </p>
            <button
              type="button"
              onClick={() => setShowNoGModal(false)}
              className="px-6 py-2 bg-guinness-gold text-guinness-black rounded-lg hover:bg-guinness-tan transition-colors duration-300"
            >
              {t("common.tryAgain")}
            </button>
          </div>
        </div>
      )}

      {isSubmitting ? (
        <div className="fixed inset-0 bg-guinness-black/95 flex flex-col items-center justify-center gap-6 z-50">
          <div className="w-24 h-24 border-4 border-guinness-gold/20 border-t-guinness-gold rounded-full animate-spin"></div>
          <p className="type-section text-xl">
            {t("pages.home.analyzingSplit")}
          </p>
          <p className="type-meta">
            {t("pages.home.moment")}
          </p>
        </div>
      ) : (
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-6 pt-4 max-lg:pb-[max(6.5rem,env(safe-area-inset-bottom,0px))] sm:px-6 sm:pt-5 lg:min-h-0 lg:flex-1 lg:overflow-visible lg:px-8 lg:pb-5 lg:pt-[4.5rem]">
          <h1 className="sr-only">{t("pages.home.srTitle")}</h1>

          <div className="flex min-h-0 flex-1 flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-start lg:gap-x-10 lg:gap-y-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.28fr)] xl:gap-x-12">
            <aside className="flex min-w-0 shrink-0 flex-col items-center gap-4 text-center lg:items-start lg:gap-8 lg:pr-2 lg:pt-0 lg:text-left xl:gap-9">
              <div className="flex w-full flex-col items-center gap-0 max-lg:mt-3 lg:mt-0 lg:items-start lg:gap-5">
                <div className="flex w-full justify-center lg:justify-start">
                  <SplitTheGLogo className="max-w-[min(82vw,14rem)] lg:max-w-[18rem] xl:max-w-[19rem]" />
                </div>
                <div
                  className="mt-3 h-[2px] w-[min(72%,11.5rem)] rounded-full bg-gradient-to-r from-guinness-gold/65 via-guinness-tan/35 to-transparent lg:mt-0 lg:h-px lg:w-[min(88%,13.5rem)] lg:from-guinness-gold/55 lg:via-guinness-gold/28 lg:to-transparent"
                  aria-hidden
                />
              </div>
              <div className="flex w-full max-w-sm flex-col gap-2.5 lg:max-w-[23rem] lg:gap-3">
                <h2 className="text-base font-medium leading-snug tracking-tight text-guinness-gold sm:text-[1.0625rem] lg:text-lg lg:leading-tight xl:text-xl">
                  {t("pages.home.tagline")}
                </h2>
                <p className="text-[13px] leading-relaxed text-guinness-tan/70 sm:text-sm lg:text-[0.9375rem] lg:leading-[1.65] lg:text-guinness-tan/68">
                  {t("pages.home.subtitle")}
                </p>
              </div>
              <nav
                aria-label={t("pages.home.browseAria")}
                className="flex w-full max-w-sm flex-col items-stretch gap-2 lg:mt-2 lg:max-w-none"
              >
                <div className="mx-auto grid w-full max-w-[17.5rem] grid-cols-2 gap-2 lg:hidden">
                  <AppDocumentLink
                    to="/leaderboard"
                    prefetch="intent"
                    viewTransition
                    className={homeMobileBrowseLinkClass}
                  >
                    {t("pages.home.topSplits")}
                  </AppDocumentLink>
                  <AppDocumentLink
                    to="/wall"
                    prefetch="intent"
                    viewTransition
                    className={homeMobileBrowseLinkClass}
                  >
                    {t("pages.home.wall")}
                  </AppDocumentLink>
                </div>
                <div className="hidden items-center gap-2 text-sm text-guinness-tan/65 lg:flex">
                  <AppDocumentLink
                    to="/leaderboard"
                    prefetch="intent"
                    viewTransition
                    className="font-medium text-guinness-tan/88 underline decoration-guinness-tan/20 underline-offset-[3px] transition-colors hover:text-guinness-gold hover:decoration-guinness-gold/40"
                  >
                    {t("pages.home.topSplits")}
                  </AppDocumentLink>
                  <span className="text-guinness-tan/28" aria-hidden>
                    ·
                  </span>
                  <AppDocumentLink
                    to="/wall"
                    prefetch="intent"
                    viewTransition
                    className="font-medium text-guinness-tan/88 underline decoration-guinness-tan/20 underline-offset-[3px] transition-colors hover:text-guinness-gold hover:decoration-guinness-gold/40"
                  >
                    {t("pages.home.theWall")}
                  </AppDocumentLink>
                </div>
              </nav>

              <div className="mt-3 w-full max-w-sm overflow-hidden rounded-xl border border-[#312814] bg-guinness-brown/12 text-left lg:mt-6 lg:max-w-[23rem] lg:rounded-none lg:border-0 lg:bg-transparent lg:overflow-visible">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 border-b border-[#312814]/45 px-3 py-2.5 text-left transition-colors hover:bg-guinness-black/20 lg:hidden"
                  aria-expanded={howItWorksOpen ? "true" : "false"}
                  onClick={() => setHowItWorksOpen((o) => !o)}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-guinness-tan/50">
                    {t("pages.home.howItWorks")}
                  </span>
                  <svg
                    className={`h-4 w-4 shrink-0 text-guinness-gold/70 transition-transform duration-200 ${howItWorksOpen ? "rotate-180" : ""}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                <div className="hidden lg:block">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-guinness-tan/32">
                    {t("pages.home.howItWorks")}
                  </p>
                  <div
                    className="mt-3 h-px w-[min(11rem,72%)] bg-gradient-to-r from-guinness-gold/28 via-guinness-tan/12 to-transparent"
                    aria-hidden
                  />
                </div>
                <ul
                  className={`space-y-2.5 px-3.5 pb-4 pt-3 text-[11px] leading-relaxed text-guinness-tan/75 sm:text-xs max-lg:mt-0 lg:mt-5 lg:space-y-3.5 lg:px-0 lg:pb-0 lg:pt-0 lg:text-[12px] lg:leading-relaxed lg:text-guinness-tan/60 ${howItWorksOpen ? "block" : "hidden"} lg:block`}
                >
                  <li className="flex gap-3">
                    <span className="w-4 shrink-0 text-right text-[11px] font-semibold tabular-nums leading-[1.5] text-guinness-gold/88 lg:font-medium lg:text-guinness-gold/42">
                      1
                    </span>
                    <span>{t("pages.home.step1")}</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-4 shrink-0 text-right text-[11px] font-semibold tabular-nums leading-[1.5] text-guinness-gold/88 lg:font-medium lg:text-guinness-gold/42">
                      2
                    </span>
                    <span>{t("pages.home.step2")}</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-4 shrink-0 text-right text-[11px] font-semibold tabular-nums leading-[1.5] text-guinness-gold/88 lg:font-medium lg:text-guinness-gold/42">
                      3
                    </span>
                    <span>{t("pages.home.step3")}</span>
                  </li>
                </ul>
              </div>
            </aside>

            <section
              className="mx-auto flex w-full min-h-0 max-w-md flex-1 flex-col gap-2 sm:max-w-lg lg:mx-0 lg:max-h-full lg:min-h-0 lg:w-full lg:max-w-none lg:justify-self-stretch"
              aria-label={t("pages.home.scoreYourPour")}
            >
              <p className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-guinness-tan/42 max-lg:pb-0 lg:hidden">
                {t("pages.home.scoreYourPour")}
              </p>
              <div className="hidden w-full flex-row items-baseline justify-between gap-4 lg:flex">
                <p className="text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-guinness-tan/42">
                  {t("pages.home.scoreYourPour")}
                </p>
                <BuyCreatorABeer variant="compact" className="shrink-0 text-sm" />
              </div>

              {isCameraActive && (
                <div className="shrink-0 rounded-xl border border-[#312814] bg-guinness-brown/35 px-4 py-3 text-guinness-gold shadow-[inset_0_1px_0_rgba(212,175,55,0.05)] backdrop-blur-sm lg:px-4 lg:py-2.5">
                  {isProcessing ? (
                    <div className="flex items-center justify-center gap-3">
                      <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      <span className="type-label text-guinness-gold">
                        {feedbackMessage}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center">
                      <span className="type-label text-guinness-gold">
                        {feedbackMessage}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-2xl border border-[#312814] bg-guinness-brown/30 shadow-[inset_0_1px_0_rgba(212,175,55,0.06),0_12px_40px_rgba(0,0,0,0.45)] max-lg:min-h-[min(56dvh,26rem)] lg:aspect-auto lg:min-h-[min(34rem,calc(100dvh-10rem))] lg:max-h-[min(44rem,calc(100dvh-7.5rem))]">
                <div
                  className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_38%,rgba(179,139,45,0.12)_0%,transparent_62%)]"
                  aria-hidden
                />
                <div className="relative flex min-h-0 flex-1 flex-col">
                  {isCameraActive ? (
                    <div className="relative min-h-0 flex-1">
                      {isFlashSupported ? (
                        <button
                          type="button"
                          onClick={() => void toggleFlash()}
                          disabled={isFlashUpdating}
                          aria-pressed={isFlashEnabled ? "true" : "false"}
                          className="absolute right-3 top-3 z-20 inline-flex items-center gap-2 rounded-full border border-guinness-gold/35 bg-guinness-black/65 px-3 py-1.5 text-xs font-semibold text-guinness-gold backdrop-blur-sm transition-colors hover:bg-guinness-black/80 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isFlashEnabled ? (
                            <Zap className="h-3.5 w-3.5" aria-hidden />
                          ) : (
                            <ZapOff className="h-3.5 w-3.5" aria-hidden />
                          )}
                          {isFlashEnabled
                            ? t("pages.home.flashOn")
                            : t("pages.home.flashOff")}
                        </button>
                      ) : null}
                      <video
                        ref={videoRef}
                        className="absolute inset-0 h-full w-full object-cover"
                        autoPlay
                        playsInline
                        onLoadedMetadata={() => setIsVideoReady(true)}
                        onError={(err) => {
                          console.error("Camera error:", err);
                          stopCameraTracks();
                          setIsCameraActive(false);
                        }}
                      />
                      <canvas
                        ref={canvasRef}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 flex translate-y-3 items-center justify-center sm:translate-y-4 lg:translate-y-3">
                        {/*
                          Uniform scale only: fixed max-height + w:auto preserves the
                          SVG viewBox 400:600 aspect ratio (no skew transforms).
                        */}
                        <PintGlassOverlay className="block h-[min(20rem,52dvh)] w-auto shrink-0 text-guinness-gold opacity-50 sm:h-[min(22rem,50dvh)] lg:h-[min(23rem,min(48dvh,calc(100dvh-12rem)))]" />
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        trackEvent(analyticsEventNames.pourCaptureStarted, {
                          source: "camera",
                        });
                        setIsCameraActive(true);
                      }}
                      className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-4 py-6 text-guinness-gold transition-colors duration-300 hover:text-guinness-tan sm:gap-2.5 sm:py-8 lg:gap-2.5 lg:py-8"
                    >
                      <span
                        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-[#312814] bg-guinness-black/35 shadow-[inset_0_1px_0_rgba(212,175,55,0.08)] sm:h-[4.5rem] sm:w-[4.5rem] lg:h-14 lg:w-14"
                        aria-hidden
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-8 w-8 sm:h-9 sm:w-9"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                      </span>
                      <span className="text-base font-semibold tracking-tight sm:text-lg lg:text-base">
                        {t("pages.home.startAnalysis")}
                      </span>
                      <span className="type-meta max-w-[17rem] px-2 text-center text-[12px] text-guinness-tan/55 sm:text-[13px] lg:max-w-[15rem] lg:text-xs lg:leading-snug">
                        {t("pages.home.startAnalysisHint")}
                      </span>
                    </button>
                  )}
                  <div className="relative z-10 shrink-0 border-t border-[#312814] bg-guinness-black/30 px-3 py-2.5">
                    <button
                      type="button"
                      onClick={handleUploadInstead}
                      className="flex min-h-10 w-full items-center justify-center rounded-lg border border-[#312814] bg-guinness-black/25 px-3 py-2 text-xs font-semibold text-guinness-tan/90 transition-colors duration-300 hover:border-guinness-gold/35 hover:bg-[#312814]/40 hover:text-guinness-cream sm:text-sm"
                    >
                      {t("pages.home.uploadPhoto")}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-center pt-1 max-lg:pt-2 lg:hidden">
                <BuyCreatorABeer variant="compact" className="text-xs" />
              </div>

              <input
                id="file-upload"
                type="file"
                accept="image/*"
                aria-label={t("pages.home.uploadAria")}
                title={t("pages.home.uploadAria")}
                onChange={handleFileChange}
                className="hidden"
              />
            </section>
          </div>
        </div>
      )}

      <BrandedToast
        open={homeToast != null}
        message={homeToast?.message ?? ""}
        variant={homeToast?.variant ?? "info"}
        title={
          homeToast?.variant === "danger"
            ? t("common.couldntProcessImage")
            : homeToast?.variant === "warning"
              ? t("common.headsUp")
              : undefined
        }
        onClose={() => setHomeToast(null)}
        autoCloseMs={
          homeToast ? toastAutoCloseForVariant(homeToast.variant) : undefined
        }
      />
    </main>
  );
}
