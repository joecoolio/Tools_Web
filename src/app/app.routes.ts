import { Routes } from '@angular/router';
import { authGuard } from "./auth-guard";

export const routes: Routes = [
    {path: '', redirectTo: '/login', pathMatch: 'full' },

    // Must be logged in for this stuff
    {path: 'home', loadComponent: () => import('./landing/landing.component').then(m => m.LandingComponent), title: "Home", canActivate: [authGuard] },
    {path: 'friends', loadComponent: () => import('./user/friends/managefriends.component').then(m => m.ManageFriendsComponent), title: "Manage Friends", canActivate: [authGuard] },

    // Login & register
    {path: 'register', loadComponent: () => import('./user/register/register.component').then(m => m.RegisterComponent), title: "Register"},
    {path: 'login', loadComponent: () => import('./user/login/login.component').then(m => m.LoginComponent), title: "Login"},
];
