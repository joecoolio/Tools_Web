import { inject } from '@angular/core';
import { CanActivateFn, RedirectCommand, Router } from '@angular/router';
import { TokenService } from './services/token.service';

export const authGuard: CanActivateFn = (route, state) => {
  const tokenService = inject(TokenService);
  const router = inject(Router);
  
  if (tokenService.isLoggedIn()) {
    return true;
  } else {
    const loginPath = router.parseUrl("/login");
    return new RedirectCommand(loginPath, { skipLocationChange: true });
  }
};
