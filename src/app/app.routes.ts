import { Routes } from '@angular/router';

export const routes: Routes = [
    {path: '', redirectTo: '/login', pathMatch: 'full' },
  
    {path: 'login', loadComponent: () => import('./user/login/login.component').then(m => m.LoginComponent), title: "Login"},
    {path: 'map', loadComponent: () => import('./map/map.component').then(m => m.MapComponent), title: "Map"},
];
