
export async function generateCodeVerifier(): Promise<string> {
    const array = new Uint8Array(32);
    window.crypto.getRandomValues(array);
    return base64UrlEncode(array);
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = new Uint8Array(hashBuffer);
    return base64UrlEncode(hashArray);
}

function base64UrlEncode(buffer: Uint8Array): string {
    const binary = String.fromCharCode(...buffer);
    const base64 = btoa(binary);
    return base64
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}
