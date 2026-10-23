const COGNITO_CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID || "";
const COGNITO_REGION = import.meta.env.VITE_AWS_REGION || "us-east-1";

const COGNITO_ENDPOINT = `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/`;

interface CognitoResponse {
  AuthenticationResult?: {
    AccessToken: string;
    IdToken: string;
    RefreshToken: string;
  };
  UserSub?: string;
  message?: string;
  __type?: string;
}

async function cognitoRequest(target: string, payload: Record<string, unknown>): Promise<CognitoResponse> {
  if (!COGNITO_CLIENT_ID) {
    // If not yet configured, allow local testing mock token
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

  const res = await fetch(COGNITO_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Target": `AWSCognitoIdentityProviderService.${target}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.__type || "Authentication request failed");
  }
  return data;
}

export async function signUp(email: string, password: string) {
  return cognitoRequest("SignUp", {
    ClientId: COGNITO_CLIENT_ID,
    Username: email,
    Password: password,
    UserAttributes: [{ Name: "email", Value: email }],
  });
}

export async function confirmSignUp(email: string, code: string) {
  return cognitoRequest("ConfirmSignUp", {
    ClientId: COGNITO_CLIENT_ID,
    Username: email,
    ConfirmationCode: code,
  });
}

export async function signIn(email: string, password: string) {
  const res = await cognitoRequest("InitiateAuth", {
    AuthFlow: "USER_PASSWORD_AUTH",
    ClientId: COGNITO_CLIENT_ID,
    AuthParameters: {
      USERNAME: email,
      PASSWORD: password,
    },
  });

  return {
    accessToken: res.AuthenticationResult?.AccessToken || "",
    idToken: res.AuthenticationResult?.IdToken || "",
  };
}
