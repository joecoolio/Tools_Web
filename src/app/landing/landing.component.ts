import { Component, OnInit, AfterViewInit } from "@angular/core";
import { MatCardModule } from "@angular/material/card";
import { MatMenuModule } from "@angular/material/menu";
import { MatIconModule } from "@angular/material/icon";

@Component({
    standalone: true,
    selector: 'app-map',
    imports: [
        MatMenuModule,
        MatIconModule,
        MatCardModule,
    ],
    templateUrl: './landing.component.html',
    styleUrl: './landing.component.scss',
})
export class LandingComponent implements OnInit, AfterViewInit {
    constructor() {}

    ngOnInit(): void {
        throw new Error("Method not implemented.");
    }
    ngAfterViewInit(): void {
        throw new Error("Method not implemented.");
    }
}
