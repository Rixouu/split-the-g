import type { SupportedLocale } from "~/i18n/config";
import { localizePath } from "~/i18n/paths";
import { scorePourPath } from "~/utils/scorePath";
import { supabase } from "~/utils/supabase";
import { generateBeerUsername } from "~/utils/usernameGenerator";
import {
  sendFriendSplitNotifications,
  sendKnockedOutTop10NotificationForNewScore,
} from "~/utils/push-notifications.server";

const ROBOFLOW_API_BASE_URL =
  import.meta.env.VITE_ROBOFLOW_API_URL ?? "https://detect.roboflow.com";
const ROBOFLOW_WORKSPACE = import.meta.env.VITE_ROBOFLOW_WORKSPACE ?? "";
const ROBOFLOW_WORKFLOW_ID = import.meta.env.VITE_ROBOFLOW_WORKFLOW_ID ?? "";
const ROBOFLOW_WORKFLOW_INFER_URL =
  import.meta.env.VITE_ROBOFLOW_WORKFLOW_INFER_URL ?? "";
const ROBOFLOW_WORKFLOW_VERSION_ID =
  import.meta.env.VITE_ROBOFLOW_WORKFLOW_VERSION_ID ?? "";
const ROBOFLOW_USE_SERVERLESS = Boolean(ROBOFLOW_WORKSPACE && ROBOFLOW_WORKFLOW_ID);
const ROBOFLOW_LEGACY_WORKFLOW_PATH =
  import.meta.env.VITE_ROBOFLOW_WORKFLOW ?? "rx-m9wzu/split-the-g-workflow";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function resolveClientIp(request: Request): string {
  return (
    request.headers.get("Fly-Client-IP") ||
    request.headers.get("fly-client-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-client-ip") ||
    request.headers.get("fastly-client-ip") ||
    "unknown"
  );
}

function resolveRoboflowServerKey(): string {
  const roboflowServerKey =
    (typeof process !== "undefined" && process.env?.ROBOFLOW_PRIVATE_API_KEY) ||
    import.meta.env.VITE_ROBOFLOW_API_KEY;
  if (!roboflowServerKey) {
    throw new Error(
      "Missing Roboflow server key. Set ROBOFLOW_PRIVATE_API_KEY (Private API key) in .env.local, or temporarily VITE_ROBOFLOW_API_KEY. Restart dev server.",
    );
  }
  return roboflowServerKey;
}

function readSessionCookie(request: Request): string | undefined {
  const cookieHeader = request.headers.get("Cookie") ?? "";
  const cookies = Object.fromEntries(
    cookieHeader
      .split("; ")
      .map((cookie) => {
        const [key, ...value] = cookie.split("=");
        return [key.trim(), value.join("=")];
      })
      .filter(([key]) => key),
  );
  const sessionFromCookie = cookies["split-g-session"];
  return sessionFromCookie?.trim() || undefined;
}

function isImageHashUniqueViolation(message: string): boolean {
  return (
    message.includes("source_image_sha256") ||
    message.includes("scores_source_image_sha256")
  );
}

async function analyzePourImage(imagePayload: string, roboflowServerKey: string) {
  const [
    { calculateScore },
    {
      extractDetectionsFromWorkflow,
      extractWorkflowOutputImageByNames,
      extractPreferredWorkflowImageBase64,
      predictionsIncludeClass,
      runServerlessWorkflow,
      stripBase64ImagePayload,
      toLegacyScoringOutputs,
    },
  ] = await Promise.all([
    import("~/utils/scoring"),
    import("~/utils/roboflowWorkflow"),
  ]);

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
        success: false as const,
        error: "NO_G",
        status: 400,
      };
    }

    const scoringBlock = toLegacyScoringOutputs(extracted);
    splitScore = calculateScore(scoringBlock);

    const splitImageFromNamedOutput = extractWorkflowOutputImageByNames(result, [
      "pint_image",
      "pint image",
      "split_image",
      "split image",
    ]);

    const splitVisualization =
      splitImageFromNamedOutput ??
      extractPreferredWorkflowImageBase64(result, [
        "visualize_split",
        "g_label",
        "g_visualization",
        "beer_label",
      ]) ??
      imagePayload;
    const pintVisualization = imagePayload;

    splitImage = stripBase64ImagePayload(splitVisualization);
    pintImage = stripBase64ImagePayload(pintVisualization);

    try {
      const { cropGCloseupBase64 } = await import("~/utils/gCloseupCrop");
      gCloseupBase64 = await cropGCloseupBase64(imagePayload, extracted.predictions);
    } catch (cropError) {
      console.error("G close-up crop failed:", cropError);
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
      },
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
    }[] = result.outputs?.[0]?.["pint results"]?.predictions?.predictions || [];
    const hasG = pintPredictions.some((prediction) => prediction.class === "G");

    if (!hasG) {
      return {
        success: false as const,
        error: "NO_G",
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
    } catch (cropError) {
      console.error("G close-up crop failed:", cropError);
    }
  }

  return {
    success: true as const,
    splitImage,
    pintImage,
    splitScore,
    gCloseupBase64,
  };
}

async function persistScoreRecord(args: {
  splitScore: number;
  splitImageUrl: string;
  pintImageUrl: string;
  gCloseupImageUrl: string | null;
  rowUsername: string;
  sessionId: string;
  locationData: {
    city: string | null;
    region: string | null;
    country: string | null;
    country_code: string | null;
  };
  sourceImageSha256: string;
  clientIP: string;
  verifiedUserId: string;
  verifiedAuthUserEmail: string | null;
}) {
  const { generatePourSlug } = await import("~/utils/pourSlug");

  type InsertShape = Record<string, unknown>;
  let insertPayload: InsertShape = {
    split_score: args.splitScore,
    split_image_url: args.splitImageUrl,
    pint_image_url: args.pintImageUrl,
    g_closeup_image_url: args.gCloseupImageUrl,
    username: args.rowUsername,
    created_at: new Date().toISOString(),
    session_id: args.sessionId,
    city: args.locationData.city,
    region: args.locationData.region,
    country: args.locationData.country,
    country_code: args.locationData.country_code,
    source_image_sha256: args.sourceImageSha256,
    ingest_ip: args.clientIP !== "unknown" ? args.clientIP : null,
    submitter_user_id: args.verifiedUserId || null,
  };

  if (args.verifiedAuthUserEmail?.trim()) {
    insertPayload.email = args.verifiedAuthUserEmail.trim();
    insertPayload.email_opted_out = false;
  }

  let score: {
    id: string;
    slug?: string | null;
  } | null = null;
  let dbError: Error | null = null;
  let strippedAnticheatCols = false;

  for (let attempt = 0; attempt < 10; attempt++) {
    const slug = generatePourSlug(8);
    const result = await supabase
      .from("scores")
      .insert({ ...insertPayload, slug })
      .select("id, slug")
      .single();

    if (!result.error && result.data) {
      score = result.data;
      break;
    }

    const message = result.error?.message ?? "";
    const code = (result.error as { code?: string })?.code;
    if (code === "23505" && isImageHashUniqueViolation(message)) {
      return {
        success: false as const,
        error: "DUPLICATE_IMAGE",
        status: 400,
      };
    }
    if (code === "23505" || message.includes("unique") || message.includes("duplicate")) {
      continue;
    }
    if (
      !strippedAnticheatCols &&
      code === "42703" &&
      (message.includes("source_image_sha256") ||
        message.includes("ingest_ip") ||
        message.includes("submitter_user_id"))
    ) {
      strippedAnticheatCols = true;
      const {
        source_image_sha256: _sourceImageSha256,
        ingest_ip: _ingestIp,
        submitter_user_id: _submitterUserId,
        ...rest
      } = insertPayload;
      insertPayload = rest;
      continue;
    }
    if (code === "42703" || (message.includes("slug") && message.includes("does not exist"))) {
      break;
    }
    dbError = result.error as Error;
    break;
  }

  if (!score) {
    const result = await supabase
      .from("scores")
      .insert(insertPayload)
      .select("id")
      .single();
    if (!result.error && result.data) {
      score = result.data;
      dbError = null;
    } else if (result.error) {
      const message = result.error.message ?? "";
      const code = (result.error as { code?: string })?.code;
      if (code === "23505" && isImageHashUniqueViolation(message)) {
        return {
          success: false as const,
          error: "DUPLICATE_IMAGE",
          status: 400,
        };
      }
      if (
        !strippedAnticheatCols &&
        code === "42703" &&
        (message.includes("source_image_sha256") ||
          message.includes("ingest_ip") ||
          message.includes("submitter_user_id")) &&
        !dbError
      ) {
        strippedAnticheatCols = true;
        const {
          source_image_sha256: _sourceImageSha256,
          ingest_ip: _ingestIp,
          submitter_user_id: _submitterUserId,
          ...rest
        } = insertPayload;
        insertPayload = rest;
        const retry = await supabase
          .from("scores")
          .insert(rest)
          .select("id")
          .single();
        if (!retry.error && retry.data) {
          score = retry.data;
          dbError = null;
        } else if (retry.error && !dbError) {
          dbError = retry.error as Error;
        }
      } else if (!dbError) {
        dbError = result.error as Error;
      }
    }
  }

  if (dbError) throw dbError;
  if (!score) throw new Error("Failed to save score");
  return { success: true as const, score, sessionId: args.sessionId };
}

export async function handleHomePourAction({
  request,
  lang,
}: {
  request: Request;
  lang: SupportedLocale;
}) {
  try {
    const formData = await request.formData();
    const base64Image = formData.get("image") as string;
    const competitionRaw = formData.get("competition");
    const competitionId =
      typeof competitionRaw === "string" && UUID_RE.test(competitionRaw.trim())
        ? competitionRaw.trim()
        : "";
    const actorNameRaw = formData.get("actorName");
    const actorName =
      typeof actorNameRaw === "string" && actorNameRaw.trim()
        ? actorNameRaw.trim()
        : null;
    const clientFileLastModifiedRaw = formData.get("clientFileLastModifiedMs");
    const clientFileLastModifiedMs =
      typeof clientFileLastModifiedRaw === "string" &&
      Number.isFinite(Number(clientFileLastModifiedRaw))
        ? Number(clientFileLastModifiedRaw)
        : undefined;
    const { randomUUID } = await import("node:crypto");
    const [{ uploadImage }, { getLocationData }, { stripBase64ImagePayload }] =
      await Promise.all([
        import("~/utils/imageStorage"),
        import("~/utils/locationService"),
        import("~/utils/roboflowWorkflow"),
      ]);
    const sessionId = randomUUID();
    const clientIP = resolveClientIp(request);
    const roboflowServerKey = resolveRoboflowServerKey();

    if (typeof base64Image !== "string" || !base64Image.trim()) {
      return {
        success: false,
        error: "INVALID_IMAGE",
        status: 400,
      };
    }

    const imagePayload = stripBase64ImagePayload(base64Image);
    let imageBuf: Buffer;
    try {
      imageBuf = Buffer.from(imagePayload, "base64");
    } catch {
      return { success: false, error: "INVALID_IMAGE", status: 400 };
    }
    if (!imageBuf.length) {
      return { success: false, error: "INVALID_IMAGE", status: 400 };
    }

    const sessionFromCookie = readSessionCookie(request);
    const {
      getSupabaseAccessTokenFromRequestCookies,
      getSupabaseUserFromAccessToken,
      resolveLeaderboardUsernameForAuthUser,
    } = await import("~/utils/pour-auth-claim.server");

    const formAccessRaw = formData.get("accessToken");
    const formAccess =
      typeof formAccessRaw === "string" ? formAccessRaw.trim() : "";
    const authHeader = request.headers.get("authorization") ?? "";
    const bearer = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : "";
    const cookieAccess = getSupabaseAccessTokenFromRequestCookies(request);
    const accessToken = formAccess || bearer || cookieAccess;
    const verifiedAuthUser = accessToken
      ? await getSupabaseUserFromAccessToken(accessToken)
      : null;
    const verifiedUserId = verifiedAuthUser?.id ?? "";

    const {
      assertPourSubmissionRateAllowed,
      assertPourImageNotDuplicate,
      validatePourImageExifAge,
      sha256HexOfBuffer,
    } = await import("~/utils/pour-submission-guards.server");

    const sourceImageSha256 = sha256HexOfBuffer(imageBuf);
    const rateFail = await assertPourSubmissionRateAllowed(supabase, {
      ingestIp: clientIP,
      sessionIdFromCookie: sessionFromCookie,
      submitterUserId: verifiedUserId || undefined,
    });
    if (rateFail) {
      return {
        success: false,
        error: rateFail.code,
        status: 429,
      };
    }

    const dupFail = await assertPourImageNotDuplicate(supabase, sourceImageSha256);
    if (dupFail) {
      return {
        success: false,
        error: dupFail.code,
        status: 400,
      };
    }

    const exifFail = await validatePourImageExifAge(imageBuf, {
      clientFileLastModifiedMs,
    });
    if (exifFail) {
      return {
        success: false,
        error: exifFail.code,
        status: 400,
      };
    }

    const locationPromise = getLocationData(
      clientIP !== "unknown" ? clientIP : undefined,
      request.headers,
    );

    const analysisResult = await analyzePourImage(imagePayload, roboflowServerKey);
    if (!analysisResult.success) return analysisResult;

    const closeupUpload =
      analysisResult.gCloseupBase64 != null
        ? uploadImage(analysisResult.gCloseupBase64, "g-closeup-images").catch(
            (uploadError) => {
              console.error("G close-up upload failed:", uploadError);
              return null;
            },
          )
        : Promise.resolve(null);

    const [splitImageUrl, pintImageUrl, gCloseupImageUrl, locationData] =
      await Promise.all([
        uploadImage(analysisResult.splitImage, "split-images"),
        uploadImage(analysisResult.pintImage, "pint-images"),
        closeupUpload,
        locationPromise,
      ]);

    const rowUsername = verifiedAuthUser
      ? await resolveLeaderboardUsernameForAuthUser(verifiedAuthUser, supabase)
      : generateBeerUsername();

    const persisted = await persistScoreRecord({
      splitScore: analysisResult.splitScore,
      splitImageUrl,
      pintImageUrl,
      gCloseupImageUrl,
      rowUsername,
      sessionId,
      locationData,
      sourceImageSha256,
      clientIP,
      verifiedUserId,
      verifiedAuthUserEmail: verifiedAuthUser?.email?.trim() ?? null,
    });
    if (!persisted.success) return persisted;

    const headers = new Headers();
    headers.append(
      "Set-Cookie",
      `split-g-session=${sessionId}; Path=/; Max-Age=31536000; SameSite=Lax`,
    );

    const path = scorePourPath(persisted.score);
    const localized = localizePath(path, lang);
    const destination = competitionId
      ? `${localized}${localized.includes("?") ? "&" : "?"}competition=${encodeURIComponent(competitionId)}`
      : localized;

    if (verifiedUserId) {
      const notifyName =
        (typeof actorName === "string" && actorName.trim()
          ? actorName.trim()
          : null) ?? rowUsername;
      void sendFriendSplitNotifications({
        actorUserId: verifiedUserId,
        actorName: notifyName,
        score: analysisResult.splitScore,
        path: localized,
      }).catch((error) => console.error("sendFriendSplitNotifications:", error));
    }

    if (persisted.score.id) {
      void sendKnockedOutTop10NotificationForNewScore({
        newScoreId: persisted.score.id,
        scorePath: localized,
      }).catch((error) =>
        console.error("sendKnockedOutTop10NotificationForNewScore:", error),
      );
    }

    return Response.json(
      {
        success: true,
        redirectTo: destination,
        scoreId: persisted.score.id,
      },
      { headers },
    );
  } catch (error) {
    console.error("Error processing image:", error);
    const detail =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "Unknown error occurred";

    let code = "PROCESS_FAILED";
    if (error instanceof Error && error.name === "AbortError") {
      code = "ANALYSIS_TIMEOUT";
    } else if (/Roboflow workflow failed|API request failed/i.test(detail)) {
      code = "ROBOFLOW_FAILED";
    } else if (/timeout|timed out|ETIMEDOUT|TIMEOUT/i.test(detail)) {
      code = "ANALYSIS_TIMEOUT";
    }

    return {
      success: false,
      error: code,
      detail,
      status: code === "ANALYSIS_TIMEOUT" ? 504 : 500,
    };
  }
}
