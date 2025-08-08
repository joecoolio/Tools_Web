import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

export const WEB_URL = "http://localhost:8000/";
export const API_URL = WEB_URL + "";

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'Tools_Web';
}
