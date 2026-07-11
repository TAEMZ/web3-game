import { API_URL } from "@/config";
import type { User } from "@arena/types";

// After an explicit logout we keep the wallet CONNECTED, but must stop <WalletAuth>
// from silently re-authenticating from it (that was the "logout bounces me back"
// bug). This flag suppresses that auto-login until the user deliberately signs in.
const SIGNED_OUT_KEY = "chess:signedOut";
export const markSignedOut = () => {
    try {
        localStorage.setItem(SIGNED_OUT_KEY, "1");
    } catch {
        /* ignore */
    }
};
export const clearSignedOut = () => {
    try {
        localStorage.removeItem(SIGNED_OUT_KEY);
    } catch {
        /* ignore */
    }
};
export const isSignedOut = () => {
    try {
        return localStorage.getItem(SIGNED_OUT_KEY) === "1";
    } catch {
        return false;
    }
};

export const fetchSession = async () => {
    try {
        const res = await fetch(`${API_URL}/v1/auth`, {
            credentials: "include"
        });

        if (res && res.status === 200) {
            const user: User = await res.json();
            return user;
        }
    } catch (err) {
        // do nothing
    }
};

export const setGuestSession = async (name: string) => {
    try {
        const res = await fetch(`${API_URL}/v1/auth/guest`, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ name })
        });
        if (res.status === 201) {
            const user: User = await res.json();
            clearSignedOut();
            return user;
        }
    } catch (err) {
        console.error(err);
    }
};

export const register = async (name: string, password: string, email?: string) => {
    try {
        const res = await fetch(`${API_URL}/v1/auth/register`, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ name, password, email })
        });
        if (res.status === 201) {
            const user: User = await res.json();
            clearSignedOut();
            return user;
        } else if (res.status === 409 || res.status === 400) {
            const { message } = await res.json().catch(() => ({}));
            if (message) return message as string;
        }
    } catch (err) {
        console.error(err);
    }
};

export const login = async (name: string, password: string) => {
    try {
        const res = await fetch(`${API_URL}/v1/auth/login`, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ name, password })
        });
        if (res.status === 200) {
            const user: User = await res.json();
            clearSignedOut();
            return user;
        } else if (res.status === 404 || res.status === 401) {
            const { message } = await res.json();
            return message as string;
        }
    } catch (err) {
        console.error(err);
    }
};

export const walletLogin = async (
    address: string,
    signMessage: (message: string) => Promise<string>
) => {
    try {
        const nonceRes = await fetch(`${API_URL}/v1/auth/wallet/nonce`, {
            credentials: "include"
        });
        if (nonceRes.status !== 200) return;
        const { nonce } = await nonceRes.json();
        const signature = await signMessage(`Sign in to Chess Arena.\n\nNonce: ${nonce}`);
        const res = await fetch(`${API_URL}/v1/auth/wallet`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ address, signature })
        });
        if (res.status === 200) {
            const user: User = await res.json();
            return user;
        }
    } catch (err) {
        console.error(err);
    }
};

export const logout = async () => {
    try {
        const res = await fetch(`${API_URL}/v1/auth/logout`, {
            method: "POST",
            credentials: "include"
        });
        if (res.status === 204) {
            return true;
        }
    } catch (err) {
        console.error(err);
    }
};

export const updateUser = async (name?: string, email?: string, password?: string) => {
    try {
        if (!name && !email && !password) return;
        const res = await fetch(`${API_URL}/v1/auth/`, {
            method: "PATCH",
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ name, email, password })
        });
        if (res.status === 200) {
            const user: User = await res.json();
            return user;
        } else if (res.status === 409) {
            const { message } = await res.json();
            return message as string;
        }
    } catch (err) {
        console.error(err);
    }
};
