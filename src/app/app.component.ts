import { Component } from '@angular/core';
import { MatMenuModule } from "@angular/material/menu";
import { MatIconModule } from "@angular/material/icon";
import { RouterModule } from '@angular/router';

export const WEB_URL = "http://localhost:8000/";
export const API_URL = WEB_URL + "";

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterModule,
    MatMenuModule,
    MatIconModule,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'Tools_Web';
}
