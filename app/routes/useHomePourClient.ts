import {
  useActionData,
  useFetcher,
  useSearchParams,
  useSubmit,
} from "react-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import type {
  InferenceEngine as RoboflowInferenceEngine,
  InferencePrediction,
} from "inferencejs";
import type { BrandedNoticeVariant } from "~/components/branded/BrandedNotice";
import type { TranslateFn } from "~/i18n/translate";
import { analyticsEventNames } from "~/utils/analytics/events";
import { trackEvent } from "~/utils/analytics/client";
import {
  enqueueOfflinePour,
  flushOfflinePourQueue,
} from "~/utils/offline-pour-queue";
import { getSupabaseBrowserClient } from "~/utils/supabase-browser";
import {
  getSupabaseAccessToken,
  getSupabaseAuthUserSnapshot,
  useSupabaseAuthUser,
} from "~/utils/supabase-auth";

const isClient = typeof window !== "undefined";
const MAX_POUR_IMAGE_BYTES = 18 * 1024 * 1024;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ROBOFLOW_PUBLISHABLE_KEY =
  import.meta.env.VITE_ROBOFLOW_PUBLISHABLE_KEY ??
  import.meta.env.VITE_ROBOFLOW_API_KEY ??
  "";
const ROBOFLOW_INFERENCE_MODEL =
  import.meta.env.VITE_ROBOFLOW_INFERENCE_MODEL ?? "split-g-label-experiment";
const ROBOFLOW_INFERENCE_VERSION =
  import.meta.env.VITE_ROBOFLOW_INFERENCE_VERSION ?? "8";
const INFERENCEJS_CDN_URL =
  "https://esm.sh/inferencejs@1.2.3?target=es2022";

type InferenceImageInput = Parameters<RoboflowInferenceEngine["infer"]>[1];

type InferenceJsModule = {
  InferenceEngine: new () => RoboflowInferenceEngine;
  CVImage: new (source: HTMLVideoElement) => InferenceImageInput;
};

type TorchTrackCapabilities = MediaTrackCapabilities & {
  torch?: boolean;
  fillLightMode?: string[];
};

type HomeActionResult =
  | {
      success: true;
      redirectTo: string;
      scoreId?: string;
    }
  | {
      success: false;
      error?: string;
      detail?: string;
      status?: number;
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

function toastForSubmissionError(t: TranslateFn, err?: string, detail?: string) {
  if (err === "PROCESS_FAILED") return t("errors.failedProcessImage");
  if (err === "ANALYSIS_TIMEOUT") return t("errors.pourAnalysisTimedOut");
  if (err === "ROBOFLOW_FAILED") return t("errors.pourScoringServiceUnavailable");
  if (err === "RATE_LIMITED") return t("errors.pourRateLimited");
  if (err === "DUPLICATE_IMAGE") return t("errors.duplicatePourImage");
  if (err === "STALE_IMAGE_EXIF") return t("errors.imageTimestampStale");
  if (err === "INVALID_IMAGE") return t("errors.readImageFailedShort");
  if (typeof detail === "string") return detail;
  return t("errors.genericPourError");
}

export function useHomePourClient({ t }: { t: TranslateFn }) {
  const { user } = useSupabaseAuthUser();
  const submit = useSubmit();
  const [searchParams] = useSearchParams();
  const actionData = useActionData<HomeActionResult>();
  const queueFetcher = useFetcher<HomeActionResult>();
  const competitionIdParam = searchParams.get("competition")?.trim() ?? "";

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isFlashSupported, setIsFlashSupported] = useState(false);
  const [isFlashEnabled, setIsFlashEnabled] = useState(false);
  const [isFlashUpdating, setIsFlashUpdating] = useState(false);
  const [inferEngine, setInferEngine] = useState<RoboflowInferenceEngine | null>(
    null,
  );
  const [modelWorkerId, setModelWorkerId] = useState<string | null>(null);
  const [modelLoading, setModelLoading] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState(() =>
    t("pages.home.feedbackShowGlass"),
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadProcessing, setIsUploadProcessing] = useState(false);
  const [showNoGModal, setShowNoGModal] = useState(false);
  const [homeToast, setHomeToast] = useState<{
    message: string;
    variant: BrandedNoticeVariant;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const offlineFlushPendingRef = useRef<{
    resolve: () => void;
    reject: (e: Error) => void;
  } | null>(null);
  const lastSubmitSourceRef = useRef<"camera" | "upload">("camera");
  const actorMeta = useMemo(
    () => ({
      userId: user?.id ?? "",
      actorName:
        (user?.user_metadata?.full_name as string | undefined)?.trim() ||
        (user?.user_metadata?.name as string | undefined)?.trim() ||
        "",
    }),
    [user],
  );

  const stopCameraTracks = useCallback(() => {
    const stream = mediaStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    const video = videoRef.current;
    if (video) {
      video.srcObject = null;
    }
    setIsVideoReady(false);
    setIsFlashSupported(false);
    setIsFlashEnabled(false);
    setIsFlashUpdating(false);
  }, []);

  const submitQueuedPourItem = useCallback(
    (item: {
      imageBase64: string;
      competitionId: string;
      actorUserId: string;
      actorName: string;
    }) => {
      return new Promise<void>((resolve, reject) => {
        offlineFlushPendingRef.current = { resolve, reject };
        const formData = new FormData();
        formData.append("image", item.imageBase64);
        if (item.competitionId && UUID_RE.test(item.competitionId)) {
          formData.append("competition", item.competitionId);
        }
        if (item.actorName) formData.append("actorName", item.actorName);
        void getSupabaseAccessToken()
          .then((accessToken) => {
            if (accessToken) formData.append("accessToken", accessToken);
          })
          .catch(() => null)
          .finally(() => {
            queueFetcher.submit(formData, {
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
    const data = queueFetcher.data;
    if (data && data.success === false) {
      pending.reject(new Error(data.error ?? "PROCESS_FAILED"));
      return;
    }
    pending.resolve();
  }, [queueFetcher.data, queueFetcher.state]);

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
          setHomeToast({
            message: t("errors.duplicatePourImage"),
            variant: "danger",
          });
        } else if (code === "STALE_IMAGE_EXIF") {
          setHomeToast({
            message: t("errors.imageTimestampStale"),
            variant: "danger",
          });
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
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") tryFlushOfflineQueue();
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibilityChange);
    void tryFlushOfflineQueue();
    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [tryFlushOfflineQueue]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.serviceWorker) return;
    function onServiceWorkerMessage(event: MessageEvent) {
      if (event.data?.type === "FLUSH_POUR_QUEUE") {
        tryFlushOfflineQueue();
      }
    }
    navigator.serviceWorker.addEventListener("message", onServiceWorkerMessage);
    return () =>
      navigator.serviceWorker.removeEventListener(
        "message",
        onServiceWorkerMessage,
      );
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
          const accessToken = await getSupabaseAccessToken();
          if (accessToken) formData.append("accessToken", accessToken);
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
    [actorMeta.actorName, actorMeta.userId, competitionIdParam, submit, t],
  );

  useEffect(() => {
    if (typeof window === "undefined" || !isCameraActive) return;
    if (inferEngine) return;

    let cancelled = false;
    void loadInferenceJsModule()
      .then(({ InferenceEngine }) => {
        if (cancelled) return;
        setInferEngine(new InferenceEngine());
      })
      .catch((error) => {
        console.error("Could not load inference module:", error);
        if (cancelled) return;
        setHomeToast({
          message: t("pages.home.inferenceUnavailable"),
          variant: "warning",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [inferEngine, isCameraActive, t]);

  useEffect(() => {
    if (!inferEngine || modelLoading) return;

    setModelLoading(true);
    inferEngine
      .startWorker(
        ROBOFLOW_INFERENCE_MODEL,
        ROBOFLOW_INFERENCE_VERSION,
        ROBOFLOW_PUBLISHABLE_KEY,
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
          stream.getTracks().forEach((track) => track.stop());
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
      .catch((error) => {
        console.error("Camera error:", error);
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
        active.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setIsVideoReady(false);
    };
  }, [isCameraActive, t]);

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

  useEffect(() => {
    if (
      !isClient ||
      !inferEngine ||
      !modelWorkerId ||
      !isCameraActive ||
      !isVideoReady
    ) {
      return;
    }

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

            const hasGlass = predictions.some((prediction) => prediction.class === "glass");
            const hasG = predictions.some((prediction) => prediction.class === "G");

            if (hasGlass && hasG) {
              setConsecutiveDetections((prev) => {
                if (prev >= 4) return prev;
                const next = prev + 1;
                if (next === 4) {
                  setFeedbackMessage(t("pages.home.feedbackPerfect"));
                  setIsProcessing(true);
                  setIsSubmitting(true);

                  const video = videoRef.current;
                  const canvas = canvasRef.current;
                  if (video && canvas) {
                    const context = canvas.getContext("2d");
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    context?.drawImage(video, 0, 0, canvas.width, canvas.height);

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
      .catch((error) => {
        console.error("Could not load inference module:", error);
      });

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [
    inferEngine,
    isCameraActive,
    isVideoReady,
    modelWorkerId,
    sendPourImageBase64,
    stopCameraTracks,
    t,
  ]);

  useEffect(() => {
    if (!actionData) return;
    setIsUploadProcessing(false);
    setIsSubmitting(false);
    setIsProcessing(false);

    if (actionData.success === true && typeof actionData.redirectTo === "string") {
      const redirectTo = actionData.redirectTo;
      const scoreId =
        typeof actionData.scoreId === "string" ? actionData.scoreId : "";
      void (async () => {
        try {
          const competitionId =
            competitionIdParam && UUID_RE.test(competitionIdParam)
              ? competitionIdParam
              : "";
          if (competitionId && scoreId) {
            const supabase = await getSupabaseBrowserClient();
            const { user: authedUser } = await getSupabaseAuthUserSnapshot();
            if (authedUser) {
              await supabase.from("competition_scores").insert({
                competition_id: competitionId,
                score_id: scoreId,
                user_id: authedUser.id,
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

    if (actionData.success === false) {
      if (actionData.error === "NO_G") {
        setShowNoGModal(true);
        return;
      }
      trackEvent(analyticsEventNames.pourProcessingFailed, {
        code: actionData.error ?? "PROCESS_FAILED",
        source: lastSubmitSourceRef.current,
      });
      setHomeToast({
        message: toastForSubmissionError(t, actionData.error, actionData.detail),
        variant: "danger",
      });
    }
  }, [actionData, competitionIdParam, t]);

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
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
    },
    [sendPourImageBase64, t],
  );

  const handleUploadInstead = useCallback(() => {
    if (isCameraActive) {
      stopCameraTracks();
      setIsCameraActive(false);
    }
    fileInputRef.current?.click();
  }, [isCameraActive, stopCameraTracks]);

  const handleStartCamera = useCallback(() => {
    trackEvent(analyticsEventNames.pourCaptureStarted, {
      source: "camera",
    });
    setIsCameraActive(true);
  }, []);

  const handleVideoLoadedMetadata = useCallback(() => {
    setIsVideoReady(true);
  }, []);

  const handleVideoError = useCallback(
    (error: unknown) => {
      console.error("Camera error:", error);
      stopCameraTracks();
      setIsCameraActive(false);
    },
    [stopCameraTracks],
  );

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

  const [, setConsecutiveDetections] = useState(0);

  return {
    isCameraActive,
    isFlashSupported,
    isFlashEnabled,
    isFlashUpdating,
    videoRef,
    canvasRef,
    fileInputRef,
    feedbackMessage,
    isProcessing,
    isSubmitting,
    isUploadProcessing,
    showNoGModal,
    homeToast,
    toggleFlash,
    handleStartCamera,
    handleVideoLoadedMetadata,
    handleVideoError,
    handleUploadInstead,
    handleFileChange,
    closeNoGModal: () => setShowNoGModal(false),
    dismissHomeToast: () => setHomeToast(null),
  };
}
