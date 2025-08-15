import { Routes } from '@angular/router';

export const routes: Routes = [
    {path: '', redirectTo: '/login', pathMatch: 'full' },

    {path: 'home', loadComponent: () => import('./landing/landing.component').then(m => m.LandingComponent), title: "Home"},
    {path: 'friends', loadComponent: () => import('./user/friends/managefriends.component').then(m => m.ManageFriendsComponent), title: "Manage Friends"},
    


    {path: 'register', loadComponent: () => import('./user/register/register.component').then(m => m.RegisterComponent), title: "Register"},
    {path: 'login', loadComponent: () => import('./user/login/login.component').then(m => m.LoginComponent), title: "Login"},
    {path: 'main', loadComponent: () => import('./main/main.component').then(m => m.MainComponent), title: "Map"},
];
