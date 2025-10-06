// auth-redirect.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { TokenService } from './services/token.service';

export const rootRedirectGuard: CanActivateFn = () => {
    const tokenService = inject(TokenService);
    const router = inject(Router);

    if (tokenService.isLoggedIn()) {
        console.log("Redirect to /home");
        router.navigate(['/home']);
        return false;
    }

    return true;
};
