import { computed, Injectable, signal, Signal, WritableSignal, ɵunwrapWritableSignal } from '@angular/core';

const TOKEN_KEY = 'auth-token';
const REFRESHTOKEN_KEY = 'auth-refreshtoken';
const USER_KEY = 'auth-user';

@Injectable({
  providedIn: 'root'
})
export class TokenService {
    constructor() {}

    public _isLoggedIn: WritableSignal<boolean> = signal(false);
    public readonly isLoggedIn: Signal<boolean> = computed(() => this._isLoggedIn());

    public set token(value: string | null) {
        localStorage.removeItem(TOKEN_KEY);
        if (typeof value === "string") {
            localStorage.setItem(TOKEN_KEY, value as string);
        }
    }

    public get token(): string | null {
        let t = localStorage.getItem(TOKEN_KEY);
        return (typeof t === "string") ? t as string : null;
    }

    public set refreshToken(value: string | null) {
        localStorage.removeItem(REFRESHTOKEN_KEY);
        if (typeof value === "string") {
            localStorage.setItem(REFRESHTOKEN_KEY, value as string);
            this._isLoggedIn.set(true);
        } else {
            this._isLoggedIn.set(false);
        }
    }

    public get refreshToken(): string {
        let t = localStorage.getItem(REFRESHTOKEN_KEY);
        return (typeof t === "string") ? t as string : "";
    }

    public set userid(userid: string) {
        localStorage.removeItem(USER_KEY);
        localStorage.setItem(USER_KEY, JSON.stringify(userid));
    }

    public get userid(): string {
        let t = localStorage.getItem(USER_KEY);
        return (typeof t === "string") ? t as string : "";
    }

}
