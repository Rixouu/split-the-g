import { useEffect, useRef, useState } from "react";
import { useNavigate, useSubmit, useActionData, redirect } from "react-router";
import { RoboflowLogo } from "../components/RoboflowLogo";
import { PintGlassOverlay } from "../components/PintGlassOverlay";
import type { ActionFunctionArgs } from "react-router";
import { calculateScore, calculateScoreFromPredictions } from "~/utils/scoring";
import { uploadImage } from "~/utils/imageStorage";
import { supabase } from "~/utils/supabase";
import { LeaderboardButton } from "../components/LeaderboardButton";
import { SubmissionsButton } from "../components/SubmissionsButton";
import { generateBeerUsername } from "~/utils/usernameGenerator";
import { getLocationData } from "~/utils/locationService";
import { CountryLeaderboardButton } from "../components/CountryLeaderboard";

const isClient = typeof window !== "undefined";

// Generate a UUID that works in both Node.js and browser environments
function generateUUID() {
  // On the server (Node.js)
  if (typeof window === 'undefined') {
    try {
      const { randomUUID } = require('crypto');
      return randomUUID();
    } catch (e) {
      console.error("Failed to use Node crypto", e);
    }
  }
  
  // In the browser or fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
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

export async function action({ request }: ActionFunctionArgs) {
  try {
    const formData = await request.formData();
    const base64Image = formData.get("image") as string;
    const bypassFlag = formData.get("bypass");
    
    if (!base64Image) {
      console.error("No image data found in form submission");
      return {
        success: false,
        error: "Missing image data",
        message: "No image was provided",
        status: 400,
      };
    }
    
    const username = generateBeerUsername();
    const sessionId = generateUUID();

    console.log("Processing image submission...");
    console.log("Headers:", Object.fromEntries(request.headers.entries()));
    console.log("Bypass flag present:", !!bypassFlag);

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

    console.log("Detected client IP:", clientIP);
    
    // Check for the bypass flag - if present, skip API processing
    let predictions: any[] = [];
    if (bypassFlag) {
      console.log("Bypass flag is set - skipping API processing");
    } else {
      // Check for Roboflow API key
      if (!process.env.ROBOFLOW_API_KEY) {
        console.error("Missing Roboflow API key in environment variables");
        return {
          success: false,
          error: "Configuration error",
          message: "The application is missing required API keys. Please check the .env file.",
          status: 500,
        };
      }

      // Make API request if not bypassed
      console.log("Making API request to Roboflow...");
      try {
        const response = await fetch(
          // Use the correct API endpoint with project and version
          "https://detect.roboflow.com/split-g/1",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${process.env.ROBOFLOW_API_KEY}`
            },
            body: JSON.stringify({
              image: base64Image,
              confidence: 5, // Lower confidence threshold to 5%
              overlap: 30, // Lower overlap threshold
              labels: true // Get labels in the response
            }),
          }
        );

        console.log("Roboflow API Response Status:", response.status);
        
        if (!response.ok) {
          console.error(`API request failed (${response.status}): ${await response.text()}`);
          // Continue anyway even if the API fails
        } else {
          const result = await response.json();
          console.log("Received API response:", JSON.stringify(result, null, 2));
          
          if (result.predictions) {
            predictions = result.predictions;
            console.log(`Found ${predictions.length} predictions`);
          } else {
            console.log("No predictions in API response");
          }
        }
      } catch (apiError) {
        console.error("API request error:", apiError);
        // Continue anyway even if the API fails
      }
    }

    // For standard Roboflow API, the response format is different
    // Check if we have predictions
    if (predictions.length === 0) {
      console.log("No predictions in API response - using default score anyway");
      // Continue with the process instead of returning an error
    }

    // Since we're using the standard API, we need to process the image differently
    try {
      // Calculate score based on predictions when available
      let score;
      
      if (predictions && predictions.length > 0) {
        // Use the scoring function with real predictions
        score = calculateScoreFromPredictions(predictions);
        console.log(`Using calculated score from predictions: ${score}`);
      } else if (bypassFlag) {
        // Only if explicitly bypassed with the continue anyway button
        score = 3.5;
        console.log("Using bypass default score: 3.5");
      } else {
        // If no predictions but not explicitly bypassed, try with a lower score
        score = 2.0;
        console.log("No predictions found, using minimal score: 2.0");
      }
      
      // We won't have split images from the standard API, so we'll use the original image
      console.log("Uploading image to Supabase storage...");
      let splitImageUrl = "";
      let pintImageUrl = "";
      
      try {
        splitImageUrl = await uploadImage(base64Image, "split-images");
        pintImageUrl = splitImageUrl; // Use the same image for both
        console.log("Image uploaded successfully:", splitImageUrl);
      } catch (uploadError) {
        console.error("Image upload failed:", uploadError);
        // Continue with empty URLs if upload fails
        splitImageUrl = "";
        pintImageUrl = "";
      }

      // Get location data with client IP
      console.log("Getting location data for IP:", clientIP);
      const locationData = await getLocationData(clientIP);
      console.log("Location data:", JSON.stringify(locationData));

      // Create database record with session_id and location
      console.log("Inserting record into Supabase...");
      const { data: scoreData, error: dbError } = await supabase
        .from("scores")
        .insert({
          split_score: score,
          split_image_url: splitImageUrl,
          pint_image_url: pintImageUrl,
          username: username,
          created_at: new Date().toISOString(),
          session_id: sessionId,
          city: locationData.city,
          region: locationData.region,
          country: locationData.country,
          country_code: locationData.country_code,
        })
        .select()
        .single();

      if (dbError) {
        console.error("Database error:", dbError);
        throw dbError;
      }
      
      console.log("Database record created:", scoreData);

      // Set the session cookie before redirecting
      const headers = new Headers();
      headers.append(
        "Set-Cookie",
        `split-g-session=${sessionId}; Path=/; Max-Age=31536000; SameSite=Lax`
      );
      
      console.log("Redirecting to score page...");

      // Redirect to the score page with the ID
      return redirect(`/score/${scoreData.id}`, {
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
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const submit = useSubmit();
  const actionData = useActionData<typeof action>();

  // Use type any for the inference engine
  const [inferEngine, setInferEngine] = useState<any>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    async function initInference() {
      // @ts-ignore - Ignoring type issues with inferencejs library
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
        "split-g-label-experiment",
        "8",
        "rf_KknWyvJ8ONXATuszsdUEuknA86p2"
      )
      // Use a type annotation for the parameter
      .then((id: string) => setModelWorkerId(id));
  }, [inferEngine, modelLoading]);

  const [isVideoReady, setIsVideoReady] = useState(false);

  // Add effect to handle camera initialization
  useEffect(() => {
    if (!isCameraActive || !videoRef.current) return;

    const constraints = {
      video: {
        facingMode: { ideal: "environment" },
        width: 720,
        height: 960,
      },
    };

    navigator.mediaDevices
      .getUserMedia(constraints)
      .then((stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      })
      .catch((err) => {
        console.error("Camera error:", err);
        setIsCameraActive(false);
      });
  }, [isCameraActive]);

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
        // @ts-ignore - Ignoring type issues with inferencejs library
        const { CVImage } = await import("inferencejs");
        const img = new CVImage(videoRef.current);
        const predictions = await inferEngine.infer(modelWorkerId, img);

        // Use any type for inferencejs predictions
        const hasGlass = predictions.some((pred: any) => pred.class === "glass");
        const hasG = predictions.some((pred: any) => pred.class === "G");

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

              // Stop the camera stream
              const stream = videoRef.current.srcObject as MediaStream;
              stream?.getTracks().forEach((track) => track.stop());
              setIsCameraActive(false);

              // Submit form data to action
              const formData = new FormData();
              formData.append("image", base64Image);

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
  ]);

  // Update the effect that handles action response
  useEffect(() => {
    if (actionData) {
      setIsUploadProcessing(false);
      setIsSubmitting(false);

      if (!actionData.success) {
        // Check for specific error types
        if (actionData.error === "No G detected") {
          // Show the No G modal for this specific error
          setShowNoGModal(true);
        } else if (actionData.status === 400) {
          // Handle client-side errors with more specific messaging
          alert(`Please check your image: ${actionData.message}`);
        } else if (actionData.status === 500) {
          // Handle server errors
          console.error('Server error:', actionData.error);
          alert(`Server error: ${actionData.message}. Please try again.`);
        } else {
          // Generic error handler
          console.error('Action error:', actionData);
          alert(`Error: ${actionData.message || 'Failed to process image'}`);
        }
      }
    }
  }, [actionData]);

  // Update the handleFileChange function
  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      console.log(`Processing file: ${file.name}, ${file.type}, ${file.size} bytes`);
      setIsUploadProcessing(true);
      const reader = new FileReader();

      reader.onloadend = () => {
        try {
          const base64String = reader.result?.toString();
          if (!base64String) {
            throw new Error("Failed to read file as base64");
          }
          
          console.log(`Read file as base64, length: ${base64String.length} chars`);
          
          // Remove data URI prefix if present
          const base64Image = base64String.replace(/^data:image\/\w+;base64,/, "");
          console.log(`Stripped base64 prefix, new length: ${base64Image.length} chars`);
          
          // Save the base64 image for potential retry
          setCapturedImage(base64Image);
          
          // Create form data for submission
          const formData = new FormData();
          formData.append("image", base64Image);
          
          console.log("Submitting image data to server...");
          
          submit(formData, {
            method: "post",
            action: "/?index",
            encType: "multipart/form-data",
          });
        } catch (error) {
          console.error("Error processing loaded file:", error);
          setIsUploadProcessing(false);
          alert("Failed to process image. Please try again.");
        }
      };
      
      reader.onerror = (error) => {
        console.error("FileReader error:", error);
        setIsUploadProcessing(false);
        alert("Failed to read image file. Please try again.");
      };
      
      console.log("Starting file read as data URL...");
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Error in file selection:", error);
      setIsUploadProcessing(false);
      alert("An error occurred. Please try again.");
    }
  };

  return (
    <main className="flex items-center justify-center min-h-screen bg-gradient-to-b from-guinness-black via-[#0a0a0a] to-[#121212] text-guinness-cream">
      {isUploadProcessing && (
        <div className="fixed inset-0 bg-guinness-black/95 flex flex-col items-center justify-center gap-6 z-50 backdrop-blur-sm">
          <div className="w-24 h-24 border-4 border-guinness-gold/20 border-t-guinness-gold rounded-full animate-spin"></div>
          <p className="text-guinness-gold text-xl font-medium">
            Processing your image...
          </p>
          <p className="text-guinness-tan text-sm">
            This will just take a moment
          </p>
        </div>
      )}

      {isSubmitting ? (
        <div className="fixed inset-0 bg-guinness-black/95 flex flex-col items-center justify-center gap-6 z-50 backdrop-blur-sm">
          <div className="w-24 h-24 border-4 border-guinness-gold/20 border-t-guinness-gold rounded-full animate-spin"></div>
          <p className="text-guinness-gold text-xl font-medium">
            Analyzing your split...
          </p>
          <p className="text-guinness-tan text-sm">
            This will just take a moment
          </p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center gap-8 p-4 max-w-2xl mx-auto">
          <header className="flex flex-col items-center gap-4 md:gap-6 text-center px-2 md:px-4 animate-fade-in">
            <h1 className="text-4xl md:text-6xl font-bold text-guinness-gold tracking-wide">
              Split the G
            </h1>
            <div className="w-32 md:w-40 h-0.5 bg-gradient-to-r from-transparent via-guinness-gold/80 to-transparent my-1 md:my-2"></div>
            <p className="text-base md:text-xl text-guinness-tan font-light max-w-[280px] md:max-w-md mx-auto">
              Put your Guinness splitting technique to the test!
            </p>
            <div className="flex flex-wrap justify-center gap-3 md:gap-5 w-full px-2 mt-2">
              <LeaderboardButton />
              <SubmissionsButton />
              <CountryLeaderboardButton />
            </div>
          </header>

          <div className="w-full max-w-md flex flex-col gap-4 transition-all duration-500">
            {isCameraActive && (
              <div className="px-8 py-4 bg-guinness-black/80 backdrop-blur-sm border border-guinness-gold/30 text-guinness-gold rounded-2xl shadow-lg animate-fade-in">
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
                    <span className="font-medium tracking-wide">
                      {feedbackMessage}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center">
                    <span className="font-medium tracking-wide">
                      {feedbackMessage}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="aspect-[3/4] bg-guinness-brown/40 rounded-xl overflow-hidden border border-guinness-gold/30 shadow-xl shadow-black/40 relative transition-all duration-300 hover:shadow-guinness-gold/10 hover:border-guinness-gold/40">
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
                  <div className="absolute inset-0 bg-gradient-to-b from-guinness-black/20 to-guinness-black/60"></div>
                  <button
                    onClick={() => setIsCameraActive(true)}
                    className="w-full h-full flex flex-col items-center justify-center gap-4 text-guinness-gold hover:text-guinness-tan transition-colors duration-300 relative z-10 group"
                  >
                    <div className="p-6 rounded-full bg-guinness-gold/10 border border-guinness-gold/30 transition-all duration-300 group-hover:bg-guinness-gold/20 group-hover:scale-105">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-16 md:h-20 w-16 md:w-20"
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
                    </div>
                    <span className="text-xl md:text-2xl font-medium">
                      Start Analysis
                    </span>
                  </button>
                </>
              )}
            </div>
          </div>

          <button
            onClick={() => document.getElementById("file-upload")?.click()}
            className="w-3/4 mt-4 py-3 px-4 bg-guinness-gold text-guinness-black rounded-lg hover:bg-guinness-tan transition-all duration-300 font-semibold shadow-lg transform hover:scale-105 active:scale-95"
            aria-label="Upload an image"
          >
            Upload an Image
          </button>
          <input
            id="file-upload"
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
            aria-label="Upload image file input"
            title="Choose a file to upload"
          />

          <div className="mt-8 text-guinness-tan text-sm bg-guinness-black/40 p-6 rounded-xl border border-guinness-gold/20 backdrop-blur-sm">
            <h2 className="text-lg font-bold text-guinness-gold">
              How to enter the Split the G contest:
            </h2>
            <p>Follow the below steps before 11:59pm PST March 17, 2025.</p>
            <ol className="list-decimal list-inside mt-2 space-y-2">
              <li>
                <strong>Receive a score</strong>: Hit the{" "}
                <strong>Start Analysis</strong> button on the website, aim your
                camera at the pint glass to capture an image, and let the
                website generate your score (the closer you are to the middle of
                the G logo, the better the score).
              </li>
              <li>
                <strong>Submit your score</strong>: Hit the{" "}
                <strong>Submit score</strong> button to submit your score to the
                leaderboard, fill out your contact information, and hit the{" "}
                <strong>Enter the contest</strong> button.
              </li>
              <li>
                <strong>All done!</strong>
              </li>
            </ol>

            <h2 className="text-lg font-bold mt-6 text-guinness-gold">Contest Rules:</h2>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>
                Entry Period: Contest begins January 1, 2025 and ends 11:59pm
                PST March 17, 2025.
              </li>
              <li>Prize: Commemorative item!</li>
              <li>
                Winner Selection: The winner will be randomly selected from all
                eligible entries.
              </li>
              <li>Eligibility: Must submit email to enter.</li>
              <li>
                Winner Notification: The winner will be notified via the email
                provided upon submission within 10 business days of the contest
                end date.
              </li>
              <li>
                No Purchase Necessary: Entering the contest does not require any
                purchase.
              </li>
              <li>
                Multiple Entries: Multiple entries are allowed, but each entry
                must be submitted separately.
              </li>
              <li>
                Disqualification: Any attempt to manipulate the contest or
                submit fraudulent entries will result in disqualification.
              </li>
              <li>
                Privacy: Your email and personal information will be used solely
                for the purpose of this contest and will not be shared with
                third parties.
              </li>
              <li>
                Acceptance of Rules: By entering the contest, you agree to abide
                by these rules and the decisions of the contest organizers.
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* Add the No G Modal */}
      {showNoGModal && (
        <div className="fixed inset-0 bg-guinness-black/95 flex items-center justify-center z-50 backdrop-blur-md animate-fade-in">
          <div className="bg-guinness-black border border-guinness-gold/30 rounded-xl p-8 max-w-sm w-full mx-4 text-center shadow-2xl animate-scale-in">
            <h3 className="text-2xl font-bold text-guinness-gold mb-4">
              No G Pattern Found
            </h3>
            <p className="text-guinness-tan mb-6">
              We couldn't detect a clear Guinness G pattern in your image. You can:
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  setShowNoGModal(false);
                  // Get the last uploaded image and submit with bypass
                  if (capturedImage) {
                    const formData = new FormData();
                    formData.append("image", capturedImage);
                    formData.append("bypass", "true");
                    submit(formData, {
                      method: "post",
                      action: "/?index",
                      encType: "multipart/form-data",
                    });
                  }
                }}
                className="px-6 py-3 bg-guinness-gold text-guinness-black rounded-lg hover:bg-guinness-tan transition-all duration-300 font-semibold transform hover:scale-105 active:scale-95"
              >
                Continue With Lower Score
              </button>
              <button
                onClick={() => setShowNoGModal(false)}
                className="px-6 py-3 border border-guinness-gold/50 text-guinness-gold rounded-lg hover:bg-guinness-black/50 transition-all duration-300 font-semibold"
              >
                Take Another Photo
              </button>
            </div>
            <div className="mt-4 text-xs text-guinness-tan/70">
              <p>For the best score, ensure the G pattern is clearly visible and centered in your Guinness.</p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
