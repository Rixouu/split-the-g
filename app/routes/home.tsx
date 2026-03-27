import { useCallback, useEffect, useRef, useState } from "react";
import {
  useSubmit,
  useActionData,
  redirect,
  useLoaderData,
  useSearchParams,
} from "react-router";
import { QRCode } from "~/components/QRCode";
import { SplitTheGLogo } from "~/components/SplitTheGLogo";
import { PintGlassOverlay } from "~/components/PintGlassOverlay";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import type {
  InferenceEngine as RoboflowInferenceEngine,
  InferencePrediction,
} from "inferencejs";
import { calculateScore } from "~/utils/scoring";
import { uploadImage } from "~/utils/imageStorage";
import { supabase } from "~/utils/supabase";
import { LeaderboardButton } from "~/components/leaderboard/LeaderboardButton";
import { SubmissionsButton } from "~/components/leaderboard/SubmissionsButton";
import { generateBeerUsername } from "~/utils/usernameGenerator";
import { getLocationData } from "~/utils/locationService";
import { BuyCreatorsABeer } from "~/components/BuyCreatorsABeer";
import { standardPageDescription } from "~/components/PageHeader";
import * as crypto from "crypto";
import {
  extractDetectionsFromWorkflow,
  extractWorkflowOutputImageByNames,
  extractPreferredWorkflowImageBase64,
  predictionsIncludeClass,
  runServerlessWorkflow,
  stripBase64ImagePayload,
  toLegacyScoringOutputs,
} from "~/utils/roboflowWorkflow";
import { cropGCloseupBase64 } from "~/utils/gCloseupCrop";
import { generatePourSlug } from "~/utils/pourSlug";
import { scorePourPath } from "~/utils/scorePath";

const isClient = typeof window !== "undefined";

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

export async function loader({ request }: LoaderFunctionArgs) {
  // Get total splits (all-time)
  const { count: totalSplits } = await supabase
    .from("scores")
    .select("*", { count: "exact", head: true });

  return { totalSplits };
}

export function meta() {
  return [
    { title: "Split the G Scorer" },
    {
      name: "description",
      content: "Test your Split the G skills with AI-powered analysis",
    },
  ];
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
  const username = generateBeerUsername();
  const sessionId = crypto.randomUUID();

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
  const { totalSplits } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const competitionIdParam = searchParams.get("competition")?.trim() ?? "";
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
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

  // Dynamically import and initialize inference engine
  const [inferEngine, setInferEngine] =
    useState<RoboflowInferenceEngine | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    async function initInference() {
      const { InferenceEngine } = await import("inferencejs");
      setInferEngine(new InferenceEngine());
    }

    initInference();
  }, []);

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
  const [consecutiveDetections, setConsecutiveDetections] = useState(0);
  const [feedbackMessage, setFeedbackMessage] = useState(
    "Show your pint glass"
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadProcessing, setIsUploadProcessing] = useState(false);
  const [showNoGModal, setShowNoGModal] = useState(false);

  // Update the detection loop with feedback logic
  useEffect(() => {
    if (
      !isClient ||
      !inferEngine ||
      !modelWorkerId ||
      !isCameraActive ||
      !isVideoReady
    )
      return;

    const detectFrame = async () => {
      if (!modelWorkerId || !videoRef.current) return;

      try {
        const { CVImage } = await import("inferencejs");
        const img = new CVImage(videoRef.current);
        const predictions: InferencePrediction[] = await inferEngine.infer(
          modelWorkerId,
          img
        );

        const hasGlass = predictions.some((pred: InferencePrediction) => pred.class === "glass");
        const hasG = predictions.some((pred: InferencePrediction) => pred.class === "G");

        if (hasGlass && hasG) {
          setConsecutiveDetections((prev) => prev + 1);

          if (consecutiveDetections >= 4) {
            setFeedbackMessage("Perfect! Processing your pour...");
            setIsProcessing(true);
            setIsSubmitting(true);

            if (videoRef.current && canvasRef.current) {
              const canvas = canvasRef.current;
              const context = canvas.getContext("2d");

              canvas.width = videoRef.current.videoWidth;
              canvas.height = videoRef.current.videoHeight;
              context?.drawImage(
                videoRef.current,
                0,
                0,
                canvas.width,
                canvas.height
              );

              const imageData = canvas.toDataURL("image/jpeg");
              const base64Image = imageData.replace(
                /^data:image\/\w+;base64,/,
                ""
              );

              stopCameraTracks();
              setIsCameraActive(false);

              // Submit form data to action
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
            return; // Exit the detection loop
          }
          if (consecutiveDetections >= 1) {
            setFeedbackMessage("Hold still...");
          } else {
            setFeedbackMessage("Keep the glass centered...");
          }
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

    const intervalId = setInterval(detectFrame, 500);
    return () => clearInterval(intervalId);
  }, [
    modelWorkerId,
    isCameraActive,
    inferEngine,
    isVideoReady,
    consecutiveDetections,
    submit,
    stopCameraTracks,
  ]);

  // Update the effect that handles action response
  useEffect(() => {
    if (actionData) {
      setIsUploadProcessing(false);
      setIsSubmitting(false);

      // Check if there was an error due to no G detected
      if (actionData.error === "No G detected") {
        setShowNoGModal(true);
      }
    }
  }, [actionData]);

  // Update the handleFileChange function
  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploadProcessing(true);
    const reader = new FileReader();

    reader.onloadend = () => {
      const base64Image = reader.result
        ?.toString()
        .replace(/^data:image\/\w+;base64,/, "");
      if (base64Image) {
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
    };
    reader.readAsDataURL(file);
  };

  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-start bg-guinness-black text-guinness-cream">
      {/* QR Code Modal */}
      {showQRCode && (
        <div
          className="fixed inset-0 bg-guinness-black/95 flex items-center justify-center z-50"
          onClick={() => setShowQRCode(false)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <QRCode className="w-full h-full object-contain" />
            <button
              onClick={() => setShowQRCode(false)}
              aria-label="Close QR code modal"
              title="Close"
              className="absolute top-4 right-4 text-guinness-gold hover:text-guinness-tan transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-8 w-8"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* FAQ Button — desktop only (mobile: use nav on other routes or /faq URL) */}
      <a
        href="/faq"
        className="fixed top-4 left-4 z-40 hidden items-center gap-1.5 rounded-lg border border-guinness-gold/20 bg-guinness-gold/10 p-1.5 text-guinness-gold transition-colors hover:bg-guinness-gold/20 md:inline-flex"
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

      {/* QR Code Icon — desktop only */}
      <button
        type="button"
        onClick={() => setShowQRCode(true)}
        aria-label="Show QR code"
        title="Show QR code"
        className="fixed top-4 right-4 z-40 hidden rounded-lg border border-guinness-gold/20 bg-guinness-gold/10 p-2 text-guinness-gold transition-colors hover:bg-guinness-gold/20 md:block"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 3h6v6H3V3zm12 0h6v6h-6V3zM3 15h6v6H3v-6zm12 0h6v6h-6v-6z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 9h2v2H9V9zm4 0h2v2h-2V9zm0 4h2v2h-2v-2z"
          />
        </svg>
      </button>

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
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center gap-5 px-4 pb-6 pt-6 sm:px-5 sm:pb-6 sm:pt-8">
          <header className="flex flex-col items-center gap-4 px-2 text-center md:gap-5 md:px-4">
            <SplitTheGLogo />
            <div className="h-px w-20 bg-guinness-gold/50 md:w-28" aria-hidden />
            <p className="type-body-muted mx-auto max-w-2xl text-base font-normal leading-relaxed text-guinness-tan/85 md:text-lg">
              {standardPageDescription}
            </p>
            <div className="flex w-full max-w-md flex-col gap-3 sm:max-w-none sm:flex-row sm:flex-wrap sm:justify-center">
              <LeaderboardButton className="min-h-11 w-full justify-center sm:w-auto" />
              <SubmissionsButton className="w-full justify-center sm:w-auto" />
            </div>
          </header>

          <div className="flex w-full max-w-md flex-col gap-4">
            {isCameraActive && (
              <div className="px-8 py-4 bg-guinness-black/90 backdrop-blur-sm border border-guinness-gold/20 text-guinness-gold rounded-lg shadow-lg">
                {isProcessing ? (
                  <div className="flex items-center justify-center gap-3">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
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

            <div className="aspect-[3/4] w-full overflow-hidden rounded-lg border border-guinness-gold/20 bg-guinness-brown/50 shadow-lg shadow-black/50">
              {isCameraActive ? (
                <div className="relative h-full w-full">
                  <video
                    ref={videoRef}
                    className="absolute inset-0 w-full h-full object-cover"
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
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center translate-y-8">
                    <PintGlassOverlay className="w-80 md:w-96 h-[28rem] md:h-[32rem] text-guinness-gold opacity-50" />
                  </div>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => setIsCameraActive(true)}
                    className="w-full h-full flex flex-col items-center justify-center gap-4 text-guinness-gold hover:text-guinness-tan transition-colors duration-300"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-16 w-16 md:h-20 md:w-20"
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
                    <span className="text-lg font-medium md:text-xl">
                      Start Analysis
                    </span>
                  </button>
                </>
              )}
            </div>
          </div>

          <button
            onClick={() => document.getElementById("file-upload")?.click()}
            className="mt-4 w-3/4 rounded-lg bg-guinness-gold px-4 py-2 font-semibold text-guinness-black transition-colors duration-300 hover:bg-guinness-tan"
          >
            Upload an Image
          </button>
          <input
            id="file-upload"
            type="file"
            accept="image/*"
            aria-label="Upload an image"
            title="Upload an image"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="type-body-muted mx-auto max-w-[280px] rounded-lg border border-guinness-gold/20 bg-guinness-black/90 px-6 py-3 text-center text-base backdrop-blur-sm md:max-w-md md:text-lg">
            All Time Total Splits: {totalSplits?.toLocaleString() || "0"}
          </div>

          <div className="mt-3 flex justify-center">
            <BuyCreatorsABeer />
          </div>

        </div>
      )}
    </main>
  );
}
