import { HttpClient, HttpHeaders, HttpResponse } from '@angular/common/http';
import { filter, firstValueFrom, Observable, tap, timeout } from 'rxjs';
import { TokenService } from './token.service';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment'

const API_URL = environment.baseUrl;

// Timeout for remote calls
const HTTP_TIMEOUT: number = 5000;

const httpOptions = {
  headers: new HttpHeaders({ 'Content-Type': 'application/json' })
};

export interface RegisterData {
    userid: string,
    name: string,
    password: string,
    address: string,
}

export interface LoginResult {
    access_token: string,
    token_type: string,
    expires_in: number,
    refresh_token: string
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
    constructor(private http: HttpClient, private tokenStorage: TokenService) { }

    // Register
    register(formData: FormData): Observable<HttpResponse<LoginResult>> {
        const userid: string = (formData.get('userid') as string) ?? '';
        console.log('Authservice Register: ' + userid);
        
        return this.http.post<LoginResult>(
            API_URL + 'v1/auth/register',
            formData,
            { observe: 'response' }
        ).pipe(
            timeout(HTTP_TIMEOUT),
            filter(event => event instanceof HttpResponse),
            tap<HttpResponse<LoginResult>>(
                response => this.processResultTokens(response, userid)
            )
        );   
    }

    // Login
    login(userid: string, password: string): Observable<HttpResponse<LoginResult>> {
        const body = {
            userid: userid,
            password: password,
        };
        console.log('Authservice Login: ' + userid);

        return this.http.post<LoginResult>(
            API_URL + 'v1/auth/login',
            body,
            { observe: 'response' }
        ).pipe(
            timeout(HTTP_TIMEOUT),
            filter(event => event instanceof HttpResponse),
            tap<HttpResponse<LoginResult>>(
                response => this.processResultTokens(response, userid)
            )
        );
    }

    private processResultTokens(response: HttpResponse<LoginResult>, userid: string) {
        if (response.status == 200) {
            // this._lastExecutionTime = parseFloat(response.headers.get('ExecutionTime'));
            // console.log("exec time:", this._lastExecutionTime);
            let loginResult: LoginResult = response.body as LoginResult;
            console.log("Authservice: saving new tokens");
            this.tokenStorage.token = loginResult.access_token;
            this.tokenStorage.refreshToken = loginResult.refresh_token;
            this.tokenStorage.userid = userid;
        }
    }

    // Refresh token
    refreshToken(token: string): Observable<HttpResponse<LoginResult>> {
        const body = {
            grant_type: 'refresh_token',
            refresh_token: token
        };
        console.log('Authservice Refresh Token');

        return this.http.post<LoginResult>(
            API_URL + 'v1/auth//refresh',
            body,
            { observe: 'response' }
        ).pipe(
            timeout(HTTP_TIMEOUT),
            filter(event => event instanceof HttpResponse),
            tap<HttpResponse<LoginResult>>(
                response => {
                    if (response.status == 200) {
                        let loginResult: LoginResult = response.body as LoginResult;

                        this.tokenStorage.token = loginResult.access_token;
                        this.tokenStorage.refreshToken = loginResult.refresh_token;
                    }
                }
            ),
        )
    }

    logout() {
        this.tokenStorage.userid = "";
        this.tokenStorage.refreshToken = null;
        this.tokenStorage.token = null;

        console.log("Logged out and deleted tokens");
    }
}
