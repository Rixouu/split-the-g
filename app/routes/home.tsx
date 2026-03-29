import { useCallback, useEffect, useRef, useState } from "react";
import {
  Link,
  useSubmit,
  useActionData,
  redirect,
  useSearchParams,
} from "react-router";
import { PintGlassOverlay } from "~/components/PintGlassOverlay";
import { SplitTheGLogo } from "~/components/SplitTheGLogo";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import type {
  InferenceEngine as RoboflowInferenceEngine,
  InferencePrediction,
} from "inferencejs";
import { BuyCreatorABeer } from "~/components/BuyCreatorABeer";
import type { BrandedNoticeVariant } from "~/components/branded/BrandedNotice";
import { BrandedToast } from "~/components/branded/BrandedToast";
import { toastAutoCloseForVariant } from "~/components/branded/feedback-variant";
import { seoMeta } from "~/utils/seo";

const isClient = typeof window !== "undefined";

/** Compact mobile browse links — avoids full-width gold blocks on small screens. */
const homeMobileBrowseLinkClass =
  "inline-flex min-h-9 w-full items-center justify-center rounded-md border border-guinness-gold/30 bg-guinness-black/40 px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-guinness-gold transition-colors hover:border-guinness-gold/50 hover:bg-guinness-gold/10 active:bg-guinness-gold/15";

const MAX_POUR_IMAGE_BYTES = 18 * 1024 * 1024;

/**
 * Roboflow workflow API base. Official Deploy snippets often use `https://detect.roboflow.com`;
 * some use `https://serverless.roboflow.com` — paths differ; `buildWorkflowInferUrl` handles both.
 */
const ROBOFLOW_API_BASE_URL =
  import.meta.env.VITE_ROBOFLOW_API_URL ?? "https://detect.roboflow.com";
const ROBOFLOW_WORKSPACE = import.meta.env.VITE_ROBOFLOW_WORKSPACE ?? "";
const ROBOFLOW_WORKFLOW_ID = import.meta.env.VITE_ROBOFLOW_WORKFLOW_ID ?? "";
/** Paste full infer URL from Deploy if 404 (overrides base + workspace + id). */
const ROBOFLOW_WORKFLOW_INFER_URL =
  import.meta.env.VITE_ROBOFLOW_WORKFLOW_INFER_URL ?? "";
const ROBOFLOW_WORKFLOW_VERSION_ID =
  import.meta.env.VITE_ROBOFLOW_WORKFLOW_VERSION_ID ?? "";

const ROBOFLOW_USE_SERVERLESS = Boolean(ROBOFLOW_WORKSPACE && ROBOFLOW_WORKFLOW_ID);

/** Legacy: `workspace-id/workflow-id` on detect.roboflow.com — only if serverless env is not set. */
const ROBOFLOW_LEGACY_WORKFLOW_PATH =
  import.meta.env.VITE_ROBOFLOW_WORKFLOW ?? "hunter-diminick/split-g-scoring";

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
  "https://esm.sh/inferencejs@2.10.2?target=es2022";

/** Second argument to `InferenceEngine.infer` (CDN build matches npm typings). */
type InferenceImageInput = Parameters<RoboflowInferenceEngine["infer"]>[1];

type InferenceJsModule = {
  InferenceEngine: new () => RoboflowInferenceEngine;
  CVImage: new (source: HTMLVideoElement) => InferenceImageInput;
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

export function meta() {
  return seoMeta({
    title: "Split the G Scorer",
    description: "Snap your pint and get an AI Split the G score in seconds.",
    path: "/",
    keywords: ["split the g scorer", "guinness score app", "pour analyzer"],
  });
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const base64Image = formData.get("image") as string;
  const competitionRaw = formData.get("competition");
  const competitionId =
    typeof competitionRaw === "string" && UUID_RE.test(competitionRaw.trim())
      ? competitionRaw.trim()
      : "";
  const { randomUUID } = await import("node:crypto");
  const [
    { calculateScore },
    { uploadImage },
    { getLocationData },
    {
      extractDetectionsFromWorkflow,
      extractWorkflowOutputImageByNames,
      extractPreferredWorkflowImageBase64,
      predictionsIncludeClass,
      runServerlessWorkflow,
      stripBase64ImagePayload,
      toLegacyScoringOutputs,
    },
    { generatePourSlug },
    { scorePourPath },
    { supabase },
    { generateBeerUsername },
  ] = await Promise.all([
    import("~/utils/scoring"),
    import("~/utils/imageStorage"),
    import("~/utils/locationService"),
    import("~/utils/roboflowWorkflow"),
    import("~/utils/pourSlug"),
    import("~/utils/scorePath"),
    import("~/utils/supabase"),
    import("~/utils/usernameGenerator"),
  ]);
  const username = generateBeerUsername();
  const sessionId = randomUUID();

  // Prioritize Fly.io headers since we're using Fly hosting
  const clientIP =
    request.headers.get("Fly-Client-IP") ||
    request.headers.get("fly-client-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-client-ip") ||
    request.headers.get("fastly-client-ip") ||
    "unknown";

  try {
    /** Server workflow API — use Roboflow Private API key (not publishable). Non-VITE so it is not bundled for the browser. */
    const roboflowServerKey =
      (typeof process !== "undefined" && process.env?.ROBOFLOW_PRIVATE_API_KEY) ||
      import.meta.env.VITE_ROBOFLOW_API_KEY;
    if (!roboflowServerKey) {
      throw new Error(
        "Missing Roboflow server key. Set ROBOFLOW_PRIVATE_API_KEY (Private API key) in .env.local, or temporarily VITE_ROBOFLOW_API_KEY. Restart dev server.",
      );
    }

    const imagePayload = stripBase64ImagePayload(base64Image);
    let splitImage: string;
    let pintImage: string;
    let splitScore: number;
    let gCloseupBase64: string | null = null;

    if (ROBOFLOW_USE_SERVERLESS) {
      const result = await runServerlessWorkflow(
        {
          apiUrl: ROBOFLOW_API_BASE_URL,
          workspace: ROBOFLOW_WORKSPACE,
          workflowId: ROBOFLOW_WORKFLOW_ID,
          apiKey: roboflowServerKey,
          inferUrlOverride: ROBOFLOW_WORKFLOW_INFER_URL || undefined,
          workflowVersionId: ROBOFLOW_WORKFLOW_VERSION_ID || undefined,
        },
        imagePayload,
      );

      const extracted = extractDetectionsFromWorkflow(result);
      if (!extracted) {
        throw new Error(
          "Workflow returned no object-detection block this app understands. Ensure a detection step exposes predictions + image size (see Roboflow object-detection JSON).",
        );
      }

      if (!predictionsIncludeClass(extracted, "G")) {
        return {
          success: false,
          error: "No G detected",
          message: "No G pattern detected",
          status: 400,
        };
      }

      const scoringBlock = toLegacyScoringOutputs(extracted);
      splitScore = calculateScore(scoringBlock);

      const splitImageFromNamedOutput = extractWorkflowOutputImageByNames(result, [
        // In this workflow, `pint_image` is the full annotated frame and is best for "Your Split G".
        "pint_image",
        "pint image",
        // Keep compatibility fallback if another workflow maps split visualization here.
        "split_image",
        "split image",
      ]);

      // Prefer annotated outputs from workflow steps; fall back to original capture.
      const splitVisualization =
        splitImageFromNamedOutput ??
        extractPreferredWorkflowImageBase64(result, [
          "visualize_split",
          "g_label",
          "g_visualization",
          "beer_label",
        ]) ?? imagePayload;
      // "Original Pour" should always be the untouched source image from camera/upload.
      const pintVisualization = imagePayload;

      splitImage = stripBase64ImagePayload(splitVisualization);
      pintImage = stripBase64ImagePayload(pintVisualization);

      try {
        const { cropGCloseupBase64 } = await import("~/utils/gCloseupCrop");
        gCloseupBase64 = await cropGCloseupBase64(
          imagePayload,
          extracted.predictions,
        );
      } catch (cropErr) {
        console.error("G close-up crop failed:", cropErr);
      }
    } else {
      const response = await fetch(
        `https://detect.roboflow.com/infer/workflows/${ROBOFLOW_LEGACY_WORKFLOW_PATH}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            api_key: roboflowServerKey,
            inputs: {
              image: { type: "base64", value: imagePayload },
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed (${response.status}): ${errorText}`);
      }

      const result = await response.json();

      const pintPredictions: {
        class: string;
        x: number;
        y: number;
        width: number;
        height: number;
        confidence?: number;
      }[] =
        result.outputs?.[0]?.["pint results"]?.predictions?.predictions || [];
      const hasG = pintPredictions.some((pred: { class: string }) => pred.class === "G");

      if (!hasG) {
        return {
          success: false,
          error: "No G detected",
          message: "No G pattern detected",
          status: 400,
        };
      }

      if (!result.outputs?.[0]) {
        throw new Error("No outputs received from API");
      }

      const splitImageData = result.outputs[0]["split image"];
      const pintImageData = result.outputs[0]["pint image"];

      const legacySplit = splitImageData?.[0]?.value;
      const legacyPint = pintImageData?.value;

      if (!legacySplit || !legacyPint) {
        throw new Error("Missing required image data from API response");
      }

      splitImage = legacySplit;
      pintImage = legacyPint;
      splitScore = calculateScore(result.outputs[0]);

      try {
        const { cropGCloseupBase64 } = await import("~/utils/gCloseupCrop");
        gCloseupBase64 = await cropGCloseupBase64(imagePayload, pintPredictions);
      } catch (cropErr) {
        console.error("G close-up crop failed:", cropErr);
      }
    }

    // Upload images to storage
    const splitImageUrl = await uploadImage(splitImage, "split-images");
    const pintImageUrl = await uploadImage(pintImage, "pint-images");
    let gCloseupImageUrl: string | null = null;
    if (gCloseupBase64) {
      try {
        gCloseupImageUrl = await uploadImage(gCloseupBase64, "g-closeup-images");
      } catch (uploadErr) {
        console.error("G close-up upload failed:", uploadErr);
      }
    }

    // Get location data with client IP
    const locationData = await getLocationData(clientIP);

    // Create database record with session_id, location, and short public slug when supported
    const insertPayload = {
      split_score: splitScore,
      split_image_url: splitImageUrl,
      pint_image_url: pintImageUrl,
      g_closeup_image_url: gCloseupImageUrl,
      username: username,
      created_at: new Date().toISOString(),
      session_id: sessionId,
      city: locationData.city,
      region: locationData.region,
      country: locationData.country,
      country_code: locationData.country_code,
    };

    let score: {
      id: string;
      slug?: string | null;
    } | null = null;
    let dbError: Error | null = null;

    for (let attempt = 0; attempt < 10; attempt++) {
      const slug = generatePourSlug(8);
      const res = await supabase
        .from("scores")
        .insert({ ...insertPayload, slug })
        .select("id, slug")
        .single();

      if (!res.error && res.data) {
        score = res.data;
        break;
      }

      const msg = res.error?.message ?? "";
      const code = (res.error as { code?: string })?.code;
      if (code === "23505" || msg.includes("unique") || msg.includes("duplicate")) {
        continue;
      }
      // Slug column not migrated yet — fall through to insert without slug
      if (
        code === "42703" ||
        (msg.includes("slug") && msg.includes("does not exist"))
      ) {
        break;
      }
      dbError = res.error as Error;
      break;
    }

    if (!score) {
      const res = await supabase
        .from("scores")
        .insert(insertPayload)
        .select("id")
        .single();
      if (!res.error && res.data) {
        score = res.data;
        dbError = null;
      } else if (res.error && !dbError) {
        dbError = res.error as Error;
      }
    }

    if (dbError) throw dbError;
    if (!score) throw new Error("Failed to save score");

    // Set the session cookie before redirecting
    const headers = new Headers();
    headers.append(
      "Set-Cookie",
      `split-g-session=${sessionId}; Path=/; Max-Age=31536000; SameSite=Lax`
    );

    const path = scorePourPath(score);
    const dest = competitionId
      ? `${path}${path.includes("?") ? "&" : "?"}competition=${encodeURIComponent(competitionId)}`
      : path;
    return redirect(dest, {
      headers,
    });
  } catch (error) {
    console.error("Error processing image:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Detailed error:", JSON.stringify(error, null, 2));

    return {
      success: false,
      message: "Failed to process image",
      error: errorMessage,
      status: 500,
    };
  }
}

export default function Home() {
  const [searchParams] = useSearchParams();
  const competitionIdParam = searchParams.get("competition")?.trim() ?? "";
  const [isCameraActive, setIsCameraActive] = useState(false);
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
  }, []);
  const submit = useSubmit();
  const actionData = useActionData<typeof action>();

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
          message:
            "Live camera guidance is temporarily unavailable. You can still upload a photo.",
          variant: "warning",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [isCameraActive, inferEngine]);

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
      .then((id: string) => setModelWorkerId(id));
  }, [inferEngine, modelLoading]);

  const [isVideoReady, setIsVideoReady] = useState(false);
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);

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
          message:
            "Camera unavailable or permission denied. Allow camera access or use Upload an image instead.",
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
  }, [isCameraActive]);

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
  const [feedbackMessage, setFeedbackMessage] = useState(
    "Show your pint glass"
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadProcessing, setIsUploadProcessing] = useState(false);
  const [showNoGModal, setShowNoGModal] = useState(false);
  const [homeToast, setHomeToast] = useState<{
    message: string;
    variant: BrandedNoticeVariant;
  } | null>(null);

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
                  setFeedbackMessage("Perfect! Processing your pour...");
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

                    const formData = new FormData();
                    formData.append("image", base64Image);
                    if (competitionIdParam && UUID_RE.test(competitionIdParam)) {
                      formData.append("competition", competitionIdParam);
                    }

                    submit(formData, {
                      method: "post",
                      action: "/?index",
                      encType: "multipart/form-data",
                    });
                  }
                } else if (next >= 2) {
                  setFeedbackMessage("Hold still...");
                } else {
                  setFeedbackMessage("Keep the glass centered...");
                }
                return next;
              });
            } else {
              setConsecutiveDetections(0);
              if (!hasGlass) {
                setFeedbackMessage("Show your pint glass");
              } else if (!hasG) {
                setFeedbackMessage("Make sure the G pattern is visible");
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
    submit,
    stopCameraTracks,
    competitionIdParam,
  ]);

  // Update the effect that handles action response
  useEffect(() => {
    if (!actionData) return;
    setIsUploadProcessing(false);
    setIsSubmitting(false);

    if (actionData.error === "No G detected") {
      setShowNoGModal(true);
      return;
    }

    if (
      "success" in actionData &&
      actionData.success === false &&
      actionData.error !== "No G detected"
    ) {
      const msg =
        typeof actionData.message === "string" && actionData.message.trim()
          ? actionData.message.trim()
          : typeof actionData.error === "string"
            ? actionData.error
            : "Something went wrong processing your pour.";
      setHomeToast({
        message: msg,
        variant: "danger",
      });
    }
  }, [actionData]);

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
        message: "Please choose an image file (for example JPG or PNG).",
        variant: "warning",
      });
      return;
    }
    if (file.size > MAX_POUR_IMAGE_BYTES) {
      setHomeToast({
        message: `That image is too large (max ${Math.round(MAX_POUR_IMAGE_BYTES / (1024 * 1024))} MB). Try a smaller photo.`,
        variant: "warning",
      });
      return;
    }

    setIsUploadProcessing(true);
    const reader = new FileReader();

    reader.onerror = () => {
      setIsUploadProcessing(false);
      setHomeToast({
        message: "We couldn’t read that image. Try another photo or export it again.",
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
          message: "Couldn’t read that image. Try a different file.",
          variant: "danger",
        });
        return;
      }
      const formData = new FormData();
      formData.append("image", base64Image);
      if (competitionIdParam && UUID_RE.test(competitionIdParam)) {
        formData.append("competition", competitionIdParam);
      }
      submit(formData, {
        method: "post",
        action: "/?index",
        encType: "multipart/form-data",
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <main className="flex min-h-dvh w-full flex-col items-center justify-start overflow-x-hidden bg-guinness-black text-guinness-cream max-lg:overflow-y-auto lg:max-h-dvh lg:min-h-0 lg:overflow-y-auto">
      {/* FAQ Button — desktop only (mobile: use nav on other routes or /faq URL) */}
      <a
        href="/profile/faq"
        className="fixed left-4 top-4 z-40 hidden items-center gap-1.5 rounded-lg border border-[#312814] bg-guinness-brown/40 p-1.5 text-guinness-gold transition-colors hover:border-guinness-gold/35 hover:bg-[#312814]/50 md:inline-flex"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span className="text-sm">FAQ</span>
      </a>

      {isUploadProcessing && (
        <div className="fixed inset-0 bg-guinness-black/95 flex flex-col items-center justify-center gap-6 z-50">
          <div className="w-24 h-24 border-4 border-guinness-gold/20 border-t-guinness-gold rounded-full animate-spin"></div>
          <p className="type-section text-xl">
            Processing your image...
          </p>
          <p className="type-meta">
            This will just take a moment
          </p>
        </div>
      )}

      {showNoGModal && (
        <div className="fixed inset-0 bg-guinness-black/95 flex flex-col items-center justify-center gap-6 z-50">
          <div className="bg-guinness-black/90 backdrop-blur-sm border border-guinness-gold/20 rounded-lg p-8 max-w-md mx-4 text-center">
            <p className="type-section mb-4">
              {actionData?.message || "No G detected"}
            </p>
            <p className="type-meta mb-6">
              Please make sure the G pattern is clearly visible in your image
              and try again.
            </p>
            <button
              onClick={() => setShowNoGModal(false)}
              className="px-6 py-2 bg-guinness-gold text-guinness-black rounded-lg hover:bg-guinness-tan transition-colors duration-300"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {isSubmitting ? (
        <div className="fixed inset-0 bg-guinness-black/95 flex flex-col items-center justify-center gap-6 z-50">
          <div className="w-24 h-24 border-4 border-guinness-gold/20 border-t-guinness-gold rounded-full animate-spin"></div>
          <p className="type-section text-xl">
            Analyzing your split...
          </p>
          <p className="type-meta">
            This will just take a moment
          </p>
        </div>
      ) : (
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-6 pt-4 max-lg:pb-[max(6.5rem,env(safe-area-inset-bottom,0px))] sm:px-6 sm:pt-5 lg:min-h-0 lg:flex-1 lg:overflow-visible lg:px-8 lg:pb-5 lg:pt-[4.5rem]">
          <h1 className="sr-only">Split the G: score your pour</h1>

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
                  Frame it. Split it.
                </h2>
                <p className="text-[13px] leading-relaxed text-guinness-tan/70 sm:text-sm lg:text-[0.9375rem] lg:leading-[1.65] lg:text-guinness-tan/68">
                  One photo of your pint, we score the G line. Share on the wall
                  or chase the board.
                </p>
              </div>
              <nav
                aria-label="Browse splits and wall"
                className="flex w-full max-w-sm flex-col items-stretch gap-2 lg:mt-2 lg:max-w-none"
              >
                <div className="mx-auto grid w-full max-w-[17.5rem] grid-cols-2 gap-2 lg:hidden">
                  <Link
                    to="/leaderboard"
                    prefetch="intent"
                    viewTransition
                    className={homeMobileBrowseLinkClass}
                  >
                    Top splits
                  </Link>
                  <Link
                    to="/wall"
                    prefetch="intent"
                    viewTransition
                    className={homeMobileBrowseLinkClass}
                  >
                    Wall
                  </Link>
                </div>
                <div className="hidden items-center gap-2 text-sm text-guinness-tan/65 lg:flex">
                  <Link
                    to="/leaderboard"
                    prefetch="intent"
                    viewTransition
                    className="font-medium text-guinness-tan/88 underline decoration-guinness-tan/20 underline-offset-[3px] transition-colors hover:text-guinness-gold hover:decoration-guinness-gold/40"
                  >
                    Top splits
                  </Link>
                  <span className="text-guinness-tan/28" aria-hidden>
                    ·
                  </span>
                  <Link
                    to="/wall"
                    prefetch="intent"
                    viewTransition
                    className="font-medium text-guinness-tan/88 underline decoration-guinness-tan/20 underline-offset-[3px] transition-colors hover:text-guinness-gold hover:decoration-guinness-gold/40"
                  >
                    The wall
                  </Link>
                </div>
              </nav>

              <div className="mt-3 w-full max-w-sm overflow-hidden rounded-xl border border-[#312814] bg-guinness-brown/12 text-left lg:mt-6 lg:max-w-[23rem] lg:rounded-none lg:border-0 lg:bg-transparent lg:overflow-visible">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 border-b border-[#312814]/45 px-3 py-2.5 text-left transition-colors hover:bg-guinness-black/20 lg:hidden"
                  aria-expanded={howItWorksOpen}
                  onClick={() => setHowItWorksOpen((o) => !o)}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-guinness-tan/50">
                    How it works
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
                    How it works
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
                    <span>Straight-on pint, G and foam line visible.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-4 shrink-0 text-right text-[11px] font-semibold tabular-nums leading-[1.5] text-guinness-gold/88 lg:font-medium lg:text-guinness-gold/42">
                      2
                    </span>
                    <span>Start analysis and hold still for the score.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-4 shrink-0 text-right text-[11px] font-semibold tabular-nums leading-[1.5] text-guinness-gold/88 lg:font-medium lg:text-guinness-gold/42">
                      3
                    </span>
                    <span>Post to the wall or climb the leaderboard.</span>
                  </li>
                </ul>
              </div>
            </aside>

            <section
              className="mx-auto flex w-full min-h-0 max-w-md flex-1 flex-col gap-2 sm:max-w-lg lg:mx-0 lg:max-h-full lg:min-h-0 lg:w-full lg:max-w-none lg:justify-self-stretch"
              aria-label="Camera and upload"
            >
              <p className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-guinness-tan/42 max-lg:pb-0 lg:hidden">
                Score your pour
              </p>
              <div className="hidden w-full flex-row items-baseline justify-between gap-4 lg:flex">
                <p className="text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-guinness-tan/42">
                  Score your pour
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
                      <div className="absolute inset-0 flex translate-y-6 items-center justify-center lg:translate-y-4">
                        <PintGlassOverlay className="h-[26rem] w-72 text-guinness-gold opacity-50 sm:h-[28rem] sm:w-80 lg:h-[min(28rem,calc(100dvh-16rem))] lg:w-[min(20rem,45vw)]" />
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsCameraActive(true)}
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
                        Start analysis
                      </span>
                      <span className="type-meta max-w-[17rem] px-2 text-center text-[12px] text-guinness-tan/55 sm:text-[13px] lg:max-w-[15rem] lg:text-xs lg:leading-snug">
                        Line up the pint and G, hold steady, or upload below.
                      </span>
                    </button>
                  )}
                  {!isCameraActive ? (
                    <div className="relative z-10 shrink-0 border-t border-[#312814] bg-guinness-black/30 px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() =>
                          document.getElementById("file-upload")?.click()
                        }
                        className="flex min-h-10 w-full items-center justify-center rounded-lg border border-[#312814] bg-guinness-black/25 px-3 py-2 text-xs font-semibold text-guinness-tan/90 transition-colors duration-300 hover:border-guinness-gold/35 hover:bg-[#312814]/40 hover:text-guinness-cream sm:text-sm"
                      >
                        Upload a photo instead
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="flex justify-center pt-1 max-lg:pt-2 lg:hidden">
                <BuyCreatorABeer variant="compact" className="text-xs" />
              </div>

              <input
                id="file-upload"
                type="file"
                accept="image/*"
                aria-label="Upload an image"
                title="Upload an image"
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
            ? "Couldn’t process that image"
            : homeToast?.variant === "warning"
              ? "Heads up"
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
