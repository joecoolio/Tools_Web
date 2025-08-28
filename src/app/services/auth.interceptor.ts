import { HttpEvent, HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpHandler, HttpRequest } from '@angular/common/http';

import { TokenService } from './token.service';
import { AuthService, LoginResult } from './auth.service';

import { EMPTY, Observable, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { NavigationExtras, Router } from '@angular/router';
import { environment } from '../../environments/environment'

const API_URL = environment.baseUrl;

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
    private isRefreshing = false;

    constructor(
        private tokenService: TokenService,
        private authService: AuthService,
        private router: Router,
    ) { }

    intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<Object>> {
        // Only intercept requests going to our api, not external places
        if (! req.url.startsWith(API_URL)) {
            // console.log("Ignored: " + req.url);
            return next.handle(req);
        }

        // Put the access token onto each outgoing http request
        const token = this.tokenService.token;
        if (token != null) {
            // We have a token, add it to the request
            let authReq = this.addAccessTokenHeader(req, token);

            // Watch responses for 400 statuses.  If you find one, refresh the token and try again.
            return next.handle(authReq).pipe(
                catchError((error: HttpErrorResponse) => {
                    if (error instanceof HttpErrorResponse) {
                        console.log("Intercept error status: " + error.status);
                        console.log("Intercept error text: " + error.statusText);

                        // 400 is returned when an access token is no good
                        if (error.status === 400) {
                            return this.refreshToken(authReq, next);
                        }

                        // 401 is returned when an access token is no good
                        if (error.status === 401) {
                            // If you get here, the refresh token is no good and you need to re-login
                            console.log("AuthInterceptor/intercept: refresh token is expired");
                            this.tokenService.refreshToken = null;
                            this.tokenService.token = null;

                            const navigationExtras: NavigationExtras = {state: {data: 'Your login has expired, please login again.'}};
                            // this.router.navigateByUrl('/login', navigationExtras);
                            this.router.navigate(['login'], navigationExtras);
    
                            throw new Error("Refresh token expired, redirecting to /login");
                        }
                    }

                    return throwError(() => error);
                })
            );
        } else {
            // We have no token, send without (for login/register/etc.)
            return next.handle(req);
        }
    }

    private refreshToken(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
        if (!this.isRefreshing) {
            this.isRefreshing = true;

            const token = this.tokenService.refreshToken;

            if (token) {
                return this.authService.refreshToken(token).pipe(
                    switchMap((resp: HttpResponse<LoginResult>) => {
                        let loginResult: LoginResult = resp.body as LoginResult;

                        this.isRefreshing = false;
                        return next.handle(this.addAccessTokenHeader(request, loginResult.access_token));
                    }),
                    catchError((err) => {
                        this.isRefreshing = false;

                        // If you get here, the refresh token is no good and you need to re-login
                        console.log("AuthInterceptor/Refresh: refresh token is expired");
                        this.tokenService.refreshToken = null;
                        this.tokenService.token = null;

                        const navigationExtras: NavigationExtras = {state: {data: 'Your login has expired, please login again.'}};
                        // this.router.navigateByUrl('/login', navigationExtras);
                        this.router.navigate(["", { outlets: { right: ["login"] } }], navigationExtras);

                        throw new Error("Refresh token expired, redirecting to /login");
                    })
                );
            }
        }
        return EMPTY;
    }

    private addAccessTokenHeader(request: HttpRequest<any>, token: string) {
        return request.clone({ headers: request.headers.set('Authorization', 'Bearer ' + token) });
    }
}
