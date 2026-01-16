// services/cloudRunService.ts

export type PassportCount = 1 | 2 | 4 | 6 | 8;
export type PaperSize = '10x15';

export interface GeneratePassportRequest {
  imageUrl: string;
  count: PassportCount;
  paperSize?: PaperSize;
  marginMm?: number;
  userId: string;
}

export interface GeneratePassportResponse {
  success: boolean;
  downloadUrl: string;
  originalImageDeleted: boolean;
  metadata: {
    count: number;
    paperSize: string;
    marginMm: number;
    generatedAt: string;
    processingTimeMs: number;
  };
}

export interface CloudRunError {
  error: string;
  message: string;
  code?: string;
}

// Update these based on your Firebase project region
const FIREBASE_PROJECT_ID = 'plot-9fd6e';
const FIREBASE_REGION = 'africa-south1';

// Cloud Function endpoint URL
const FUNCTION_URL = `https://${FIREBASE_REGION}-${FIREBASE_PROJECT_ID}.cloudfunctions.net/generatePassport`;
const HEALTH_CHECK_URL = `https://${FIREBASE_REGION}-${FIREBASE_PROJECT_ID}.cloudfunctions.net/healthCheck`;

/**
 * Generate passport photo tiles via Cloud Functions
 * @param request - The generation request parameters
 * @returns Response containing the download URL for the generated passport tiles
 */
export const generatePassportTiles = async (
  request: GeneratePassportRequest
): Promise<GeneratePassportResponse> => {
  try {
    console.log('[Cloud Functions] Generating passport tiles:', {
      endpoint: FUNCTION_URL,
      request: {
        imageUrl: request.imageUrl,
        count: request.count,
        paperSize: request.paperSize || '10x15',
        marginMm: request.marginMm || 2,
        userId: request.userId,
      },
    });

    const startTime = Date.now();

    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        imageUrl: request.imageUrl,
        count: request.count,
        paperSize: request.paperSize || '10x15',
        marginMm: request.marginMm || 2,
        userId: request.userId,
      }),
    });

    const processingTimeMs = Date.now() - startTime;

    if (!response.ok) {
      let errorData: CloudRunError;
      
      try {
        errorData = await response.json();
      } catch {
        errorData = {
          error: 'Unknown Error',
          message: `Request failed with status ${response.status}: ${response.statusText}`,
        };
      }
      
      console.error('[Cloud Functions] Request failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
      });
      
      throw new Error(errorData.message || `Cloud Function request failed: ${response.statusText}`);
    }

    const data: GeneratePassportResponse = await response.json();

    console.log('[Cloud Functions] Generation successful:', {
      downloadUrl: data.downloadUrl,
      metadata: data.metadata,
      clientProcessingTimeMs: processingTimeMs,
    });

    return data;
  } catch (error) {
    console.error('[Cloud Functions] Generation failed:', error);
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Network error: Unable to connect to the passport generation service. Please check your internet connection.');
    }
    
    throw new Error(
      error instanceof Error 
        ? error.message 
        : 'Failed to generate passport tiles. Please try again.'
    );
  }
};

/**
 * Check the health status of the Cloud Function
 * @returns True if the service is healthy
 */
export const checkServiceHealth = async (): Promise<boolean> => {
  try {
    console.log('[Cloud Functions] Checking service health');

    const response = await fetch(HEALTH_CHECK_URL, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    const isHealthy = response.ok;

    console.log('[Cloud Functions] Health check result:', {
      status: response.status,
      isHealthy,
    });

    return isHealthy;
  } catch (error) {
    console.error('[Cloud Functions] Health check failed:', error);
    return false;
  }
};