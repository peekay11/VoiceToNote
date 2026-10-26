// Talks directly to the AWS Cognito REST API for sign up, sign in, and token refresh.
// No AWS SDK needed — just plain fetch calls with the right headers.

const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID || "";
const REGION = import.meta.env.VITE_AWS_REGION || "us-east-1";
const COGNITO_URL = `https://cognito-idp.${REGION}.amazonaws.com/`;

// Shape of a successful Cognito auth response
interface CognitoTokens {
  AccessToken: string;
  IdToken: string;
  RefreshToken: string;
}

interface CognitoResponse {
  AuthenticationResult?: CognitoTokens;
  UserSub?: string;
  message?: string;
  __type?: string;
}

// Sends a request to Cognito. `target` is the Cognito action name (e.g. "SignUp").
async function cognitoRequest(
  target: string,
  payload: Record<string, unknown>
): Promise<CognitoResponse> {
  // No client ID means we're running locally without .env — return mock tokens
  if (!CLIENT_ID) {
    if (target === "InitiateAuth") {
      return {
        AuthenticationResult: {
          AccessToken: "mock-access-token",
          IdToken: "mock-id-token",
          RefreshToken: "mock-refresh-token",
        },
      };
    }
    return { UserSub: "mock-sub" };
  }

  const response = await fetch(COGNITO_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Target": `AWSCognitoIdentityProviderService.${target}`,
    },
    body: JSON.stringify(payload),
  });

  const data: CognitoResponse = await response.json();

  if (!response.ok) {
    throw new Error(data.message || data.__type || "Cognito request failed");
  }

  return data;
}

// Creates a new user account. Cognito sends a verification email automatically.
export async function signUp(email: string, password: string) {
  return cognitoRequest("SignUp", {
    ClientId: CLIENT_ID,
    Username: email,
    Password: password,
    UserAttributes: [{ Name: "email", Value: email }],
  });
}

// Verifies the email using the 6-digit code Cognito sent after sign up.
export async function confirmSignUp(email: string, verificationCode: string) {
  return cognitoRequest("ConfirmSignUp", {
    ClientId: CLIENT_ID,
    Username: email,
    ConfirmationCode: verificationCode,
  });
}

// Signs the user in and returns three tokens: access, id, and refresh.
export async function signIn(email: string, password: string) {
  const response = await cognitoRequest("InitiateAuth", {
    AuthFlow: "USER_PASSWORD_AUTH",
    ClientId: CLIENT_ID,
    AuthParameters: {
      USERNAME: email,
      PASSWORD: password,
    },
  });

  return {
    accessToken: response.AuthenticationResult?.AccessToken || "",
    idToken: response.AuthenticationResult?.IdToken || "",
    refreshToken: response.AuthenticationResult?.RefreshToken || "",
  };
}

// Uses the refresh token to get a new access + id token when the current ones expire.
// Cognito ID tokens expire after 1 hour by default.
export async function refreshSession(
  refreshToken: string
): Promise<{ accessToken: string; idToken: string }> {
  // Skip real network call for mock tokens (local dev without .env)
  if (!CLIENT_ID || refreshToken === "mock-refresh-token") {
    return { accessToken: "mock-access-token", idToken: "mock-id-token" };
  }

  const response = await cognitoRequest("InitiateAuth", {
    AuthFlow: "REFRESH_TOKEN_AUTH",
    ClientId: CLIENT_ID,
    AuthParameters: { REFRESH_TOKEN: refreshToken },
  });

  const accessToken = response.AuthenticationResult?.AccessToken;
  const idToken = response.AuthenticationResult?.IdToken;

  if (!accessToken || !idToken) {
    throw new Error("Token refresh failed — tokens missing in Cognito response");
  }

  return { accessToken, idToken };
}
