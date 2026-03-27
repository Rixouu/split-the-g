/**
 * Roboflow Serverless Hosted API (v2) — predefined workflows.
 * @see https://docs.roboflow.com/deploy/serverless-hosted-api-v2/use-with-the-rest-api
 */

export interface RoboflowServerlessConfig {
  apiUrl: string;
  workspace: string;
  workflowId: string;
  apiKey: string;
  /** Full POST URL from Deploy → Workflow (overrides apiUrl + workspace + workflowId). */
  inferUrlOverride?: string;
  /** Optional pinned workflow version from Roboflow. */
  workflowVersionId?: string;
}

/**
 * Roboflow uses different paths per host:
 * - `detect.roboflow.com` → `POST /infer/workflows/{workspace}/{workflow_id}`
 * - `serverless.roboflow.com` → `POST /{workspace}/workflows/{workflow_id}`
 * Copy the host shown in your Deploy snippet.
 */
export function buildWorkflowInferUrl(
  apiUrl: string,
  workspace: string,
  workflowId: string,
): string {
  const base = apiUrl.replace(/\/$/, "");
  const ws = encodeURIComponent(workspace.trim());
  const wf = encodeURIComponent(workflowId.trim());
  if (/detect\.roboflow\.com/i.test(base)) {
    return `${base}/infer/workflows/${ws}/${wf}`;
  }
  return `${base}/${ws}/workflows/${wf}`;
}

interface LoosePred {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  class: string;
}

interface ExtractedDetections {
  predictions: LoosePred[];
  image: { width: number; height: number };
}

export function stripBase64ImagePayload(raw: string): string {
  const m = raw.match(/^data:image\/[^;]+;base64,(.+)$/);
  return m ? m[1]! : raw;
}

export async function runServerlessWorkflow(
  config: RoboflowServerlessConfig,
  base64Image: string,
): Promise<unknown> {
  const trimmedOverride = config.inferUrlOverride?.trim();
  const primaryUrl =
    trimmedOverride ||
    buildWorkflowInferUrl(config.apiUrl, config.workspace, config.workflowId);
  const payload = stripBase64ImagePayload(base64Image);

  const body: Record<string, unknown> = {
    api_key: config.apiKey,
    inputs: {
      image: { type: "base64", value: payload },
    },
    use_cache: false,
  };
  if (config.workflowVersionId?.trim()) {
    body.workflow_version_id = config.workflowVersionId.trim();
  }

  const bodyJson = JSON.stringify(body);
  const attempted: string[] = [];

  async function post(url: string) {
    attempted.push(url);
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: bodyJson,
    });
  }

  let res = await post(primaryUrl);

  // Many Deploy snippets use detect.roboflow.com; serverless often 404s for the same workspace/workflow.
  if (
    res.status === 404 &&
    !trimmedOverride &&
    /serverless\.roboflow\.com/i.test(config.apiUrl)
  ) {
    const fallbackUrl = buildWorkflowInferUrl(
      "https://detect.roboflow.com",
      config.workspace,
      config.workflowId,
    );
    res = await post(fallbackUrl);
  }

  if (!res.ok) {
    const text = await res.text();
    const hint404 =
      res.status === 404
        ? ` Tried: ${attempted.join(" → ")}. Confirm workspace + workflow id in Roboflow → Deploy, or set VITE_ROBOFLOW_WORKFLOW_INFER_URL to the exact POST URL.`
        : "";
    throw new Error(`Roboflow workflow failed (${res.status}): ${text}${hint404}`);
  }

  return res.json();
}

function tryExtractInferenceShape(obj: unknown): ExtractedDetections | null {
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;

  if (
    Array.isArray(o.predictions) &&
    o.image &&
    typeof o.image === "object" &&
    !Array.isArray(o.image)
  ) {
    const img = o.image as Record<string, unknown>;
    if (typeof img.width === "number" && typeof img.height === "number") {
      return {
        predictions: o.predictions as LoosePred[],
        image: { width: img.width, height: img.height },
      };
    }
  }

  if (o.predictions && typeof o.predictions === "object" && !Array.isArray(o.predictions)) {
    const inner = o.predictions as Record<string, unknown>;
    if (
      Array.isArray(inner.predictions) &&
      inner.image &&
      typeof inner.image === "object" &&
      !Array.isArray(inner.image)
    ) {
      const img = inner.image as Record<string, unknown>;
      if (typeof img.width === "number" && typeof img.height === "number") {
        return {
          predictions: inner.predictions as LoosePred[],
          image: { width: img.width, height: img.height },
        };
      }
    }
  }

  return null;
}

function walkForDetections(node: unknown, depth = 0): ExtractedDetections | null {
  if (depth > 8 || node == null) return null;

  const direct = tryExtractInferenceShape(node);
  if (direct) return direct;

  if (typeof node !== "object") return null;

  for (const v of Object.values(node as Record<string, unknown>)) {
    const found = walkForDetections(v, depth + 1);
    if (found) return found;
  }
  return null;
}

export function extractDetectionsFromWorkflow(
  result: unknown,
): ExtractedDetections | null {
  if (!result || typeof result !== "object") return null;
  const outputs = (result as { outputs?: unknown[] }).outputs;
  if (!Array.isArray(outputs) || outputs.length === 0) return null;
  const first = outputs[0];
  if (!first || typeof first !== "object") return null;
  return walkForDetections(first, 0);
}

function walkForVisualization(node: unknown, depth = 0): string | null {
  if (depth > 8 || node == null) return null;
  if (typeof node === "object" && !Array.isArray(node)) {
    const o = node as Record<string, unknown>;
    if (typeof o.visualization === "string" && o.visualization.length > 100) {
      return o.visualization;
    }
    for (const v of Object.values(o)) {
      const vis = walkForVisualization(v, depth + 1);
      if (vis) return vis;
    }
  }
  return null;
}

export function extractVisualizationBase64(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const outputs = (result as { outputs?: unknown[] }).outputs;
  if (!Array.isArray(outputs) || outputs.length === 0) return null;
  const first = outputs[0];
  if (!first || typeof first !== "object") return null;
  return walkForVisualization(first, 0);
}

interface ImageSearchMatch {
  value: string;
  priority: number;
}

function coerceBase64Image(value: unknown): string | null {
  if (typeof value === "string" && value.length > 100) return value;

  if (Array.isArray(value)) {
    for (const item of value) {
      const coerced = coerceBase64Image(item);
      if (coerced) return coerced;
    }
    return null;
  }

  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  if (typeof record.value === "string" && record.value.length > 100) {
    return record.value;
  }
  if (typeof record.image === "string" && record.image.length > 100) {
    return record.image;
  }
  if (typeof record.visualization === "string" && record.visualization.length > 100) {
    return record.visualization;
  }

  return null;
}

function findImageInNode(node: unknown): string | null {
  if (!node || typeof node !== "object" || Array.isArray(node)) return null;
  const o = node as Record<string, unknown>;
  const image = coerceBase64Image(o.image);
  if (image) return image;
  const visualization = coerceBase64Image(o.visualization);
  if (visualization) return visualization;
  return null;
}

function walkForPreferredImages(
  node: unknown,
  preferredStepNames: string[],
  path: string[] = [],
  depth = 0,
): ImageSearchMatch | null {
  if (depth > 10 || !node || typeof node !== "object" || Array.isArray(node)) {
    return null;
  }

  const preferred = new Set(preferredStepNames.map((name) => name.toLowerCase()));
  let best: ImageSearchMatch | null = null;
  const current = node as Record<string, unknown>;

  for (const [key, value] of Object.entries(current)) {
    const keyLower = key.toLowerCase();
    const nextPath = [...path, key];
    const directImage = findImageInNode(value);
    const isPreferredKey = preferred.has(keyLower);

    if (
      isPreferredKey &&
      typeof value === "string" &&
      value.length > 100
    ) {
      return { value, priority: 1000 };
    }

    if (isPreferredKey && directImage) {
      return { value: directImage, priority: 1000 };
    }

    if (
      typeof value === "string" &&
      value.length > 100 &&
      (keyLower.includes("image") || keyLower.includes("visual"))
    ) {
      const candidate: ImageSearchMatch = { value, priority: 80 };
      if (!best || candidate.priority > best.priority) {
        best = candidate;
      }
    }

    if (directImage) {
      const hitsPreferredPath = nextPath.some((segment) =>
        preferred.has(segment.toLowerCase()),
      );
      const candidate: ImageSearchMatch = {
        value: directImage,
        priority: hitsPreferredPath ? 100 : 1,
      };
      if (!best || candidate.priority > best.priority) {
        best = candidate;
      }
    }

    const nested = walkForPreferredImages(value, preferredStepNames, nextPath, depth + 1);
    if (nested && (!best || nested.priority > best.priority)) {
      best = nested;
      if (best.priority >= 1000) return best;
    }
  }

  return best;
}

export function extractPreferredWorkflowImageBase64(
  result: unknown,
  preferredStepNames: string[],
): string | null {
  if (!result || typeof result !== "object") return null;
  const outputs = (result as { outputs?: unknown[] }).outputs;
  if (!Array.isArray(outputs) || outputs.length === 0) return null;
  const first = outputs[0];
  if (!first || typeof first !== "object") return null;

  const preferredMatch = walkForPreferredImages(first, preferredStepNames);
  if (preferredMatch?.value) return preferredMatch.value;

  return walkForVisualization(first, 0);
}

export function extractWorkflowOutputImageByNames(
  result: unknown,
  outputNames: string[],
): string | null {
  if (!result || typeof result !== "object") return null;
  const outputs = (result as { outputs?: unknown[] }).outputs;
  if (!Array.isArray(outputs) || outputs.length === 0) return null;
  const first = outputs[0];
  if (!first || typeof first !== "object") return null;

  const outputRecord = first as Record<string, unknown>;
  for (const outputName of outputNames) {
    const direct = coerceBase64Image(outputRecord[outputName]);
    if (direct) return direct;
  }

  return null;
}

function normalizeClassLabel(c: string): string {
  const t = String(c).trim();
  if (t.toLowerCase() === "beer") return "beer";
  if (t.toLowerCase() === "g") return "G";
  return t;
}

/**
 * Shapes workflow detections into the structure expected by `calculateScore` in scoring.ts.
 */
export function toLegacyScoringOutputs(extracted: ExtractedDetections) {
  const normalized = extracted.predictions.map((p) => ({
    ...p,
    class: normalizeClassLabel(p.class),
  }));

  return {
    "pint results": {
      predictions: {
        predictions: normalized,
        image: extracted.image,
      },
    },
    "split results": [
      {
        predictions: {
          predictions: [] as typeof normalized,
          image: extracted.image,
        },
      },
    ],
  };
}

export function predictionsIncludeClass(
  extracted: ExtractedDetections,
  className: string,
): boolean {
  const target = className === "G" ? "G" : className.toLowerCase();
  return extracted.predictions.some((p) => {
    const c = normalizeClassLabel(p.class);
    if (target === "G") return c === "G";
    return c.toLowerCase() === target;
  });
}
